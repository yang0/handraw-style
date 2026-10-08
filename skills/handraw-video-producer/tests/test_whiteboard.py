"""Offline regression tests. --browser additionally checks Edge and H.264 output.

No TTS, ASR, image-generation or other paid/network requests are made.
"""
import argparse
import base64
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from PIL import Image, ImageChops

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
PROJECT=next((p for p in ROOT.parents if (p/'version.json').exists() or (p/'styles_200_reorganized.md').exists()),Path.cwd()).resolve()
sys.path.insert(0,str(ROOT/'lib'))
from frame_layout import resolve_frame
from whiteboard import build_config,prepare_whiteboard,validate_board
from subtitles import resolve_subtitle_mode,export_subtitles,SUBTITLE_MODES


def fixture(root,actual_asset=None):
    (root/'assets').mkdir();(root/'work').mkdir();(root/'outputs').mkdir()
    if actual_asset:
        shutil.copyfile(actual_asset,root/'assets'/'art.png')
        with Image.open(actual_asset) as im:w,h=im.size
        first=[0,0,w/3,h/2];last=[w*2/3,h/2,w/3,h/2]
    else:
        # Unit-only synthetic pixels, not production artwork or a visual deliverable.
        Image.new('RGBA',(32,32),(25,74,200,200)).save(root/'assets'/'art.png')
        first=last=[0,0,32,32]
    a={'path':'assets/art.png','source_rect':first}
    b={'path':'assets/art.png','source_rect':last}
    put_down={'path':'assets/art.png','source_rect':[0,h/2,w/3,h/2]} if actual_asset else a
    window={'path':'assets/art.png','source_rect':[w/3,h/2,w/3,h/2]} if actual_asset else b
    board={'version':1,'scenes':[
        {'id':'question','title':'遇到一个问题','layout':'hero','body':'先看现象，再找原因。','image':a},
        {'id':'steps','title':'两个可试的小动作','layout':'steps','items':[{'text':'放下手机','image':put_down},{'text':'看看窗外','image':window}]},
        {'id':'compare','title':'前后状态有何不同','layout':'compare','items':[{'text':'一直看屏幕','image':a},{'text':'留一点空白','image':b}]},
        {'id':'diagram','title':'用关系图讲清逻辑','layout':'diagram','nodes':['观察','寻找重点','再继续']}
    ]}
    timing={'duration':8.2,'segments':[{'text':s,'start':i*2+.1,'end':i*2+1.7} for i,s in enumerate(['先看清一个问题。','放下手机，看看窗外。','比较前后两个状态。','观察，寻找重点，再继续。'])]}
    (root/'storyboard.json').write_text(json.dumps(board,ensure_ascii=False),encoding='utf-8')
    return board,timing


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp_root=(PROJECT/'tmp'/'whiteboard-unit-tests').resolve();self.tmp_root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(prefix='hvp-unit-',dir=self.tmp_root)
        self.ep=Path(self.temp.name);self.board,self.timing=fixture(self.ep)
    def tearDown(self):
        assert self.ep.resolve().is_relative_to(self.tmp_root)
        self.temp.cleanup()
    def write_board(self,board):
        (self.ep/'storyboard.json').write_text(json.dumps(board,ensure_ascii=False),encoding='utf-8')
    def test_frame_presets_and_custom_dimensions(self):
        self.assertEqual(resolve_frame('16:9')['width'],1920)
        self.assertEqual(resolve_frame('9:16')['height'],1920)
        self.assertEqual(resolve_frame(width=1280,height=720,fps=24)['aspect_ratio'],'16:9')
        self.assertEqual(resolve_frame(width=720,height=1280)['orientation'],'portrait')
        self.assertEqual(resolve_frame(width=1000,height=1000)['orientation'],'square')
    def test_bad_dimensions_rejected_before_writes(self):
        for kwargs in ({'width':1280},{'width':719,'height':1280},{'aspect':'bad'},{'aspect':'0:9'},{'width':1280,'height':720,'aspect':'9:16'},{'fps':0}):
            with self.subTest(kwargs=kwargs),self.assertRaises(ValueError):resolve_frame(**kwargs)
    def test_complete_segments_and_full_text(self):
        c=build_config(self.ep,resolve_frame('16:9'),self.timing)
        self.assertEqual(len(c['scenes']),4);self.assertEqual(c['cues'][1]['text'],'放下手机，看看窗外。')
        self.assertEqual(c['scenes'][-1]['end'],8.2)
    def test_many_scenes_not_truncated(self):
        self.board['scenes']=[{'id':str(i),'title':f'第{i+1}个问题','layout':'diagram','nodes':['原因','结果']} for i in range(7)]
        self.write_board(self.board)
        timing={'duration':14,'segments':[{'text':f'完整句子{i}','start':i*2,'end':i*2+1.5} for i in range(7)]}
        self.assertEqual(len(build_config(self.ep,resolve_frame('9:16'),timing)['scenes']),7)
    def test_missing_image_fails(self):
        self.board['scenes'][0]['image']['path']='assets/missing.png';self.write_board(self.board)
        with self.assertRaisesRegex(ValueError,'素材不存在'):validate_board(self.ep)
    def test_source_rect_and_escape_fail(self):
        for image in ({'path':'../foreign.png'},{'path':'assets/art.png','source_rect':[0,0,500,500]}):
            self.board['scenes'][0]['image']=image;self.write_board(self.board)
            with self.subTest(image=image),self.assertRaises(ValueError):validate_board(self.ep)
    def test_missing_duplicate_or_reordered_speech_fails(self):
        for indices in ([0],[0,1],[2]):
            board=copy.deepcopy(self.board);board['scenes'][1]['segment_indices']=indices;self.write_board(board)
            with self.subTest(indices=indices),self.assertRaises(ValueError):build_config(self.ep,resolve_frame(),self.timing)
    def test_explicit_caption_lines_preserve_words(self):
        self.timing['segments'][1]['caption_lines']=['放下手机，','看看窗外。']
        c=build_config(self.ep,resolve_frame(),self.timing);self.assertEqual(c['cues'][1]['lines'],['放下手机，','看看窗外。'])
        self.timing['segments'][1]['caption_lines']=['偷换原句']
        with self.assertRaisesRegex(ValueError,'完整保留'):build_config(self.ep,resolve_frame(),self.timing)
    def test_subtitle_modes_keep_graphics_and_speech_timing(self):
        for ratio in ('16:9','9:16'):
            baseline=build_config(self.ep,resolve_frame(ratio),self.timing)
            self.assertEqual(baseline['subtitle_mode'],'burn-in') # Old episodes remain compatible.
            for mode in SUBTITLE_MODES:
                config=build_config(self.ep,{**resolve_frame(ratio),'subtitle_mode':mode},self.timing)
                self.assertEqual(config['subtitle_mode'],mode)
                for key in ('scenes','cues','duration','width','height','fps'):
                    self.assertEqual(config[key],baseline[key])
    def test_disabled_subtitles_do_not_require_caption_line_work(self):
        self.timing['segments'][1]['caption_lines']=['unused broken caption layout']
        for mode in ('sidecar','none'):
            config=build_config(self.ep,{'subtitle_mode':mode},self.timing)
            self.assertEqual(config['cues'][1]['text'],self.timing['segments'][1]['text'])
            self.assertNotIn('lines',config['cues'][1])
    def test_subtitle_policy_rejects_invalid_values(self):
        for mode in ('auto','off','NONE',None,False):
            with self.subTest(mode=mode),self.assertRaises(ValueError):resolve_subtitle_mode({'subtitle_mode':mode})
    def test_sidecar_export_uses_speech_not_graphic_text(self):
        for mode in ('sidecar','burn-in'):
            active=export_subtitles(self.ep,{'subtitle_mode':mode},self.timing)
            content=(self.ep/active).read_text(encoding='utf-8')
            self.assertIn('00:00:00,100 --> 00:00:01,700',content)
            self.assertIn(self.timing['segments'][1]['text'],content)
            self.assertNotIn(self.board['scenes'][1]['title'],content)
    def test_no_subtitles_preserves_archived_sidecar(self):
        archive=self.ep/'outputs/subtitles.srt';archive.write_bytes(b'archived original')
        self.assertIsNone(export_subtitles(self.ep,{'subtitle_mode':'none'},{}))
        self.assertEqual(archive.read_bytes(),b'archived original')
    def test_scene_capacity_explicit_not_silent_drop(self):
        self.board['scenes'][1]['items']*=3;self.write_board(self.board)
        with self.assertRaisesRegex(ValueError,'拆幕'):validate_board(self.ep)
    def test_cli_creates_both_frame_profiles_without_network(self):
        spec=importlib.util.spec_from_file_location('hvp_test',ROOT/'bin/hvp.py');hvp=importlib.util.module_from_spec(spec);spec.loader.exec_module(hvp)
        hvp.EPISODES_DIR=self.ep/'episodes'
        for ratio in ('16:9','9:16'):
            for mode in SUBTITLE_MODES:
                title=ratio.replace(':','-')+'-'+mode
                hvp.cmd_new(title,'whiteboard',aspect=ratio,subtitle_mode=mode)
                created=next(p for p in hvp.EPISODES_DIR.iterdir() if p.name.endswith(title))
                meta=json.loads((created/'episode.json').read_text(encoding='utf-8'))
                self.assertEqual(meta['aspect_ratio'],ratio);self.assertEqual(meta['status'],'draft_needs_storyboard')
                self.assertEqual(meta['subtitle_mode'],mode)
                with self.assertRaises(ValueError):hvp.cmd_tts(created) # Empty draft fails before a service call.
        for mode in ('none','sidecar'):
            with self.assertRaisesRegex(ValueError,'需核对'):hvp.cmd_new('unsupported-'+mode,'comic',subtitle_mode=mode)
            self.assertFalse(any(p.name.endswith('unsupported-'+mode) for p in hvp.EPISODES_DIR.iterdir()))
    def test_mix_no_subtitles_clears_active_link_not_archive(self):
        spec=importlib.util.spec_from_file_location('hvp_mix_test',ROOT/'bin/hvp.py');hvp=importlib.util.module_from_spec(spec);spec.loader.exec_module(hvp)
        meta={'mode':'whiteboard','subtitle_mode':'none','subtitles':'outputs/subtitles.srt'}
        (self.ep/'episode.json').write_text(json.dumps(meta),encoding='utf-8')
        (self.ep/'work/raw_video.mp4').write_bytes(b'fixture only')
        archive=self.ep/'outputs/subtitles.srt';archive.write_bytes(b'archived original')
        with patch.object(hvp,'mix_video') as mix:
            hvp.cmd_mix(self.ep)
            mix.assert_called_once()
        self.assertIsNone(json.loads((self.ep/'episode.json').read_text(encoding='utf-8'))['subtitles'])
        self.assertEqual(archive.read_bytes(),b'archived original')
    def test_actual_audio_duration_not_last_speech_boundary(self):
        import tts_engine
        class FakeSpeech:
            async def stream(self):
                yield {'type':'audio','data':b'unit-test-audio'}
                yield {'type':'SentenceBoundary','offset':0,'duration':10000000,'text':'测试'}
        with patch.object(tts_engine.edge_tts,'Communicate',return_value=FakeSpeech()),patch.dict(os.environ,{'HVP_FFPROBE':'test-probe'}),patch.object(tts_engine.subprocess,'run',return_value=SimpleNamespace(stdout='{"format":{"duration":"2.5"}}')):
            coro=tts_engine.synthesize('测试',self.ep/'work'/'test.mp3')
            # Fake stream has no asynchronous I/O; avoid Windows loopback setup.
            try:coro.send(None)
            except StopIteration as complete:result=complete.value
        self.assertEqual(result['duration'],2.5);self.assertEqual(result['segments'][0]['end'],1.0)


