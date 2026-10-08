// S03 · 8-bit 像素游戏「闯关」。风格卡 references/风格配方/14_8bit.md、标杆 scenes/14_8bit.js。
// 管线：整幅在 240×135 低分辨率上逐像素画（1 低像素 = 8 屏幕像素），限 NES 色板 → 最近邻放大 8 倍；
//      火箭＝RK.falcon1 的真实比例路径缩到低分辨率 → 阈值去抗锯齿＋量化＋1px 黑描边（spriteize）；
//      动作按 20fps 步进（像素游戏的一顿一顿），HUD 用 PressStart2P 64/128px（1 字体像素 = 8/16 屏幕像素）；中文年份牌用普惠体在低分辨率上画再二值化（像素化中文）。
// 剧情：太平洋小岛发射台（夸贾林环礁欧姆莱克岛：棕榈、海）→ FALCON 1 标题 → 2006/2007/2008年8月 三次 GAME OVER，右上 4 颗心一颗颗灭
//      → 第四次 LAST TRY（最后一颗心）→ 升空、卷轴进太空 → 绕像素地球入轨 STAGE CLEAR → 对话框打出 1ST PRIVATE LIQUID-FUEL ROCKET IN ORBIT。
(() => {
const W = 1920, H = 1080, S = 8, LW = 240, LH = 135, ID = 's03';
const { clamp, lerp, rng } = U, P = PAINT;
const C = {
  k: '#000000', w: '#fcfcfc', g: '#bcbcbc', gd: '#7c7c7c', gdd: '#404040',
  sky0: '#0078f8', sky1: '#3cbcfc', sky2: '#a4e4fc', sea: '#0058f8', seaDk: '#0000bc', navy: '#000058',
  sand: '#f8d878', sandDk: '#d8a038', trunk: '#ac7c00', trunkDk: '#503000', leaf: '#00a800', leafHi: '#58d854', leafDk: '#005800',
  y: '#f8b800', o: '#fca044', r: '#e45c10', rd: '#a81000', pink: '#f878f8', red: '#d82800', land: '#00a800', landDk: '#005800',
};
const PAL = Object.values(C).map(P.hex);
const px = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
let Q = null;
const cues = () => Q || (Q = (() => {
  const q = k => TM.cue(ID, k);
  return { spawn: q('火箭'), title: q('猎鹰1号'), a: [q('2006年'), q('2007年'), q('2008年8月'), q('第四次')],
    f: [q('失败；2007'), q('失败；2008'), q('失败。')], ok: q('成了'), le: q('了，成为'), banner: q('成为第一枚'), voEnd: TM.vo(ID)[1] };
})());

// ---------- 精灵化：低分辨率 AA 路径 → 阈值＋量化到色板＋外描黑边 ----------
function spriteize(g, w, h) {
  const im = g.getImageData(0, 0, w, h), d = im.data, op = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] < 100) { d[i * 4 + 3] = 0; continue; }
    let best = 0, bd = 1e9; for (let j = 0; j < PAL.length; j++) { const q = PAL[j], dd = (d[i * 4] - q[0]) ** 2 + (d[i * 4 + 1] - q[1]) ** 2 + (d[i * 4 + 2] - q[2]) ** 2; if (dd < bd) { bd = dd; best = j; } }
    const q = PAL[best]; d[i * 4] = q[0]; d[i * 4 + 1] = q[1]; d[i * 4 + 2] = q[2]; d[i * 4 + 3] = 255; op[i] = 1;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (op[i]) continue;
    if ((x > 0 && op[i - 1]) || (x < w - 1 && op[i + 1]) || (y > 0 && op[i - w]) || (y < h - 1 && op[i + w])) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; } }
  g.putImageData(im, 0, 0);
}
// 猎鹰1号精灵（RK.falcon1 真实比例，高 hpx 低像素），按角度缓存；锚点 = 箭底中心
const F1 = RK.falcon1(), SPR = {};
function rocketSprite(hpx, ang) {
  const a = Math.round(ang / 0.13) * 0.13, key = hpx + '|' + a.toFixed(2);
  if (SPR[key]) return SPR[key];
  const N = Math.ceil(hpx * 1.3) + 6, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d', { willReadFrequently: true }), s = hpx / F1.h;
  g.translate(N / 2, N / 2); g.rotate(a); g.translate(0, hpx * 0.45); g.scale(s, s);
  for (const q of F1.parts) { g.fillStyle = q.k === 'dark' ? C.k : q.k === 'engine' ? C.gd : C.w; g.fill(q.p); }
  g.fillStyle = C.g; g.fillRect(F1.w * 0.12, -15.4, F1.w * 0.38, 15.2);                    // 右侧一道灰：圆柱的明暗
  g.setTransform(1, 0, 0, 1, 0, 0); spriteize(g, N, N);
  return (SPR[key] = { cv, ox: N / 2 - Math.sin(a) * hpx * 0.45, oy: N / 2 + Math.cos(a) * hpx * 0.45 });
}
const drawRocket = (g, x, y, hpx, ang = 0) => { const s = rocketSprite(hpx, ang); g.drawImage(s.cv, Math.round(x - s.ox), Math.round(y - s.oy)); };
// 像素尾焰：三帧交替（20fps）
const flamePx = (g, x, y, len, st, big = 1) => {
  const f = Math.floor(st * 20) % 3, L = len + [0, 2, 1][f];
  for (let j = 0; j < L; j++) { const q = j / L, w = Math.max(1, Math.round((3 - q * 2.5) * big)), col = q < 0.25 ? C.w : q < 0.55 ? C.y : q < 0.8 ? C.o : C.r;
    px(g, Math.round(x - w / 2 + ((j + f) % 3 === 0 && q > 0.5 ? 1 : 0)), y + j, w, 1, col); }
};
// 爆炸：种子粒子，颜色按年龄 白→黄→橙→红→灰
const boom = (g, x, y, age, seed, big = 1) => {
  if (age < 0 || age > 0.9) return;
  const r = rng(seed); if (age < 0.12) { const R = Math.round((3 + age * 60) * big); for (let j = -R; j <= R; j++) { const w = Math.round(Math.sqrt(R * R - j * j)); px(g, x - w, y + j, w * 2 + 1, 1, age < 0.06 ? C.w : C.y); } }
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, v = (14 + r() * 46) * big, life = 0.35 + r() * 0.5, sz = r() < 0.35 ? 3 : 2; if (age > life) continue;
    const q = age / life, d = v * (1 - Math.exp(-age * 5)) / 5 * 5 * 0.25 * 4;
    const col = q < 0.18 ? C.w : q < 0.38 ? C.y : q < 0.6 ? C.o : q < 0.8 ? C.r : C.gd;
    px(g, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.8 + age * age * 30), sz, sz, col);
  }
};

