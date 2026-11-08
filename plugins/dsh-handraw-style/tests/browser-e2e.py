import json,os,subprocess,atexit,tempfile,urllib.request,urllib.error
from urllib.parse import urlsplit
from pathlib import Path
from playwright.sync_api import sync_playwright
plugin=Path(__file__).resolve().parent.parent
qa_dir=Path(os.environ.get('HANDRAW_QA_OUTPUT') or tempfile.mkdtemp(prefix='handraw-qa-screens-'))
qa_dir.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node',str(plugin/'tests/browser-qa-server.mjs')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
atexit.register(server.terminate)
first=server.stdout.readline().strip()
if not first:raise RuntimeError('QA server did not start: '+server.stderr.read())
url=json.loads(first)['url']
print('QA isolated server',url,'screenshots',qa_dir,flush=True)
react=Path('/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react/umd/react.production.min.js').read_text()
dom=Path('/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react-dom/umd/react-dom.production.min.js').read_text()
client=(plugin/'client.js').read_text()
code=r'''window.__ModuleLoader__={load(spec){
 let hooks=[],cursor=0,pending=[],active=true,tick=false,Studio;
 const eq=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>x===b[i]);
 function schedule(){if(!active||tick)return;tick=true;setTimeout(()=>{tick=false;render()},0)}
 const lib={createElement(tag,props,...children){if(props?.ref && typeof props.ref==='object'){const ref=props.ref;props={...props,ref:element=>{ref.current=element}}}return React.createElement(tag,props,...children)},
   useState(initial){const i=cursor++;if(!hooks[i])hooks[i]={state:typeof initial==='function'?initial():initial};return [hooks[i].state,value=>{hooks[i].state=typeof value==='function'?value(hooks[i].state):value;schedule()}]},
   useRef(initial){const i=cursor++;if(!hooks[i])hooks[i]={ref:{current:initial}};return hooks[i].ref},
   useEffect(fn,deps){const i=cursor++;if(!hooks[i])hooks[i]={deps:null,cleanup:null};if(!eq(hooks[i].deps,deps)){pending.push({i,fn});hooks[i].deps=deps}}
 };
 const inst=spec.factory(name=>name==='react'?lib:null);
 inst.apply({slots:{inject(name,fn){fn()},register(props,view){if(props.name==='main')Studio=view;return{}}}});
 function render(){if(!active)return;cursor=0;pending=[];ReactDOM.render(Studio(),document.getElementById('root'));for(const {i,fn} of pending){try{hooks[i].cleanup?.();hooks[i].cleanup=fn()}catch(e){console.error(e)}}}
 window.mount=()=>{hooks=[];active=true;render()};
 window.unmount=()=>{for(const h of hooks){try{h?.cleanup?.()}catch(e){console.error(e)}};ReactDOM.unmountComponentAtNode(document.getElementById('root'));active=false;hooks=[]};
 window.mount();
}};'''

