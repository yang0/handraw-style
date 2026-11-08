/** Local DSH host/browser integration fixture. For QA only; no real image API or real DSH credentials. */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const source=fileURLToPath(new URL('../',import.meta.url));
// Work exclusively on an isolated temporary clone; NEVER overwrite the real Skill metadata.
const root=await mkdtemp(join(tmpdir(),'handraw-dsh-qa-root-'));
const here=join(root,'plugins/dsh-handraw-style');
await mkdir(join(root,'plugins'),{recursive:true});
await cp(source,here,{recursive:true});
const refs=join(root,'skills/handdraw-style-prompter/references');
const images=join(root,'images');
process.env.DSH_HOME=await mkdtemp(join(tmpdir(),'dsh-browser-qa-'));
const tinyPNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';
const styles=[
 {number:'FA-001',generation_name:'Line Art',reference:'Example A',traits:'极简笔触、手绘线条、纸张纹理'},
 {number:'FA-002',generation_name:'Watercolor Scene',reference:'Example B',traits:'透明水彩晕染、柔和湿边'},
 {number:'FB-006',generation_name:'Book Illustration',reference:'Example C',traits:'绘本暖色调、叠色肌理'}];
const layouts=[
 {id:'SC-001',name:'上文下图社媒卡',name_en:'Text above illustration',image:'../../../images/layouts/social-cards/SC-001.webp'},
 {id:'SC-021',name:'双拼艺术转译',name_en:'Photo-art split',image:'../../../images/layouts/social-cards/SC-021.webp'},
 {id:'IG-001',name:'信息图布局',name_en:'Infographic',image:'../../../images/layouts/infographics/IG-001.webp'},
 {id:'EC-001',name:'电商主图',name_en:'Shop card',image:'../../../images/layouts/ecommerce/EC-001.webp'}];
const colors=[
 {id:'C-01',category_zh:'经典蓝系',name_zh:'克莱因蓝',name_en:'Klein Blue',prompt_zh:'主题色：克莱因蓝。',prompt_en:'Theme color: blue.'},
 {id:'C-02',category_zh:'暖色系',name_zh:'暖黄',name_en:'Warm yellow',prompt_zh:'主题色：暖黄。',prompt_en:'Theme color: yellow.'}];
const tones=[
 {id:'T-01',name_zh:'高调',name_en:'High-key',category_zh:'明暗阶调',desc_zh:'明亮柔和',desc_en:'High key'},
 {id:'T-02',name_zh:'低调',name_en:'Low-key',category_zh:'明暗阶调',desc_zh:'深色高反差',desc_en:'Low key'}];
for(const [file,data] of [['styles.json',styles],['layouts.json',layouts],['colors.json',colors],['tones.json',tones]]){
 await mkdir(refs,{recursive:true});await writeFile(join(refs,file),JSON.stringify(data));
}
await mkdir(join(refs,'layouts'),{recursive:true});
for(const row of layouts){await writeFile(join(refs,'layouts',row.id+'.md'),`<!-- zh -->\n${row.name}。\n<!-- en -->\n${row.name_en}.`);}
// An actual small WebP file, rather than a mocked missing image response.
const webp=Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64');
for(const file of [...styles.map(x=>`individual/${x.number.slice(0,2)}/${x.number}.webp`),...layouts.map(x=>x.image.split('/images/')[1]),...colors.map(x=>`colors/${x.id}.webp`),...tones.map(x=>`tones/${x.id}.webp`)]){
 const pathname=join(images,file);await mkdir(resolve(pathname,'..'),{recursive:true});await writeFile(pathname,webp);
}
// Allow our in-process host to use a fake image upstream. No real credentials are sent.
const stats={generations:0,edits:0,llmCalls:0};
const upstream=globalThis.fetch;
globalThis.fetch=async (input,init)=>{
 const url=String(input?.url||input);
 if(url.startsWith('https://api.openai.com/v1/images/')){
   if(url.endsWith('/edits'))stats.edits++;else stats.generations++;
   return Response.json({data:[{b64_json:tinyPNG}]});
 }
 return upstream(input,init);
};
const {apply}=await import(pathToFileURL(join(here,'host.js')).href);
const routes=new Map();
const fakeLLM={async prepareCall(){stats.llmCalls++;return {config:{},async *stream({system,messages}){
 if(!system.includes('参数选择器'))throw new Error('AI must be restricted to catalogue selection; prose pass forbidden');
 const args=JSON.parse(messages[0].content[0].text);
 const result={style:'FA-001',style2:'FA-002',layout:'SC-001',color:'C-01',tone:'T-01'};
 if(!args.choices.fusionEnabled)delete result.style2;
 yield {type:'text-delta',text:JSON.stringify(result)};yield {type:'finish',reason:{kind:'stop'}};
 }}}};
const ctx={effect:fn=>{fn();},connection:{fetch:{register(route){routes.set(route.path,route);return()=>routes.delete(route.path);}}},get:key=>key==='llm'?fakeLLM:key==='agentDefaultModel'?{currentSelection:()=>({model:'deepseek-chat',provider:'DeepSeek'})}:undefined};
apply(ctx);
const reactdir='/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react';
const domdir='/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react-dom/umd/react-dom.production.min.js';
const reactjs=join(reactdir,'umd/react.production.min.js');
const html=`<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>DSH 手绘风工作台 · UI QA</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0"><div id="root" style="height:100vh"></div><script src="/qa/react.js"></script><script src="/qa/react-dom.js"></script><script>
window.__ModuleLoader__={load(spec){
  const p=spec.factory(name=>name==='react'?React:null);
  let Studio=null;
  p.apply({slots:{inject(_,fn){fn();},register(props,view){if(props.name==='main')Studio=view;return {};} }});
  window.__unmount=()=>{ReactDOM.unmountComponentAtNode(document.getElementById('root'));};
  window.__remount=()=>{ReactDOM.render(React.createElement(Studio),document.getElementById('root'));};
  window.__remount();
}};
</script><script src="/qa/client.js"></script></body></html>`;
const types={'.js':'application/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.webp':'image/webp'};
const server=createServer(async (req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  let file;
  if(url.pathname==='/')return void(res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}).end(html));
  if(url.pathname==='/__qa_stats')return void(res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(stats)));
  if(url.pathname==='/qa/react.js')file=reactjs;
  if(url.pathname==='/qa/react-dom.js')file=domdir;
  if(url.pathname==='/qa/client.js')file=join(here,'client.js');
  if(file)return void(res.writeHead(200,{'Content-Type':'application/javascript;charset=utf-8'}).end(await readFile(file)));
  if(!url.pathname.startsWith('/api/handraw-style.'))return void res.writeHead(404).end('not found');
  const route=routes.get(url.pathname);if(!route)return void res.writeHead(404).end('route not found');
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=chunks.length?Buffer.concat(chunks):undefined;
  const request=new Request(`http://127.0.0.1:${server.address().port}${req.url}`,{method:req.method,headers:{...req.headers,host:'127.0.0.1'},...(body?{body}:{} )});
  const response=await route.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500,{'Content-Type':'text/plain'}).end(e.stack||String(e));}
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}`,home:process.env.DSH_HOME})));
