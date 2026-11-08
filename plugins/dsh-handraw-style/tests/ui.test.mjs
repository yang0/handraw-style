import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const client=await readFile(new URL('../client.js',import.meta.url),'utf8');
const host=await readFile(new URL('../host.js',import.meta.url),'utf8');
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

test('gallery is strictly browse-only and broken legacy gallery is removed',()=>{
  assert.match(client,/画廊仅供浏览、放大和查找编号/);
  assert.match(client,/暂选，确认后回显/);
  assert.match(client,/pickerModal/);
  assert.match(client,/commitPicker/);
  assert.doesNotMatch(client,/iframe/);
  assert.doesNotMatch(host,/route\('legacy'/);
  assert.ok(!manifest.files.includes('gallery.js'));
});

test('both delivery buttons share the AI checkbox setting; image copy and path are rendered',()=>{
  assert.match(client,/type:'checkbox',checked:page\.aiAssist===true/);
  assert.match(client,/aiAssist:p\.aiAssist===true/);
  assert.match(client,/aiAssist:page\.aiAssist===true/);
  assert.match(client,/生成完整提示词/);
  assert.match(client,/直接生成图片/);
  assert.match(client,/ClipboardItem/);
  assert.match(client,/复制图片/);
  assert.match(client,/savedPath/);
  assert.match(host,/generated/);
  assert.match(host,/flag:'wx'/);
});

test('skill aspect ratio presets include wide covers and custom values',()=>{
  for(const value of ['3:4','9:16','4:3','16:9','21:9','2.35:1','5:2']) assert.ok(client.includes(value));
  assert.match(client,/自定义比例/);
  assert.match(client,/validRatio/);
  assert.match(client,/1024x1536/);
});

test('popup uses category tags, renders every match, and fusion controls the two style pickers',()=>{
  assert.match(client,/className:'pickertabs'/);
  assert.match(client,/素材分类二级导航/);
  assert.match(client,/pickerFiltered\.map\(item/);
  assert.doesNotMatch(client,/加载更多|继续加载|pageLimit/);
  assert.doesNotMatch(client,/el\('select',\{value:picker.group/);
  assert.match(client,/checked:page.fusion===true/);
  assert.match(client,/page.fusion\?\['style','style2'\]:\['style'\]/);
  assert.match(client,/fusion:p.fusion===true/);
});


test('responsive workbench uses container queries; long page titles are clipped inside the rail',()=>{
  assert.match(client,/container-name:workbench/);
  assert.match(client,/@container workbench \(max-width:760px\)/);
  assert.match(client,/\.hd2 \.rail \.pagecontents\{flex:1 1 0/);
  assert.match(client,/\.hd2 \.rail \.page \.name\{display:block;flex:1 1 0/);
  assert.match(client,/\.hd2 \.compose\{width:100%;min-width:0;max-width:100%;grid-template-columns:minmax\(160px,205px\) minmax\(0,1fr\)/);
});

test('AI checkbox explicitly promises constrained Skill parameter recommendations, not prose',()=>{
  assert.match(client,/只从原 Skill 现有画风/);
  assert.match(client,/不会改写主题、生成小作文/);
  assert.doesNotMatch(client,/经 AI 完善/);
  assert.match(client,/lockedFields:/);
});
