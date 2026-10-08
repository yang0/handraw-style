"""Offline integration gates: all scenes, nine clip APIs, real styles/assets, reload and encoding."""
from pathlib import Path
import sys,json,base64,http.server,functools,threading,io,subprocess,os
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'bin'))
from art_motion import ENGINE,catalog,bind,save,read,runtime_env
PROJECT=next(p for p in ROOT.parents if (p/'styles_200_reorganized.md').exists())
OUT=PROJECT/'tmp/art-motion-validation';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
def main():
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ENGINE)));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    url=f'http://127.0.0.1:{server.server_address[1]}';results=[]
    try:
      with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='msedge');page=browser.new_page(viewport={'width':1920,'height':1080});errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        def ready():
            page.wait_for_function('window.__ready || window.__bootFailed',timeout=180000)
            failure=page.evaluate('window.__bootFailed || null');assert not failure,failure
            assert not errors,errors
        page.goto(url+'/index.html?render=1&film=gallery');ready()
        ids=page.evaluate('ERAS.map(x=>x.id)')
        assert set(catalog()['art_scenes']).issubset(set(ids))
        for scene in catalog()['art_scenes']:
            page.evaluate('id=>renderSolo(id,.5,{counter:false})',scene);a=page.evaluate('__canvas.toDataURL()');page.evaluate('id=>renderSolo(id,.5,{counter:false})',scene);assert a==page.evaluate('__canvas.toDataURL()'),scene
            page.evaluate('id=>renderSolo(id,0,{counter:false})',scene);page.evaluate('id=>renderSolo(id,.5,{counter:false})',scene);assert a==page.evaluate('__canvas.toDataURL()'),(scene,'reverse seek')
            results.append({'scene':scene,'load':True,'same_time_deterministic':True,'reverse_seek':True})
        for grammar in catalog()['grammars']:
            print('CHECK',grammar,flush=True)
            if grammar=='y6_presenter_explainer':spec={'grammar':grammar,'duration':3,'cues':[{'at':0,'kind':'point','text':'用原创讲解员解释一个概念'},{'at':1,'kind':'point','text':'画面与声音相互对应','data':{'pose':'point'}}]}
            else:spec=read(ENGINE/'examples'/f'{grammar}.json')
            spec['handdraw']={'render':{'palette':{'paper':'#fff8e8','accent':'#7f9981','ink':'#26364a'}}}
            for portrait in [False,True]:
                spec['width'],spec['height']=(1080,1920) if portrait else (1920,1080);spec['safe']={'bottom':220 if portrait else 100}
                source=OUT/f'{grammar}-{portrait}.json'
                # Upstream examples' files are resolved relative to their original example directory.
                for cue in spec.get('cues',[]):
                    if cue.get('image') and not cue['image'].startswith('data:'):cue['image']=str((ENGINE/'examples'/cue['image']).resolve())
                save(source,spec);bound=bind(source,OUT/f'{grammar}-{portrait}.bound.json');value=read(bound)
                page.close();page=browser.new_page(viewport={'width':spec['width'],'height':spec['height']});page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.CLIP_SPEC='+json.dumps(value,ensure_ascii=False));page.goto(url+'/clip.html?render=1');ready()
                times=[.1,spec['duration']*.5,spec['duration']-1/30]
                for t in times:
                    page.evaluate('t=>renderFrame(t)',t);a=page.evaluate('__canvas.toDataURL("image/png")');page.evaluate('renderFrame(0)');page.evaluate('t=>renderFrame(t)',t);assert a==page.evaluate('__canvas.toDataURL("image/png")'),(grammar,t)
                    im=Image.open(io.BytesIO(base64.b64decode(a.split(',')[1])));assert im.size==(spec['width'],spec['height'])
                page.screenshot(path=str(OUT/f'{grammar}-{portrait}.png'))
                page.reload();ready();page.evaluate('t=>renderFrame(t)',times[-1]);assert a==page.evaluate('__canvas.toDataURL("image/png")')
                results.append({'grammar':grammar,'portrait':portrait,'three_times_and_reload':True,'resolution':[spec['width'],spec['height']]})
        # Real categorized style and aliases resolve to the same binding, actual project image consumed.
        aliases=read(PROJECT/'skills/handdraw-style-prompter/references/style_alias_map.json')['legacy_to_new'];canonical=aliases['042']
        # Bundled project-owned artwork keeps this gate runnable after cloning the repo.
        image=ENGINE/'demos/long_scroll/frames/egypt_walk8/01.png'
        real={'grammar':'y3_whiteboard','duration':2,'handdraw':{'style_code':canonical,'color_codes':['C-34','C-10'],'layers':[{'image':str(image),'region':[.6,.3,.35,.4],'at':0}]},'cues':[{'at':0,'kind':'title','text':'真实手绘图层'}]}
        save(OUT/'handdraw.json',real);b=bind(OUT/'handdraw.json',OUT/'handdraw.bound.json');assert read(b)['handdraw']['binding']['asset_paths']
        real['handdraw']['style_code']='042';save(OUT/'legacy.json',real);legacy=bind(OUT/'legacy.json',OUT/'legacy.bound.json');assert read(b)['handdraw']['style_code']==read(legacy)['handdraw']['style_code']
        page.close();page=browser.new_page();page.add_init_script('window.CLIP_SPEC='+json.dumps(read(b),ensure_ascii=False));page.goto(url+'/clip.html?render=1');ready();assert page.evaluate('Object.keys(CLIP_CTX.HDIMG).length')==1
        # Missing images must stop binding instead of silently rendering a placeholder.
        real['handdraw']['layers'][0]['image']='missing-image.png';save(OUT/'missing.json',real)
        try:bind(OUT/'missing.json',OUT/'missing.bound.json');raise AssertionError('missing asset accepted')
        except FileNotFoundError:pass
        page.goto(url+'/index.html?render=1&film=demos/long_scroll');ready()
        for t in [1,5,9]:page.evaluate('t=>renderFrame(t)',t);assert page.evaluate('__canvas.width')==1920
        results.append({'long_scroll':'project original finite frames','sample_times':[1,5,9],'loaded':True,'aesthetic_and_contact_review':'not claimed'})
        assert not errors,errors;browser.close()
      env=runtime_env()
      for command in [
        [sys.executable,'-X','utf8',str(ROOT/'bin/art_motion.py'),'render','--spec',str(OUT/'handdraw.json'),'--out',str(OUT/'smoke.mp4')],
        [sys.executable,'-X','utf8',str(ROOT/'bin/art_motion.py'),'render','--spec',str(OUT/'handdraw.json'),'--alpha','--out',str(OUT/'smoke-alpha.mov')],
        [sys.executable,'-X','utf8',str(ROOT/'bin/art_motion.py'),'music','--duration','2','--out',str(OUT/'music.wav')]]:
        subprocess.run(command,check=True,env=env)
      ffprobe=__import__('shutil').which('ffprobe',path=env['PATH'])
      for name in ['smoke.mp4','smoke-alpha.mov']:
        info=json.loads(subprocess.run([ffprobe,'-v','error','-show_streams','-show_format','-of','json',str(OUT/name)],capture_output=True,check=True).stdout)
        v=next(x for x in info['streams']if x['codec_type']=='video');assert int(v['nb_frames'])==60 and abs(float(info['format']['duration'])-2)<.01
        if name.endswith('.mov'):assert 'yuva' in v['pix_fmt']
        results.append({'encoding':name,'frames':60,'duration':2,'pixel_format':v['pix_fmt']})
      save(ROOT/'lib/art_motion/integration_record.json',{'status':'runtime_and_static_checks_passed_awaiting_visual_review','checks':results,'all_scene_count':len(catalog()['art_scenes']),'clip_count':len(catalog()['grammars']),'reverse_seek_and_reload':True,'missing_assets_rejected':True,'style_alias_binding':True,'dynamic_review':'not performed','user_acceptance':'pending'})
      print('PASS:',len(results),'integration checks')
    finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