def browser_smoke(ffmpeg,ffprobe,asset):
    from playwright.sync_api import sync_playwright
    from render_engine import render_html_to_video
    if not ffmpeg or not ffprobe:raise RuntimeError('--browser需要ffmpeg/ffprobe或对应命令在PATH中')
    os.environ['HVP_FFMPEG']=ffmpeg
    review=PROJECT/'tmp'/'whiteboard-skill-validation';review.mkdir(parents=True,exist_ok=True)
    results=[]
    with tempfile.TemporaryDirectory(prefix='hvp-smoke-',dir=review) as folder:
        for aspect,mode in ((a,m) for a in ('16:9','9:16') for m in SUBTITLE_MODES):
            prefix=aspect.replace(':','x')+'_'+mode
            ep=Path(folder)/prefix;ep.mkdir();board,timing=fixture(ep,asset)
            meta={**resolve_frame(aspect),'title':'横竖屏通用知识示例','subtitle_mode':mode}
            html=prepare_whiteboard(ep,meta,timing,ROOT/'lib/modes/whiteboard_template.html')
            active=export_subtitles(ep,meta,timing)
            assert (active is None)==(mode=='none')
            if mode=='burn-in':baseline_frames={};baseline_graphics={};baseline_covers={}
            with sync_playwright() as p:
                browser=p.chromium.launch(channel='msedge');page=browser.new_page(viewport={'width':meta['width'],'height':meta['height']});errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)));page.goto(html.as_uri());page.evaluate('window.ready')
                first_box=None
                for i,t in enumerate((1.4,3.4,5.4,7.5,2.0,4.0,6.0)):
                    a=page.evaluate('t=>window.renderFrame(t)',t);page.evaluate('t=>window.renderFrame(t)',max(0,t-.7));b=page.evaluate('t=>window.renderFrame(t)',t)
                    assert a==b,'Non-deterministic seek';audit=page.evaluate('window.lastAudit');assert not audit['overflows'],audit
                    assert audit['subtitle_mode']==mode
                    graphics=[box for box in audit['textBoxes'] if box['role']=='graphic']
                    captions=[box for box in audit['textBoxes'] if box['role']=='subtitle']
                    speaking=any(s['start']<=t<s['end'] for s in timing['segments'])
                    assert len(captions)==int(mode=='burn-in' and speaking)
                    assert graphics,'Graphic titles/labels must survive removing narration subtitles'
                    im=Image.open(io.BytesIO(base64.b64decode(a)));assert im.size==(meta['width'],meta['height'])
                    if mode=='burn-in':baseline_frames[t]=im.copy();baseline_graphics[t]=graphics
                    else:
                        assert graphics==baseline_graphics[t],'Graphic content or layout changed'
                        delta=ImageChops.difference(im.convert('RGB'),baseline_frames[t].convert('RGB')).getbbox()
                        if speaking:assert delta and delta[1]>=meta['height']*.83 and delta[3]<=meta['height']*.95
                        else:assert delta is None
                        if mode=='sidecar':plain_frames[t]=a
                        else:assert a==plain_frames[t],'sidecar and none must produce identical picture'
                    if i==0:first_box=audit['imageBoxes'][0]
                    if i<4:(review/f'{prefix}_scene_{i+1}.png').write_bytes(base64.b64decode(a))
                if aspect=='16:9':assert first_box['x']>meta['width']*.35
                else:assert first_box['y']>meta['height']*.3
                for w,h in ((1200,900),(900,1200)):
                    a=page.evaluate('([w,h])=>window.renderCover(w,h)',[w,h]);assert Image.open(io.BytesIO(base64.b64decode(a))).size==(w,h)
                    if mode=='burn-in':baseline_covers[(w,h)]=a
                    else:assert a==baseline_covers[(w,h)]
                assert not errors,errors;browser.close()
            if mode=='burn-in':plain_frames={}
            video=review/f'{prefix}_encoding_smoke.mp4'
            render_html_to_video(html,video,duration=.4,fps=10,width=meta['width'],height=meta['height'])
            info=json.loads(subprocess.run([ffprobe,'-v','error','-show_streams','-of','json',str(video)],capture_output=True,text=True,check=True).stdout)['streams'][0]
            assert (info['width'],info['height'],int(info['nb_frames']))==(meta['width'],meta['height'],4)
            subprocess.run([ffmpeg,'-v','error','-i',str(video),'-f','null','-'],capture_output=True,check=True)
            results.append({'aspect':aspect,'subtitle_mode':mode,'dimensions':[meta['width'],meta['height']],'frames_checked':7,'seek_safe':True,'graphic_text_preserved':True,'caption_layer_checked':True,'srt_delivered':active is not None,'browser_errors':errors,'encoding_smoke_frames':4,'covers_checked':2})
    (review/'report.json').write_text(json.dumps({'offline':True,'paid_calls':0,'profiles':results},ensure_ascii=False,indent=2),encoding='utf-8')
    print('[SMOKE] 横竖屏×三种字幕策略、图文保留、字幕/SRT分离、回跳、双封面、编码和解码通过：'+str(review/'report.json'))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--browser',action='store_true');parser.add_argument('--ffmpeg',default=shutil.which('ffmpeg'));parser.add_argument('--ffprobe',default=shutil.which('ffprobe'));parser.add_argument('--asset',type=Path)
    args=parser.parse_args();suite=unittest.defaultTestLoader.loadTestsFromTestCase(ContractTests)
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():sys.exit(1)
    if args.browser:browser_smoke(args.ffmpeg,args.ffprobe,args.asset)
