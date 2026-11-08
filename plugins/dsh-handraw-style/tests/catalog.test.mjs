import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCatalog, resolveImage } from '../catalog.js';
import { compilePrompt } from '../prompt.js';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'handraw-dsh-'));
  const refs = join(root, 'skills/handdraw-style-prompter/references');
  const md = join(refs, 'layouts');
  await mkdir(md, {recursive:true});
  const save = async (name,data) => writeFile(join(refs,name),JSON.stringify(data));
  await save('styles.json', [{number:'FA-001',generation_name:'Line Art',reference:'Example Artist',traits:'手绘线条与纸质笔触',group:'FA'}]);
  await save('tones.json', [{id:'T-01',name_zh:'高调',name_en:'High-key',category_zh:'明暗阶调',desc_zh:'柔和明亮',desc_en:'Bright and soft'}]);
  await save('colors.json', [{id:'C-01',category_zh:'蓝',name_zh:'蓝色',name_en:'Blue',prompt_zh:'主题色：蓝色。',prompt_en:'Blue.'}]);
  await save('layouts.json', [
    {id:'SC-001',name:'上文下图',name_en:'Text then image',image:'../../../images/layouts/social-cards/SC-001.webp'},
    {id:'SC-021',name:'跨媒介拼贴',name_en:'Art split',image:'../../../images/layouts/social-cards/SC-021.webp'},
    {id:'EC-001',name:'电商主图',name_en:'Shop hero',image:'../../../images/layouts/ecommerce/EC-001.webp'},
  ]);
  await writeFile(join(md,'SC-021.md'),'<!-- zh -->\n双拼照片艺术转译。\n- 【类型 01 · 跨界续绘】：测试一。\n- 【类型 02 · 撕纸第二世界】：测试二。\n<!-- en -->\nPhoto-to-art split.\n- [Type 01: Continuation]: One.\n- [Type 02: Torn-paper]: Two.');
  await writeFile(join(md,'SC-001.md'),'<!-- zh -->\n上文下图。\n<!-- en -->\nText then image.');
  await writeFile(join(md,'EC-001.md'),'<!-- zh -->\n商品清晰优先。\n<!-- en -->\nProduct first.');
  try {await run(root);} finally {await rm(root,{recursive:true,force:true});}
}

test('upstream metadata is mapped to canonical image paths, without asset copies', async()=>fixture(async root=>{
  const list=createCatalog(root);
  const [styles,layouts,colors,tones]=await Promise.all([list('style'),list('layout'),list('color'),list('tone')]);
  assert.equal(styles[0].id,'FA-001');
  assert.equal(styles[0].prompt,'手绘线条与纸质笔触');
  assert.equal(styles[0].image,'individual/FA/FA-001.webp');
  assert.equal(layouts[0].prompt,'上文下图。');
  assert.equal(layouts[0].promptEn,'Text then image.');
  assert.equal(tones[0].image,'tones/T-01.webp');
  assert.equal(colors[0].image,'colors/C-01.webp');
  assert.equal(resolveImage(root,layouts[0]),join(root,'images/layouts/social-cards/SC-001.webp'));
  await assert.rejects(list('unknown'),/未知素材类别/);
  assert.throws(()=>resolveImage(root,{image:'../../secrets.json'}),/不支持的图片路径/);
}));

test('prompt combines theme, optional style, layout, and colors without copying sample subjects', async()=>fixture(async root=>{
  const list=createCatalog(root);
  const result=await compilePrompt({theme:'一只猫在阳台看雨',style:'FA-001',layout:'SC-001',color:'C-01',mode:'pure-image'},list);
  assert.equal(result.mode,'graphic-text');
  assert.match(result.prompt,/一只猫在阳台看雨/);
  assert.match(result.prompt,/手绘线条与纸质笔触/);
  assert.match(result.prompt,/上文下图/);
  assert.match(result.prompt,/文字参与构图，图文一体/);
  assert.match((await compilePrompt({theme:'',style:'FA-001'},list)).prompt,/请在此输入画面主题/);
  await assert.rejects(compilePrompt({theme:'主题',style:'FA-999'},list),/不存在/);
}));

test('ecommerce layout avoids forced graphic-text suffix; image upload requires redraw', async()=>fixture(async root=>{
  const list=createCatalog(root);
  const result=await compilePrompt({theme:'茶杯',layout:'EC-001',style:'FA-001',referenceUpload:true,mode:'pure-image'},list);
  assert.equal(result.mode,'ecommerce');
  assert.doesNotMatch(result.prompt,/文字参与构图，图文一体/);
  assert.match(result.prompt,/重新画/);
  const sceneOnly=await compilePrompt({theme:'茶杯',layout:'EC-001',style2:'FA-001',fusion:true,explicitStyle:true},list);
  assert.match(sceneOnly.prompt,/场景／环境画风：Line Art/);
}));

test('language selection, tone, placeholder and SC-021 single variant selection', async()=>fixture(async root=>{
  const list=createCatalog(root);
  const noTheme=await compilePrompt({style:'FA-001',language:'both',tone:'T-01'},list);
  assert.match(noTheme.prompt,/请在此输入画面主题/);
  assert.match(noTheme.prompt,/English/);
  assert.match(noTheme.prompt,/柔和明亮/);
  const split=await compilePrompt({theme:'海边',layout:'SC-021',layoutVariant:2,ratio:'3:2',language:'zh'},list);
  assert.match(split.prompt,/撕纸第二世界/);
  assert.match(split.prompt,/左右等分/);
  assert.doesNotMatch(split.prompt,/类型 01 · 跨界续绘/);
  const english=await compilePrompt({theme:'Ocean',layout:'SC-001',language:'en'},list);
  assert.match(english.prompt,/Text then image/);
}));

test('single-style is default; fusion explicitly separates subject and environment', async()=>fixture(async root=>{
  const list=createCatalog(root);
  const defaultStyle=await compilePrompt({theme:'公园',style:'FA-001',style2:'FA-001'},list);
  assert.match(defaultStyle.prompt,/画风：Line Art/);
  assert.doesNotMatch(defaultStyle.prompt,/角色／主体画风|场景／环境画风|双画风融合原则/);
  assert.equal(defaultStyle.refs.style2,undefined);
  const fused=await compilePrompt({theme:'公园',fusion:true,style:'FA-001',style2:'FA-001'},list);
  assert.match(fused.prompt,/角色／主体画风：Line Art/);
  assert.match(fused.prompt,/场景／环境画风：Line Art/);
  assert.match(fused.prompt,/双画风融合原则/);
}));
