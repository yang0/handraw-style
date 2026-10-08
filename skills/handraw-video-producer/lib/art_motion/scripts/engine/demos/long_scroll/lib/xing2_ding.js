// 一组段共用的小工具（完整片子里 27_kirby、13_pop、14_8bit、25_ghibli、26_vaporwave、16_2026 共用；本示范只用到 14_8bit）。不改 world.js / crossing.js。
// 段文件开头用 D4.need() 同步加载本文件（index.html 不用改）。
//   D4.hero(seg, s)            复刻 world.js drawHero 的取帧逻辑：返回 { key, i, o:{x,y,h}, hat:[x,y], act, u }（屏幕坐标），front 里画道具对准手/帽子用
//   D4.since(seg, s, k)        距本段第 k 个互动开始的秒数（互动前为负）——段内事件一律相对互动定时，步速改了也不错位
//   D4.frameCanvas(key, i, tag, fn)   取第 i 帧的原图，交给 fn(g, im) 加工成新画布并缓存（画风材质：像素化、海报化、霓虹描边…）
//   D4.drawFrame(c, key, i, o, cv)    按 XING.actor 的锚点规则把加工后的帧画到 (o.x, o.y)，cv.pad 为加工时四周留的边
(() => {
const D4 = window.D4 = {};
D4.SCALE = {};    // 某些互动帧库（全身＋胸像、站＋坐混排）的 ref_h 被拉偏：按 key 整套补一个缩放，D4.hero 与 hero.draw 共用
const { clamp } = U;
D4.hero = (seg, s) => {
  const WD = WORLD, hero = WD.heroAt(s.t), H0 = seg.hero || {};
  let key = H0.walk, i;
  if (hero.p.kind === 'act' && hero.p.seg === seg) { key = hero.p.act.key || H0.walk; i = hero.p.act.frame ? hero.p.act.frame(hero.u) : 0; }
  else { const walked = WD.plan.filter(q => q.kind === 'walk' && q.t0 <= s.t).reduce((a, q) => a + Math.min(s.t, q.t1) - q.t0, 0); i = Math.floor(walked * (H0.fps || 8.5) * WD.V / 330) % XING.nFrames(key); }   // 与 world.js 同：步频随步速同比例
  const lx = hero.x - seg.x0;
  const gy = (hero.p.kind === 'act' && hero.p.seg === seg && hero.p.act.y) ? hero.p.act.y(lx, hero.u) : (seg.ground ? seg.ground(lx) : WD.GROUND);
  const o = { x: lx - s.camX, y: gy, h: H0.h || WD.HERO_H, scale: D4.SCALE[key] || 1 };
  return { key, i, o, lx, hat: XING.hatTop(key, i, o), act: hero.p.kind === 'act' && hero.p.seg === seg ? hero.p.act : null, u: hero.u };
};
const FC = {};
D4.img = (key, i) => window.IMG[`demos/long_scroll/frames/${key}/${XING.SPR[key].meta.frames[i].file}`];
D4.frameCanvas = (key, i, tag, fn) => {
  const k = key + '|' + i + '|' + tag; if (FC[k]) return FC[k];
  const im = D4.img(key, i); const cv = fn(im); FC[k] = cv; return cv;
};
D4.drawFrame = (c, key, i, o, cv, alpha) => {
  const f = XING.SPR[key].meta.frames[i], s = o.h / XING.SPR[key].meta.ref_h * (o.scale || 1), pad = cv.pad || 0, k = cv.k || 1;
  const fx = o.flip ? -1 : 1;
  c.save(); if (alpha != null) c.globalAlpha *= alpha;
  if (o.shadow) { c.fillStyle = o.shadow; c.beginPath(); c.ellipse(o.x, o.y + 2, o.h * 0.2, o.h * 0.035, 0, 0, Math.PI * 2); c.fill(); }
  c.translate(o.x, o.y); c.scale(fx, 1);
  if (cv.pixel) c.imageSmoothingEnabled = false;
  c.drawImage(cv, -(f.ax + pad) * s, -(f.ay + pad) * s, cv.width / k * s, cv.height / k * s);
  c.restore();
};
// 一个 im → 留边画布
D4.padded = (im, pad) => { const cv = PAINT.canvas(im.width + 2 * pad, im.height + 2 * pad); cv.getContext('2d').drawImage(im, pad, pad); cv.pad = pad; return cv; };
// 抛物线：从 a 到 b（u 0..1），返回 [x,y,u]
D4.arc = (a, b, u, peak = 200) => { const e = clamp(u); return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e - Math.sin(e * Math.PI) * peak, e]; };
D4.since = (seg, s, k = 0) => s.t - WORLD.actT(seg, k);
})();
