"""Portable bridge for imported art-motion and the live handdraw library."""
from pathlib import Path
import argparse,base64,copy,hashlib,json,os,shutil,subprocess,sys,math,wave
ROOT=Path(__file__).resolve().parents[1]
BUNDLE=ROOT/'lib/art_motion'
SCRIPTS=BUNDLE/'scripts';ENGINE=SCRIPTS/'engine'
def project_root():
    for p in ROOT.parents:
        if (p/'styles_200_reorganized.md').exists():return p
    raise RuntimeError('Cannot locate project handdraw style library')
def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def save(p,x):p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def runtime_env():
    e=os.environ.copy();e['PYTHONUTF8']='1';e['PYTHONIOENCODING']='utf-8';e.setdefault('ART_MOTION_BROWSER','msedge')
    # Prefer PATH; fallbacks match the workspace's existing video tooling.
    dirs=[]
    for command,fallback in [('ffmpeg','D:/tools/npm-global/node_modules/ffmpeg-static/ffmpeg.exe'),('ffprobe','D:/tools/npm-global/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe')]:
        resolved=shutil.which(command) or (fallback if Path(fallback).exists() else None)
        if not resolved:raise RuntimeError(f'Missing {command}; configure PATH')
        dirs.append(str(Path(resolved).parent))
    e['PATH']=os.pathsep.join(dirs+[e.get('PATH','')]);return e
def run_script(p,args):return subprocess.run([sys.executable,'-X','utf8',str(p),*map(str,args)],env=runtime_env(),check=True)
def catalog():
    return {'art_scenes':[p.stem for p in sorted((ENGINE/'scenes').glob('[0-9]*.js'))],
      'grammars':[p.stem for p in sorted((ENGINE/'clips').glob('*.js'))],
      'upstream_grammar_cards':[p.stem for p in sorted((ROOT/'references/art_motion/动画语法').glob('*.md'))],
      'methods':[p.name for p in sorted((ROOT/'references/art_motion').glob('[0-9]*.md'))],
      'routes':['analyze','native art scenes','clip','narration film','long scroll','sprites','music','qa'],
      'external_video_generation':'method available; requires separately configured provider, no fake local endpoint'}
