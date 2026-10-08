"""Import the user-selected MIT art-motion engine; retain notices, exclude identity artwork."""
from pathlib import Path
import argparse,hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[1]
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);a=ap.parse_args()
    src=Path(a.source).resolve();dst=ROOT/'lib/art_motion';refs=ROOT/'references/art_motion'
    assert (src/'LICENSE').is_file() and (src/'scripts/engine/clip.js').is_file()
    if (dst/'import_manifest.json').exists():
        raise SystemExit('Already imported. Compare upstream manifest and preserve local adapters before a versioned update.')
    records=[];excluded=[]
    for base,target in [(src/'scripts',dst/'scripts'),(src/'references',refs)]:
        for p in sorted(base.rglob('*')):
            if not p.is_file() or '__pycache__' in p.parts:continue
            rel=p.relative_to(base)
            if p.suffix.lower() in ['.png','.jpg','.gif'] and ('hero' in rel.parts or 'frames' in rel.parts):
                excluded.append(str(p.relative_to(src)).replace('\\','/'));continue
            out=target/rel;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
            if out.suffix.lower()=='.py':
                s=out.read_text(encoding='utf-8')
                s=s.replace('spec = json.loads(sp.read_text())','spec = json.loads(sp.read_text(encoding="utf-8"))')
                s=s.replace("p.chromium.launch(","p.chromium.launch(channel=__import__('os').environ.get('ART_MOTION_BROWSER', 'msedge'), ")
                s=s.replace('ff.stdin.close(); ff.wait()','ff.stdin.close();\n        if ff.wait() != 0: raise SystemExit("FFmpeg encoding failed")')
                out.write_text(s,encoding='utf-8')
            if out.suffix.lower()=='.md' and target==refs:
                s=out.read_text(encoding='utf-8').replace('花叔','创作者')
                out.write_text(s,encoding='utf-8')
            records.append({'source':str(p.relative_to(src)).replace('\\','/'),'destination':str(out.relative_to(ROOT)).replace('\\','/'),'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'import_sha256':hashlib.sha256(out.read_bytes()).hexdigest()})
    shutil.copy2(src/'LICENSE',dst/'LICENSE')
    notice='''# Imported art-motion engine\n\nCode and method documentation adapted from huashu-art-motion by Huashu, under the attached MIT license. Source selected by the user.\nFonts retain their individual OFL licenses in scripts/engine/lib/fonts/.\nStroke data retains the Arphic license beside scripts/engine/reference_films/spacex/spacex_wb/assets/strokes.js.\nAuthor identity raster artwork is excluded. Demonstration replacements are original project assets; they do not inherit the source author identity.\nImported historical examples and measurements describe the upstream project, not current facts or local validation.\nLocal runtime changes: UTF-8 IO, configured installed browser and encoding error propagation. See integration guide for additional adapters and actual validation.\n'''
    (dst/'NOTICE.md').write_text(notice,encoding='utf-8')
    (dst/'import_manifest.json').write_text(json.dumps({'upstream':'huashu-art-motion','license':'MIT + font OFL + stroke Arphic','files':records,'excluded_identity_artwork':excluded},ensure_ascii=False,indent=2),encoding='utf-8')
    print('Imported',len(records),'files; excluded',len(excluded),'identity images')
if __name__=='__main__':main()
