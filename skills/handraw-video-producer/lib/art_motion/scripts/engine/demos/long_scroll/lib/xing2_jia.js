// 一组段共用的小工具（完整片子里 01_cave 02_egypt 03_greek 20_dunhuang 17_ink 05_gothic 共用；本示范只用到 02_egypt）。各段文件开头用 XJ_LOAD 同步加载，不进 index.html。
//   XJ.actor(c, key, i, o, name, proc)   用本段材质画主角帧：proc(g, w, h, i, img) 在「帧＋pad」画布上做该画风的材料处理，结果按 key/帧/name 缓存
//   XJ.texInside(g, w, h, draw, op)      纹理只乘在角色上（纹理层 destination-in 剪影 → multiply 回去），白帽不变灰：纹理请用接近白的底
//   XJ.ta(seg, s)                        互动内秒（全片时刻 − WORLD.actT(seg)；互动前为负）——段里所有事件都按它定时，步速改了也对得上
//   XJ.hatNow(seg, s)                    互动进行中：帽顶在屏幕上的位置
//   XJ.arc(p0, p1, q, lift)              两点间抛物线
//   XJ.actFrame(table)                   [[秒, 帧], ...] → frame(u) 函数（u = 动作内秒）
(() => {
if (window.XJ) return;
const { clamp, lerp } = U, P = PAINT, TAU = Math.PI * 2;
const XJ = window.XJ = {};
const MATS = {};
XJ.mat = (key, i, name, proc, pad = 6) => {
  const k = key + '|' + i + '|' + name; if (MATS[k]) return MATS[k];
  const S = XING.SPR[key], im = S.imgs[i];
  const out = P.canvas(im.width + 2 * pad, im.height + 2 * pad), g = out.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, pad, pad);
  if (proc) proc(g, out.width, out.height, i, im, pad);
  out.pad = pad; MATS[k] = out; return out;
};
XJ.actor = (c, key, i, o, name, proc) => {
  XING.hatTop(key, i, o);                                   // 触发 crossing.js 里的 ensure（读帧、算帽顶）
  const S = XING.SPR[key], f = S.meta.frames[i], im = XJ.mat(key, i, name, proc), pad = im.pad, s = o.h / S.meta.ref_h * (o.scale || 1);
  const x0 = o.x - (f.ax + pad) * s, y0 = o.y - (f.ay + pad) * s;
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha;
  if (o.shadow) { c.fillStyle = o.shadow; c.beginPath(); c.ellipse(o.x, o.y + 2, o.h * 0.2, o.h * 0.035, 0, 0, TAU); c.fill(); }
  if (!o.lock) c.drawImage(im, x0, y0, im.width * s, im.height * s);
  else {   // 脚底锁：上半身照常（平滑）；膝盖往下用一个连续的错切把下半段平移到 o.lock，鞋（底部 9%）整块平移满——支撑脚贴住地面不打滑
    const iw = im.width, foot = f.ay + pad, cut = Math.max(0, foot - S.meta.ref_h * 0.4), full = foot - S.meta.ref_h * 0.09;
    c.drawImage(im, 0, 0, iw, cut, x0, y0, iw * s, cut * s);
    c.save(); c.beginPath(); c.rect(x0 - 200, y0 + cut * s, iw * s + 400, (full - cut) * s); c.clip();
    c.translate(0, y0 + cut * s); c.transform(1, 0, o.lock / ((full - cut) * s), 1, 0, 0); c.drawImage(im, x0, -cut * s, iw * s, im.height * s); c.restore();
    c.drawImage(im, 0, full, iw, im.height - full, x0 + o.lock, y0 + full * s, iw * s, (im.height - full) * s);
  }
  c.restore();
};
// 走路脚底锁的平移量（屏幕 px）。st = 每帧支撑脚相对锚点的 x（身高 300 时，从走路帧逐帧量出），fps = 该帧库在步速 330 时的帧率（与 hero.fps 一致）。
// 原理：一个半周期（4 帧）里支撑脚的世界位置不变；平滑行进的身体相对它走了 V·τ，画里的脚相对锚点退了 st0−stj，两者之差就是这一刻该把脚挪回去的量。
// 段两端 220px 内渐隐到 0（跨边界时两边帧库不同，避免左右半身错位）。
XJ.walkLock = (seg, S, i, st, fps, h = 300) => {
  if (S.act) return 0; const t = S.t, P0 = WORLD.plan.find(q => t >= q.t0 && t < q.t1); if (!P0 || P0.kind !== 'walk') return 0;
  const walked = WORLD.plan.filter(q => q.kind === 'walk' && q.t0 <= t).reduce((a, q) => a + Math.min(t, q.t1) - q.t0, 0);
  const rate = fps * WORLD.V / 330, ph = walked * rate, h0 = Math.floor(ph / 4) * 4, tau = (ph - h0) / rate;
  const k0 = h0 % 8, n = st.length; const lock = ((st[k0 % n] - st[i % n]) * h / 300 - WORLD.V * tau);
  const L = U.ss(0, 220, S.hx) * U.ss(0, 220, seg.w - S.hx);
  return clamp(lock, -70, 40) * L;
};
XJ.texInside = (g, w, h, draw, op = 'multiply', alpha = 1, skipWhite = false) => {
  const T = P.canvas(w, h), tg = T.getContext('2d');
  draw(tg, w, h);
  tg.globalCompositeOperation = 'destination-in'; tg.drawImage(g.canvas, 0, 0);
  if (skipWhite) { tg.globalCompositeOperation = 'destination-out'; tg.drawImage(XJ.whiteMask(g, w, h), 0, 0); }   // 白帽白T不上做旧（角色设定：帽子纯白）
  g.save(); g.globalCompositeOperation = op; g.globalAlpha = alpha; g.drawImage(T, 0, 0); g.restore();
};
// 逐像素改色（白帽护白等）：fn(r,g,b,a) → [r,g,b] 或 null
XJ.remap = (g, w, h, fn) => { const d = g.getImageData(0, 0, w, h), q = d.data;
  for (let k = 0; k < q.length; k += 4) { if (q[k + 3] < 8) continue; const r = fn(q[k], q[k + 1], q[k + 2], q[k + 3], (k >> 2) % w, (k >> 2) / w | 0); if (r) { q[k] = r[0]; q[k + 1] = r[1]; q[k + 2] = r[2]; if (r.length > 3) q[k + 3] = r[3]; } }
  g.putImageData(d, 0, 0); };
// 白色区域蒙版（亮且低饱和），给 texInside 挖掉
XJ.whiteMask = (g, w, h) => { const d = g.getImageData(0, 0, w, h).data, M = P.canvas(w, h), mg = M.getContext('2d'), o = mg.createImageData(w, h);
  for (let k = 0; k < w * h; k++) { const r = d[k * 4], gg = d[k * 4 + 1], b = d[k * 4 + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); o.data[k * 4 + 3] = d[k * 4 + 3] > 100 && mx > 200 && mx - mn < 50 ? 255 : 0; }
  mg.putImageData(o, 0, 0); return M; };
// 帽区（上 frac）里的做旧斑点抹白：周围 5×5 有六成以上是白的、自身又不暗的像素＝白帽上的斑点 → 换成纯白（帽檐的勾线周围白不足六成，保留）
XJ.cleanHat = (g, w, h, frac = 0.34, white = [250, 248, 242], R = 2, wmin = 205) => { const D = g.getImageData(0, 0, w, h), d = D.data, Y = Math.floor(h * frac), wt = new Uint8Array(w * Y);
  for (let y = 0; y < Y; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, mx = Math.max(d[k], d[k + 1], d[k + 2]), mn = Math.min(d[k], d[k + 1], d[k + 2]); wt[y * w + x] = d[k + 3] > 100 && mx > wmin && mx - mn < 45 ? 1 : 0; }
  const need = Math.ceil((2 * R + 1) ** 2 * 0.55);
  for (let y = R; y < Y - R; y++) for (let x = R; x < w - R; x++) { const k = (y * w + x) * 4; if (d[k + 3] < 100 || wt[y * w + x]) continue; const lum = d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11; if (lum < 95) continue;
    let n = 0; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) n += wt[(y + dy) * w + x + dx]; if (n >= need) { d[k] = white[0]; d[k + 1] = white[1]; d[k + 2] = white[2]; } }
  g.putImageData(D, 0, 0); };
