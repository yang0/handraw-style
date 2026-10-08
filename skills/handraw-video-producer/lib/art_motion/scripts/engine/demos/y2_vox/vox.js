// Y2 · Vox 式拼贴解说（Missing Chapter / Borders 一路）：「AI 是怎么学会认猫的」
// 一张大桌面（世界坐标），相机 60fps 平滑地推、移；桌上的元素（荧光笔、红笔、打字、红线、贴纸）按 12fps「一拍二」步进。
// 依据：调研/y2_vox/调研.md（13 段相机运动实测：中位 1.29s，对称 easeInOutSine 或长尾 bezier(.33,0,.2,1)，没有线性；元素层 12fps）
// ①剪报＋网点照片已在桌上（随切点直接出现），荧光笔按行扫、红笔圈词、相机慢推向那一行
// → 转场 A「沿红线平移」：一条红线从剪报连到调查墙，相机沿线 1.1s 追过去（长尾 bezier）
// ②调查墙：1000 万张截图里的猫被红线连到索引卡，打字机 13 字/秒，计数滚到 10,000,000，一张小照片带倾斜滑入放平
// → 转场 B「推进照片→硬切」：相机推满那张小照片，硬切成同一张图的大幅扫描，再「拉出揭示」整张黑底拼贴
// ③黑底：它脑中的「猫」、纸条标题打字＋荧光笔、花叔剪纸贴纸滑入、红笔圈住
// 用到的库：CL（纸纹、撕边、网点照片、胶带、图钉、红线、毛边荧光笔、倾斜滑入、贴纸白边）、CAM（关键帧相机、推进锚点、运动模糊）、
//           DG（手画圈、逐段描出）、TY.typedCount（打字机）、MO（longTail、12fps 步进）。
(() => {
const W = 1920, H = 1080;
const { clamp, lerp, rng } = U;
const seg = MO.seg, step = MO.step;
const Y2 = window.Y2 = {};
const F0 = 0; Y2.F0 = F0;
Y2.SHOTS = { s1: [0, 2.6], s2: [2.6, 5.9], s3: [5.9, 8.0] };
const PAN = { a: 2.6, d: 1.1 }, PUSH = { a: 5.3, b: 5.9 };
const longTail = MO.longTail;                    // 「沿线追过去」「拉出揭示」用：起步快、长尾落定

// 调研实测色（MC/BD/PSY 取色）
const C = { desk: '#e4ddcf', news: '#eeedeb', ink: '#171716', red: '#b8433f', hl: '#dacf08', black: '#171716', paper: '#eeedeb', tape: 'rgba(226,220,200,.85)', card: '#f6f4ee' };
const SERIF = '"Songti SC", "STSong", serif';

// ---------- 素材（一次画好缓存） ----------
const sprite = (key, w, h, fn) => PAINT.cached('y2_' + key, w, h, fn);
const tornPoly = CL.tornRect;
const catPhoto = (g, w, h, { dark = false, pose = 0 } = {}) => {
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, dark ? '#555' : '#bdbdbd'); bg.addColorStop(1, dark ? '#2a2a2a' : '#8a8a8a'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const cx = w * (0.5 + pose * 0.08), cy = h * 0.56, s = Math.min(w, h) / 300;
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.fillStyle = dark ? '#d9d9d9' : '#3a3a3a';
  g.beginPath(); g.ellipse(0, 120, 120, 90, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(0, 0, 92, 78, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(-80, -30); g.lineTo(-70, -118); g.lineTo(-20, -66); g.fill(); g.beginPath(); g.moveTo(80, -30); g.lineTo(70, -118); g.lineTo(20, -66); g.fill();
  const fg = g.createRadialGradient(0, 20, 5, 0, 20, 70); fg.addColorStop(0, dark ? '#fff' : '#9a9a9a'); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fg; g.beginPath(); g.ellipse(0, 22, 60, 46, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2f2f2'; for (const ex of [-34, 34]) { g.beginPath(); g.ellipse(ex, -6, 17, 13, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#111'; for (const ex of [-34, 34]) { g.beginPath(); g.ellipse(ex, -6, 5, 12, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#222'; g.beginPath(); g.moveTo(-9, 22); g.lineTo(9, 22); g.lineTo(0, 32); g.fill();
  g.strokeStyle = 'rgba(240,240,240,.7)'; g.lineWidth = 2.5; for (const k of [-1, 1]) for (const d of [-6, 6]) { g.beginPath(); g.moveTo(k * 30, 34 + d); g.lineTo(k * 110, 26 + d * 2.4); g.stroke(); }
  g.restore();
};
const thumbScene = (g, w, h, kind, seed) => {
  const r = rng(seed); const bg = g.createLinearGradient(0, 0, 0, h); const L = 120 + r() * 80; bg.addColorStop(0, `rgb(${L},${L},${L})`); bg.addColorStop(1, `rgb(${L - 50},${L - 50},${L - 50})`); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = r() < 0.5 ? '#2c2c2c' : '#e8e8e8';
  if (kind === 'cat') return catPhoto(g, w, h, { dark: r() < 0.4, pose: r() - 0.5 });
  g.save(); g.translate(w / 2, h * 0.6); const s = h / 90; g.scale(s, s);
  if (kind === 'dog') { g.beginPath(); g.ellipse(0, 6, 34, 18, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(-30, -14, 14, 12, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(-40, -8, 6, 12, 0.3, 0, Math.PI * 2); g.fill(); g.fillRect(-26, 14, 6, 16); g.fillRect(18, 14, 6, 16); }
  if (kind === 'car') { g.beginPath(); g.roundRect(-44, -4, 88, 22, 6); g.fill(); g.beginPath(); g.roundRect(-24, -22, 46, 22, 8); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(-26, 20, 9, 0, 7); g.arc(26, 20, 9, 0, 7); g.fill(); }
  if (kind === 'man') { g.beginPath(); g.arc(0, -26, 13, 0, 7); g.fill(); g.beginPath(); g.roundRect(-20, -10, 40, 44, 10); g.fill(); }
  if (kind === 'tree') { g.fillRect(-5, -4, 10, 34); g.beginPath(); g.arc(0, -20, 26, 0, 7); g.fill(); }
  if (kind === 'house') { g.fillRect(-28, -8, 56, 36); g.beginPath(); g.moveTo(-36, -8); g.lineTo(0, -38); g.lineTo(36, -8); g.fill(); }
  if (kind === 'game') { g.beginPath(); g.roundRect(-36, -14, 72, 34, 16); g.fill(); }
  g.restore();
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, h - 8, w, 8); g.fillStyle = '#b8433f'; g.fillRect(0, h - 8, w * (0.2 + r() * 0.6), 8);   // 播放条（只用形状，不放台标）
};
const photoSprite = CL.photo;                                   // 网点照片＋纸边（halftone 6px、对比 1.3）
// 「猫神经元」的最优刺激图（论文 Fig.6 那种模糊猫脸），用大块柔光画，过网点
const neuronDraw = (g, w, h) => {
  g.fillStyle = '#7b7b7b'; g.fillRect(0, 0, w, h); const k = w / 560;
  const blob = (x, y, rx, ry, col) => { g.save(); g.filter = `blur(${26 * k}px)`; g.fillStyle = col; g.beginPath(); g.ellipse(x * w, y * h, rx * k, ry * k, 0, 0, Math.PI * 2); g.fill(); g.restore(); };
  blob(0.5, 0.56, 190, 160, '#3b3b3b'); blob(0.28, 0.25, 60, 90, '#3a3a3a'); blob(0.72, 0.25, 60, 90, '#3a3a3a');
  blob(0.5, 0.68, 110, 70, '#c9c9c9'); blob(0.36, 0.5, 34, 26, '#e6e6e6'); blob(0.64, 0.5, 34, 26, '#e6e6e6');
  blob(0.36, 0.5, 12, 18, '#111'); blob(0.64, 0.5, 12, 18, '#111'); blob(0.5, 0.64, 16, 10, '#222');
};
// 剪报（数字出自 Le et al. 2012 论文摘要与 Google 官方博客：1000 台机器、1.6 万个 CPU 核、1000 万张 YouTube 截图、不打标签）
const NEWS = { w: 860, h: 600, hl: { x: 52, y: 352, w: 590, h: 48 }, circ: { x: 450, y: 226, rx: 96, ry: 50 } };
const newsSprite = () => sprite('news', NEWS.w, NEWS.h, (g) => {
  const tile = CL.paperTile('news', C.news, { amt: 9, fibers: 160 });
  g.save(); tornPoly(g, NEWS.w, NEWS.h, 21, 4); g.clip(); g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, NEWS.w, NEWS.h);
  const yel = g.createRadialGradient(NEWS.w * 0.4, NEWS.h * 0.4, 50, NEWS.w * 0.5, NEWS.h * 0.5, NEWS.w * 0.75); yel.addColorStop(0, 'rgba(255,255,255,0)'); yel.addColorStop(1, 'rgba(170,150,110,.2)'); g.fillStyle = yel; g.fillRect(0, 0, NEWS.w, NEWS.h);
  g.fillStyle = C.ink; g.font = `600 22px ${SERIF}`; g.fillText('科技  ·  2012 年 6 月', 52, 64);
  g.fillRect(52, 80, NEWS.w - 104, 3); g.fillRect(52, 86, NEWS.w - 104, 1);
  g.font = `900 66px ${SERIF}`; g.fillText('谷歌的电脑', 52, 170); g.fillText('自己学会了认猫', 52, 250);
  g.font = `400 32px ${SERIF}`; g.fillStyle = '#2a2723';
  g.fillText('1000 台机器、1.6 万个处理器核心，', 52, 330); g.fillText('看了 1000 万张 YouTube 视频截图，', 52, 386); g.fillText('没有人告诉过它，哪一张是猫。', 52, 442);
  g.fillStyle = 'rgba(40,36,30,.3)'; for (let i = 0; i < 3; i++) g.fillRect(52, 482 + i * 34, [700, 640, 420][i], 14);
  g.restore();
});
const CARD = { w: 520, h: 330 };
const cardSprite = () => sprite('card', CARD.w, CARD.h, (g) => {
  g.fillStyle = C.card; g.fillRect(0, 0, CARD.w, CARD.h);
  g.strokeStyle = 'rgba(80,140,200,.3)'; g.lineWidth = 2; for (let y = 96; y < CARD.h; y += 52) { g.beginPath(); g.moveTo(0, y); g.lineTo(CARD.w, y); g.stroke(); }
  g.strokeStyle = 'rgba(184,67,63,.5)'; g.beginPath(); g.moveTo(0, 60); g.lineTo(CARD.w, 60); g.stroke();
});

// ---------- 桌面世界 ----------
const R1 = [960, 540], R2 = [3100, 720];
const NEWSPOS = { x: 620, y: 520, r: -0.035 }, PHOTO = { x: 1440, y: 470, r: 0.06, w: 380, h: 430 };
const THUMBS = (() => { const r = rng(55), o = [], kinds = ['dog', 'car', 'man', 'tree', 'house', 'game']; const cats = new Set([3, 8, 13, 16, 22]);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { const k = j * 6 + i; o.push({ x: 2250 + i * 205 + (r() - .5) * 26, y: 420 + j * 150 + (r() - .5) * 20, r: (r() - .5) * 0.09, kind: cats.has(k) ? 'cat' : kinds[(r() * kinds.length) | 0], seed: 100 + k, cat: cats.has(k) }); }
  return o; })();
const CARDPOS = { x: 3660, y: 560, r: 0.025 };
const PRINT = { x: 3640, y: 900, r: -0.04, w: 210, h: 210 };       // 调查墙上那张小照片：推进它、硬切到镜 3
const deskCam = (ft) => {
  const base = CAM.at([
    { t: 0, x: R1[0] + 20, y: R1[1] + 20, z: 1.14 },
    { t: 0.9, x: R1[0] + 10, y: R1[1] + 30, z: 1.165, ease: MO.sineInOut },        // 开场慢推（停留段 0.5–1%/s 的 Ken Burns 加一点）
    // 荧光笔扫完后推向那一行（BD 实测约 +11%/s），1.5s easeInOutSine
    { t: 2.4, x: R1[0] - 60, y: R1[1] + 60, z: 1.28, ease: MO.sineInOut },
    { t: PAN.a, x: R1[0] - 56, y: R1[1] + 60, z: 1.29, ease: MO.sineInOut },
    // 沿红线追过去：1.1s 长尾 bezier(.33,0,.2,1)
    { t: PAN.a + PAN.d, x: R2[0], y: R2[1], z: 1.0, ease: longTail },
    { t: PUSH.a, x: R2[0] + 30, y: R2[1] + 10, z: 1.04, ease: MO.sineInOut },
  ], ft);
  if (ft <= PUSH.a) return base;
  // 推进照片：0.6s easeInOutSine，对数插值推到照片铺满画面（z≈9.6）
  return CAM.pushTo(base, PRINT.x, PRINT.y, 9.6, MO.sineInOut(seg(ft, PUSH.a, PUSH.b)));
};
Y2.deskCam = deskCam;
// 投影很弱（MC 实测黑底卡片几乎无投影；桌面上留一点就够）；纸片滑入带倾斜、到位放平（12fps 步进）
const shadowed = CL.shadowed, slideIn = CL.slideIn, placed = CL.placed, tape = CL.tape, stringPts = CL.stringPts, highlight = CL.highlight;
const pin = (g, x, y, on) => { if (on) CL.pin(g, x, y, C.red); };
const NEWS_CIRCLE = DG.hand(DG.ellipsePts(0, 0, NEWS.circ.rx, NEWS.circ.ry, -2.6, 1.1, 40), { amp: 2.2, seed: 9 }), NEWS_CIRCLE_L = DG.cum(NEWS_CIRCLE);
// 线索红线：从剪报高亮那一行的末端，一路连到调查墙的计数标签（相机沿它追）
const CLUE = (() => { const a = [NEWSPOS.x + 250, NEWSPOS.y + 70], b = [2400, 1100]; return { a, b, pts: stringPts(a, b, 0.05) }; })();
CLUE.cum = DG.cum(CLUE.pts);
const drawDesk = (g, cam, ft) => {
  g.save(); CAM.apply(g, cam);
  g.fillStyle = g.createPattern(CL.paperTile('desk', C.desk, { amt: 12, fibers: 320, fiberCol: [110, 95, 70] }), 'repeat'); g.fillRect(-1200, -1200, 6800, 3600);
  const st = step(ft);
  // —— 区域 1：剪报＋照片（随切点直接在桌上） ——
  placed(g, NEWSPOS.x, NEWSPOS.y, NEWSPOS.r, (g) => {
    const sp = newsSprite(); shadowed(g, () => g.drawImage(sp, -NEWS.w / 2, -NEWS.h / 2));
    const b = NEWS.hl; highlight(g, -NEWS.w / 2 + b.x - 8, -NEWS.h / 2 + b.y - 6, b.w + 16, b.h + 12, MO.sineInOut(seg(st, 0.35, 1.25)));
    const cq = MO.cubicOut(seg(st, 1.35, 2.0));                                 // 红笔圈：0.65s，首尾不闭合
    if (cq > 0) { g.save(); g.translate(-NEWS.w / 2 + NEWS.circ.x, -NEWS.h / 2 + NEWS.circ.y); g.strokeStyle = C.red; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; DG.drawPartial(g, NEWS_CIRCLE, NEWS_CIRCLE_L, NEWS_CIRCLE_L[NEWS_CIRCLE_L.length - 1] * cq); g.restore(); }
  });
  placed(g, PHOTO.x, PHOTO.y, PHOTO.r, (g) => {
    const sp = photoSprite('catphoto', PHOTO.w, PHOTO.h, (gg, w, h) => catPhoto(gg, w, h), { border: 18, cell: 7 });
    shadowed(g, () => g.drawImage(sp, -sp.width / 2, -sp.height / 2)); tape(g, -sp.width / 2 + 30, -sp.height / 2 + 10, -0.6); tape(g, sp.width / 2 - 30, -sp.height / 2 + 10, 0.5);
  });
  // Borders 式黑底白字标签条
  placed(g, 1260, 830, -0.02, (g) => { g.fillStyle = C.black; g.fillRect(-150, -40, 300, 80); g.fillStyle = C.paper; g.font = '46px "PuHui-Heavy"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2012 · 谷歌', 0, 3); });
  // —— 线索红线（一直在桌上；相机沿它追） ——
  CL.string(g, CLUE.pts, CLUE.cum, 1e9, { col: C.red, lw: 5 });
  pin(g, CLUE.a[0], CLUE.a[1], true); pin(g, CLUE.b[0], CLUE.b[1], true);
  // —— 区域 2：调查墙（截图早就钉在墙上） ——
  for (const [i, th] of THUMBS.entries()) placed(g, th.x, th.y, th.r, (g) => { const sp = photoSprite('th' + i, 168, 94, (gg, w, h) => thumbScene(gg, w, h, th.kind, th.seed), { border: 7, cell: 4 }); shadowed(g, () => g.drawImage(sp, -sp.width / 2, -sp.height / 2)); });
  placed(g, CARDPOS.x, CARDPOS.y, CARDPOS.r, (g) => {
    shadowed(g, () => g.drawImage(cardSprite(), -CARD.w / 2, -CARD.h / 2));
    // 打字机：13 字/秒（MC 实测），按一拍二出字
    const lines = ['没有人告诉它', '哪一张是猫'], t0 = PAN.a + PAN.d + 0.1;
    g.fillStyle = C.ink; g.font = `600 52px ${SERIF}`; g.textBaseline = 'alphabetic';
    const typed = TY.typedCount(st, t0, 13);
    let k = 0; lines.forEach((ln, li) => { let x = -CARD.w / 2 + 40; for (const ch of ln) { if (k < typed) g.fillText(ch, x, -CARD.h / 2 + 140 + li * 104); x += g.measureText(ch).width; k++; } });
  });
  // 红线：每根 0.5s 描出（12fps），错开 0.15s；图钉随线头一起出现
  const cats = THUMBS.filter(t => t.cat), cardPin = [CARDPOS.x - 40, CARDPOS.y - CARD.h / 2 + 22];
  cats.forEach((th, i) => {
    const t0 = PAN.a + PAN.d + 0.15 + i * 0.15, q = MO.sineInOut(seg(st, t0, t0 + 0.5)); if (q <= 0) return;
    const a = [th.x + 40, th.y - 28], pts = stringPts(a, cardPin), L = DG.cum(pts);
    CL.string(g, pts, L, L[L.length - 1] * q, { col: C.red, lw: 4 });
    pin(g, a[0], a[1], true);
  });
  pin(g, cardPin[0], cardPin[1], st >= PAN.a + PAN.d + 0.15);
  // 计数标签：黑胶带，数字 12fps 滚到 10,000,000（cubicOut）
  placed(g, 2770, 1110, -0.03, (g) => {
    const nq = MO.cubicOut(seg(st, PAN.a + 0.6, PAN.a + 2.0));
    shadowed(g, () => { g.fillStyle = C.black; g.save(); g.translate(-380, -52); tornPoly(g, 760, 104, 77, 3); g.fill(); g.restore(); });
    g.fillStyle = C.paper; g.textBaseline = 'middle'; g.font = `600 40px ${SERIF}`; g.fillText('视频截图', -350, 2);
    g.fillStyle = C.hl; g.font = '74px "Anton-400"'; g.textAlign = 'right'; g.fillText('× ' + Math.round(10000000 * nq).toLocaleString('en-US'), 350, 6);
  });
  // 小照片：它脑中的「猫」，带倾斜滑入放平
  slideIn(g, ft, PAN.a + PAN.d + 0.95, PRINT.x, PRINT.y, PRINT.r, (g) => {
    const sp = photoSprite('neuron_s', PRINT.w, PRINT.h, neuronDraw, { border: 10, cell: 4 });
    shadowed(g, () => g.drawImage(sp, -sp.width / 2, -sp.height / 2)); tape(g, 0, -sp.height / 2 + 2, 0.05, 90);
  }, { from: [520, 120], tilt: 0.22, dur: 0.55 });
  g.restore();
};

// 屏幕空间：暗角＋静态颗粒（Vox 的纸纹是贴死的，不逐帧抖；调研 §9 实测）
const finish = (c) => {
  const v = PAINT.cached('y2_vig', W, H, (g) => { const r = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05); r.addColorStop(0, 'rgba(40,30,20,0)'); r.addColorStop(1, 'rgba(40,30,20,.34)'); g.fillStyle = r; g.fillRect(0, 0, W, H); });
  c.drawImage(v, 0, 0); c.drawImage(PAINT.grain('y2grain', 0.05, [40, 30, 20], 0.14), 0, 0);
};
const deskShot = (c, lt, t) => {
  const ft = t - F0, cam = deskCam(ft);
  const buf = PAINT.scratch('yt_y2desk'), g = buf.getContext('2d'); g.reset();
  drawDesk(g, cam, ft);
  c.fillStyle = C.desk; c.fillRect(0, 0, W, H);
  // 快摇时沿速度方向的短模糊（PremiumBeat：模糊比相机运动更短）
  const [vx, vy] = CAM.velocity(deskCam, ft);
  CAM.motionBlur(c, buf, vx * 0.6, vy * 0.6, 7);
  finish(c);
};
Y2.shot1 = deskShot; Y2.shot2 = deskShot;

// ---------- 镜 3：黑底拼贴（MC 的「黑、纸白、一种红」） ----------
const BIG = { x: 650, y: 610, w: 560, h: 560 };
const s3cam = (ft) => {
  const l = ft - Y2.SHOTS.s3[0];
  // 拉出揭示：硬切后从同一张图铺满（z=3.68，和上一镜推满时照片的屏幕宽度一致）0.85s 长尾拉到 1.0；之后慢推 1%/s
  const e = longTail(seg(l, 0, 0.85)), z = CAM.zlerp(3.68, 1.0, e) * (1 + 0.01 * Math.max(0, l - 0.85));
  return CAM.anchor(BIG.x, BIG.y, z, lerp(W / 2, BIG.x, e), lerp(H / 2, BIG.y, e));
};
const NCIRC = DG.hand(DG.ellipsePts(0, 0, 340, 330, -2.2, 1.08, 48), { amp: 3, seed: 4 }), NCIRC_L = DG.cum(NCIRC);
Y2.shot3 = (c, lt, t) => {
  const ft = t - F0, l = ft - Y2.SHOTS.s3[0], cam = s3cam(ft), st = step(l);
  c.save(); CAM.apply(c, cam);
  // 结论还在同一张桌面上：一张大黑卡纸铺在桌上（MC 的黑底卡片），四边露出桌面纸纹
  c.fillStyle = c.createPattern(CL.paperTile('desk', C.desk, { amt: 12, fibers: 320, fiberCol: [110, 95, 70] }), 'repeat'); c.fillRect(-800, -800, W + 1600, H + 1600);
  placed(c, 960, 545, -0.012, (g) => { shadowed(g, () => { g.fillStyle = '#1b1b1a'; g.save(); g.translate(-890, -490); tornPoly(g, 1780, 980, 91, 3); g.fill(); g.restore(); });
    g.save(); g.translate(-890, -490); tornPoly(g, 1780, 980, 91, 3); g.clip(); g.fillStyle = g.createPattern(CL.paperTile('black', '#1b1b1a', { amt: 5, fibers: 90, fiberCol: [90, 90, 85] }), 'repeat'); g.fillRect(0, 0, 1780, 980); g.restore(); });
  placed(c, BIG.x, BIG.y, 0, (g) => { const sp = photoSprite('neuron', BIG.w, BIG.h, neuronDraw, { border: 20, cell: 9 }); g.drawImage(sp, -sp.width / 2, -sp.height / 2);
    tape(g, 0, -sp.height / 2 + 4, 0.05, 220);
    g.fillStyle = C.paper; g.font = `600 40px ${SERIF}`; g.textAlign = 'left'; g.fillText('它脑中的「猫」', -sp.width / 2, sp.height / 2 + 54); });
  // 纸条标题：打字 13 字/秒（一拍二），随后荧光笔扫「猫神经元」
  const T1 = '它自己长出了一个', T2 = '「猫神经元」', t0 = 0.4;
  slideIn(c, l, 0.15, 1490, 330, -0.02, (g) => {
    g.fillStyle = C.paper; g.save(); g.translate(-470, -150); tornPoly(g, 900, 290, 61, 4); g.fill(); g.restore();
    g.fillStyle = C.ink; g.font = `900 70px ${SERIF}`; g.textBaseline = 'alphabetic';
    const typed = TY.typedCount(st, t0, 13);
    let x = -420; [...T1].forEach((ch, i) => { if (i < typed) g.fillText(ch, x, -40); x += g.measureText(ch).width; });
    const w2 = g.measureText(T2).width; highlight(g, -428, 22, w2 + 20, 82, MO.sineInOut(seg(st, 1.5, 1.8)));
    g.fillStyle = C.ink; x = -420; [...T2].forEach((ch, i) => { if (T1.length + i < typed) g.fillText(ch, x, 88); x += g.measureText(ch).width; });
  }, { from: [700, -200], tilt: 0.18, dur: 0.4 });
  // 红笔圈住（0.6s，12fps，首尾略交叉）
  const cq = MO.cubicOut(seg(st, 0.95, 1.5));
  if (cq > 0) { c.save(); c.translate(BIG.x, BIG.y); c.strokeStyle = C.red; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round'; DG.drawPartial(c, NCIRC, NCIRC_L, NCIRC_L[NCIRC_L.length - 1] * cq); c.restore(); }
  // 花叔剪纸贴纸：带 12° 倾斜滑入放平；姿势按 12fps 步进（剪纸动画的一顿一顿）
  const sq = clamp((st - 0.6) / 0.6);
  if (sq > 0) {
    const e = MO.quartOut(sq);
    const pose = HUASHU.pose('point', 0, { ua1: 1.35 + 0.12 * Math.sin(st * 5), head: -0.05 + 0.04 * Math.sin(st * 3), mouth: 0.5 + 0.4 * Math.sin(st * 9) });
    const HS = HUASHU.build({ x: 0, y: 0, s: 0.82, face: -1, pose });
    const pal = { skin: '#f3c9a8', hair: '#171716', shirt: '#eeedeb', shorts: '#cdbf9f', hat: '#eeedeb', hatBand: '#b8433f', shoe: '#e8e4da', watch: '#171716', line: '#171716', lw: 5 };
    const sp = PAINT.scratch('y2hs'), g = sp.getContext('2d'); g.reset(); if (!HERO.y2(g, st)) { g.translate(1500, 1040); HUASHU.draw(g, HS, pal); g.setTransform(1, 0, 0, 1, 0, 0); }
    const sil = CL.stickerEdge(sp, 'y2sil', 12, '#f4f2ec');          // 剪纸贴纸：外扩 12px 的纸白边
    c.save(); c.translate(1500 + 1100 * (1 - e), 1040 + 120 * (1 - e)); c.rotate(0.02 + 0.21 * (1 - Math.min(1, e * 1.15))); c.translate(-1500, -1040);
    c.drawImage(sil, 0, 0); c.drawImage(sp, 0, 0); c.restore();
  }
  c.restore();
  finish(c);
};
})();

SCENES['y2_s1'] = { draw: (c, lt, t) => Y2.shot1(c, lt, t) };
SCENES['y2_s2'] = { draw: (c, lt, t) => Y2.shot2(c, lt, t) };
SCENES['y2_s3'] = { draw: (c, lt, t) => Y2.shot3(c, lt, t) };
