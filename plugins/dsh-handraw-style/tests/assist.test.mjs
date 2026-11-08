import test from 'node:test';
import assert from 'node:assert/strict';
import {hostModel,resolvePrompt,ratioPresets} from '../assist.js';
import {compilePrompt} from '../prompt.js';

const styles=[{id:'FA-001',name:'角色水墨',prompt:'柔和墨线'},{id:'FA-002',name:'场景纸雕',prompt:'纸质肌理'}];
const layouts=[{id:'SC-001',name:'社媒卡',prompt:'上文下图',promptEn:'Text above image'}];
const colors=[{id:'C-01',name:'克莱因蓝',prompt:'主题色：克莱因蓝'}];
const tones=[{id:'T-01',name:'高调',prompt:'明亮光照'}];
const rows={style:styles,layout:layouts,color:colors,tone:tones};
const catalog=async kind=>rows[kind]||[];
const signal=new AbortController().signal;
function fakeHost(answer) {
  let calls=0;
  return {get count(){return calls;},llm:{
    async prepareCall({model,provider,maxTokens}) {
      assert.equal(model,'deepseek-chat');assert.equal(provider,'deepseek');
      assert.ok(maxTokens<=2000,'selection JSON must not consume article-writing token budget');calls++;
      return {config:{},async *stream({system,messages,signal}) {
        assert.match(system,/参数选择器/);assert.match(system,/禁止任何解释或小作文/);
        const content=JSON.parse(messages[0].content[0].text);
        assert.ok(content.choices.style.length>0);
        assert.ok(!signal.aborted);
        const result=typeof answer==='function'?answer(content):answer;
        yield {type:'text-delta',text:JSON.stringify(result)};
        yield {type:'finish',reason:{kind:'stop'}};
      }};
    },
  },model:'deepseek-chat',provider:'deepseek'};
}
test('without AI no DSH call; output exactly canonical Skill concatenation',async()=>{
  const design={theme:'海边的小猫',style:'FA-001'};
  const result=await resolvePrompt(design,false,catalog,null,signal);
  assert.equal(result.aiAssisted,false);
  assert.equal(result.prompt,(await compilePrompt(design,catalog)).prompt);
});
test('DSH default model is the ONLY AI assist provider',()=>{
  const h=fakeHost({});
  assert.equal(hostModel({get:key=>key==='llm'?h.llm:{currentSelection:()=>({provider:'deepseek',model:'deepseek-chat'})}}).model,'deepseek-chat');
  assert.equal(hostModel({get:()=>undefined}),null);
});
test('one host call recommends only Skill IDs, compiler alone builds the final prompt; manually picked styles are protected',async()=>{
  const h=fakeHost({style:'FA-002',style2:'FA-002',layout:'SC-001',color:'C-01',tone:'T-01',ratio:'16:9',whitespace:'moderate'});
  const original={theme:'海边的小猫',style:'FA-001',fusion:true,ratio:'3:4',lockedFields:['style']};
  const result=await resolvePrompt(original,true,catalog,h,signal);
  assert.equal(h.count,1,'never call DSH a second time to write prose');
  assert.equal(result.design.style,'FA-001');
  assert.equal(result.design.style2,'FA-002');
  assert.equal(result.design.layout,'SC-001');
  assert.equal(result.design.color,'C-01');
  assert.equal(result.design.tone,'T-01');
  assert.equal(result.design.ratio,'16:9');
  assert.equal(result.design.whitespace,'moderate');
  assert.match(result.prompt,/角色／主体画风：角色水墨/);
  assert.match(result.prompt,/场景／环境画风：场景纸雕/);
  assert.equal(result.prompt,(await compilePrompt(result.design,catalog)).prompt);
  assert.doesNotMatch(result.prompt,/AI 创意|创意文案|构图很有趣/);
});
test('invalid catalogue ID is rejected, never invented or sent to image API',async()=>{
  const h=fakeHost({style:'FA-999'});
  await assert.rejects(resolvePrompt({theme:'猫',lockedFields:[]},true,catalog,h,signal),/不在原 Skill 素材库/);
});
test('non-catalogue free-text fields are rejected (no essays, copy, brief or invented concepts)',async()=>{
  for(const field of ['brief','copy','concept','prompt','audience','description']){
    const h=fakeHost({style:'FA-001',[field]:'明亮的海风，大段创造性文案'});
    await assert.rejects(resolvePrompt({theme:'猫'},true,catalog,h,signal),/拼装器以外的字段/);
  }
});
test('valid AI response cannot overwrite manually chosen mode, ratio or tone',async()=>{
  const h=fakeHost({tone:'T-01',mode:'graphic-text',ratio:'16:9',whitespace:'high'});
  const design={theme:'猫',tone:'T-01',ratio:'3:4',mode:'pure-image',lockedFields:['tone','ratio','mode']};
  const result=await resolvePrompt(design,true,catalog,h,signal);
  assert.equal(result.design.ratio,'3:4');assert.equal(result.design.mode,'pure-image');
  assert.equal(result.design.tone,'T-01');assert.equal(result.design.whitespace,'high');
});
test('theme-only AI completes a valid design without writing new prose',async()=>{
  const h=fakeHost({style:'FA-001',layout:'SC-001',color:'C-01',tone:'T-01',ratio:'3:4'});
  const result=await resolvePrompt({theme:'月亮上的纸船',lockedFields:[]},true,catalog,h,signal);
  assert.equal(result.design.style,'FA-001');
  assert.equal(result.design.layout,'SC-001');
  assert.equal(result.design.color,'C-01');
  assert.equal(result.design.tone,'T-01');
  assert.equal(result.design.brief,undefined);
  assert.equal(h.count,1);
  assert.equal(result.prompt,(await compilePrompt(result.design,catalog)).prompt);
});
test('without a DSH host AI fails visibly; no image-key fallback',async()=>{
  await assert.rejects(resolvePrompt({theme:'猫'},true,catalog,null,signal),/DSH 的默认模型/);
});
test('AI selection respects single style mode even if model sends style2',async()=>{
  const h=fakeHost({style:'FA-001',style2:'FA-002',layout:'SC-001'});
  const result=await resolvePrompt({theme:'海边的小猫',fusion:false,lockedFields:[]},true,catalog,h,signal);
  assert.equal(result.design.style,'FA-001');assert.equal(result.design.style2,'');
  assert.doesNotMatch(result.prompt,/场景／环境画风/);
});
test('selected scene style still applies to commerce with character/scene role split',async()=>{
  const commerceCatalog=async kind=>kind==='layout'?[{id:'EC-001',name:'电商商品主图',prompt:'商品完整清晰'}]:catalog(kind);
  const h=fakeHost({style2:'FA-002',layout:'EC-001'});
  const result=await resolvePrompt({theme:'猫咪手办',fusion:true,lockedFields:[]},true,commerceCatalog,h,signal);
  assert.equal(result.design.style2,'FA-002');assert.equal(result.design.explicitStyle,true);
  assert.match(result.prompt,/场景／环境画风：场景纸雕/);
});
test('only permitted ratio options and mode enums are accepted',async()=>{
  assert.ok(ratioPresets.includes('2.35:1'));
  const h=fakeHost({ratio:'999:1'});
  await assert.rejects(resolvePrompt({theme:'猫',lockedFields:[]},true,catalog,h,signal),/不支持的 ratio/);
});