XJ.ta = (seg, s, k = 0) => s.t - WORLD.actT(seg, k);
XJ.hatNow = (seg, s) => {
  const a = s.act; if (!a) return null;
  const key = a.a.key, i = a.a.frame ? a.a.frame(a.u) : 0, h = (seg.hero && seg.hero.h) || WORLD.HERO_H;
  const x = s.hx - s.camX, y = a.a.y ? a.a.y(s.hx, a.u) : (seg.ground ? seg.ground(s.hx) : WORLD.GROUND);
  return XING.hatTop(key, i, { x, y, h });
};
XJ.arc = (p0, p1, q, lift = 120) => [lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q) - 4 * lift * q * (1 - q)];
// 停下/起步不再一帧刹死、一帧满速：互动开头 Tb 秒从步速匀减到 0、末尾 Tb 秒从 0 匀加回步速（镜头跟着他，所以镜头也是缓停缓起）。
// extra(u) 可叠加互动自己的位移（如被甩飞），extraDx 是它的总位移。返回 { dx, move } 直接展开进 acts 项（并配 lead: 0，免得镜头先冲再倒带）。
XJ.glide = (dur, Tb = 0.22, extra = null, extraDx = 0) => { const V = WORLD.V, d1 = V * Tb / 2, dx = 2 * d1 + extraDx;
  const pos = u => (u < Tb ? V * (u - u * u / (2 * Tb)) : d1) + (u > dur - Tb ? V * (u - (dur - Tb)) ** 2 / (2 * Tb) : 0) + (extra ? extra(u) : 0);
  return { dx, move: f => dx ? pos(f * dur) / dx : 0 }; };
