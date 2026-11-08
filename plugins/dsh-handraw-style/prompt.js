const invalid = (message, status = 400) => Object.assign(new Error(message), { status });
const text = (value, max = 3000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const graphicSuffix = '【如果主题直白包含画面元素那就按主题出图，文案由你来升华，但是不要直接描述画面。 如果主题比较概念化，那么文案和主题尽量保持一致，如果文案较长由你提炼，由你先设计画面隐喻（人类和非人类都行）再出图   。    文字参与构图，图文一体】';
const redrawZh = '【请只提取人物的五官特征和姿态，场景轮廓，在画风上严格按 选择的风格重新画，不要在原照片上加质感。】';
const redrawEn = '[Extract only the character\'s facial features and posture, and the scene contours. Strictly redraw from scratch according to the selected style; do not add texture or filters onto the original photo.]';
const photoTypesZh = ['跨界续绘','撕纸第二世界','越界破框','微缩浮岛','记忆图谱','悬浮落地','正负形咬合'];
const photoTypesEn = ['Visual Anchor Continuation','Torn-Paper Second World','Boundary Break','Miniature Diorama','Memory Knolling','Suspended Hero','Positive-Negative Interlock'];
const whitespaceModes = {
  moderate: ['【大量留白】','[Generous negative space]'],
  high: ['【大量留白，场景只显示必要部分，不要显示全】','[Generous negative space. Show only essential scene elements.]'],
};

function photoLayout(prompt, variant, english, ratio) {
  const lines = prompt.split(/\r?\n/);
  const selected = lines.find(line => english
    ? new RegExp(`^\\s*[-–]\\s*\\[Type\\s*0?${variant}\\b`, 'i').test(line)
    : new RegExp(`^\\s*[-–]\\s*【类型\\s*0?${variant}\\b`).test(line));
  // Never send all seven conflicting composition types at once.
  const withoutOptions = lines.filter(line => !/^\s*[-–]\s*(?:【类型\s*0?[1-7]\b|\[Type\s*0?[1-7]\b)/i.test(line));
  let out = withoutOptions.join('\n').trim();
  const parts = /^(\d+(?:\.\d+)?)[：:](\d+(?:\.\d+)?)$/.exec(ratio);
  const horizontal = parts ? Number(parts[1]) > Number(parts[2]) : false;
  out += '\n' + (english
    ? `For this image, use ONLY the selected Type 0${variant} (${photoTypesEn[variant-1]}). ${horizontal ? 'Side-by-side split: photograph left, artwork right.' : 'Stacked split: photograph above, artwork below.'}`
    : `本张只采用【类型 0${variant} · ${photoTypesZh[variant-1]}】；${horizontal ? '左右等分，左侧摄影、右侧手绘。' : '上下等分，上方摄影、下方手绘。'}`);
  if (selected) out += '\n' + selected.replace(/^\s*[-–]\s*/, '');
  return out;
}

function outputLanguage(design) {
  if (['zh','en','both'].includes(design?.language)) return design.language;
  return /[\u3400-\u9fff]/.test(String(design?.theme || '')) ? 'zh' : 'en';
}

export async function compilePrompt(design, catalog) {
  if (!design || typeof design !== 'object') throw invalid('创作参数无效。');
  const theme = text(design.theme) || '【请在此输入画面主题，或在生图模型中垫入你的照片】';
  const [styles, layouts, colors, tones] = await Promise.all([catalog('style'),catalog('layout'),catalog('color'),catalog('tone')]);
  const pick = (rows, id, kind) => {
    if (!id) return null;
    const found = rows.find(row => row.id === id);
    if (!found) throw invalid(`所选${kind}不存在：${id}`);
    return found;
  };
  const style = pick(styles, design.style, '画风');
  const fusion = design.fusion === true;
  const style2 = fusion ? pick(styles, design.style2, '场景画风') : null;
  const layout = pick(layouts, design.layout, '图型');
  const color = pick(colors, design.color, '配色');
  const tone = pick(tones, design.tone, '影调');
  const ecommerce = Boolean(layout?.id.startsWith('EC-'));
  const mode = ecommerce ? 'ecommerce' : layout ? 'graphic-text' : design.mode === 'graphic-text' ? 'graphic-text' : 'pure-image';
  const variant = Number(design.layoutVariant) >= 1 && Number(design.layoutVariant) <= 7 ? Math.trunc(Number(design.layoutVariant)) : 1;
  const includeStyle = !ecommerce || design.explicitStyle !== false;
  const make = english => {
    const lines = [];
    if (includeStyle) {
      const styleEntries=fusion
        ? [[style,english?'Character / subject style: ':'角色／主体画风：'],[style2,english?'Scene / environment style: ':'场景／环境画风：']]
        : [[style,english?'Visual style: ':'画风：']];
      for (const [item,label] of styleEntries) {
        if (!item) continue;
        lines.push(`${label}${item.name}（${item.id}）`);
        if (item.author) lines.push(`${english?'Reference style: ':'参考风格名称：'}${item.author}`);
        if (item.prompt) lines.push(`${english?'Pure visual traits (never copy the sample subject): ':'纯视觉画风特征（禁止照抄示例主体）：'}${item.prompt}`);
      }
    }
    if (fusion && style && style2 && includeStyle) lines.push(english ? 'Keep the character/subject style and scene/environment style separate. The former governs subjects and linework, the latter backgrounds and spatial rendering; integrate at their boundary only.' : '【双画风融合原则】角色／主体画风与场景／环境画风分场景、分角色分别执行：前者只控制人物及主体造型，后者只控制背景环境、空间与氛围；仅在二者交界处自然协调，严禁混成单一新画风。');
    if (color) lines.push(english ? color.promptEn || color.prompt : color.prompt);
    lines.push((english ? 'Theme: ' : '主题：') + theme);
    if (text(design.scenario,240)) lines.push((english?'Scenario: ':'业务场景：') + text(design.scenario,240));
    if (text(design.audience,240)) lines.push((english?'Audience: ':'目标受众：') + text(design.audience,240));
    if (text(design.ratio,40)) lines.push((english?'Aspect ratio: ':'画幅比例：') + text(design.ratio,40));
    if (tone) lines.push((english?'Tone: ':'影调：') + (english ? tone.nameEn || tone.name : tone.name) + '。' + (english ? tone.promptEn || tone.prompt : tone.prompt));
    if (whitespaceModes[design.whitespace]) lines.push(whitespaceModes[design.whitespace][english?1:0]);
    if (text(design.brief,1200)) lines.push((english?'Art direction: ':'画面要求：') + text(design.brief,1200));
    if (mode !== 'pure-image' && text(design.copy,1600)) lines.push((english?'Copy to render: ':'画面文案：') + text(design.copy,1600));
    if (layout) {
      const template = english ? layout.promptEn || layout.prompt : layout.prompt;
      lines.push((english ? 'Layout (' : '排版图型（') + layout.id + (english ? '): ' : '）：') +
        (layout.id === 'SC-021' ? photoLayout(template,variant,english,text(design.ratio,40)) : template));
    }
    if (design.referenceUpload) lines.push(english ? redrawEn : redrawZh);
    if (mode === 'graphic-text' && !ecommerce) lines.push(english
      ? 'Integrate readable typography organically into the composition. Text and image form a unified graphic design; refine the copy only within the user’s theme.' : graphicSuffix);
    if (mode === 'pure-image') lines.push(english ? 'Pure image: do not add titles, labels, or extra readable text.' : '纯图模式：画面内不生成额外标题、标识或可读文字。');
    return lines.join('\n\n');
  };
  const promptZh = make(false), promptEn = make(true), language = outputLanguage(design);
  const prompt = language === 'en' ? promptEn : language === 'both' ? promptZh + '\n\n--- English ---\n\n' + promptEn : promptZh;
  return {prompt, promptZh,promptEn,language,mode,refs:{style:style?.id,style2:style2?.id,layout:layout?.id,color:color?.id,tone:tone?.id}};
}

export async function shouldAttachStyleReference(styleId, model, catalog, preference = 'auto') {
  if (!styleId || preference === 'never') return false;
  if (preference === 'always') return true;
  const style = (await catalog('style')).find(item => item.id === styleId);
  if (!style) throw invalid(`风格不存在：${styleId}`);
  // Automatically use a reference image for unknown/third-party models.
  const {readFile} = await import('node:fs/promises');
  const {fileURLToPath} = await import('node:url');
  const {join} = await import('node:path');
  const refs = fileURLToPath(new URL('../../skills/handdraw-style-prompter/references/model_capabilities.json', import.meta.url));
  let info;
  try {info=JSON.parse(await readFile(refs,'utf8'));}catch{return true;}
  const policy=info?.models?.[model];
  if (!policy) return true;
  return policy.styles?.[styleId]?.name_activation !== 'strong' && !(policy.traits_activation === 'strong' && style.prompt);
}
