"""Offline browser regression for panorama coverage, modes and replay safety."""
import base64, io, json, tempfile, unittest
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

class ScrollContract(unittest.TestCase):
    def test_scroll_modes_and_load_errors(self):
        with tempfile.TemporaryDirectory(prefix='scroll-check-',dir=ROOT/'tests') as tmp, sync_playwright() as p:
            tmp=Path(tmp);first=tmp/'a.png';second=tmp/'b.png'
            Image.new('RGB',(1280,720),'#254d42').save(first)
            Image.new('RGB',(1280,720),'#243a61').save(second)
            template=(ROOT/'lib/modes/scroll_template.html').read_text(encoding='utf-8')
            browser=p.chromium.launch(channel='msedge',args=['--allow-file-access-from-files'])
            page=browser.new_page(viewport={'width':1920,'height':1080})
            def load(**overrides):
                cfg=dict(width=1920,height=1080,duration=30,scenes=[{'url':first.as_uri()},{'url':second.as_uri()}],
                         panorama=True,showTitle=False,subtitleMode='sidecar',particleCount=0,cues=[{'start':0,'end':30,'text':'DO NOT BURN THIS IN'}])
                cfg.update(overrides);html=tmp/'scene.html';html.write_text(template.replace('/*SCROLL_CONFIG*/','window.CONFIG='+json.dumps(cfg)+';'),encoding='utf-8')
                page.goto(html.as_uri());page.evaluate('window.ready')
            load()
            self.assertEqual(page.evaluate('[canvas.width,canvas.height,canvas.clientWidth,canvas.clientHeight]'),[1920,1080,1920,1080])
            frame=page.evaluate('window.renderFrame(0)');im=Image.open(io.BytesIO(base64.b64decode(frame)))
            # No fallback silhouette or burned caption on a pure panorama.
            self.assertEqual(im.getpixel((538,799)),(37,77,66,255))
            load(cues=[]);self.assertEqual(frame,page.evaluate('window.renderFrame(0)'))
            # Opposite setting has a visible character: the switch truly works.
            load(panorama=False);self.assertNotEqual(frame,page.evaluate('window.renderFrame(0)'))
            load(particleCount=12)
            frame=page.evaluate('window.renderFrame(15)');page.evaluate('window.renderFrame(3)')
            self.assertEqual(frame,page.evaluate('window.renderFrame(15)'))
            page.reload();page.evaluate('window.ready');self.assertEqual(frame,page.evaluate('window.renderFrame(15)'))
            # Final viewport contains painted imagery, not an invented extra strip.
            self.assertEqual(page.evaluate('totalWorldWidth'),3620)
            with self.assertRaisesRegex(Exception,'Unable to load scroll scene'):
                load(scenes=[{'url':(tmp/'missing.png').as_uri()}])
            with self.assertRaisesRegex(Exception,'overlap must be smaller'):
                load(overlap=2000)
            with self.assertRaisesRegex(Exception,'does not cover'):
                load(scenes=[{'url':first.as_uri()}],width=2400)
            browser.close()

if __name__=='__main__': unittest.main()