// ---------- 静态背景：岛、海、天 ----------
function islandBg(g) {
  for (let y = 0; y < 78; y++) for (let x = 0; x < LW; x++) {
    const q = y / 78; let col = q < 0.35 ? C.sky0 : q < 0.7 ? C.sky1 : C.sky2;
    if (Math.abs(q - 0.35) < 0.04 && (x + y) % 2) col = C.sky1; if (Math.abs(q - 0.7) < 0.04 && (x + y) % 2) col = q < 0.7 ? C.sky2 : C.sky1;
    px(g, x, y, 1, 1, col);
  }
  px(g, 0, 78, LW, 1, C.sky2); px(g, 0, 79, LW, 56, C.sea);
  for (let y = 100; y < LH; y++) for (let x = 0; x < LW; x++) if ((y > 118 || (x + y) % 2 === 0 && y > 108)) px(g, x, y, 1, 1, C.seaDk);
  // 远处的环礁小岛
  for (const [cx, w] of [[26, 16], [58, 8]]) { px(g, cx - w / 2, 77, w, 2, C.sandDk); px(g, cx - w / 2 + 2, 76, w - 4, 1, C.leafDk); }
  // 主岛（沙丘）
  for (let x = 84; x <= 220; x++) { const u = (x - 152) / 68, h = Math.round(9 * Math.sqrt(Math.max(0, 1 - u * u))); if (h <= 0) continue;
    px(g, x, 104 - h, 1, h + 6, C.sand); px(g, x, 104 - h, 1, 1, '#fcfcfc'); px(g, x, 108, 1, 2, C.sandDk); }
  // 发射台：混凝土台＋导流槽；勤务塔（桁架）
  px(g, 158, 96, 28, 1, C.k); px(g, 158, 97, 28, 4, C.g); px(g, 158, 100, 28, 1, C.gd); px(g, 166, 97, 10, 2, C.gdd);
  px(g, 180, 46, 1, 51, C.k); px(g, 185, 46, 1, 51, C.k); px(g, 181, 46, 4, 51, C.gd);
  for (let y = 48; y < 96; y += 6) { for (let i = 0; i < 4; i++) { px(g, 181 + i, y + i, 1, 1, C.gdd); px(g, 184 - i, y + i + 3 > 95 ? 95 : y + i + 3, 1, 1, C.gdd); } px(g, 180, y, 6, 1, C.k); }
  px(g, 179, 45, 8, 1, C.k); px(g, 182, 42, 2, 3, C.gdd); px(g, 177, 62, 3, 1, C.gdd); px(g, 177, 78, 3, 1, C.gdd);   // 塔顶避雷针、两根脐带臂
}
// 棕榈树：树干一段段弯，叶片 5 条弧，sway 整像素摆
function palm(g, x0, y0, h, lean, sway) {
  let x = x0; for (let j = 0; j < h; j++) { const xx = Math.round(x0 + lean * (j / h) ** 2 * h * 0.35 + (j > h * 0.7 ? sway * (j - h * 0.7) / (h * 0.3) : 0)); px(g, xx - 1, y0 - j, 3, 1, j % 3 ? C.trunk : C.trunkDk); px(g, xx - 2, y0 - j, 1, 1, C.k); px(g, xx + 2, y0 - j, 1, 1, C.k); x = xx; }
  const tx = x, ty = y0 - h;
  const fr = [[-1, 0.15], [-0.55, -0.5], [0, -0.85], [0.55, -0.5], [1, 0.15]];
  for (const [dx, dy] of fr) for (let i = 1; i <= 10; i++) { const fx = Math.round(tx + dx * i + sway * (i / 10)), fy = Math.round(ty + dy * i * 0.7 + (i * i) * 0.06);
    px(g, fx - 1, fy - 1, 3, 3, C.k); }
  for (const [dx, dy] of fr) for (let i = 1; i <= 10; i++) { const fx = Math.round(tx + dx * i + sway * (i / 10)), fy = Math.round(ty + dy * i * 0.7 + (i * i) * 0.06);
    px(g, fx, fy, 1 + (i < 8 ? 1 : 0), 1, i % 2 ? C.leaf : C.leafHi); }
  px(g, tx - 1, ty, 3, 2, C.trunkDk);
}
// 会动的部分：云、浪、棕榈
function islandLive(g, st) {
  const cs = Math.floor(st * 6);
  for (const [x0, y, w] of [[30, 14, 22], [130, 26, 16], [210, 8, 18]]) { const x = ((x0 - cs) % (LW + 40) + LW + 40) % (LW + 40) - 20;
    px(g, x + 3, y - 2, w - 8, 2, C.w); px(g, x, y, w, 3, C.w); px(g, x + 2, y + 3, w - 4, 1, C.sky2); }
  const wf = Math.floor(st * 5);
  for (let r = 0; r < 6; r++) { const y = 84 + r * 6 + (r > 2 ? 4 : 0); for (let x = (r * 13 + wf * (r % 2 ? 2 : -2)) % 24 - 24; x < LW; x += 24) if (y < 100 || x < 80 || x > 222) px(g, x, y, 4, 1, r > 3 ? C.sea : C.sky1); }
  for (let x = 84; x <= 220; x += 1) { if ((x + wf) % 4 === 0) px(g, x, 110, 2, 1, C.w); }
  const sw = [0, 1, 0, -1][Math.floor(st * 4) % 4];
  palm(g, 100, 101, 26, -1, sw); palm(g, 118, 99, 20, 1, -sw); palm(g, 206, 100, 22, 1, sw);
}
// ---------- 地球（入轨画面）：逐像素球面＋噪声大陆＋明暗交界抖动 ----------
const ER = 105, ECX = 150, ECY = 206, ORB = 126;
function earth(st) {
  const key = 'e' + Math.floor(st * 10), cv = P.cached('s03_earth', ER * 2 + 4, ER * 2 + 4, () => {});
  if (earth.k === key) return cv; earth.k = key;
  const g = cv.getContext('2d', { willReadFrequently: true }), N = ER * 2 + 4, im = g.createImageData(N, N), d = im.data, rot = Math.floor(st * 10) * 0.02;
  const put = (i, hex) => { const c = P.hex(hex); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const nx = (x - N / 2 + 0.5) / ER, ny = (y - N / 2 + 0.5) / ER, r2 = nx * nx + ny * ny, i = y * N + x;
    if (r2 > 1.0) { if (r2 < 1.06) put(i, C.sky1); continue; }
    const nz = Math.sqrt(1 - r2), lon = Math.atan2(nx, nz) + rot, lat = Math.asin(-ny);
    const land = P.noise(lon * 1.6 + 10, lat * 2.4) + 0.4 * P.noise(lon * 4 + 3, lat * 5) > 0.18, cloud = P.noise(lon * 3 + 40 + rot * 2, lat * 7) > 0.42;
    const lit = -0.55 * nx - 0.45 * ny + 0.7 * nz;
    let col = cloud ? C.w : land ? C.land : C.sea;
    if (lit < 0.25 && ((x + y) % 2 || lit < 0.05)) col = cloud ? C.g : land ? C.landDk : C.seaDk;
    if (lit < -0.15) col = C.navy;
    put(i, col);
  }
  g.putImageData(im, 0, 0); return cv;
}
// ---------- 字 ----------
const ptext = (c, s, x, y, size, col, align = 'center', alpha = 1) => {
  c.save(); c.globalAlpha = alpha; c.font = `${size}px "PressStart2P-400"`; c.textBaseline = 'top'; c.textAlign = align;
  const o = size / 8; c.fillStyle = '#000'; c.fillText(s, x + o, y + o); c.fillStyle = col; c.fillText(s, x, y); c.restore();
};
// 像素化中文：普惠体在低分辨率上画 → 二值化 → 外描黑边
const LTX = {};
function lowText(str, size = 13) {
  if (LTX[str]) return LTX[str];
  const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true }); g.font = `${size}px "PuHui-Heavy"`;
  cv.width = Math.ceil(g.measureText(str).width) + 4; cv.height = size + 6;
  g.font = `${size}px "PuHui-Heavy"`; g.textBaseline = 'top'; g.fillStyle = C.w; g.fillText(str, 2, 2);
  const im = g.getImageData(0, 0, cv.width, cv.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] >= 120) { d[i] = d[i + 1] = d[i + 2] = 252; d[i + 3] = 255; } else d[i + 3] = 0; }
  g.putImageData(im, 0, 0); spriteize(g, cv.width, cv.height);
  return (LTX[str] = cv);
}
const HEART = ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
const HEARTE = ['.kk.kk.', 'k..k..k', 'k.....k', 'k.....k', '.k...k.', '..k.k..', '...k...'];
const heart = (c, rows, x, y, map) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { c.fillStyle = map[ch]; c.fillRect(x + i * S, y + j * S, S, S); } }));

