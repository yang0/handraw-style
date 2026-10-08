// 示范 · 长卷穿越片：一条横向长画卷，几个「世界段」首尾相接，主角从左走到右，跨过边界时画风跟着换。
// 这里只收了 3 段（埃及壁画 → 莫奈《日本桥》→ 8-bit 像素），完整片子是 24 段，做法见 references/11-长卷穿越片.md。
//   预览 index.html?film=demos/long_scroll   渲染 render.py --film demos/long_scroll --out long_scroll.mp4
// 骨架 lib/world.js 管时间轴、主角行进、只进不退的相机、按边界裁开的主角、角标；每段一个文件 segments/<id>.js，调用 WORLD.add({...})。
(() => {
  window.__bootErrors = window.__bootErrors || [];
  const base = 'demos/long_scroll/';
  const load = url => { const x = new XMLHttpRequest(); x.open('GET', url, false); x.send(); if (x.status !== 200) { __bootErrors.push(`${url} 不存在 (HTTP ${x.status})`); return; }
    try { (0, eval)(x.responseText + `\n//# sourceURL=${url}`); } catch (e) { __bootErrors.push(`${url} 执行出错 ${e && e.stack || e}`); } };
  load(base + 'lib/crossing.js');                 // XING：角色帧库、笔触材质、莫奈世界
  load(base + 'lib/acts.js');                     // ACT：打水漂的石子轨迹等小剧本工具
  load(base + 'lib/world.js');                    // WORLD：长卷骨架
  // 片子顺序：改顺序、加段只改这里（加段 = 往 segments/ 放一个文件，再把 id 写进来）
  window.FILM_ORDER = ['02_egypt', '28_monet', '14_8bit'];
  for (const id of window.FILM_ORDER) { const n = WORLD.segs.length; load(`${base}segments/${id}.js`);
    if (WORLD.segs.length === n || WORLD.segs[WORLD.segs.length - 1].id !== id) __bootErrors.push(`segments/${id}.js 没有 WORLD.add({ id: '${id}', ... })`); }
  // 每段用到的帧库（hero.walk、acts[].key、sprites）一次性登记成资源，引擎启动前全部加载
  const sprites = new Set(); WORLD.segs.forEach(s => { if (s.hero && s.hero.walk) sprites.add(s.hero.walk); (s.acts || []).forEach(a => a.key && sprites.add(a.key)); (s.sprites || []).forEach(k => sprites.add(k)); });
  try { window.EXTRA_ASSETS = (window.EXTRA_ASSETS || []).concat(XING.sprites([...sprites])); } catch (e) { __bootErrors.push('帧库缺失：' + e.message); }
  WORLD.layout();
  window.PUNCH = 0;
  window.ERAS = [{ id: 'film', dur: WORLD.total, draw: (c, lt, t) => WORLD.draw(c, t) }];
})();