with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(9000)
 errs=[]
 page.on('pageerror',lambda e:errs.append(str(e)))
 def route_handler(route):
  req=route.request
  try:
   u=url+urlsplit(req.url).path+('?' + urlsplit(req.url).query if urlsplit(req.url).query else '')
   data=req.post_data.encode() if req.post_data is not None else None
   request=urllib.request.Request(u,data=data,method=req.method,headers={'Content-Type':'application/json'} if data else {})
   with urllib.request.urlopen(request,timeout=40) as response:
    response_body=response.read()
    route.fulfill(status=response.status,body=response_body,headers={'Content-Type':response.headers.get('Content-Type','application/json'),'Access-Control-Allow-Origin':'*'})
  except urllib.error.HTTPError as e:route.fulfill(status=e.code,body=e.read(),headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'})
  except Exception as e:print('routeerror',repr(e));route.fulfill(status=500,body='{}',headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'})
 page.route('**/api/handraw-style.*',route_handler)
 page.set_content(f'<!doctype html><html><head><meta charset="utf-8"><base href="{url}/"></head><body style="margin:0"><div id="root" style="height:100vh"></div></body></html>')
 for script in [react,dom,code,client]:page.add_script_tag(content=script)
 page.evaluate('''() => {
   window.ClipboardItem = class { constructor(items) {this.items=items;} };
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      writeText:async text=>{window.__copiedText=text},
      write:async items=>{window.__copiedImages=items}
   }});
 }''')
 page.wait_for_timeout(1400)
 print('H1',page.locator('h1').all_text_contents(),flush=True)
 print('errors',errs)
 print('images',page.locator('.pickimg img').count())
 print('title',page.locator('.brand').inner_text())
 page.screenshot(path=str(qa_dir/'qa-test-compose.png'),full_page=True)

 # Reproduce the reported failure: long Chinese theme must NEVER widen the page rail
 # or cover any part of the editor; test actual plugin container widths, not just viewport.
 long_theme='中秋佳节啊收到了放假啊塑料袋放假啊收到消息' * 12
 theme_input=page.get_by_placeholder('描述你真正想画的内容。例如：雨天车站，一只橘猫等待末班电车，画面温暖又安静……')
 theme_input.fill(long_theme)
 page.wait_for_timeout(180)
 for width in [1440,1017,850,710,390]:
  page.set_viewport_size({'width':width,'height':900})
  page.wait_for_timeout(160)
  measures=page.evaluate("""() => {
    const $=s=>document.querySelector(s),box=s=>$(s).getBoundingClientRect();
    const rail=box('.rail'),card=box('.rail .page'),editor=box('.form'),main=$('.main');
    return {rail:Math.round(rail.width),card:Math.round(card.width),
     cardRight:card.right,railRight:rail.right,editorLeft:editor.left,
     intersects:!(card.right<=editor.left+1||editor.top>=box('.form').bottom||box('.form').top>=card.bottom),
     scroll:main.scrollWidth,client:main.clientWidth};
  }""")
  assert measures['cardRight']<=measures['railRight']+2,(width,measures,'page card escaped its rail')
  assert not measures['intersects'],(width,measures,'page card overlaps editor')
  assert measures['scroll']<=measures['client']+3,(width,measures,'main horizontally overflows')
  print('long-theme responsive layout',width,measures,flush=True)
  if width==1017:page.screenshot(path=str(qa_dir/'qa-long-theme-desktop.png'),full_page=True)
  if width==390:page.screenshot(path=str(qa_dir/'qa-long-theme-mobile.png'),full_page=True)
 # Extra regression: DSH may give the plugin only 800px even when browser width is 1440px.
 page.set_viewport_size({'width':1440,'height':900})
 page.evaluate("document.querySelector('#root').style.width='800px'")
 page.wait_for_timeout(150)
 mini=page.evaluate("""() => {const r=document.querySelector('.rail').getBoundingClientRect(),
   c=document.querySelector('.rail .page').getBoundingClientRect(),f=document.querySelector('.form').getBoundingClientRect();
   return {cardRight:c.right,railRight:r.right,editorLeft:f.left,editorTop:f.top,cardBottom:c.bottom};}""")
 assert mini['cardRight']<=mini['railRight']+2 and (mini['cardRight']<mini['editorLeft']+1 or mini['cardBottom']<=mini['editorTop']+1),mini
 print('narrow DSH embed width verified',mini,flush=True)
 page.evaluate("document.querySelector('#root').style.width='100%'")
 theme_input.fill('')
 page.wait_for_timeout(160)

 # Default has ONE style picker; only enabling fusion exposes the two-role selection.
 assert page.locator('.pick').count()==4
 assert '角色／主体画风' not in page.locator('.pickgrid').inner_text()
 assert '场景／环境画风' not in page.locator('.pickgrid').inner_text()
 page.locator('.pick').first.click()
 page.get_by_role('dialog',name='选择画风').wait_for(timeout=8000)
 assert page.get_by_role('dialog',name='选择画风').count()==1
 assert page.locator('.pickertabs button').count()>=2
 assert page.locator('.pickercontrols select').count()==0
 assert page.locator('.pickergrid > .pickercard').count()==3
 assert page.get_by_text('加载更多',exact=True).count()==0
 page.locator('.pickertabs').get_by_role('button',name='FB · 经典绘本').click()
 page.wait_for_function('document.querySelectorAll(".pickergrid > .pickercard").length===1')
 assert page.locator('.pickergrid > .pickercard').count()==1
 page.locator('.pickertabs').get_by_role('button',name='全部',exact=True).click()
 page.wait_for_function('document.querySelectorAll(".pickergrid > .pickercard").length===3')
 assert page.locator('.pickergrid > .pickercard').count()==3
 page.get_by_role('button',name='取消',exact=True).click()
 page.locator('.fusion-switch input').click()
 page.wait_for_timeout(160)
 print('fusion control state',page.locator('.fusion-switch input').is_checked(),page.locator('.pick').count(),flush=True)
 assert page.locator('.pick').count()==5
 assert '角色／主体画风' in page.locator('.pickgrid').inner_text()
 assert '场景／环境画风' in page.locator('.pickgrid').inner_text()
 # Each material picker, including tone, must display an image and commit only after confirmation.
 page.locator('.pick').first.click()
 print('picker roles',page.get_by_role('dialog',name='选择角色／主体画风').count(),flush=True)
 page.locator('.pickercontrols input').fill('FA-001')
 page.get_by_role('button',name='选此项').click()
 page.get_by_role('button',name='取消',exact=True).click()
 assert page.locator('.pick').first.inner_text().find('FA-001')<0, 'Cancel must not save pending choice'
 for idx,term in [(0,'FA-001'),(1,'FA-002'),(2,'SC-001'),(3,'C-01'),(4,'T-01')]:
  page.locator('.pick').nth(idx).click()
  page.locator('.pickercontrols input').fill(term)
  page.locator('.pickergrid .pickercard').first.wait_for()
  img=page.locator('.pickergrid img').first
  img.scroll_into_view_if_needed()
  page.wait_for_timeout(100)
  print('picker',idx,term,'img loaded',img.evaluate('(el)=>el.complete && el.naturalWidth>0'),flush=True)
  assert img.evaluate('(el)=>el.complete && el.naturalWidth>0'),term+' thumbnail missing'
  page.get_by_role('button',name='放大',exact=True).first.click()
  page.get_by_role('dialog',name='图片完整预览').wait_for(timeout=5000)
  page.get_by_role('button',name='关闭 Esc').click()
  page.get_by_role('button',name='选此项').first.click()
  page.wait_for_timeout(170)
  print('footer',page.locator('.pickerfooter').inner_text(),flush=True)
  page.get_by_role('button',name='确认选用并返回').click()
  page.wait_for_timeout(200)
  print('picked card',page.locator('.pick').nth(idx).inner_text(),flush=True)
  assert term in page.locator('.pick').nth(idx).inner_text(),(term,'not echoed')
 assert page.locator('.pickimg img').count()==5
 page.get_by_placeholder('描述你真正想画的内容。例如：雨天车站，一只橘猫等待末班电车，画面温暖又安静……').fill('海边一只猫在散步')
 # custom ratio, including invalid input feedback
 ratio=page.locator('.form select').nth(1)
 ratio.select_option('custom')
 page.locator('input[placeholder="7:10"]').fill('not-a-ratio')
 assert page.get_by_text('请填写有效比例',exact=False).count()>=1
 page.locator('input[placeholder="7:10"]').fill('7:10')
 assert page.locator('input[placeholder="7:10"]').input_value()=='7:10'
 # Prompt mode without AI: exact selected roles must appear, and no LLM is called.
 page.get_by_role('button',name='生成完整提示词').click()
 page.wait_for_timeout(300)
 output=page.locator('.promptout.big').inner_text(timeout=10000)
 for x in ['FA-001','FA-002','SC-001','克莱因蓝','7:10','海边一只猫在散步']:
  assert x in output,(x,output[:250])
 print('prompt flow (no AI) verified',len(output),flush=True)
 page.get_by_role('button',name='复制提示词').click()
 page.wait_for_timeout(70)
 assert page.evaluate('window.__copiedText')==output
 # Turning fusion off must immediately hide scene style AND ignore it during compilation.
 page.locator('.fusion-switch input').click()
 page.wait_for_timeout(160)
 assert page.locator('.pick').count()==4
 assert '场景／环境画风' not in page.locator('.pickgrid').inner_text()
 page.get_by_role('button',name='生成完整提示词').click()
 page.wait_for_timeout(260)
 single=page.locator('.promptout.big').inner_text()
 assert '画风：' in single and 'FA-001' in single
 assert 'FA-002' not in single and '双画风融合原则' not in single
 page.locator('.fusion-switch input').click()
 page.wait_for_timeout(160)
 print('fusion control state',page.locator('.fusion-switch input').is_checked(),page.locator('.pick').count(),flush=True)
 assert page.locator('.pick').count()==5
 assert 'FA-002' in page.locator('.pick').nth(1).inner_text()
 # Switch to direct image and configure mock GPT image API.
 print('before direct delivery',flush=True)
 page.get_by_role('button',name='✦ 直接生图').click()
 print('after direct delivery',flush=True)
 print('before settings open',flush=True)
 page.get_by_role('button',name='接口设置').click()
 print('after settings open',flush=True)
 page.get_by_role('dialog',name='图像接口设置').wait_for(timeout=5000)
 page.locator('input[type=password]').fill('test-api-key-12345')
 print('before save settings',flush=True)
 page.get_by_role('button',name='保存接口设置').click()
 print('after save settings',flush=True)
 page.wait_for_timeout(220)
 page.get_by_role('dialog',name='图像接口设置').wait_for(state='detached',timeout=5000)
 print('before image generation',flush=True)
 page.get_by_role('button',name='直接生成图片',exact=True).click()
 print('after image generation click',flush=True)
 page.locator('.resultarea > img').wait_for(timeout=15000)
 assert page.get_by_role('button',name='复制图片').is_visible()
 assert page.get_by_role('button',name='保存 PNG').is_visible()
 saved=page.locator('.hostpath code').inner_text()
 assert saved.startswith('/') and saved.endswith('.png'),saved
 assert Path(saved).is_file(),saved
 assert page.locator('.resultarea > img').evaluate('(e)=>e.complete && e.naturalWidth>0')
 with page.expect_download(timeout=8000) as event:
  page.get_by_role('button',name='保存 PNG').click()
 print('download',event.value.suggested_filename,flush=True)
 print('image saved',saved,flush=True)
 page.get_by_role('button',name='复制路径').click()
 page.wait_for_timeout(90)
 assert page.evaluate('window.__copiedText')==saved
 page.get_by_role('button',name='复制图片').click()
 page.wait_for_timeout(120)
 assert page.evaluate('Array.isArray(window.__copiedImages) && window.__copiedImages.length===1')
 page.screenshot(path=str(qa_dir/'qa-test-image.png'),full_page=True)
 # AI auto-completion from theme only, then prompt generated by host twice.
 page.get_by_role('button',name='＋ 新建').click()
 page.wait_for_function('document.querySelectorAll(".rail .page").length >= 2 && document.querySelector(".rail .page.selected")?.textContent.includes("02")')
 page.get_by_placeholder('描述你真正想画的内容。例如：雨天车站，一只橘猫等待末班电车，画面温暖又安静……').fill('月亮上的纸船')
 print('checkbox-before',page.locator('.ai-switch input').is_checked(),flush=True)
 page.locator('.ai-switch input').click()
 page.wait_for_timeout(170)
 page.wait_for_timeout(200)
 print('checkbox-after',page.locator('.ai-switch input').is_checked(),flush=True)
 page.get_by_role('button',name='生成完整提示词').click()
 aiout=page.locator('.promptout.big')
 try:aiout.wait_for(timeout=15000)
 except Exception:
  print('AI failure visible notices',page.locator('.toast').all_text_contents(),flush=True)
  print('AI view',page.locator('.delivery').inner_text()[:900],flush=True)
  print('AI server stats',json.load(urllib.request.urlopen(url+'/__qa_stats')),flush=True)
  page.screenshot(path=str(qa_dir/'qa-failure-ai.png'),full_page=True)
  raise
 result=aiout.inner_text()
 for key in ['月亮上的纸船','FA-001','SC-001','克莱因蓝','高调']:
  assert key in result,(key,'not in AI output')
 assert 'FA-001' in page.locator('.pick').first.inner_text()
 assert page.locator('.pick').count()==4
 assert '场景／环境画风' not in page.locator('.pickgrid').inner_text()
 assert 'FA-002' not in result
 print('AI assistance (theme only) verified',flush=True)
 # Same AI checkbox must also invoke the host when the user chooses direct image.
 page.get_by_role('button',name='✦ 直接生图').click()
 page.get_by_role('button',name='直接生成图片',exact=True).click()
 page.locator('.resultarea > img').wait_for(timeout=15000)
 assert Path(page.locator('.hostpath code').inner_text()).is_file()
 print('AI assisted direct generation verified',flush=True)
 # Third page tests text-only input going to image-generation API (no reference images).
 page.get_by_role('button',name='＋ 新建').click()
 page.wait_for_function('document.querySelectorAll(".rail .page").length >= 3 && document.querySelector(".rail .page.selected")?.textContent.includes("03")')
 page.get_by_placeholder('描述你真正想画的内容。例如：雨天车站，一只橘猫等待末班电车，画面温暖又安静……').fill('星空下的山谷')
 page.get_by_role('button',name='✦ 直接生图').click()
 page.get_by_role('button',name='直接生成图片',exact=True).click()
 page.locator('.resultarea > img').wait_for(timeout=15000)
 assert Path(page.locator('.hostpath code').inner_text()).is_file()
 print('no-reference image generation verified',flush=True)
 page.locator('.rail .page').nth(1).click()
 page.wait_for_timeout(150)
 page.get_by_role('button',name='📝 生成提示词').click()
 page.screenshot(path=str(qa_dir/'qa-test-ai.png'),full_page=True)
 # Browser-only gallery, every category, including tone image loads.
 page.get_by_role('button',name='素材画廊（浏览）').first.click()
 galleryScreens=[]
 for kind,label in [('style','画风'),('layout','版式图型'),('color','主题色'),('tone','光影影调')]:
  page.locator('.gallerycontent').wait_for()
  nav=page.locator('.main > div > .row > button').filter(has_text=label).first
  nav.click()
  page.locator('.assetgrid img').first.wait_for(timeout=8000)
  pic=page.locator('.assetgrid img').first
  assert pic.evaluate('(el)=>el.complete && el.naturalWidth>0'),kind+' gallery image did not load'
  page.locator('.assetgrid button.select').first.click()
  page.get_by_role('dialog',name='图片完整预览').wait_for(timeout=5000)
  page.get_by_role('button',name='关闭 Esc').click()
  page.get_by_role('dialog',name='图片完整预览').wait_for(state='detached',timeout=5000)
  assert '仅浏览' in page.locator('.gallerycontent').inner_text()
  shot=str(qa_dir/('qa-test-gallery-'+kind+'.png'))
  page.screenshot(path=shot,full_page=True)
  galleryScreens.append(shot)
  expected={'style':3,'layout':4,'color':2,'tone':2}[kind]
  assert page.locator('.assetgrid .assetcard').count()==expected,(kind,'missing items')
  print('gallery category',kind,'ok; cards',page.locator('.assetgrid .assetcard').count(),flush=True)
 # Gallery must not mutate saved choices.
 page.get_by_role('button',name='返回创作台').click()
 assert 'FA-001' in page.locator('.pick').first.inner_text()
 # Switch DSH main panel off and on, verify state restores from module snapshot.
 page.evaluate('window.unmount()')
 page.evaluate('window.mount()')
 page.wait_for_timeout(250)
 assert page.get_by_placeholder('描述你真正想画的内容。例如：雨天车站，一只橘猫等待末班电车，画面温暖又安静……').input_value()=='月亮上的纸船'
 assert 'FA-001' in page.locator('.pick').first.inner_text()
 print('DSH panel remount state preserved',flush=True)
 # Check phone layout, including accessible picker modal and tone thumbnails.
 page.set_viewport_size({'width':390,'height':844})
 page.locator('.pick').nth(3).click()
 page.get_by_role('dialog',name='选择影调').wait_for(timeout=5000)
 assert page.locator('.pickergrid img').first.evaluate('(el)=>el.complete && el.naturalWidth>0')
 page.get_by_role('button',name='取消',exact=True).click()
 page.get_by_role('dialog',name='选择影调').wait_for(state='detached',timeout=5000)
 page.screenshot(path=str(qa_dir/'qa-test-mobile.png'),full_page=True)
 print('mobile picker verified',flush=True)
 assert not errs,errs
 stats=json.load(urllib.request.urlopen(url+'/__qa_stats'))
 assert stats['llmCalls']==2,stats # one constrained DSH parameter-selection call per AI-assisted action
 assert stats['edits']>=2,stats
 assert stats['generations']>=1,stats
 print('server integration stats',stats,flush=True)
 print('ALL UI ROUTES PASS',flush=True)
 b.close()
 server.terminate()
 print('QA screenshots:',qa_dir,flush=True)