// ---------- 每次尝试的火箭轨迹 ----------
// 返回 {x, y(箭底), ang, flame, vis, alt(卷轴高度)}；u = 起飞后秒数（20fps 步进）
const PADX = 171, PADY = 96, RH = 48;
function attempt(i, st) {
  const q = cues(), a = q.a[i], L = a + 0.42, u = Math.max(0, st - L);
  const o = { x: PADX, y: PADY, ang: 0, flame: st > a + 0.24 ? (u > 0 ? 7 + Math.min(10, u * 30) : 3) : 0, vis: true, alt: 0, u };
  if (i < 3) {
    const uf = q.f[i] - 0.03 - L, yf = [68, 60, 52][i], k = (PADY - yf) / (uf * uf);
    const uu = Math.min(u, uf); o.y = PADY - k * uu * uu;
    if (i === 1 && u > uf) { const d = u - uf; o.flame = 0; o.ang = 2.6 * d + 0.6 * d * d; o.y = yf + 260 * d * d - 18 * d; o.x = PADX + 22 * d; }   // 2007：熄火、翻滚、掉下去
    else if (u > uf) o.vis = false;                                                                               // 2006 / 2008.8：炸了
  } else {
    const alt = 120 * u * u + 200 * u * u * u; o.alt = alt;
    o.y = Math.max(PADY - alt, 60); o.alt = Math.max(0, alt - (PADY - 60));
  }
  o.y = Math.round(o.y); return o;
}