def bind(spec_path,out_path):
    src=Path(spec_path).resolve();spec=read(src);hand=spec.setdefault('handdraw',{});project=project_root();library=project/'skills/handdraw-style-prompter'
    assert spec.get('grammar') in catalog()['grammars'],'Unknown grammar'
    assert isinstance(spec.get('duration'),(int,float)) and math.isfinite(spec['duration']) and spec['duration']>0
    for name,default in [('width',1920),('height',1080),('fps',30)]:
        spec.setdefault(name,default);assert isinstance(spec[name],int) and spec[name]>0
    assert spec['width']%2==0 and spec['height']%2==0
    for q in spec.get('cues',[]):assert 0<=q.get('at',0)<spec['duration'],'Cue outside duration'
    binding={'source_spec_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'asset_paths':[],'style_status':'not specified','layout_status':'not specified'}
    if hand.get('style_code'):
        code=str(hand['style_code']).strip().lstrip('#')
        r=subprocess.run([sys.executable,'-X','utf8',str(library/'scripts/resolve_reference.py'),'--model',hand.get('model','gpt-image-2'),'--style',code],capture_output=True,text=True,encoding='utf-8',check=True)
        binding['style']=json.loads(r.stdout);binding['style_status']='resolved for asset generation; renderer does not emulate arbitrary style IDs'
        hand['style_code']=binding['style']['style']
        style_record=next(x for x in read(library/'references/styles.json') if x['number']==hand['style_code'])
        binding['style_record']=style_record
        binding['asset_prompt_style']='，'.join(filter(None,[style_record.get('reference'),style_record.get('generation_name'),binding['style'].get('prompt_traits')]))
    if hand.get('style_description'):binding['style_description']=hand['style_description']
    if hand.get('layout_code'):
        layout=next((x for x in read(library/'references/layouts.json') if x['id']==hand['layout_code']),None)
        if not layout:raise ValueError('Unknown layout ID')
        binding['layout']={**layout,'prompt':(library/'references'/layout['prompt_file']).read_text(encoding='utf-8')};binding['layout_status']='resolved; review actual regions against layout rules'
    colors=read(library/'references/colors.json');binding['colors']=[]
    for code in hand.get('color_codes',[]):
        value=next((x for x in colors if x['id']==code),None)
        if not value:raise ValueError('Unknown color ID: '+code)
        binding['colors'].append(value)
    binding['palette_status']='render palette is explicit CSS; color IDs describe generation palette and do not invent hex values'
    def refs(value):
        if isinstance(value,dict):
            for k,v in list(value.items()):
                if k=='image' and isinstance(v,str) and v and not v.startswith('data:'):
                    if v.startswith(('http:','https:')):raise ValueError('Import external media as authorized local assets before rendering')
                    p=(src.parent/v).resolve()
                    if not p.is_file():raise FileNotFoundError(p)
                    mime={'.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg'}.get(p.suffix.lower())
                    if not mime:raise ValueError('Raster asset format unsupported: '+str(p))
                    binding['asset_paths'].append({'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
                    value[k]='data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
                else:refs(v)
        elif isinstance(value,list):
            for v in value:refs(v)
    refs(spec)
    if hand.get('style_code') and not binding['asset_paths'] and not hand.get('native_style_implemented'):
        raise ValueError('Style code resolved but no actual style assets: provide images or an explicitly implemented native style; a label is not a render effect')
    if hand.get('native_style_implemented'):binding['native_style_claim']='user/producer supplied; requires visual validation'
    hand['binding']=binding;save(out_path,spec);save(Path(out_path).with_suffix('.binding.json'),binding);return Path(out_path)
def music(out,duration,bpm,seed):
    import numpy as np
    sr=48000;t=np.arange(round(duration*sr))/sr;s=np.zeros(len(t));notes=[261.63,329.63,392,440,392,329.63,293.66,261.63]
    for i,start in enumerate(np.arange(0,duration,120/bpm)):
        u=t-start;mask=(u>=0)&(u<6);tau=u[mask];f=notes[(i+seed)%len(notes)]
        s[mask]+=.10*(np.sin(2*np.pi*f*tau)+.3*np.sin(2*np.pi*f*2*tau))*(1-np.exp(-tau*12))*np.exp(-tau*.9)
    s*=np.minimum(t/1,1)*np.minimum((duration-t)/2,1);s*=min(1,.7/max(.001,float(abs(s).max())))
    p=Path(out);p.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(p),'wb') as f:f.setparams((2,2,sr,0,'NONE','not compressed'));f.writeframes(np.stack([s,s],axis=1).__mul__(32767).astype('<i2').tobytes())
    save(p.with_suffix('.json'),{'original_composition':True,'duration':duration,'sample_rate':sr,'bpm':bpm,'seed':seed,'true_peak_not_measured':'check encoded final mix'})
def main(argv=None):
    ap=argparse.ArgumentParser(description='Handdraw art-motion bridge');sub=ap.add_subparsers(dest='cmd',required=True)
    sub.add_parser('catalog')
    for cmd in ['bind','render','qa']:
        p=sub.add_parser(cmd);p.add_argument('--spec');p.add_argument('--out',required=True)
        if cmd!='bind':p.add_argument('--film');p.add_argument('--project');p.add_argument('--solo');p.add_argument('--stills');p.add_argument('--alpha',action='store_true');p.add_argument('--audio')
    p=sub.add_parser('analyze');p.add_argument('--video',required=True);p.add_argument('--out',required=True)
    p=sub.add_parser('music');p.add_argument('--out',required=True);p.add_argument('--duration',type=float,default=15);p.add_argument('--bpm',type=float,default=86);p.add_argument('--seed',type=int,default=1)
    p=sub.add_parser('sprites');p.add_argument('--tool',choices=['key_green','key_split','font_subset'],required=True);p.add_argument('args',nargs=argparse.REMAINDER)
    a=ap.parse_args(argv)
    if a.cmd=='catalog':print(json.dumps(catalog(),ensure_ascii=False,indent=2));return
    if a.cmd=='bind':
        if not a.spec:ap.error('bind requires --spec')
        print(bind(a.spec,a.out));return
    if a.cmd=='music':
        if not (0<a.duration<=3600 and 0<a.bpm<=300):ap.error('invalid duration/bpm')
        music(a.out,a.duration,a.bpm,a.seed);return
    if a.cmd=='analyze':run_script(SCRIPTS/'analyze/breakdown.py',['--video',a.video,'--out',a.out]);return
    if a.cmd=='sprites':run_script(SCRIPTS/(a.tool+'.py'),a.args[1:] if a.args[:1]==['--'] else a.args);return
    args=['--out',a.out]
    if a.spec:
        bound=Path(a.out).resolve().parent/(Path(a.spec).stem+'.bound.json');bind(a.spec,bound);args+=['--spec',str(bound)]
    elif a.cmd=='qa':args+=['--project',a.project or str(ENGINE)]
    if a.film:args+=['--film',a.film]
    if a.cmd=='render':
        if a.project:raise ValueError('For custom engine project use its render.py; wrapper render uses bundled engine')
        if a.solo:args+=['--solo',a.solo,'--no-counter']
        if a.stills:args+=['--stills',a.stills]
        if a.alpha:args+=['--alpha']
        if a.audio:args+=['--audio',a.audio]
    elif any([a.solo,a.stills,a.alpha,a.audio]):raise ValueError('render options supplied to qa')
    run_script(ENGINE/'render.py' if a.cmd=='render' else SCRIPTS/'qa.py',args)
if __name__=='__main__':main()
