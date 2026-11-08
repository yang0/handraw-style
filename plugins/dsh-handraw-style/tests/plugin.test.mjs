import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { apply } from '../host.js';

const sourcePath = new URL('../client.js',import.meta.url);

test('DSH host exposes catalog, thumbnails, prompt, settings, and image-generation routes',()=>{
  const routes=[];
  const ctx={
    effect(fn){fn();},
    connection:{fetch:{register(route){routes.push(route);return()=>{};}}},
  };
  apply(ctx);
  assert.deepEqual(routes.map(route=>route.path).sort(),[
    '/api/handraw-style.catalog','/api/handraw-style.generate',
    '/api/handraw-style.prompt','/api/handraw-style.settings','/api/handraw-style.thumb',
  ]);
  assert.deepEqual(routes.find(route=>route.path.endsWith('.generate')).methods,['POST']);
});

test('browser bundle registers the correct DSH module and stable keyed sidebar/main slots',async()=>{
  let definition;
  const browser={__ModuleLoader__:{load:module=>{definition=module;}},addEventListener(){}};
  const document={addEventListener(){}};
  const source=await readFile(sourcePath,'utf8');
  runInNewContext(source,{window:browser,document,console});
  assert.equal(definition.id,'dsh-plugin-handraw-style');
  const h=(...args)=>args;
  const react={createElement:h,useState(){},useEffect(){},useRef(){}};
  const plugin=definition.factory(name=>{
    assert.equal(name,'react');return react;
  });
  assert.equal(plugin.name,'handraw-style');
  const slots=[];
  plugin.apply({slots:{inject(name,fn){slots.push({name,item:fn()});return()=>{};},register(...args){return args;}}});
  assert.deepEqual(slots.map(slot=>slot.name).sort(),['main','sidebar.panellist']);
  assert.equal(slots.find(slot=>slot.name==='main').item[0].key,'handraw-style');
});

test('uncropped image gallery and separate output workflow remain present', async()=>{
  const src=await readFile(sourcePath,'utf8');
  assert.match(src,/asset-visual img\{[^}]*object-fit:contain/);
  assert.match(src,/resultarea img\{[^}]*object-fit:contain/);
  assert.doesNotMatch(src,/原版画廊与提示词拼装器/);
  assert.doesNotMatch(src,/legacyUrl/);
  assert.match(src,/pickerModal=picker/);
  assert.match(src,/画廊仅供浏览/);
  assert.match(src,/角色／主体画风/);
  assert.match(src,/场景／环境画风/);
  assert.match(src,/AI 辅助设计/);
  assert.match(src,/复制图片/);
  assert.match(src,/图片已保存在 DSH Host/);
  assert.match(src,/生成完整提示词/);
  assert.match(src,/直接生成图片/);
  assert.match(src,/const job=\{controller:null/);
});

test('initial DSH workspace builds valid actionable controls without the running host', async()=>{
  let definition;
  const browser={__ModuleLoader__:{load:module=>{definition=module;}},addEventListener(){}};
  const document={addEventListener(){}};
  const code=await readFile(sourcePath,'utf8');
  const browserStorage=new Map();
  runInNewContext(code,{window:browser,document,console,URLSearchParams,localStorage:{getItem(key){return browserStorage.get(key)||null;},setItem(key,value){browserStorage.set(key,value);}},crypto:{randomUUID(){return 'page-test-1';}}});
  let buttons=0;
  const react={
    createElement(type,props,...children){
      if(type==='button'){buttons++;assert.equal(typeof props.onClick,'function','every button must have a valid callback');}
      return {type,props,children};
    },
    useState(value){return [typeof value==='function'?value():value,()=>{}];},
    useEffect(){},useRef(value){return {current:value};},
  };
  const plugin=definition.factory(name=>name==='react'?react:null);
  let Studio;
  plugin.apply({slots:{inject(_,fn){fn();},register(props,view){if(props.name==='main')Studio=view;return{};}}});
  assert.equal(typeof Studio,'function');
  const tree=Studio();
  assert.equal(tree.type,'div');
  assert.ok(buttons>20,`expected a fully wired interface, got ${buttons} buttons`);
  const walk=(node,pred)=>{if(!node||typeof node!=='object')return null;if(pred(node))return node;for(const child of node.children||[]){const found=walk(child,pred);if(found)return found;}return null;};
  const theme=walk(tree,n=>n.type==='textarea'&&n.props?.placeholder?.includes('描述你真正想画的内容'));
  assert.ok(theme);
  theme.props.onChange({target:{value:'海边的一只猫'}});
  const rerender=Studio(); // DSH panel switch remount: module snapshot must survive.
  const restored=walk(rerender,n=>n.type==='textarea'&&n.props?.placeholder?.includes('描述你真正想画的内容'));
  assert.equal(restored.props.value,'海边的一只猫');
  assert.match(browserStorage.get('dsh-handraw-style:workspace:v2'),/海边的一只猫/);
});


test('workbench has the requested Chinese name and visible repository link', async()=>{
  const source=await readFile(sourcePath,'utf8');
  assert.match(source,/label:\(\)=> '手绘风工作台'/);
  assert.match(source,/el\('strong',null,'手绘风工作台'\)/);
  assert.match(source,/href:'https:\/\/github\.com\/yang0\/handraw-style'/);
  assert.match(source,/github\.com\/yang0\/handraw-style'\)/);
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.homepage,'https://github.com/yang0/handraw-style');
  assert.match(pkg.description,/手绘风工作台/);
});
