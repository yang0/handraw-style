"""Extract project-owned animation atlas frames with recorded source rectangles; no image generation."""
from pathlib import Path
import base64,json,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
def main():
    project=next(p for p in ROOT.parents if (p/'styles_200_reorganized.md').exists())
    src=project/'videos/episodes/2026-10-08 让画回应你/assets'
    dest=ROOT/'lib/art_motion/scripts/engine/demos/long_scroll/frames'
    meta=json.loads((src/'sprite_metadata.json').read_text(encoding='utf-8'));records=[]
    groups={'egypt_walk8':('ink',[1,1,2,2,3,3,4,4]),'egypt_dodge':('ink',[0,9,9,10,10,11,0,0]),'monet_walk':('paint',[1,1,2,2,3,3,4,4]),'monet_throw':('paint',[0,5,0,6,7,8,0,0]),'8bit_walk':('pixel',[1,1,2,2,3,3,4,4]),'8bit_act':('pixel',[0,9,10,10,10,11,8,0])}
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge');page=browser.new_page()
        for key,(style,indices) in groups.items():
            folder=dest/key;folder.mkdir(parents=True,exist_ok=True);frames=[]
            atlas=src/(style+'_atlas.png');url='data:image/png;base64,'+base64.b64encode(atlas.read_bytes()).decode()
            page.evaluate('''async url=>{window.srcImage=new Image();srcImage.src=url;await srcImage.decode()}''',url)
            for i,index in enumerate(indices):
                f=meta[style]['frames'][index];x,y,w,h=f['crop'];file=f'{i+1:02d}.png'
                data=page.evaluate('''r=>{const c=document.createElement('canvas');c.width=r[2];c.height=r[3];c.getContext('2d').drawImage(srcImage,...r,0,0,r[2],r[3]);return c.toDataURL('image/png').split(',')[1]}''',f['crop'])
                (folder/file).write_bytes(base64.b64decode(data));frames.append({'file':file,'ax':f['foot'][0],'ay':f['foot'][1],'w':w,'h':h,'air':0,'pose':f['pose'],'source_rect':f['crop']})
            (folder/'meta.json').write_text(json.dumps({'ref_h':meta[style]['ref_height'],'frames':frames,'identity':'project original traveler, not source author','animation':'four distinct walking poses held across eight slots; finite interaction keyframes'},ensure_ascii=False,indent=2),encoding='utf-8')
            records.append({'key':key,'source_atlas_sha256':hashlib.sha256(atlas.read_bytes()).hexdigest(),'source':str(atlas.relative_to(project)),'poses':[f['pose'] for f in frames]})
        browser.close()
    (dest/'handdraw_demo_manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Prepared 48 frame files from project original atlases; action naturalness requires visual review')
if __name__=='__main__':main()
