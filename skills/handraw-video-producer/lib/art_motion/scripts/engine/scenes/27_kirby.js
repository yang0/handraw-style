// 1966 漫威银河时代（Jack Kirby ＋ 四色胶印）——纯代码。
// 管线：同一份几何画两遍 →
//   色版层：纸＋平涂＋本戴网点（C 15°、M 75°、Y 0°），整层偏移 (4,3) = 套色不准
//   墨线层：白填＋黑描边＋黑块阴影（spotted blacks）＋羽化排线（feathering）＋ Kirby krackle 黑点
//   合成：色版 → 墨线 multiply（墨线层白色=透明）。墨线层逐部件「白填→阴影→描边」，后画的部件盖掉前面的线，天然只剩看得见的线。
// 母题：窗外宇宙能量流里的 krackle 黑点群 12fps 流动、端杯速度线、SLURRP! 拟声大字弹出、右侧分格猫眼特写瞳孔追杯、聚焦线闪。
SCENES['27_kirby'] = (() => {
  const W = 1920, H = 1080, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
  const INK = '#141212', PAPER = '#f4ecd6';
  const C = { cyan: '#2a9fd8', blue: '#1f3f9e', mag: '#e0287a', red: '#e3262d', yel: '#ffd62a', org: '#f6921e', orgD: '#d2541c',
    skin: '#fbd9b8', wall: '#cfe7f2', floor: '#2b3f9c', wood: '#f2a524', space: '#121a52', energy: '#ffe14a', energy2: '#ff8a2a', planet: '#b04ac8' };
  const LIGHT = [-0.86, -0.5];                          // 光从窗（左上）来，阴影在右下边缘

  // ---- 墨线层工具：阴影月牙 + 羽化排线 ----
  const big = (() => { const p = new Path2D(); p.rect(-50, -50, W + 100, H + 100); return p; })();
  const outsideShift = (path, d) => { const m = new Path2D(); m.addPath(big); m.addPath(path, new DOMMatrix().translate(LIGHT[0] * d, LIGHT[1] * d)); return m; };
  function shade(g, path, d1 = 14, d2 = 30, gap = 9) {
    // 羽化带：path ∩ ¬shift(d2)，画沿光方向的平行短线
    g.save(); g.clip(path); g.clip(outsideShift(path, d2), 'evenodd');
    g.strokeStyle = INK; g.lineWidth = 2.6; g.lineCap = 'butt'; g.beginPath();
    const a = Math.atan2(LIGHT[1], LIGHT[0]), nx = -Math.sin(a), ny = Math.cos(a);
    for (let k = -260; k < 260; k++) { const ox = 960 + nx * k * gap, oy = 540 + ny * k * gap; g.moveTo(ox - LIGHT[0] * 1400, oy - LIGHT[1] * 1400); g.lineTo(ox + LIGHT[0] * 1400, oy + LIGHT[1] * 1400); }
    g.stroke(); g.restore();
    // 黑块：path ∩ ¬shift(d1)
    g.save(); g.clip(path); g.clip(outsideShift(path, d1), 'evenodd'); g.fillStyle = INK; g.fillRect(0, 0, W, H); g.restore();
  }
  // 一个部件：色版层填色；墨线层白填→阴影→描边
  const mkPart = (g, mode) => (path, col, o = {}) => {
    if (!path) return;
    if (mode === 'color') { g.fillStyle = col; g.fill(path); return; }
    g.fillStyle = '#fff'; g.fill(path);
    if (o.shade) shade(g, path, o.shade[0], o.shade[1]);
    if (o.lw !== 0) { g.strokeStyle = INK; g.lineWidth = o.lw || 6; g.lineJoin = 'round'; g.stroke(path); }
  };

  // ---- Kirby krackle：一簇大小不一的黑点，按 12fps 换形 ----
  function krackle(g, cx, cy, R, seed, t, n = 22) {
    const st = Math.floor(t * 12), r = U.rng(seed * 131 + st * 7);
    g.fillStyle = INK;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.pow(r(), 0.7) * R, rr = R * (0.05 + 0.2 * (1 - d / R) * r()) * (0.8 + 0.3 * Math.sin(t * 18 + i));
      g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, Math.max(2, rr), 0, TAU); g.fill();
    }
  }

  // ---- 窗外：宇宙＋能量流 ----
  const WIN = [372, 142, 416, 396];
  const stream = (s, w) => { // 能量流中线：从左下到右上的 S 形
    const x = lerp(330, 840, s), y = lerp(560, 120, s) + Math.sin(s * 5.2 + 0.4) * 46; return [x, y + w];
  };
  function windowArt(g, mode, t) {
    const [x, y, w, h] = WIN;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (mode === 'color') {
      g.fillStyle = C.space; g.fillRect(x, y, w, h);
      // 星云网点（M 75°）
      g.fillStyle = P.dotPattern(g, 'neb', 10, 3.2, C.mag, null, 75); g.beginPath(); g.ellipse(700, 230, 160, 90, -0.4, 0, TAU); g.fill();
      // 行星
      g.lineWidth = 9; g.strokeStyle = C.yel; g.beginPath(); g.ellipse(470, 230, 112, 20, -0.25, Math.PI, TAU); g.stroke();
      g.fillStyle = C.planet; g.beginPath(); g.arc(470, 230, 64, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(470, 230, 112, 20, -0.25, 0, Math.PI); g.stroke();
      // 能量流带
      const band = new Path2D(); for (let i = 0; i <= 40; i++) band.lineTo(...stream(i / 40, -58)); for (let i = 40; i >= 0; i--) band.lineTo(...stream(i / 40, 58)); band.closePath();
      g.fillStyle = C.energy2; g.fill(band);
      const core = new Path2D(); for (let i = 0; i <= 40; i++) core.lineTo(...stream(i / 40, -34)); for (let i = 40; i >= 0; i--) core.lineTo(...stream(i / 40, 34)); core.closePath();
      g.fillStyle = C.energy; g.fill(core);
      // 星
      g.fillStyle = '#fff'; [[400, 170, 7], [760, 420, 6], [560, 170, 5], [740, 170, 8], [420, 470, 5]].forEach(([sx, sy, r], k) => { const tw = 0.7 + 0.4 * Math.sin(t * 9 + k * 2); g.fill(KIT.star(sx, sy, r * 2.6 * tw, r * 0.5, 4)); });
    } else {
      g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
      // 行星阴影
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.ellipse(470, 230, 112, 20, -0.25, Math.PI, TAU); g.stroke(); const pl = new Path2D(); pl.arc(470, 230, 64, 0, TAU); g.fillStyle = '#fff'; g.fill(pl); shade(g, pl, 18, 34, 8); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(pl); g.lineWidth = 3; g.beginPath(); g.ellipse(470, 230, 112, 20, -0.25, 0, Math.PI); g.stroke();
      // krackle：沿能量流移动（300px/s），每簇 12fps 换形
      for (let k = 0; k < 6; k++) { const s = ((k / 6 + t * 0.42) % 1); const [cx, cy] = stream(s, Math.sin(k * 2.3) * 12); krackle(g, cx, cy, 44 + (k % 3) * 12, k + 1, t, 26); }
      // 能量流边缘的锯齿墨线
      g.strokeStyle = INK; g.lineWidth = 4;
      [-58, 58].forEach(o => { g.beginPath(); for (let i = 0; i <= 40; i++) { const [px, py] = stream(i / 40, o + (i % 2 ? 6 : -6)); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); });
    }
    g.restore();
  }

  // ---- 室内底版 ----
  function room(g, mode, t) {
    const part = mkPart(g, mode);
    if (mode === 'color') {
      g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
      g.fillStyle = C.wall; g.fillRect(0, 0, 1540, 700);
      g.fillStyle = P.dotPattern(g, 'wallc', 9, 2.7, C.cyan, null, 15); g.fillRect(0, 0, 1540, 700);
      g.fillStyle = C.floor; g.fillRect(0, 700, 1540, 380);
      g.fillStyle = P.dotPattern(g, 'floorm', 9, 3.2, '#7a2a9a', null, 75); g.fillRect(0, 700, 1540, 380);
    } else {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      // 地板缝（Kirby 的方块透视）＋地平线
      g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 700); g.lineTo(1540, 700); g.stroke();
      g.lineWidth = 3; for (let i = -10; i <= 12; i++) { g.beginPath(); g.moveTo(760 + i * 70, 700); g.lineTo(760 + i * 230, 1080); g.stroke(); }
      [760, 830, 930, 1060].forEach(y => { g.beginPath(); g.moveTo(0, y); g.lineTo(1540, y); g.stroke(); });
    }
    // 窗框（红）＋窗台
    const frame = new Path2D(); frame.rect(344, 114, 472, 452); frame.rect(372, 142, 416, 396);
    if (mode === 'color') { g.fillStyle = C.red; g.fill(frame, 'evenodd'); } else { g.fillStyle = '#fff'; g.fill(frame, 'evenodd'); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(frame); }
    windowArt(g, mode, t);
    const mull = new Path2D(); mull.rect(570, 142, 20, 396); part(mull, C.red, { lw: 5 });
    const sill = new Path2D(); sill.rect(322, 556, 516, 30); part(sill, C.red, { lw: 6, shade: [8, 16] });
    // 郁金香椅（1956 Saarinen，60 年代的家具）
    const shell = RIG.smooth([[1376, 470], [1420, 452], [1468, 480], [1484, 600], [1470, 712], [1330, 726], [1300, 700], [1420, 680], [1430, 560], [1400, 500]], true, 0.5);
    part(shell, '#fff', { lw: 6, shade: [10, 22] });
    const stem = new Path2D(); stem.moveTo(1380, 724); stem.lineTo(1400, 724); stem.lineTo(1412, 880); stem.lineTo(1368, 880); stem.closePath(); part(stem, '#fff', { lw: 5, shade: [6, 12] });
    const base = new Path2D(); base.ellipse(1390, 892, 74, 16, 0, 0, TAU); part(base, '#fff', { lw: 5, shade: [5, 10] });
    // 桌
    const top = new Path2D(); top.rect(806, 616, 404, 30); part(top, C.wood, { lw: 6, shade: [10, 18] });
    const apron = new Path2D(); apron.rect(826, 646, 364, 44); part(apron, C.orgD, { lw: 5, shade: [10, 22] });
    [[842, 690], [1158, 690]].forEach(([x, y]) => { const l = new Path2D(); l.rect(x, y, 26, 214); part(l, C.orgD, { lw: 5, shade: [8, 14] }); });
    // 茶壶（桌上，红白）
    const pot = RIG.smooth([[868, 616], [856, 586], [872, 556], [912, 548], [948, 558], [962, 590], [952, 616]], true, 0.5);
    const spout = U.poly([[862, 590], [828, 560], [836, 552], [870, 574]]);
    part(spout, C.red, { lw: 4 }); part(pot, C.red, { lw: 5, shade: [8, 16] });
    const lid = new Path2D(); lid.ellipse(910, 548, 26, 9, 0, 0, TAU); part(lid, '#fff', { lw: 4 });
  }

  // ---- 角色 ----
  function chars(g, mode, t, ch, G, K) {
    const part = mkPart(g, mode);
    const SH = { skirt: [16, 34], torso: [14, 30], farSleeve: [10, 22], upperArm: [10, 22], foreArm: [8, 18], hairDown: [12, 26], hairBack: [12, 24], bangs: [6, 14], body: [16, 34], head: [12, 26] };
    const LW = { skirt: 6, torso: 6, hand: 4, farHand: 4, neck: 4, face: 4.5, cuff: 4, farCuff: 4, shoe: 5, leg: 5 };
    const skinFill = mode === 'color' ? P.dotPattern(g, 'skin', 7, 1.5, '#ef8a8a', C.skin, 75) : null;
    // 猫
    RIG.drawCat(g, K, { line: INK, lw: 6, orange: C.org, white: mode === 'color' ? PAPER : '#fff', stripe: mode === 'color' ? C.orgD : INK, stripeW: 6, eye: '#8ad24a',
      paint: (c, p, col, name, stroke) => { if (mode === 'color') { c.fillStyle = col; c.fill(p); return; } c.fillStyle = '#fff'; c.fill(p); if (SH[name]) shade(c, p, SH[name][0], SH[name][1]); if (stroke) { c.strokeStyle = INK; c.lineWidth = LW[name] || 6; c.stroke(p); } },
      tail: (c, K) => { c.lineCap = 'round'; if (mode === 'color') { c.strokeStyle = C.org; c.lineWidth = K.tailW; c.stroke(K.tail); return; } c.strokeStyle = INK; c.lineWidth = K.tailW + 12; c.stroke(K.tail); c.strokeStyle = '#fff'; c.lineWidth = K.tailW; c.stroke(K.tail);
        [5, 10, 15].forEach(i => { const p = K.tailPts[i], q = K.tailPts[i + 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2; c.lineWidth = 6; c.strokeStyle = INK; c.beginPath(); c.moveTo(p[0] + Math.cos(a) * 12, p[1] + Math.sin(a) * 12); c.lineTo(p[0] - Math.cos(a) * 4, p[1] - Math.sin(a) * 4); c.stroke(); }); },
      face: mode === 'color' ? (c) => { } : undefined });
    // 少女：60 年代红色 A 字长裙、白色彼得潘领、黑发箍、外翻发尾
    const fills = { skin: mode === 'color' ? skinFill : '#fff', hair: C.yel, dress: C.red, cuff: mode === 'color' ? PAPER : '#fff', shoe: INK, cupBody: '#fff', cupRim: '#7a3a16', locks: false };
    RIG.drawGirl(g, G, { line: INK, lw: 6, ...fills, lwOf: LW, blink: ch.blink, iris: '#2a7ad8', lip: '#e3262d', featureW: 1.35,
      paint: (c, p, col, name) => { if (mode === 'color') { c.fillStyle = col; c.fill(p); return; } c.fillStyle = '#fff'; c.fill(p); if (SH[name]) shade(c, p, SH[name][0], SH[name][1]); const w = LW[name] ?? 6; c.strokeStyle = INK; c.lineWidth = w; c.stroke(p); },
      features: mode === 'color' ? () => { } : (c, G) => RIG.drawFeatures(c, G, { line: INK, iris: '#2a7ad8', lip: '#e3262d', featureW: 1.35, blink: ch.blink }),
      cup: (c, G) => { const k = G.cup; c.save(); c.translate(k.x, k.y); c.rotate(k.tilt); const w = 50, h = 44;
        const body = U.poly([[-w / 2, 0], [-w * 0.42, h], [w * 0.42, h], [w / 2, 0]]); const hd = new Path2D(); hd.arc(w * 0.58, h * 0.42, 13, -1.3, 1.4);
        if (mode === 'color') { c.fillStyle = '#fff'; c.fill(body); c.fillStyle = C.cyan; c.fillRect(-w / 2, h * 0.35, w, 10); c.strokeStyle = '#fff'; c.lineWidth = 7; c.stroke(hd); c.fillStyle = '#7a3a16'; c.beginPath(); c.ellipse(0, 1, w / 2 - 2, 6, 0, 0, TAU); c.fill(); }
        else { c.fillStyle = '#fff'; c.fill(body); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(body); c.lineWidth = 11; c.stroke(hd); c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke(hd); c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.ellipse(0, 1, w / 2 - 2, 6, 0, 0, TAU); c.stroke(); }
        c.restore(); },
      hooks: {
        skirt: (c) => { // 外翻发尾（在躯干后面）
          const hp = (x, y) => [x + G.A.headC[0] - 1318, y + G.A.headC[1] - 360];
          const flip = RIG.smooth([[1360, 430], [1404, 452], [1424, 520], [1430, 560], [1462, 556], [1474, 590], [1430, 604], [1396, 590], [1372, 520]].map(p => hp(...p)), true, 0.5);
          if (mode === 'color') { c.fillStyle = C.yel; c.fill(flip); } else { c.fillStyle = '#fff'; c.fill(flip); shade(c, flip, 12, 26); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(flip); }
          if (mode !== 'color') { c.lineWidth = 3; c.strokeStyle = INK; [[0, 0], [14, 8]].forEach(([dx, dy]) => { c.beginPath(); c.moveTo(...hp(1376 + dx, 470 + dy)); c.quadraticCurveTo(...hp(1410 + dx, 520 + dy), ...hp(1440 + dx / 2, 584)); c.stroke(); }); }
        },
        torso: (c) => { // 彼得潘白领＋一排纽扣
          const n = G.A.neck; const col = new Path2D(); col.ellipse(n[0] - 10, n[1] + 6, 26, 15, -0.2, 0, TAU); col.ellipse(n[0] + 26, n[1] + 4, 24, 14, 0.3, 0, TAU);
          if (mode === 'color') { c.fillStyle = PAPER; c.fill(col); } else { c.fillStyle = '#fff'; c.fill(col); c.strokeStyle = INK; c.lineWidth = 4.5; c.stroke(col); c.fillStyle = INK; [0, 1, 2].forEach(i => { c.beginPath(); c.arc(G.A.chest[0] + 2, G.A.chest[1] - 20 + i * 34, 4.5, 0, TAU); c.fill(); }); }
        },
        head: (c) => { // 黑发箍＋发丝墨线
          if (mode === 'color') return;
          const h = G.A.headC, rot = G.tilt;
          c.save(); c.translate(h[0], h[1]); c.rotate(rot); c.strokeStyle = INK; c.lineWidth = 11; c.lineCap = 'round'; c.beginPath(); c.ellipse(6, 4, 60, 66, -0.25, -2.35, -0.95); c.stroke(); c.restore();
          c.lineWidth = 3; c.strokeStyle = INK; G.hairLines.forEach(l => c.stroke(l));
          G.locks.forEach(l => { c.lineWidth = 3; c.stroke(l); });
        },
      } });
    // 少女与猫的地面黑影
    if (mode !== 'color') { g.fillStyle = INK; g.beginPath(); g.ellipse(560, 908, 150, 14, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(1260, 932, 170, 12, 0, 0, TAU); g.fill(); }
  }

  // ---- 顶层：速度线、拟声字、旁白框、右侧特写格、格框 ----
  function speedLines(c, G, lt, t) {
    const v = Math.abs(Math.sin(Math.min(1, lt / 0.9) * Math.PI)) * (lt < 0.95 ? 1 : 0);   // 端杯速度（正比）
    if (v < 0.08) return;
    const st = Math.floor(t * 12), r = U.rng(500 + st);
    const k = G.cup, dir = [-0.16, 1];                    // 杯往上走 → 速度线拖在下面
    c.save(); c.strokeStyle = INK; c.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const ox = k.x - 40 + i * 12 + (r() - 0.5) * 6, oy = k.y + 50 + r() * 26, L = (70 + r() * 110) * v;
      c.lineWidth = 2.5 + r() * 2.5; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + dir[0] * L, oy + dir[1] * L); c.stroke(); }
    // 手肘后方两道动作弧
    const E = G.A.elbow; c.lineWidth = 5; [0, 1].forEach(j => { c.beginPath(); c.arc(E[0] + 6, E[1] + 10, 46 + j * 18, 0.1, 1.1); c.stroke(); });
    c.restore();
  }
  function sfx(c, lt, t) {
    const q = clamp((lt - 0.52) / 0.16); if (q <= 0) return;
    const s = U.ease.outBack(q), st = Math.floor(t * 12), jx = (U.hash(st, 3) - 0.5) * 6, jy = (U.hash(st, 9) - 0.5) * 6;
    c.save(); c.translate(990 + jx, 318 + jy); c.rotate(-0.14); c.scale(s * 0.82, s * 0.82);
    // 爆炸放射底
    c.fillStyle = C.yel; c.strokeStyle = INK; c.lineWidth = 7; const burst = []; for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, r = (i % 2 ? 108 : 178) * (0.9 + U.hash(i, 77) * 0.2); burst.push([Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.75]); }
    const bp = U.poly(burst); c.fill(bp); c.stroke(bp);
    c.font = '132px "Bangers-400"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.letterSpacing = '4px';
    for (let d = 14; d > 0; d -= 2) { c.fillStyle = INK; c.fillText('SLURRP!', d * 0.8, d); }   // Kirby 的立体积木字：黑色挤出
    c.lineWidth = 10; c.strokeStyle = INK; c.strokeText('SLURRP!', 0, 0); c.fillStyle = C.red; c.fillText('SLURRP!', 0, 0);
    c.fillStyle = C.yel; c.save(); c.beginPath(); c.rect(-400, -70, 800, 46); c.clip(); c.fillText('SLURRP!', 0, 0); c.restore();
    c.restore();
  }
  function caption(c) {
    c.save(); c.translate(5, 5); c.fillStyle = INK; c.fillRect(40, 38, 420, 62); c.restore();
    c.fillStyle = C.yel; c.fillRect(40, 38, 420, 62); c.strokeStyle = INK; c.lineWidth = 5; c.strokeRect(40, 38, 420, 62);
    c.font = '38px "Bangers-400"'; c.fillStyle = INK; c.textBaseline = 'middle'; c.letterSpacing = '2px'; c.fillText('MEANWHILE, AT TEA TIME...', 56, 70); c.letterSpacing = '0px';
  }
  function catPanel(c, lt, t, ch) {
    const x0 = 1556, y0 = 236, x1 = 1892, y1 = 1050, cx = 1724, cy = 560;
    c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
    c.fillStyle = C.mag; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = P.dotPattern(c, 'pnl', 10, 3.6, C.yel, null, 0); c.fillRect(x0, y0, x1 - x0, y1 - y0);
    // 聚焦线：12fps 换种子
    const r = U.rng(900 + Math.floor(t * 12)); c.fillStyle = INK;
    for (let i = 0; i < 44; i++) { const a = i / 44 * TAU + r() * 0.08, w = 0.012 + r() * 0.02, r0 = 230 + r() * 60; c.beginPath(); c.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0); c.lineTo(cx + Math.cos(a) * 900, cy + Math.sin(a) * 900); c.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0); c.fill(); }
    // krackle 在头周围
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + t * 0.8; krackle(c, cx + Math.cos(a) * 200, cy + Math.sin(a) * 250, 30, 40 + k, t, 12); }
    // 特写猫头
    const head = new Path2D(); head.ellipse(cx, cy, 150, 132, 0, 0, TAU);
    const ears = U.poly([[cx - 140, cy - 40], [cx - 120, cy - 200], [cx - 40, cy - 120], [cx + 40, cy - 120], [cx + 120, cy - 200], [cx + 140, cy - 40]]);
    c.lineJoin = 'round'; c.fillStyle = C.org; c.strokeStyle = INK; c.lineWidth = 8; c.fill(ears); c.stroke(ears); c.fill(head); c.stroke(head);
    c.save(); c.clip(head); c.fillStyle = PAPER; c.beginPath(); c.ellipse(cx, cy + 80, 96, 72, 0, 0, TAU); c.fill();
    c.fillStyle = INK; c.beginPath(); c.ellipse(cx + 168, cy + 30, 48, 150, 0, 0, TAU); c.fill();         // 右侧黑块月牙
    c.strokeStyle = C.orgD; c.lineWidth = 12; [[-40, -128, -30, -80], [0, -132, 0, -84], [40, -128, 30, -80]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(cx + a, cy + b); c.lineTo(cx + d, cy + e); c.stroke(); });
    c.restore(); c.lineWidth = 8; c.strokeStyle = INK; c.stroke(head);
    // 眼：瞳孔追着杯子（杯往上→瞳孔往上，往左看）
    const look = ch.cup;
    [-62, 62].forEach(dx => { const ex = cx + dx, ey = cy - 18; c.fillStyle = '#b6e04a'; c.beginPath(); c.ellipse(ex, ey, 42, 48, 0, 0, TAU); c.fill(); c.lineWidth = 6; c.stroke();
      const px = ex - 14, py = ey + lerp(14, -18, look); c.fillStyle = INK; c.beginPath(); c.ellipse(px, py, 10 + look * 6, 30, 0, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - 22, ey - 22, 8, 0, TAU); c.fill(); });
    c.fillStyle = '#f07aa0'; c.beginPath(); c.moveTo(cx - 16, cy + 46); c.lineTo(cx + 16, cy + 46); c.lineTo(cx, cy + 64); c.closePath(); c.fill(); c.lineWidth = 4; c.stroke();
    c.lineWidth = 5; c.beginPath(); c.moveTo(cx - 36, cy + 84); c.quadraticCurveTo(cx - 14, cy + 102, cx, cy + 72); c.quadraticCurveTo(cx + 14, cy + 102, cx + 36, cy + 84); c.stroke();
    c.lineWidth = 3.5; [[-1, 60], [-1, 76], [1, 60], [1, 76]].forEach(([s, y]) => { c.beginPath(); c.moveTo(cx + s * 70, cy + y); c.lineTo(cx + s * 170, cy + y - 14 + (y - 60)); c.stroke(); });
    // 旁白
    c.fillStyle = '#fff'; c.fillRect(x0 + 14, y1 - 132, 308, 100); c.strokeStyle = INK; c.lineWidth = 5; c.strokeRect(x0 + 14, y1 - 132, 308, 100);
    c.font = '34px "Bangers-400"'; c.fillStyle = INK; c.textAlign = 'center'; c.letterSpacing = '1px'; c.fillText('BUT THE CAT', x0 + 168, y1 - 92); c.fillText('IS WATCHING!', x0 + 168, y1 - 52); c.letterSpacing = '0px'; c.textAlign = 'left';
    c.restore();
  }
  function gutters(c) {
    c.fillStyle = PAPER; c.fillRect(0, 0, W, 24); c.fillRect(0, H - 24, W, 24); c.fillRect(0, 0, 24, H); c.fillRect(W - 24, 0, 24, H);
    c.fillRect(1534, 0, 22, H); c.fillRect(1556, 214, W - 1556, 22);
    c.strokeStyle = INK; c.lineWidth = 7; c.strokeRect(24, 24, 1510, H - 48); c.strokeRect(1556, 236, 340, H - 260);
  }

  return {
    draw(c, lt, t) {
      const ch = P.choreo(lt, t);
      const G = RIG.girl({ cup: ch.cup, sip: ch.sip, hair: 'long', breathe: ch.breathe });
      const K = RIG.cat({ tail: ch.tail, blink: ch.blink, breathe: ch.breathe, look: ch.cup });
      const cc = P.scratch('kbColor'), cg = cc.getContext('2d'), ic = P.scratch('kbInk'), ig = ic.getContext('2d');
      cg.reset(); ig.reset();
      room(cg, 'color', t); chars(cg, 'color', t, ch, G, K);
      room(ig, 'ink', t); chars(ig, 'ink', t, ch, G, K);
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      c.drawImage(cc, 4, 3);                                  // 套色不准：色版相对墨版偏 (4,3)
      c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(ic, 0, 0); c.restore();
      speedLines(c, G, lt, t);
      // 热气 = krackle 小点上升
      for (let k = 0; k < 4; k++) { const q = ((t * 1.6 + k / 4) % 1); krackle(c, G.cup.x + Math.sin(q * 6 + k) * 14, G.cup.y - 24 - q * 120, 20 * (1 - q * 0.5), 60 + k, t, 9); }
      sfx(c, lt, t);
      caption(c);
      catPanel(c, lt, t, ch);
      gutters(c);
      c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(P.grain('kb', 0.05, [120, 100, 60], 0.25), 0, 0); c.restore();
    },
  };
})();