// 缓停/缓起窗口里不播互动帧，接着播走路帧：步频随速度降到 0 再升回来，与互动前后的走路相位首尾相接
XJ.walkedAt = t => WORLD.plan.filter(q => q.kind === 'walk' && q.t0 <= t).reduce((a, q) => a + Math.min(t, q.t1) - q.t0, 0);
XJ.glideWalk = (S, dur, fps, n = 8, Tb = 0.22, head = true, tail = true) => {
  if (!S.act) return null; const u = S.act.u, V = WORLD.V, rate = fps * V / 330, ph0 = XJ.walkedAt(S.t - u) * rate, d1 = V * Tb / 2;
  let ph = null;
  if (head && u < Tb) ph = ph0 + (V * (u - u * u / (2 * Tb))) / V * rate;
  else if (tail && u > dur - Tb) { const w = u - (dur - Tb); ph = ph0 - (d1 - V * w * w / (2 * Tb)) / V * rate; }
  return ph == null ? null : ((Math.floor(ph) % n) + n) % n;
};
XJ.actFrame = tab => u => { let f = tab[0][1]; for (const [t0, fr] of tab) if (u >= t0) f = fr; return f; };
// 只在本段可见范围内画：lx 世界坐标 → 屏幕
XJ.vis = (s, lx, pad = 300) => lx - s.camX > -pad && lx - s.camX < s.W + pad;
// 跨边界的颜料迸散：crossing.js 只有 monet / vg 两套颜色。这里只给本组的 burst 名（'jia_*'）换色，其余照旧交回原函数（不改 crossing.js）
XJ.BURST = {
  jia_cave: ['#9c3520', '#c9772f', '#21150d', '#d49a5a', '#74261a'],
  jia_egypt: ['#1f4fa0', '#c0392b', '#2f8a5a', '#e0b030', '#1a1a1a'],
  jia_greek: ['#1a1410', '#c8602a', '#e8d2b0', '#7a2a1a'],
  jia_dunhuang: ['#2f5f8f', '#3f8f6e', '#a5452f', '#ecdfc4', '#d8b05a'],
  jia_ink: ['#1a1a1a', '#3a3a3a', '#6a6a6a', '#9a9a9a', '#b8322a'],
  jia_gothic: ['#e8c45a', '#1f3f9f', '#b8202a', '#f6e6a8', '#2f7a3a'],
};
if (XING.burst && !XING.burst.__jia) {
  const orig = XING.burst;
  XING.burst = (c, x, y, a, R, style, seed = 1) => {
    const cols = XJ.BURST[style]; if (!cols) return orig(c, x, y, a, R, style, seed); if (a < 0 || a > 1) return;
    const r = U.rng(seed); c.save(); c.lineCap = 'round';
    for (let i = 0; i < 70; i++) { const ang = r() * TAU, sp = R * (0.55 + r() * 0.8), d = 150 + sp * U.ease.out(a), x1 = x + Math.cos(ang) * d, y1 = y + Math.sin(ang) * d * 0.8 + 120 * a * a;   // 从人身外一圈迸开，不压在他身上（审片：彩条留在白T上）
      c.strokeStyle = cols[i % cols.length]; c.globalAlpha = 1 - a; c.lineWidth = 7 + r() * 6; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + Math.cos(ang) * 16, y1 + Math.sin(ang) * 10); c.stroke(); }
    c.restore(); };
  XING.burst.__jia = true;
}
})();