SCENES[ID] = {
  init() {
    U.assertGlyphs('PressStart2P-400', 'FALCON 1GAMEOVERLASTTRYSTAGECLEAR!1STPRIVATELIQUID-FUELROCKETINORBIT', ID);
    U.assertGlyphs('PuHui-Heavy', '2006年2007年2008年8月9月', ID);
  },
  draw(c, lt, t) {
    const q = cues(), st = U.stepTime(lt, 20);
    const L = P.cached('s03_low', LW, LH, () => {}), g = L.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    const tOrb = q.le - 0.08, inOrbit = st >= tOrb;
    let k = 0; for (let i = 0; i < 4; i++) if (st >= q.a[i]) k = i;                    // 当前第几次（开场到 2006 之前算第 0 次的待机）
    // 屏幕抖动：爆炸后 0.25s
    let shake = 0; for (let i = 0; i < 3; i++) { const d = st - q.f[i]; if (d >= 0 && d < 0.25 && i !== 1) shake = [1, -1, 1, 0, -1][Math.floor(d * 20) % 5]; }
    if (!inOrbit) {
      const A = attempt(k, st), scroll = k === 3 ? Math.round(A.alt) : 0;
      // 天：卷轴往上时，上面接深蓝→午夜蓝→黑（带星）
      px(g, 0, 0, LW, LH, C.k);
      g.drawImage(P.cached('s03_island', LW, LH, islandBg), shake, scroll);
      if (scroll > 0) for (let y = 0; y < Math.min(LH, scroll); y++) { const wy = y - scroll; const col = wy > -30 ? C.sky0 : wy > -70 ? C.seaDk : wy > -110 ? C.navy : C.k;
        if (col !== C.k) px(g, 0, y, LW, 1, col); else { const r = U.hash(y, 7); if (r < 0.12) px(g, Math.floor(U.hash(y, 3) * LW), y, 1, 1, C.w); } }
      g.save(); g.translate(shake, scroll); islandLive(g, st);
      // 火箭：开场「火箭」时闪着刷出来；每次重来也闪着刷出
      const spawn = k === 0 && st < q.a[0] ? q.spawn : q.a[k] - 0.02, blink = st - spawn < 0.4 && Math.floor((st - spawn) * 15) % 2 === 1;
      if (st >= q.spawn && A.vis && !blink) {
        if (A.u > 0 && A.u < 0.7) for (let j = 0; j < 6; j++) { const r = Math.round(2 + A.u * 18 + j % 3), sx = PADX + (j - 2.5) * 6 * (0.4 + A.u); px(g, Math.round(sx - r / 2), PADY + 1 - Math.round(r / 3), r, Math.round(r / 2), j % 2 ? C.w : C.g); }
        if (A.flame > 0) flamePx(g, A.x, A.y + 2, Math.round(A.flame), st, A.u > 0 ? 1.2 : 0.8);
        drawRocket(g, A.x, A.y, RH, A.ang);
      }
      // 三次失败的爆炸（2007 是熄火翻滚后在海面炸开一朵小的）
      for (let i = 0; i < 3; i++) { if (k !== i) continue; const Ai = attempt(i, q.f[i] - 0.03);
        if (i === 1) { const d = st - q.f[i]; if (d > 0.36) boom(g, PADX + 14, 92, d - 0.36, 21, 0.5); }
        else boom(g, Ai.x, Ai.y - RH * 0.55, st - q.f[i] + 0.03, 11 + i * 7, i === 2 ? 1.25 : 1); }
      g.restore();
    } else {
      // 入轨：黑底、闪星、像素地球自转、火箭沿椭圆轨道飞
      px(g, 0, 0, LW, LH, C.k);
      const tw = Math.floor(st * 6);
      for (let i = 0; i < 90; i++) { const x = Math.floor(U.hash(i, 1) * LW), y = Math.floor(U.hash(i, 2) * 110), on = U.hash(i, tw) > 0.15; if (on) px(g, x, y, 1, 1, U.hash(i, 5) < 0.2 ? C.y : U.hash(i, 6) < 0.5 ? C.g : C.w); if (U.hash(i, 9) < 0.08 && U.hash(i, tw + 50) > 0.6) { px(g, x - 1, y, 3, 1, C.w); px(g, x, y - 1, 1, 3, C.w); } }
      g.drawImage(earth(st), ECX - ER - 2, ECY - ER - 2);
      const oa = -Math.PI * 0.77 + (st - tOrb) * 0.38, ox = ECX + Math.cos(oa) * ORB, oy = ECY + Math.sin(oa) * ORB;
      for (let j = 0; j < 240; j += 2) { const a = -Math.PI + j / 240 * Math.PI; if (j % 6) px(g, Math.round(ECX + Math.cos(a) * ORB), Math.round(ECY + Math.sin(a) * ORB), 1, 1, C.gd); }
      const tang = Math.atan2(Math.cos(oa), -Math.sin(oa));
      drawRocket(g, ox, oy, 28, tang + Math.PI / 2);
      const fx = Math.round(ox - Math.cos(tang) * 3), fy = Math.round(oy - Math.sin(tang) * 3);
      if (Math.floor(st * 20) % 2) px(g, fx - Math.round(Math.cos(tang) * 13), fy - Math.round(Math.sin(tang) * 13), 3, 3, C.y);
    }
    // 放大 8 倍（最近邻）
    c.imageSmoothingEnabled = false; c.drawImage(L, 0, 0, LW, LH, 0, 0, W, H); c.imageSmoothingEnabled = true;
    // 入轨白闪 2 帧
    if (Math.abs(lt - tOrb) < 0.05) { c.fillStyle = '#fcfcfc'; c.fillRect(0, 0, W, H); }

    // ---------- HUD ----------
    if (st >= q.a[0] - 0.02) ptext(c, 'FALCON 1', 96, 64, 64, C.w, 'left');
    const lost = [0, 1, 2].filter(i => st > q.f[i] + 0.15).length;
    for (let i = 0; i < 4; i++) {
      const x = 1544 + i * 72, y = 64;
      let full = i < 4 - lost;
      for (let j = 0; j < 3; j++) { const d = st - q.f[j] - 0.15; if (3 - j === i && d > -0.15 && d < 0.15) full = Math.floor(st * 20) % 2 === 0; }
      if (i === 0 && lost === 3 && !inOrbit && st > q.a[3] - 0.02 && Math.floor(st * 10) % 2) full = false;   // 最后一颗心在闪
      heart(c, full ? HEART : HEARTE, x, y, { k: '#000', r: C.red, w: C.w });
    }
    // 年份牌（像素化中文）
    const PL = ['2006年', '2007年', '2008年8月', '2008年9月'];
    if (st >= q.a[0] - 0.02) { const tx = lowText(PL[k]), pop = st - q.a[k] < 0.15 && Math.floor(st * 20) % 2; if (!pop) c.drawImage(tx, 0, 0, tx.width, tx.height, Math.round((960 - tx.width * S / 2) / 8) * 8, 40, tx.width * S, tx.height * S); }
    // 大字：FALCON 1 标题 / GAME OVER / LAST TRY / STAGE CLEAR!
    if (st >= q.title && st < q.a[0]) { const d = st - q.title, y = Math.round(lerp(-160, 176, MO.backOut(clamp(d / 0.3), 1.6)) / 8) * 8; ptext(c, 'FALCON 1', 960, y, 128, C.y); }
    for (let i = 0; i < 3; i++) { if (st > q.f[i] + 0.08 && st < q.a[i + 1] - 0.06) ptext(c, 'GAME OVER', 960, 320, 128, Math.floor(st * 10) % 4 === 0 ? C.w : C.red); }
    if (st >= q.a[3] && st < q.a[3] + 0.75 && (st - q.a[3] < 0.35 || Math.floor(st * 8) % 2 === 0)) ptext(c, 'LAST TRY', 960, 320, 128, C.y);
    if (st >= q.le) { const d = st - q.le, cols = [C.w, C.y, C.o, C.y]; ptext(c, 'STAGE CLEAR!', 960, Math.round(lerp(320, 168, MO.expoOut(clamp((st - q.banner) / 0.3))) / 8) * 8, 128, d < 0.6 ? cols[Math.floor(st * 20) % 4] : C.y); }
    // 对话框：一行行打出来
    if (st >= q.banner - 0.05) {
      const bx = 112, by = 336, bw = 1696, bh = 200, op = MO.expoOut(clamp((st - q.banner + 0.05) / 0.12));
      c.save(); c.fillStyle = '#000'; c.fillRect(bx, by + bh / 2 * (1 - op), bw, bh * op);
      if (op > 0.9) { c.fillStyle = C.w; c.fillRect(bx + 8, by + 8, bw - 16, 8); c.fillRect(bx + 8, by + bh - 16, bw - 16, 8); c.fillRect(bx + 8, by + 8, 8, bh - 24); c.fillRect(bx + bw - 16, by + 8, 8, bh - 24);
        const L1 = '1ST PRIVATE LIQUID-FUEL', L2 = 'ROCKET IN ORBIT', n = Math.floor((st - q.banner - 0.1) * 15);
        ptext(c, L1.slice(0, clamp(n, 0, L1.length)), bx + 72, by + 40, 64, C.w, 'left');
        ptext(c, L2.slice(0, clamp(n - L1.length - 2, 0, L2.length)), bx + 72, by + 112, 64, C.y, 'left');
        if (n > L1.length + L2.length + 2 && Math.floor(st * 4) % 2) heart(c, ['kkkkkkk', '.kkkkk.', '..kkk..', '...k...'], bx + bw - 104, by + bh - 64, { k: C.w });
      }
      c.restore();
    }
  },
};
ERAS.find(e => e.id === ID).transition = { type: 'pixelate', dur: 0.5 };
})();
