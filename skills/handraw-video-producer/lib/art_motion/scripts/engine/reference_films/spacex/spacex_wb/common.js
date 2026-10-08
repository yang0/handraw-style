// SpaceX 这 24 年 · 白板版（wb）共用：一整块超大白板 ＋ 一台相机 ＋ 一支马克笔（RSA Animate 型，语法卡 y3_whiteboard）。
// 全片 12 段画在同一块板上，每段的 scene 文件只往板上「排笔画」和「排相机」，画面只由全片时间 t 决定——段与段之间没有转场函数，
// 转场就是相机在板上移动（平移 / 甩镜＋运动模糊 / 拉远再扎进去 / 云团擦除），板上的东西永远不跳。
// 版式：四行，像一页手写笔记：A 行 S01–S02，B 行 S03–S05，C 行 S06–S08，D 行 S09–S12；行内左→右按时间走，换行时甩镜或拉远。
// 颜色：黑线 #0A0503 ＋ 唯一强调色橙 #EF7226（关键词、数字、斜线排线）；字：霞鹜文楷。
// 约定：WB.cur 是「下一笔从什么时候开始」（全片秒）；WB.line/text 会把它往后推；WB.pop/fill/custom 不推（或只推一点）。
(() => {
const W = 1920, H = 1080;
const { clamp, lerp } = U;
const INK = '#0A0503', OR = '#EF7226', BOARD = '#FBFBFB', WASH = 'rgba(239,114,38,.2)', FONT = '"LXGWWenKai-500"';
const SPEED = 2500, LW = 6.5;
const WB = window.WB = { INK, OR, BOARD, WASH, FONT, SPEED, LW, S: [], K: [], FX: [], WHIP: [], CH: {}, cur: 0, built: false, texts: [] };
const ROW = { A: 0, B: 1150, C: 2300, D: 3450 };
WB.ROW = ROW;

// ---------- 时间 ----------
WB.T0 = id => TIMING.seg[id].t0;
WB.q = (id, key) => TIMING.seg[id].t0 + TM.cue(id, key);
WB.qe = (id, key) => TIMING.seg[id].t0 + TM.end(id, key);
WB.at = t => (WB.cur = t);
WB.go = t => (WB.cur = Math.max(WB.cur, t));

// ---------- 几何 ----------
const bbOf = (pts, pad = 0) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]; };
WB.bbOf = bbOf;
WB.circ = (cx, cy, r, turns = 1.06, a0 = -Math.PI / 2) => DG.arcPts(cx, cy, r, r, a0, a0 + turns * Math.PI * 2, Math.max(18, Math.round(r * turns / 3)));
WB.ell = (cx, cy, rx, ry, a0 = -Math.PI / 2, turns = 1.03, rot = 0, n = 64) => { const c = Math.cos(rot), s = Math.sin(rot);
  return DG.arcPts(0, 0, rx, ry, a0, a0 + turns * Math.PI * 2, n).map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]); };
// 折线加密（保角：每条边各自加密，手绘抖动后角还是角）
WB.dense = (P, k = 10) => { const out = []; for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < k; j++) out.push([lerp(P[i][0], P[i + 1][0], j / k), lerp(P[i][1], P[i + 1][1], j / k)]); out.push(P[P.length - 1]); return out; };
WB.rect = (x, y, w, h) => WB.dense([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + 2]], 12);
WB.quad = (a, c, b, n = 28) => { const o = []; for (let i = 0; i <= n; i++) { const u = i / n; o.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]]); } return o; };
WB.xf = (pts, x, y, s = 1, r = 0) => { const c = Math.cos(r), n = Math.sin(r); return pts.map(([a, b]) => [x + (a * c - b * n) * s, y + (a * n + b * c) * s]); };

// ---------- 笔画 ----------
WB.line = (raw, o = {}) => {
  const { w = LW, col = INK, speed = SPEED, smooth = true, amp = 1.9, min = 0.04, gap = 0.02, dash = null, until = null } = o;
  const pts = smooth ? DG.hand(raw, { amp, seed: o.seed ?? WB.S.length + 7, per: 8 }) : raw;
  const cum = DG.cum(pts), len = cum[cum.length - 1], d = o.dur ?? Math.max(min, len / speed);
  const s = { kind: 'line', pts, cum, len, w, col, dash, t0: o.t0 ?? WB.cur, until, bb: bbOf(pts, w + 4), handed: o.handed !== false, nofit: !!o.nofit };
  s.t1 = s.t0 + d; WB.S.push(s); if (o.t0 == null) WB.cur += d + gap; return s;
};
const mctx = () => WB._m || (WB._m = document.createElement('canvas').getContext('2d'));
const DIGF = '"Kalam-700"', isDig = ch => false;   // 数字仍用霞鹜文楷（Kalam 只留作备用）
WB.cf = (ch, size) => isDig(ch) ? `${Math.round(size * 1.02)}px ${DIGF}` : `${size}px ${FONT}`;
WB.measure = (str, size) => { const g = mctx(); let w = 0; for (const ch of str) { g.font = WB.cf(ch, size); w += g.measureText(ch).width; } return w; };
// 笔顺：汉字沿 hanzi-writer 的笔画中线一笔一笔露出霞鹜文楷的字（1024 格，y 朝上，顶边 900）；数字用手写中线（按字的墨迹框归一化）；
// 其余字符（拉丁字母、标点）仍用之字形揭开。中线只决定「先露哪里、笔尖走哪」，字形本身不变，写完正好是整字。
const DIGM = {
  '0': [[[0.55, 0.02], [0.2, 0.15], [0.05, 0.5], [0.2, 0.88], [0.5, 0.98], [0.82, 0.86], [0.95, 0.5], [0.82, 0.13], [0.5, 0.02], [0.3, 0.1]]],
  '1': [[[0.15, 0.22], [0.6, 0.02], [0.6, 0.98]]],
  '2': [[[0.1, 0.25], [0.35, 0.03], [0.7, 0.05], [0.88, 0.28], [0.75, 0.55], [0.08, 0.97], [0.95, 0.97]]],
  '3': [[[0.1, 0.12], [0.45, 0.02], [0.82, 0.15], [0.8, 0.38], [0.45, 0.5], [0.85, 0.62], [0.88, 0.85], [0.5, 0.98], [0.08, 0.88]]],
  '4': [[[0.68, 0.98], [0.68, 0.02], [0.05, 0.7], [0.97, 0.7]]],
  '5': [[[0.88, 0.04], [0.25, 0.04], [0.15, 0.48], [0.5, 0.4], [0.88, 0.58], [0.85, 0.85], [0.5, 0.98], [0.1, 0.88]]],
  '6': [[[0.8, 0.04], [0.35, 0.25], [0.1, 0.62], [0.25, 0.92], [0.55, 0.98], [0.88, 0.8], [0.85, 0.55], [0.5, 0.45], [0.15, 0.6]]],
  '7': [[[0.05, 0.04], [0.95, 0.04], [0.65, 0.45], [0.38, 0.98]]],
  '8': [[[0.55, 0.48], [0.2, 0.3], [0.3, 0.06], [0.55, 0.02], [0.8, 0.12], [0.78, 0.32], [0.45, 0.52], [0.12, 0.72], [0.25, 0.94], [0.55, 0.98], [0.88, 0.8], [0.75, 0.6], [0.5, 0.5]]],
  '9': [[[0.85, 0.32], [0.55, 0.5], [0.2, 0.42], [0.12, 0.18], [0.45, 0.02], [0.85, 0.12], [0.9, 0.4], [0.75, 0.75], [0.45, 0.98]]],
};
const soCache = new Map();
WB.so = (ch, size, wch) => {
  const key = ch + '|' + size; if (soCache.has(key)) return soCache.get(key);
  let strokes = null, bw = 0; const M = window.WB_STROKES && window.WB_STROKES[ch];
  if (M) { const k = size / 1024; strokes = M.map(st => st.map(([X, Y]) => [X * k + (wch - size) / 2, -size * 0.88 + (900 - Y) * k])); bw = size * 0.2; }
  else if (DIGM[ch]) { const g = mctx(); g.font = WB.cf(ch, size); const m = g.measureText(ch), x0 = -m.actualBoundingBoxLeft, x1 = m.actualBoundingBoxRight, y0 = -m.actualBoundingBoxAscent, y1 = m.actualBoundingBoxDescent;
    strokes = DIGM[ch].map(st => st.map(([u, v]) => [x0 + u * (x1 - x0), y0 + v * (y1 - y0)])); bw = size * 0.24; }
  let r = null;
  if (strokes) { const cums = strokes.map(DG.cum), lens = cums.map(c => c[c.length - 1]), gap = size * 0.1; r = { strokes, cums, lens, gap, bw, tot: lens.reduce((a, b) => a + b, 0) + gap * (strokes.length - 1) }; }
  soCache.set(key, r); return r;
};
// 写到 f（0–1）：[遮罩, 笔尖]，坐标相对这个字的左边、基线。两笔之间笔尖空中滑到下一笔起点。
WB.soAt = (so, f, mask = true) => {
  let d = f * so.tot, tip = so.strokes[0][0]; const p = mask ? new Path2D() : null;
  for (let j = 0; j < so.strokes.length && d > 0; j++) {
    const dd = Math.min(d, so.lens[j]); if (mask) p.addPath(DG.revealMask(so.strokes[j], so.cums[j], dd, so.bw)); tip = DG.pointAt(so.strokes[j], so.cums[j], dd);
    d -= so.lens[j];
    if (d > 0 && j < so.strokes.length - 1) { if (d < so.gap) { const a = so.strokes[j][so.strokes[j].length - 1], b = so.strokes[j + 1][0], u = d / so.gap; tip = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; } d -= so.gap; }
  }
  return [p, tip];
};
// 手写字：rate 字/秒（正文 ≈14–16，标题 ≈7.5–10）
WB.text = (str, x, y, size, o = {}) => {
  const { col = INK, rate = 14, align = 'left', until = null } = o;
  const chars = [...str], d = o.dur ?? chars.length / rate, g = mctx();
  const ws = chars.map(ch => { g.font = WB.cf(ch, size); return g.measureText(ch).width; }), w = ws.reduce((a, b) => a + b, 0), x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const s = { kind: 'text', str, chars, ws, w, x: x0, y, size, col, t0: o.t0 ?? WB.cur, until, bb: [x0 - 12, y - size * 1.05, x0 + w + 12, y + size * 0.35], handed: true };
  s.t1 = s.t0 + d; WB.S.push(s); WB.texts.push(str); if (o.t0 == null) WB.cur += d + 0.04; return s;
};
// 强调词：不带手，0.32s 放大回落整词弹出。o.at = 落定时刻（念到它的那一刻）
WB.pop = (str, x, y, size, o = {}) => {
  const { col = OR, align = 'center', rot = 0, until = null } = o;
  if (!o.stamp) {   // 默认：笔快写出来。写完的那一刻＝ o.at（念到它的时刻）
    const n = [...str].length, dur = o.wdur ?? Math.max(0.22, Math.min(0.6, n / 15));
    const t0 = o.at != null ? o.at - dur : WB.cur;
    const s = WB.text(str, x, y, size, { col, align, dur, t0, until });
    s.emph = true; if (o.at != null && o.wdur == null) s.slow = Math.max(0.42, Math.min(0.95, n * 0.17));   // 重点词想慢一点写（看得见笔顺），build 时在不和别的笔打架的前提下往前延
    if (o.at == null) WB.cur = t0 + dur + 0.04; return s;
  }
  const dur = o.dur ?? 0.34, w = WB.measure(str, size), x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const t0 = o.at != null ? o.at - dur * 0.55 : WB.cur;
  const s = { kind: 'pop', str, x: x0 + w / 2, y, w, size, col, rot, t0, t1: t0 + dur, until, bb: [x0 - size * 0.3, y - size * 1.3, x0 + w + size * 0.3, y + size * 0.5] };
  WB.S.push(s); WB.texts.push(str); if (o.at == null) WB.cur += o.adv ?? 0.1; return s;
};
// 铺色（淡入，不推进时间）：pts 多边形或 Path2D（Path2D 要给 bb）
WB.fill = (pts, col = WASH, dur = 0.25, o = {}) => {
  const path = pts instanceof Path2D ? pts : U.poly(pts);
  const s = { kind: 'fill', path, col, t0: o.t0 ?? WB.cur, t1: (o.t0 ?? WB.cur) + dur, until: o.until ?? null, bb: o.bb || (pts instanceof Path2D ? null : bbOf(pts, 4)) };
  WB.S.push(s); return s;
};
// 自定义：{ t0, t1, draw(g, q, t) → 笔尖|null, bb, handed, start(), end(), until }
WB.fade = (arr, t, dur = 0.3) => arr.forEach(s => { s.fadeAt = t; s.fadeDur = dur; });
WB.custom = o => { const s = { kind: 'custom', handed: false, bb: null, until: null, ...o }; WB.S.push(s); return s; };
// 斜线排线（橙色浅面）：在多边形/圆里画平行斜线，笔速很快
WB.hatchCircle = (cx, cy, r, o = {}) => {
  const { gap = 22, ang = -0.8, col = OR, w = 4.2, speed = SPEED * 3.2 } = o, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const out = []; for (let d = -r + gap * 0.6; d <= r - gap * 0.4; d += gap) { const h = Math.sqrt(r * r - d * d) * 0.9;
    out.push(WB.line([[cx + nx * d - ux * h, cy + ny * d - uy * h], [cx + nx * d + ux * h, cy + ny * d + uy * h]], { col, w, speed, min: 0.022, gap: 0.006, amp: 0.8, until: o.until })); }
  return out;
};
WB.hatchRect = (x, y, w0, h0, o = {}) => {   // 45° 斜线填满矩形（逐条裁到矩形内）
  const { gap = 20, col = OR, w = 4.2, speed = SPEED * 3.4 } = o, out = [];
  for (let k = gap * 0.5; k < w0 + h0; k += gap) { const a = [x + Math.min(k, w0), y + Math.max(0, k - w0)], b = [x + Math.max(0, k - h0), y + Math.min(k, h0)];
    out.push(WB.line([[a[0], a[1]], [b[0], b[1]]], { col, w, speed, min: 0.016, gap: 0.004, amp: 0.6, smooth: false, until: o.until })); }
  return out;
};
// 引线：笔在相机平移时画一支橙色虚线箭头，从上一块的尾巴连到下一块的开头（手领着相机走；全图里它们把各块串成一条线）
WB.lead = (a, b, t0, dur = 0.55, o = {}) => {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, bend = o.bend ?? -0.18 * L;
  const pts = WB.quad(a, [mx - dy / L * bend, my + dx / L * bend], b, 30);
  const s1 = WB.line(pts, { col: OR, w: 8, dash: [1, 15], t0, dur: dur * 0.85, amp: 1.0, nofit: true });
  const e = pts[pts.length - 1], p = pts[pts.length - 4], an = Math.atan2(e[1] - p[1], e[0] - p[0]), h = 26;
  WB.line([[e[0] - Math.cos(an - 0.5) * h, e[1] - Math.sin(an - 0.5) * h], e, [e[0] - Math.cos(an + 0.5) * h, e[1] - Math.sin(an + 0.5) * h]], { col: OR, w: 6, smooth: false, t0: t0 + dur * 0.87, dur: dur * 0.13, nofit: true });
  return s1;
};
WB.arrow = (a, b, o = {}) => {
  const { bend = 0, col = INK, w = LW, head = 30, dash = null, speed = SPEED * 1.3 } = o;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const c = [mx - dy / L * bend, my + dx / L * bend], pts = WB.quad(a, c, b, 30);
  const s1 = WB.line(pts, { col, w, dash, speed, until: o.until, amp: o.amp ?? 1.4 });
  const e = pts[pts.length - 1], p = pts[pts.length - 4], an = Math.atan2(e[1] - p[1], e[0] - p[0]);
  const s2 = WB.line([[e[0] - Math.cos(an - 0.5) * head, e[1] - Math.sin(an - 0.5) * head], e, [e[0] - Math.cos(an + 0.5) * head, e[1] - Math.sin(an + 0.5) * head]], { col, w, smooth: false, speed: speed * 0.8, until: o.until });
  return [s1, s2];
};
// 一组局部笔画（[{p, o:橙, w:线宽倍数, dash, smooth}]）放到 (x,y)、缩放 s、旋转 r 后逐笔画出；返回笔画对象数组（方便设 until）
WB.sk = (strokes, x, y, o = {}) => {
  const s = o.s || 1, r = o.rot || 0, out = [];
  for (const k of strokes) {
    if (k.fillPts) { out.push(WB.fill(WB.xf(k.fillPts, x, y, s, r), k.fillCol || WASH, 0.2, { until: o.until })); continue; }
    const pts = WB.xf(k.p, x, y, s, r);
    out.push(WB.line(pts, { w: (k.w || 1) * (o.w || LW), col: k.o ? OR : (o.col || INK), speed: (o.speed || SPEED) * (k.fast ? 2 : 1), smooth: k.smooth !== false, dash: k.dash, until: o.until, gap: o.gap ?? 0.01, min: o.min ?? 0.025, amp: k.amp ?? 1.2 }));
  }
  return out;
};
// 精灵（会动的画好的东西）：笔画在局部坐标里抖动一次就固定（不沸腾），每帧按位置/角度画
WB.prep = (strokes, lw = LW) => strokes.map(k => k.fillPts ? { fill: U.poly(k.fillPts), col: k.fillCol || WASH } :
  ({ pts: k.smooth === false ? k.p : DG.hand(k.p, { amp: k.amp ?? 1.1, seed: (k.p.length * 13 + Math.round(k.p[0][0] * 7)) | 0, per: 8 }), w: (k.w || 1) * lw, col: k.o ? OR : INK, dash: k.dash }));
WB.drawPrep = (g, P, x, y, s = 1, r = 0, alpha = 1) => {
  g.save(); g.translate(x, y); if (r) g.rotate(r); if (s !== 1) g.scale(s, s); g.globalAlpha *= alpha; g.lineJoin = 'round'; g.lineCap = 'round';
  for (const k of P) {
    if (k.fill) { g.fillStyle = k.col; g.fill(k.fill); continue; }
    g.strokeStyle = k.col; g.lineWidth = k.w / s; if (k.dash) g.setLineDash(k.dash.map(v => v / s));
    g.beginPath(); k.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); if (k.dash) g.setLineDash([]);
  }
  g.restore();
};
// 一笔画出一个预备好的精灵（逐笔描出，画完后不动），用于「先画后飞」：返回最后一笔的 t1
WB.drawOn = (P, x, y, o = {}) => {
  const s = o.s || 1, r = o.rot || 0, out = [];
  for (const k of P) {
    if (k.fill) { out.push(WB.custom({ t0: WB.cur, t1: WB.cur + 0.2, until: o.until, bb: o.bb || null, draw(g, q) { g.save(); g.globalAlpha = q; g.translate(x, y); if (r) g.rotate(r); g.scale(s, s); g.fillStyle = k.col; g.fill(k.fill); g.restore(); return null; } })); continue; }
    const pts = WB.xf(k.pts, x, y, s, r);
    out.push(WB.line(pts, { w: k.w * (o.lws || 1), col: k.col, dash: k.dash, smooth: false, speed: o.speed || SPEED, until: o.until, gap: 0.01, min: 0.025 }));
  }
  return out;
};

// ---------- 相机 ----------
// 关键帧全片秒。WB.move(t0,t1,x,y,z) = 从 t0 时的位置移到 (x,y,z)，t1 到位。停留期间默认很慢地推近（creep），画面不会死。
WB.cam0 = (x, y, z) => { WB.K.length = 0; WB.K.push({ t: 0, x, y, z }); };
WB.move = (t0, t1, x, y, z, o = {}) => {
  const K = WB.K, last = K[K.length - 1];
  if (t0 < last.t - 1e-4) { console.warn(`WB.move: ${t0.toFixed(2)} 早于上一个相机键 ${last.t.toFixed(2)}，顺延`); t0 = last.t; }
  if (t0 > last.t + 1e-3) { const hold = t0 - last.t, cr = o.creep ?? 0.007; K.push({ t: t0, x: last.x, y: last.y, z: last.z * (1 + Math.min(0.035, cr * hold)), ease: MO.sineInOut }); }
  K.push({ t: Math.max(t1, t0 + 0.05), x, y, z, ease: o.ease || MO.sineInOut });
  if (o.whip) WB.WHIP.push([t0, Math.max(t1, t0 + 0.05)]);   // 换行甩镜：WB.draw 里按纯平移做密集拖影
};
WB.camAt = t => CAM.at(WB.K, t);
// 取景：把「t0 落在 [a,b) 里的笔画」框进画面（上下留在屏幕 70–870，左右各留 96），返回 [x,y,z]。
// 会动的精灵（custom）默认不算，除非它带 fit:true；地面线这类横贯的线可以标 nofit。o.add 追加世界矩形。
WB.fit = (a, b, o = {}) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const ext = r => { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); };
  for (const s of WB.S) { if (s.t0 < a || s.t0 >= b || !s.bb || s.nofit || s.kind === 'fill') continue; if (s.kind === 'custom' && !s.fit) continue; ext(s.bb); }
  (o.add || []).forEach(ext);
  if (x0 > x1) { console.warn(`WB.fit: [${a.toFixed(2)}, ${b.toFixed(2)}) 里没有笔画`); const k = WB.K[WB.K.length - 1]; return [k.x, k.y, k.z]; }
  const pad = o.pad ?? 50, w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad;
  const z = U.clamp(Math.min((W - 192) / w, 800 / h), o.zmin ?? 0.12, o.zmax ?? 1.25);
  return [(x0 + x1) / 2 + (o.dx || 0), (y0 + y1) / 2 + (540 - (o.sy ?? 470)) / z, z, [x0, y0, x1, y1]];
};
WB.declip = (cam, a, b, o = {}) => {
  let [x, y, z, cb] = cam; const z0 = z, M = 30, ok = xx => !cb || (cb[0] >= xx - W / 2 / z + 20 / z && cb[2] <= xx + W / 2 / z - 20 / z);
  for (let it = 0; it < 8; it++) {
    const hw = W / 2 / z, hh = H / 2 / z, v = [x - hw, y - hh, x + hw, y + hh]; let moved = false;
    for (const s of WB.S) {
      if ((s.kind !== 'text' && s.kind !== 'pop') || s.t0 >= b || (s.t0 >= a && s.t0 < b) || !s.bb || s.fadeAt != null) continue;
      const bb = s.bb, inter = !(bb[2] < v[0] || bb[0] > v[2] || bb[3] < v[1] || bb[1] > v[3]); if (!inter) continue;
      const inside = bb[0] >= v[0] + M / z && bb[2] <= v[2] - M / z && bb[1] >= v[1] && bb[3] <= v[3]; if (inside) continue;
      // 横向被裁：把画框推开，让这串字整个出画（推的距离不超过 o.maxShift）
      const cx = (bb[0] + bb[2]) / 2, maxS = (o.maxShift ?? 420) / z;
      if (cx < x && bb[2] > v[0] && bb[2] - v[0] + M / z < maxS && ok(x + bb[2] - v[0] + M / z)) { x += bb[2] - v[0] + M / z; moved = true; break; }
      if (cx >= x && bb[0] < v[2] && v[2] - bb[0] + M / z < maxS && ok(x - (v[2] - bb[0] + M / z))) { x -= v[2] - bb[0] + M / z; moved = true; break; }
      // 推不开就把这串字整个框进来（缩放最多让出 20%）
      if (cb) { const nb = [Math.min(cb[0], bb[0]), cb[1], Math.max(cb[2], bb[2]), cb[3]], z2 = Math.min(z, (W - 192) / (nb[2] - nb[0] + 100));
        if (z2 >= z0 * 0.8 && (nb[0] !== cb[0] || nb[2] !== cb[2])) { cb = nb; x = (nb[0] + nb[2]) / 2; y = y + 0; z = z2; moved = true; break; } }
    }
    if (!moved) break;
  }
  return [x, y, z, cb];
};
WB.shot = (t, dur, a, b, o = {}) => { let c = WB.fit(a, b, o); if (o.declip !== false) c = WB.declip(c, a, b, o); WB.move(t, t + dur, c[0], c[1], c[2], o); return c; };
WB.view = cam => { const hw = W / 2 / cam.z, hh = H / 2 / cam.z; return [cam.x - hw, cam.y - hh, cam.x + hw, cam.y + hh]; };

// ---------- 屏幕层特效 ----------
WB.fx = (t0, t1, draw) => WB.FX.push({ t0, t1, draw });

// ---------- 章节 ----------
WB.chapter = (id, fn) => { WB.CH[id] = fn; };
WB.build = () => {
  if (WB.built) return; WB.built = true;
  for (const e of ERAS) { const fn = WB.CH[e.id]; if (fn) { const n0 = WB.S.length; fn(e.id); WB.S.slice(n0).forEach(s => (s.ch = e.id)); } }
  WB.K.sort((a, b) => a.t - b.t);
  const hs = WB.S.filter(s => s.handed && (s.kind === 'line' || s.kind === 'text' || s.kind === 'custom'));
  for (const s of hs) if (s.slow && s.t1 - s.t0 < s.slow) { const t0o = s.t0; let lb = s.t1 - s.slow;
    for (const o of hs) if (o !== s && o.t0 < t0o + 1e-6 && o.t1 > lb - 0.03) lb = o.t1 + 0.03;
    s.t0 = Math.min(t0o, lb); }
  // 一支笔同时只能画一笔：后起的那笔（线或普通字）顺延到前一笔写完；顺延不超过 0.35s，自定义动画和重点词不动
  hs.sort((a, b) => a.t0 - b.t0);
  for (let pass = 0; pass < 6; pass++) { let moved = false;
    for (let i = 1; i < hs.length; i++) { const p = hs[i - 1], b = hs[i]; const sh = p.t1 + 0.02 - b.t0;
      if (sh > 0.03 && sh <= 0.35 && b.kind !== 'custom' && !b.emph) { b.t0 += sh; b.t1 += sh; moved = true; }
      else if (sh > 0.03 && b.emph && b.t1 - (p.t1 + 0.02) >= 0.1) { b.t0 = p.t1 + 0.02; moved = true; } }
    hs.sort((a, b) => a.t0 - b.t0); if (!moved) break; }
  WB.HS = hs;
  U.assertGlyphs('LXGWWenKai-500', WB.texts.join(''), 'wb');
};
// 每章笔画排到了哪（调试）：[id, 段起, 段止, 最早笔, 最晚笔]
WB.report = () => ERAS.map(e => { const ss = WB.S.filter(s => s.ch === e.id); const T = TIMING.seg[e.id];
  return [e.id, +T.t0.toFixed(2), +(T.t0 + T.dur).toFixed(2), ss.length ? +Math.min(...ss.map(s => s.t0)).toFixed(2) : null, ss.length ? +Math.max(...ss.map(s => s.t1)).toFixed(2) : null, ss.length]; });

// ---------- 画 ----------
const drawOne = (g, s, t) => {
  if (t < s.t0 || (s.until != null && t >= s.until)) return null;
  const q = s.t1 > s.t0 ? clamp((t - s.t0) / (s.t1 - s.t0)) : 1;
  if (s.kind === 'line') {
    g.strokeStyle = s.col; g.lineWidth = s.w; if (s.dash) g.setLineDash(s.dash);
    const tip = DG.drawPartial(g, s.pts, s.cum, s.len * MO.sineInOut(q)); if (s.dash) g.setLineDash([]); return tip;
  }
  if (s.kind === 'text') {
    g.font = `${s.size}px ${FONT}`; g.fillStyle = s.col; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    const n = s.chars.length, k = Math.min(n, q * n), done = Math.floor(k); let x = s.x, tip = null;
    const sd = (s.x * 7 + s.y * 3) | 0, jit = i => [U.hash(sd, i) - 0.5, U.hash(sd + 1, i) - 0.5];
    let bump = 1; if (s.emph && t > s.t1) { const u = (t - s.t1) / 0.28; if (u < 1) bump = 1 + 0.07 * Math.sin(u * Math.PI); }
    if (bump !== 1) { const cx = s.x + s.w / 2, cy = s.y - s.size * 0.35; g.save(); g.translate(cx, cy); g.scale(bump, bump); g.translate(-cx, -cy); }
    const put = (i, xx) => { const [a, b] = jit(i); g.save(); g.font = WB.cf(s.chars[i], s.size); g.translate(xx + s.ws[i] / 2, s.y + b * s.size * 0.05); g.rotate(a * 0.07); g.fillText(s.chars[i], -s.ws[i] / 2, 0); g.restore(); };
    for (let i = 0; i < n; i++) {
      if (i < done) put(i, x);
      else if (i === done && k < n) {
        const so = WB.so(s.chars[i], s.size, s.ws[i]);
        if (so) { const [m, tp] = WB.soAt(so, k - done); g.save(); g.translate(x, s.y); g.clip(m); g.translate(-x, -s.y); put(i, x); g.restore(); tip = [x + tp[0], s.y + tp[1]]; }
        else { const zz = DG.zigzag(x - 2, s.y - s.size * 0.95, s.ws[i] + 4, s.size * 1.15, 3), cum = DG.cum(zz), d = cum[cum.length - 1] * (k - done);
          g.save(); g.clip(DG.revealMask(zz, cum, d, s.size * 0.62)); put(i, x); g.restore(); tip = DG.pointAt(zz, cum, d); }
      } else break;
      x += s.ws[i];
    }
    if (bump !== 1) g.restore();
    return tip;
  }
  if (s.kind === 'pop') {
    const e = MO.backOut(q, 2.4);
    g.save(); g.font = `${s.size}px ${FONT}`; g.fillStyle = s.col; g.textBaseline = 'alphabetic'; g.textAlign = 'center'; g.globalAlpha *= clamp(q * 4);
    g.translate(s.x, s.y - s.size * 0.35); if (s.rot) g.rotate(s.rot); g.scale(e, e); g.fillText(s.str, 0, s.size * 0.35); g.restore(); return null;
  }
  if (s.kind === 'fill') { g.save(); g.globalAlpha *= q; g.fillStyle = s.col; g.fill(s.path); g.restore(); return null; }
  if (s.kind === 'custom') { g.save(); const r = s.draw(g, q, t); g.restore(); return r; }
  return null;
};
const smudge = () => PAINT.cached('wb_smudge', 1024, 1024, g => { const r = U.rng(5); for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(120,120,130,${0.0006 + r() * 0.0011})`; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 80 + r() * 220, 14 + r() * 40, r() * 3, 0, 7); g.fill(); } });
function drawBoard(c, t, cam) {
  c.fillStyle = BOARD; c.fillRect(0, 0, W, H);
  c.save(); const ox = -(((cam.x * cam.z) % 1024) + 1024) % 1024, oy = -(((cam.y * cam.z) % 1024) + 1024) % 1024;
  c.translate(ox, oy); c.fillStyle = c.createPattern(smudge(), 'repeat'); c.fillRect(0, 0, W + 1024, H + 1024); c.restore();
  const [vx0, vy0, vx1, vy1] = WB.view(cam);
  c.save(); CAM.apply(c, cam); c.lineJoin = 'round'; c.lineCap = 'round';
  let tip = null, col = null;
  for (const s of WB.S) {
    if (t < s.t0) continue;
    const b = s.bb; if (b && (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1)) continue;
    let p;
    if (s.fadeAt != null && t >= s.fadeAt) {   // 擦掉（白板语言，不用淡出）：板擦从左往右抹过去，抹过的地方只留一层很淡的残影
      const k = (t - s.fadeAt) / (s.fadeDur || 0.3), b = s.bb;
      if (!b) { if (k >= 1) continue; c.save(); c.globalAlpha = 1 - k; p = drawOne(c, s, t); c.restore(); }
      else { const x = b[0] - 30 + (b[2] - b[0] + 60) * MO.sineInOut(clamp(k)), sl = (b[3] - b[1]) * 0.25;
        c.save(); c.globalAlpha = 0.07; drawOne(c, s, t); c.restore();
        if (k < 1) { c.save(); c.beginPath(); c.moveTo(x + sl, b[1] - 60); c.lineTo(b[2] + 1e4, b[1] - 60); c.lineTo(b[2] + 1e4, b[3] + 60); c.lineTo(x - sl, b[3] + 60); c.closePath(); c.clip(); p = drawOne(c, s, t); c.restore(); } } }
    else p = drawOne(c, s, t);
    if (p && t < s.t1 && s.handed) { tip = p; col = s.col; }
  }
  c.restore();
  return { tip, col };
}
// 笔：在画 → 笔尖；两笔空档 ≤0.7s → 沿弧线滑过去；更长 → 0.35s 退到右下屏外，下一笔前 0.35s 再进来
const OFF = [W + 180, H + 340];
const endPt = s => s.kind === 'line' ? s.pts[s.pts.length - 1] : s.kind === 'text' ? [s.x + s.w, s.y - s.size * 0.35] : s.end ? s.end() : [(s.bb[0] + s.bb[2]) / 2, (s.bb[1] + s.bb[3]) / 2];
const startPt = s => s.kind === 'line' ? s.pts[0] : s.kind === 'text' ? [s.x, s.y - s.size * 0.6] : s.start ? s.start() : [(s.bb[0] + s.bb[2]) / 2, (s.bb[1] + s.bb[3]) / 2];
function penAt(t, cam, tip) {
  if (tip) return CAM.toScreen(cam, tip[0], tip[1]);
  let prev = null, next = null;
  for (const s of WB.HS) { if (s.t1 <= t) { if (!prev || s.t1 > prev.t1) prev = s; } else if (s.t0 > t) { next = s; break; } else return null; }
  if (prev && next && next.t0 - prev.t1 <= 0.7) {
    const q = MO.sineInOut((t - prev.t1) / (next.t0 - prev.t1)), a = CAM.toScreen(cam, ...endPt(prev)), b = CAM.toScreen(cam, ...startPt(next));
    return [lerp(a[0], b[0], q), lerp(a[1], b[1], q) - Math.sin(q * Math.PI) * Math.min(90, 20 + Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.15)];
  }
  const inn = next ? MO.cubicOut(clamp((t - (next.t0 - 0.35)) / 0.35)) : 0;
  if (inn > 0) { const b = CAM.toScreen(cam, ...startPt(next)); return [lerp(OFF[0], b[0], inn), lerp(OFF[1], b[1], inn)]; }
  if (prev) { const out = MO.cubicIn(clamp((t - prev.t1) / 0.35)); if (out >= 1) return null; const a = CAM.toScreen(cam, ...endPt(prev)); return [lerp(a[0], OFF[0], out), lerp(a[1], OFF[1], out)]; }
  return null;
}
// 不画也能算出某时刻笔尖在哪（只算线和字；自定义笔画返回 null，退回到滑行位置）——给笔的倾斜/抬起算速度用
function tipAt(t) {
  let cur = null; for (const s of WB.HS) { if (s.t0 > t) break; if (t < s.t1 && (s.until == null || t < s.until)) cur = s; }
  if (!cur) return null; const q = U.clamp((t - cur.t0) / (cur.t1 - cur.t0));
  if (cur.kind === 'line') return DG.pointAt(cur.pts, cur.cum, cur.len * MO.sineInOut(q));
  if (cur.kind === 'text') { const n = cur.chars.length, k = Math.min(n - 1e-6, q * n), i = Math.floor(k); let x = cur.x; for (let j = 0; j < i; j++) x += cur.ws[j];
    const so = WB.so(cur.chars[i], cur.size, cur.ws[i]); if (so) { const tp = WB.soAt(so, k - i, false)[1]; return [x + tp[0], cur.y + tp[1]]; }
    const zz = DG.zigzag(x - 2, cur.y - cur.size * 0.95, cur.ws[i] + 4, cur.size * 1.15, 3), cm = DG.cum(zz); return DG.pointAt(zz, cm, cm[cm.length - 1] * (k - i)); }
  return null;
}
WB.draw = (c, t) => {
  if (!WB.built) WB.build();
  const cam = WB.camAt(t);
  const whip = WB.WHIP.some(([a, b]) => t > a && t < b);
  // 运动模糊。原则：叠出来的每一层间距 ≤ 几个像素，看起来是一道顺滑的拖影，不是台阶状的残影。
  // 换行甩镜（纯平移）：板子只画一次，沿速度方向密集错位叠 n 层（半帧快门）；其余快速运镜（带缩放）：按时间取 N 个时刻各画一遍再等权叠，快门按「每层间距 ≤ 8px」收窄。
  const cp = WB.camAt(t - 1 / 30), vw = WB.view(cam), pts = [[cam.x, cam.y], [vw[0], vw[1]], [vw[2], vw[3]]];
  const disp = pts.map(p => { const a = CAM.toScreen(cam, p[0], p[1]), b = CAM.toScreen(cp, p[0], p[1]); return [a[0] - b[0], a[1] - b[1]]; }), dpx = Math.max(...disp.map(d => Math.hypot(d[0], d[1])));
  const buf = () => WB._buf || (WB._buf = (() => { const b = document.createElement('canvas'); b.width = W; b.height = H; return b; })());
  let res;
  if (dpx < 24) res = drawBoard(c, t, cam);
  else if (whip) {
    const b = buf(), g = b.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); res = drawBoard(g, t, cam);
    // 倍增法做 2^m 层等权错位（m 次叠加就够，比逐层叠快得多）
    const [vx, vy] = disp[0], L = 0.5, m = Math.min(6, Math.max(2, Math.ceil(Math.log2(dpx * L / 2))));
    const b2 = WB._buf2 || (WB._buf2 = (() => { const x = document.createElement('canvas'); x.width = W; x.height = H; return x; })());
    let A = b, B = b2; for (let k = 0; k < m; k++) { const f = L / Math.pow(2, k + 1), gB = B.getContext('2d'); gB.setTransform(1, 0, 0, 1, 0, 0); gB.globalAlpha = 1; gB.fillStyle = BOARD; gB.fillRect(0, 0, W, H); gB.drawImage(A, 0, 0); gB.globalAlpha = 0.5; gB.drawImage(A, vx * f, vy * f); gB.globalAlpha = 1; [A, B] = [B, A]; }
    c.drawImage(A, 0, 0);
  } else {
    const b = buf(), g = b.getContext('2d'), N = Math.min(cam.z < 0.5 ? 6 : 8, Math.ceil(dpx / 10)), sh = Math.min(0.6, 4 * (N - 1) / dpx);
    for (let i = 0; i < N; i++) { const ti = t - (sh / 30) * i / (N - 1); g.setTransform(1, 0, 0, 1, 0, 0); const r = drawBoard(g, ti, WB.camAt(ti)); if (!i) res = r; c.save(); c.globalAlpha = 1 / (i + 1); c.drawImage(b, 0, 0); c.restore(); }
  }
  let fxTip = null;
  for (const f of WB.FX) if (t >= f.t0 && t < f.t1) { c.save(); const r = f.draw(c, t, cam); c.restore(); if (r) fxTip = r; }
  const pen = fxTip ? fxTip.slice(0, 2) : penAt(t, cam, res.tip); if (fxTip) res.col = fxTip[2] || INK;
  if (pen) {
    const t1 = t - 1 / 30, c1 = WB.camAt(t1), tp = tipAt(t1), p0 = penAt(t1, c1, tp) || pen, vx = pen[0] - p0[0], vy = pen[1] - p0[1];
    const tilt = U.clamp(vx * 0.004 - vy * 0.002, -0.22, 0.22) + Math.sin(t * 7) * 0.03, lift = res.tip ? 0 : Math.min(14, Math.hypot(vx, vy) * 0.25);
    const ha = fxTip ? 1 : U.clamp((cam.z - 0.36) / 0.16);   // 全景拉远时手淡出，笔画自己长出来
    if (WB.HANDI) { if (ha > 0) { c.save(); c.globalAlpha = ha; WB.drawHand(c, pen[0] + lift * 0.5, pen[1] - lift, res.col || INK, tilt, fxTip ? 1 : poseAt(t), U.clamp(0.45 + 0.6 * cam.z, 0.62, 1)); c.restore(); } } else DG.pen(c, pen[0] + lift * 0.5, pen[1] - lift, res.col || INK, tilt);
  }
};
// 握笔手：AI 生成的线稿手三种姿势（1 写字／短笔画，2 拉长横线，3 抬笔悬空），1024 坐标里的笔尖 tip 对准落笔点；
// 袖子从出画的上下沿 U、L 沿方向 d 用代码延伸出去，手永远不会在画面里「断」掉。写橙色时把笔尖涂成橙色。投影＝同图黑色剪影，往右下错开、很淡。
// 数据由 assets/make_hand.py 量出。
const HANDS = { 1: { tip: [182, 143], U: [1023, 799], L: [747, 1023], d: [0.748, 0.664] }, 2: { tip: [108, 254], U: [1023, 657], L: [959, 1023], d: [0.904, 0.427] }, 3: { tip: [240, 91], U: [1023, 821], L: [757, 1023], d: [0.733, 0.68] } };
const HS = 0.6;
const handSh = n => { const k = '_hsh' + n; if (WB[k]) return WB[k]; const im = WB.HANDI[n], b = document.createElement('canvas'); b.width = im.width; b.height = im.height; const g = b.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, 0, b.width, b.height); return (WB[k] = b); };
WB.drawHand = (c, x, y, col, tilt, pose = 1, f = 1) => {
  const H = HANDS[pose], im = WB.HANDI[pose], { tip, U, L, d } = H, far = 3000;
  c.save(); c.translate(x, y); c.rotate(tilt * 0.8); c.scale(HS * f, HS * f); c.translate(-tip[0], -tip[1]);
  const sleeve = (dx, dy, fill, line) => { c.beginPath(); c.moveTo(U[0] - 2 + dx, U[1] + dy); c.lineTo(U[0] + d[0] * far + dx, U[1] + d[1] * far + dy); c.lineTo(L[0] + d[0] * far + dx, L[1] + d[1] * far + dy); c.lineTo(L[0] + dx, L[1] - 2 + dy); c.lineTo(1023 + dx, 1023 + dy); c.lineTo(1023 + dx, U[1] + dy); c.closePath(); c.fillStyle = fill; c.fill();
    if (line) { c.strokeStyle = '#111'; c.lineWidth = 6; c.beginPath(); c.moveTo(U[0] - 1, U[1] - 1); c.lineTo(U[0] + d[0] * far, U[1] + d[1] * far); c.moveTo(L[0] - 1, L[1]); c.lineTo(L[0] + d[0] * far, L[1] + d[1] * far); c.stroke(); } };
  sleeve(26, 30, 'rgba(0,0,0,0.13)', false); c.drawImage(handSh(pose), 26, 30, 1024, 1024);
  sleeve(0, 0, '#fdfdfd', true); c.drawImage(im, 0, 0, 1024, 1024);
  if (col !== INK) { const a = Math.atan2(H.d[1], H.d[0]); c.translate(tip[0], tip[1]); c.rotate(pose === 3 ? 0.95 : pose === 2 ? 0.28 : 0.62); c.fillStyle = col; c.beginPath(); c.moveTo(-3, 0); c.lineTo(36, -11); c.lineTo(36, 11); c.closePath(); c.fill(); }
  c.restore();
};
// 这一刻用哪种姿势：正在画长横线→2；正在画别的→1；两笔之间空档超过 0.25s→3（抬笔），短空档沿用上一笔的姿势
const strokePose = s => { if (s._pose) return s._pose; let p = 1; if (s.kind === 'line' && s.len > 220) { const a = s.pts[0], b = s.pts[s.pts.length - 1]; if (Math.abs(b[0] - a[0]) > 2.2 * Math.abs(b[1] - a[1])) p = 2; } return (s._pose = p); };
function poseAt(t) {
  let prev = null, next = null;
  for (const s of WB.HS) { if (s.t0 <= t && t < s.t1 && (s.until == null || t < s.until)) return strokePose(s); if (s.t1 <= t) { if (!prev || s.t1 > prev.t1) prev = s; } else if (s.t0 > t && !next) next = s; }
  if (prev && next && next.t0 - prev.t1 < 0.25) return strokePose(prev);
  return 3;
}
WB.scene = { init(IMG) { const I = n => IMG && IMG[`spacex_wb/assets/hand_${n}.png`]; WB.HANDI = I(1) ? { 1: I(1), 2: I(2), 3: I(3) } : null; WB.build(); }, draw(c, lt, t) { WB.draw(c, t); } };

// =====================================================================================
// 画稿库：全部返回局部笔画 [{p, o, w, dash, smooth, fillPts}]，原点见各函数说明
// =====================================================================================
const A = (cx, cy, rx, ry, a0, a1, n = 20) => DG.arcPts(cx, cy, rx, ry, a0, a1, n);
const ogive = (w, h, y0, n = 12) => { const L = [], R = []; for (let i = 0; i <= n; i++) { const u = i / n, hw = w / 2 * Math.sqrt(1 - u * u) * (1 - 0.12 * u); L.push([-hw, y0 - h * u]); R.push([hw, y0 - h * u]); } return L.concat(R.reverse()); };
const D = WB.D = {};
// 猎鹰1号：底部中心 (0,0)，高 h（不含喷管）
// 尖头锥：底宽 w、高 h、底边 y0；从左下沿左边上到尖、再沿右边下来（尖头，不是圆头）
const cone = (w, h, y0, n = 12) => { const L = [], R = []; for (let i = 0; i <= n; i++) { const u = i / n, hw = w / 2 * (1 - Math.pow(u, 1.7)); L.push([-hw, y0 - h * u]); R.push([hw, y0 - h * u]); } return L.concat(R.reverse().slice(1)); };
const shiftUp = (out, dy) => out.map(k => k.fillPts ? { ...k, fillPts: k.fillPts.map(([x, y]) => [x, y - dy]) } : { ...k, p: k.p.map(([x, y]) => [x, y - dy]) });
// 发动机喷口：平底梯形，整支火箭往上挪，让喷口底边落在 y=0（站在地平线上）
const nozzle = (d, y, k = 0.42, hh = 0.42) => ({ p: [[-d * 0.26, y], [-d * k, y + d * hh], [d * k, y + d * hh], [d * 0.26, y]], w: 0.85, smooth: false });
// 猎鹰1号：喷口底中心 (0,0)，箭体高 h
D.falcon1 = (h) => { const m = h / 22.7, d = 1.7 * m * 2.3, yb = -19.5 * m, yi = -16 * m;
  const out = [{ p: [...WB.dense([[d / 2, 0], [-d / 2, 0], [-d / 2, yb]], 8), ...cone(d, 3.6 * m * 1.15, yb).slice(1, -1), ...WB.dense([[d / 2, yb], [d / 2, 0]], 8)] },
    { p: [[-d / 2, yi], [d / 2, yi]], w: 0.8, smooth: false }, { p: [[-d / 2, yi - 0.9 * m], [d / 2, yi - 0.9 * m]], w: 0.6, smooth: false },
    { p: [[-d / 2, -2.4 * m], [d / 2, -2.4 * m]], w: 0.7, smooth: false }, nozzle(d, 0)];
  for (let k = 0; k < 3; k++) out.push({ p: [[-d / 2 + d * (0.1 + k * 0.3), yi], [-d / 2 + d * (0.3 + k * 0.3), yi - 0.9 * m]], w: 0.45, smooth: false });
  return shiftUp(out, d * 0.42); };
// 猎鹰9号：o.stage 'full'|'booster'；o.legs 0..1；o.fins；o.payload 'fairing'|'dragon'；喷口底中心 (0,0)，总高 h
D.falcon9 = (h, o = {}) => {
  const booster = o.stage === 'booster', m = h / (booster ? 41 : o.payload === 'dragon' ? 61 : 67), d = 3.7 * m * 1.7, H1 = 41 * m, out = [];
  if (booster) out.push({ p: WB.dense([[-d / 2, 0], [-d / 2, -H1], [d / 2, -H1], [d / 2, 0], [-d / 2, 0]], 8) });
  else if (o.payload === 'dragon') { const top = -54 * m; out.push({ p: WB.dense([[-d / 2, 0], [-d / 2, top], [d / 2, top], [d / 2, 0], [-d / 2, 0]], 8) });
    const cw = d * 1.04; out.push({ p: [[-cw / 2, top], [-cw * 0.33, top - 3.6 * m * 1.4], ...A(0, top - 3.6 * m * 1.4, cw * 0.33, cw * 0.18, Math.PI, Math.PI * 2, 10), [cw * 0.33, top - 3.6 * m * 1.4], [cw / 2, top]] }); }
  else { const tf = -56 * m;   // 整流罩与箭体同宽，尖头
    out.push({ p: [...WB.dense([[d / 2, 0], [-d / 2, 0], [-d / 2, tf]], 10), ...cone(d, 11 * m, tf).slice(1, -1), ...WB.dense([[d / 2, tf], [d / 2, 0]], 10)] });
    out.push({ p: [[-d / 2, tf + 0.2 * m], [d / 2, tf + 0.2 * m]], w: 0.6, smooth: false }); }
  out.push({ p: [[-d / 2, -H1 + 4.2 * m], [d / 2, -H1 + 4.2 * m]], w: 0.75, smooth: false });            // 级间段
  out.push({ fillPts: [[-d / 2, -H1 + 4.2 * m], [d / 2, -H1 + 4.2 * m], [d / 2, -H1], [-d / 2, -H1]], fillCol: 'rgba(10,5,3,.82)' });   // 猎鹰9号标志性的黑色级间段（和猎鹰1号一眼区分）
  if (o.fins) for (const s of [-1, 1]) out.push({ p: WB.dense([[s * d / 2, -H1 + 0.6 * m], [s * (d / 2 + 1.3 * m * o.fins), -H1 + 0.6 * m], [s * (d / 2 + 1.3 * m * o.fins), -H1 + 2.2 * m], [s * d / 2, -H1 + 2.2 * m]], 3), w: 0.65, smooth: false });
  const lg = o.legs ?? 0, L = 9 * m, ang = lg * 1.95;
  if (lg > 0.02) for (const s of [-1, 1]) { const x0 = s * d / 2, y0 = -0.8 * m, x1 = x0 + s * Math.sin(ang) * L, y1 = y0 - Math.cos(ang) * L;
    out.push({ p: [[x0, y0 - 3 * m], [x1, y1]], w: 0.85, smooth: false }); if (lg > 0.5) out.push({ p: [[x1 - s * 0.6 * m, y1], [x1 + s * 0.9 * m, y1]], w: 0.85, smooth: false }); }
  out.push(nozzle(d, 0, 0.36, 0.3));
  return shiftUp(out, d * 0.3);
};
// 重型猎鹰：三芯并联（中芯带整流罩，两侧助推器尖头锥）；喷口底中心 (0,0)，高 h
D.heavy = (h) => { const m = h / 67, d = 3.7 * m * 1.7, gap = d * 0.12, out = D.falcon9(h, {});
  const side = []; for (const s of [-1, 1]) { const dx = s * (d + gap), H1 = 41 * m;
    side.push({ p: [...WB.dense([[dx + d / 2, 0], [dx - d / 2, 0], [dx - d / 2, -H1]], 8), ...cone(d, 7 * m, -H1).slice(1, -1).map(([x, y]) => [x + dx, y]), ...WB.dense([[dx + d / 2, -H1], [dx + d / 2, 0]], 8)] });
    side.push({ p: [[dx - d / 2, -H1 + 4.2 * m], [dx + d / 2, -H1 + 4.2 * m]], w: 0.75, smooth: false });
    side.push({ p: [[dx - d * 0.26, 0], [dx - d * 0.36, d * 0.3], [dx + d * 0.36, d * 0.3], [dx + d * 0.26, 0]], w: 0.85, smooth: false }); }
  return out.concat(shiftUp(side, d * 0.3)); };
// 龙飞船舱体（载人龙外形）：底部中心 (0,0)，底宽 w；o.crew 舷窗里两个不透明面罩的头盔；o.trunk 尾段
D.dragon = (w, o = {}) => { const out = [], y0 = o.trunk ? -w * 0.62 : 0, top = y0 - w * 0.9;
  if (o.trunk) out.push({ p: WB.dense([[-w * 0.47, y0], [-w * 0.47, 0], [w * 0.47, 0], [w * 0.47, y0]], 6) });
  out.push({ p: [[-w / 2, y0], [-w * 0.32, top], ...A(0, top, w * 0.32, w * 0.2, Math.PI, Math.PI * 2, 12), [w * 0.32, top], [w / 2, y0], [-w / 2, y0]] });
  out.push({ p: WB.circ(w * 0.14, y0 - w * 0.6, w * 0.075, 1.05), w: 0.75 });
  out.push({ p: WB.dense([[-w * 0.3, y0 - w * 0.12], [-w * 0.24, y0 - w * 0.62], [-w * 0.05, y0 - w * 0.62], [-w * 0.08, y0 - w * 0.12]], 4), w: 0.6, smooth: false });
  out.push({ p: [[-w * 0.5, y0 - w * 0.06], [w * 0.5, y0 - w * 0.06]], w: 0.6, smooth: false });
  return out; };
// 星舰：part 'full'|'ship'|'booster'；底部中心 (0,0)，高 h（全箭按 123m 比例）；o.flap 襟翼摆角
D.starship = (h, part = 'full', o = {}) => {
  const tot = part === 'full' ? 123 : part === 'ship' ? 52 : 71, m = h / tot, d = 9 * m * 1.35, out = [];
  const boost = (y) => { const H = 71 * m;
    out.push({ p: WB.dense([[-d / 2, y], [-d / 2, y - H], [d / 2, y - H], [d / 2, y], [-d / 2, y]], 10) });
    out.push({ p: [[-d / 2, y - H + 2.2 * m], [d / 2, y - H + 2.2 * m]], w: 0.7 });
    for (const s of [-1, 1]) out.push({ p: WB.dense([[s * d / 2, y - H + 4 * m], [s * (d / 2 + 2.6 * m), y - H + 4 * m], [s * (d / 2 + 2.6 * m), y - H + 7 * m], [s * d / 2, y - H + 7 * m]], 3), w: 0.7, smooth: false });
    out.push({ p: [[-d * 0.32, y], [-d * 0.4, y + d * 0.18], [d * 0.4, y + d * 0.18], [d * 0.32, y]], w: 0.8, smooth: false }); };
  const shp = (y) => { const Hc = 36 * m, Hn = 16 * m;
    out.push({ p: [[-d / 2, y], [-d / 2, y - Hc], ...ogive(d, Hn, y - Hc), [d / 2, y - Hc], [d / 2, y], [-d / 2, y]] });
    for (const k of [0.3, 0.6]) out.push({ p: [[-d / 2, y - Hc * k], [d / 2, y - Hc * k]], w: 0.45, smooth: false });   // 不锈钢分段线
    for (let k = 0; k < 4; k++) out.push({ p: [[-d / 2, y - Hc * (0.12 + k * 0.22)], [-d * 0.18, y - Hc * (0.2 + k * 0.22)]], w: 0.45, smooth: false });   // 迎风面隔热瓦
    const f = o.flap || 0;
    for (const s of [-1, 1]) { out.push({ p: [[s * d / 2, y - 2 * m], [s * (d / 2 + 3.4 * m), y - 1 * m + f * 2 * m], [s * (d / 2 + 3.4 * m), y - 10 * m + f * 2 * m], [s * d / 2, y - 11 * m]], w: 0.8, smooth: false });
      out.push({ p: [[s * d * 0.42, y - Hc - 5 * m], [s * (d * 0.42 + 2.4 * m), y - Hc - 4 * m], [s * (d * 0.36 + 2.0 * m), y - Hc - 10 * m], [s * d * 0.34, y - Hc - 11 * m]], w: 0.75, smooth: false }); }
    if (part === 'ship') out.push({ p: [[-d * 0.3, y], [-d * 0.36, y + d * 0.16], [d * 0.36, y + d * 0.16], [d * 0.3, y]], w: 0.8, smooth: false }); };
  if (part === 'booster') boost(0); else if (part === 'ship') shp(0); else { boost(0); shp(-71 * m); }
  return out;
};
// 发射塔（格构）：底部中心 (0,0)，高 h、宽 w；不含机械臂
D.tower = (h, w = 90) => { const out = [{ p: [[-w / 2, 0], [-w / 2, -h]], smooth: false }, { p: [[w / 2, 0], [w / 2, -h]], smooth: false }];
  const n = Math.round(h / w), zz = []; for (let i = 0; i <= n; i++) zz.push([i % 2 ? w / 2 : -w / 2, -h * i / n]); out.push({ p: zz, w: 0.6, smooth: false });
  out.push({ p: [[-w * 0.7, -h], [w * 0.7, -h]], smooth: false }, { p: [[-w * 1.2, 0], [w * 1.2, 0]], smooth: false }); return out; };
// 国际空间站：中心 (0,0)，总宽 s
D.iss = (s) => { const out = [], tw = s, th = s * 0.03;
  out.push({ p: WB.dense([[-tw / 2, -th / 2], [tw / 2, -th / 2], [tw / 2, th / 2], [-tw / 2, th / 2], [-tw / 2, -th / 2]], 8), w: 0.8 });
  for (const x of [-0.42, -0.3, 0.3, 0.42]) for (const sy of [-1, 1]) { const px = x * tw, pw = s * 0.09, ph = s * 0.28, py = sy < 0 ? -th / 2 - ph : th / 2;
    out.push({ p: WB.dense([[px - pw / 2, py], [px + pw / 2, py], [px + pw / 2, py + ph], [px - pw / 2, py + ph], [px - pw / 2, py]], 4), w: 0.7 });
    out.push({ p: [[px, py], [px, py + ph]], w: 0.4, smooth: false }); out.push({ p: [[px - pw / 2, py + ph / 2], [px + pw / 2, py + ph / 2]], w: 0.4, smooth: false }); }
  out.push({ p: WB.dense([[-s * 0.05, th / 2], [-s * 0.05, s * 0.2], [s * 0.05, s * 0.2], [s * 0.05, th / 2]], 6), w: 0.85 });   // 竖着的舱段
  out.push({ p: WB.dense([[-s * 0.13, s * 0.06], [s * 0.13, s * 0.06], [s * 0.13, s * 0.12], [-s * 0.13, s * 0.12], [-s * 0.13, s * 0.06]], 4), w: 0.8 });   // 横舱
  out.push({ p: WB.dense([[-s * 0.03, s * 0.2], [-s * 0.03, s * 0.24], [s * 0.03, s * 0.24], [s * 0.03, s * 0.2]], 2), w: 0.75 });   // 对接口（下）
  return out; };
WB.issPort = (x, y, s) => [x, y + s * 0.24];
D.earth = (r) => [{ p: WB.circ(0, 0, r, 1.05) },
  { p: [[-r * 0.62, -r * 0.42], [-r * 0.36, -r * 0.6], [-r * 0.02, -r * 0.5], [r * 0.08, -r * 0.62], [r * 0.32, -r * 0.42], [r * 0.12, -r * 0.18], [r * 0.2, r * 0.06], [-r * 0.12, r * 0.1], [-r * 0.24, -r * 0.1], [-r * 0.5, -r * 0.08], [-r * 0.62, -r * 0.42]], w: 0.75 },
  { p: [[-r * 0.02, r * 0.36], [r * 0.32, r * 0.24], [r * 0.6, r * 0.34], [r * 0.66, r * 0.56], [r * 0.36, r * 0.7], [r * 0.18, r * 0.58], [-r * 0.02, r * 0.36]], w: 0.75 }];
D.moon = (r) => [{ p: WB.circ(0, 0, r, 1.05) }, { p: WB.circ(-r * 0.3, -r * 0.25, r * 0.2, 1.05), w: 0.7 }, { p: WB.circ(r * 0.35, r * 0.1, r * 0.14, 1.05), w: 0.7 }, { p: WB.circ(-r * 0.1, r * 0.45, r * 0.1, 1.05), w: 0.7 }];
D.house = (s) => [{ p: [[-s * 0.5, 0], [-s * 0.5, -s * 0.9], [s * 0.5, -s * 0.9], [s * 0.5, 0]], smooth: false }, { p: [[-s * 0.7, -s * 0.82], [0, -s * 1.5], [s * 0.7, -s * 0.82]], smooth: false }, { p: [[-s * 0.15, 0], [-s * 0.15, -s * 0.5], [s * 0.15, -s * 0.5], [s * 0.15, 0]], w: 0.85, smooth: false }];
D.sat = (s) => [{ p: WB.dense([[-s * 0.16, -s * 0.12], [s * 0.16, -s * 0.12], [s * 0.16, s * 0.12], [-s * 0.16, s * 0.12], [-s * 0.16, -s * 0.12]], 3), smooth: false },
  { p: WB.dense([[-s * 0.2, -s * 0.08], [-s * 0.62, -s * 0.08], [-s * 0.62, s * 0.08], [-s * 0.2, s * 0.08]], 3), w: 0.8, smooth: false }, { p: WB.dense([[s * 0.2, -s * 0.08], [s * 0.62, -s * 0.08], [s * 0.62, s * 0.08], [s * 0.2, s * 0.08]], 3), w: 0.8, smooth: false },
  { p: [[-s * 0.41, -s * 0.08], [-s * 0.41, s * 0.08]], w: 0.5, smooth: false }, { p: [[s * 0.41, -s * 0.08], [s * 0.41, s * 0.08]], w: 0.5, smooth: false }];
// 火柴人：脚底中心 (0,0)，高 h；pose: stand / cheer / head（抱头）/ point / wave
WB.figPose = (h, pose = 'stand') => { const k = h / 300, hy = -250 * k, r = 32 * k, nk = -218 * k, hip = -110 * k, sh = -190 * k;
  const arms = { stand: [[-55, -120], [55, -120]], cheer: [[-70, -290], [70, -290]], head: [[-40, -262], [40, -262]], point: [[-50, -125], [95, -215]], wave: [[-55, -120], [80, -280]], shrug: [[-80, -215], [80, -215]] }[pose] || [[-55, -120], [55, -120]];
  const elb = { stand: [[-40, -160], [40, -160]], cheer: [[-58, -240], [58, -240]], head: [[-62, -215], [62, -215]], point: [[-40, -160], [50, -200]], wave: [[-40, -160], [62, -225]], shrug: [[-50, -175], [50, -175]] }[pose] || [[-40, -160], [40, -160]];
  return { head: [0, hy, r], lines: [[[0, nk], [0, hip]], [[-60 * k, 0], [0, hip], [60 * k, 0]], [[elb[0][0] * k, elb[0][1] * k], [0, sh], [elb[1][0] * k, elb[1][1] * k]],
    [[arms[0][0] * k, arms[0][1] * k], [elb[0][0] * k, elb[0][1] * k]], [[elb[1][0] * k, elb[1][1] * k], [arms[1][0] * k, arms[1][1] * k]]] };
};
D.fig = (h, pose = 'stand', o = {}) => { const P = WB.figPose(h, pose), out = [{ p: WB.circ(P.head[0], P.head[1], P.head[2], 1.06) }];
  if (o.helmet) out.push({ fillPts: A(P.head[0] + P.head[2] * 0.15, P.head[1], P.head[2] * 0.62, P.head[2] * 0.5, 0, Math.PI * 2, 16), fillCol: INK });
  P.lines.forEach(l => out.push({ p: l, amp: 0.9 })); return out; };
// 画一个会换姿势的火柴人（pose-to-pose，0.18s 回弹），keys = [[t, pose], ...]
WB.drawFig = (g, x, y, h, keys, t, o = {}) => {
  let i = 0; while (i < keys.length - 1 && t >= keys[i + 1][0]) i++;
  const cur = WB.figPose(h, keys[i][1]), prv = i > 0 ? WB.figPose(h, keys[i - 1][1]) : cur, u = i > 0 ? MO.backOut(clamp((t - keys[i][0]) / 0.2), 1.6) : 1;
  const mix = (a, b) => a.map((p, j) => [lerp(b[j][0], p[0], u), lerp(b[j][1], p[1], u)]);
  const bob = Math.sin(t * 5 + x * 0.01) * h * 0.006;
  g.save(); g.translate(x, y + bob); g.strokeStyle = INK; g.lineWidth = o.w || LW; g.lineCap = g.lineJoin = 'round';
  g.beginPath(); g.arc(cur.head[0], cur.head[1], cur.head[2], 0, Math.PI * 2); g.stroke();
  if (o.helmet) { g.fillStyle = INK; g.beginPath(); g.ellipse(cur.head[0] + cur.head[2] * 0.15, cur.head[1], cur.head[2] * 0.62, cur.head[2] * 0.5, 0, 0, 7); g.fill(); }
  cur.lines.forEach((l, j) => { const m = mix(l, prv.lines[j]); g.beginPath(); m.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); });
  g.restore();
};
// 会换姿势的火柴人：先用笔画出 keys[0] 的姿势，画完交给 WB.drawFig 按 keys（全片秒）换姿势
WB.figure = (x, y, h, keys, o = {}) => {
  const st = WB.sk(D.fig(h, keys[0][1], { helmet: o.helmet }), x, y, { speed: o.speed || 3200, w: o.w });
  const tA = WB.cur; st.forEach(s => (s.until = tA));
  WB.custom({ t0: tA, t1: tA + 0.01, bb: [x - h * 0.5, y - h * 1.05, x + h * 0.5, y + h * 0.05], draw(g, qq, t) { WB.drawFig(g, x, y, h, keys, t, { helmet: o.helmet, w: o.w || WB.LW }); return null; } });
  return st;
};
// 爆炸：参差的星形（局部中心 (0,0)，半径 r）＋ 内圈
D.burst = (r, seed = 3) => { const rr = U.rng(seed), o = [], n = 11; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 - Math.PI / 2, R = (i % 2 ? 0.45 : 0.85 + rr() * 0.3) * r; o.push([Math.cos(a) * R, Math.sin(a) * R]); }
  const i2 = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2, R = (i % 2 ? 0.2 : 0.42) * r; i2.push([Math.cos(a) * R, Math.sin(a) * R]); }
  return [{ p: o, smooth: false, w: 0.9 }, { p: i2, smooth: false, o: 1, w: 0.8 }]; };
D.cross = (s) => [{ p: [[-s / 2, -s / 2], [s / 2, s / 2]], o: 1, w: 1.4, smooth: false }, { p: [[s / 2, -s / 2], [-s / 2, s / 2]], o: 1, w: 1.4, smooth: false }];
D.check = (s) => [{ p: [[-s * 0.45, 0], [-s * 0.12, s * 0.32], [s * 0.5, -s * 0.42]], o: 1, w: 1.6, smooth: false }];
D.bag = (s) => [{ p: [[-s * 0.16, -s * 0.42], [-s * 0.42, -s * 0.06], [-s * 0.44, s * 0.3], [-s * 0.3, s * 0.44], [s * 0.3, s * 0.44], [s * 0.44, s * 0.3], [s * 0.42, -s * 0.06], [s * 0.16, -s * 0.42]] },
  { p: [[-s * 0.2, -s * 0.42], [-s * 0.28, -s * 0.56], [0, -s * 0.48], [s * 0.28, -s * 0.56], [s * 0.2, -s * 0.42], [-s * 0.2, -s * 0.42]], w: 0.85 }];
D.doc = (s) => { const w = s * 0.72, h = s; return [{ p: [[w * 0.2, -h / 2], [-w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h * 0.3], [w * 0.2, -h / 2], [w * 0.2, -h * 0.3], [w / 2, -h * 0.3]] },
  { p: [[-w * 0.34, -h * 0.08], [w * 0.34, -h * 0.08]], w: 0.6 }, { p: [[-w * 0.34, h * 0.06], [w * 0.34, h * 0.06]], w: 0.6 }, { p: [[-w * 0.34, h * 0.2], [w * 0.1, h * 0.2]], w: 0.6 },
  { p: [[-w * 0.3, h * 0.38], [-w * 0.18, h * 0.3], [-w * 0.1, h * 0.4], [0, h * 0.28], [w * 0.06, h * 0.38], [w * 0.3, h * 0.33]], o: 1, w: 0.8 }]; };
D.box = (s) => [{ p: WB.dense([[-s / 2, -s * 0.3], [s * 0.3, -s * 0.3], [s * 0.3, s * 0.5], [-s / 2, s * 0.5], [-s / 2, -s * 0.3]], 4), smooth: false },
  { p: [[-s / 2, -s * 0.3], [-s * 0.3, -s * 0.5], [s * 0.5, -s * 0.5], [s * 0.3, -s * 0.3]], smooth: false }, { p: [[s * 0.5, -s * 0.5], [s * 0.5, s * 0.3], [s * 0.3, s * 0.5]], smooth: false },
  { p: [[-s * 0.1, -s * 0.3], [-s * 0.1, s * 0.5]], w: 0.5, o: 1, smooth: false }];
D.clock = (r) => [{ p: WB.circ(0, 0, r, 1.05) }, { p: [[0, -r * 0.62], [0, 0], [r * 0.45, r * 0.2]], w: 0.9, smooth: false }];
D.trophy = (s) => [{ p: [[-s * 0.32, -s * 0.5], [-s * 0.3, -s * 0.15], [-s * 0.12, s * 0.05], [-s * 0.06, s * 0.2], [-s * 0.2, s * 0.32], [s * 0.2, s * 0.32], [s * 0.06, s * 0.2], [s * 0.12, s * 0.05], [s * 0.3, -s * 0.15], [s * 0.32, -s * 0.5], [-s * 0.32, -s * 0.5]] },
  { p: A(-s * 0.32, -s * 0.3, s * 0.14, s * 0.16, -Math.PI / 2, -Math.PI * 1.5, 10), w: 0.8 }, { p: A(s * 0.32, -s * 0.3, s * 0.14, s * 0.16, -Math.PI / 2, Math.PI / 2, 10), w: 0.8 },
  { p: WB.dense([[-s * 0.3, s * 0.32], [s * 0.3, s * 0.32], [s * 0.3, s * 0.46], [-s * 0.3, s * 0.46], [-s * 0.3, s * 0.32]], 3), w: 0.9, smooth: false }];
D.car = (s) => [{ p: [[-s * 0.5, 0], [-s * 0.5, -s * 0.16], [-s * 0.2, -s * 0.2], [-s * 0.06, -s * 0.34], [s * 0.18, -s * 0.34], [s * 0.3, -s * 0.2], [s * 0.5, -s * 0.16], [s * 0.52, 0], [-s * 0.5, 0]] },
  { p: WB.circ(-s * 0.3, 0, s * 0.11, 1.05), w: 0.9 }, { p: WB.circ(s * 0.3, 0, s * 0.11, 1.05), w: 0.9 }];
D.drop = (s) => [{ p: [[0, -s * 0.5], ...A(0, s * 0.12, s * 0.28, s * 0.28, Math.PI * 1.1, -Math.PI * 0.1, 18), [0, -s * 0.5]], o: 1 }];
D.bell = (s) => [{ p: [[-s * 0.42, s * 0.3], [-s * 0.34, s * 0.2], [-s * 0.3, -s * 0.12], ...A(0, -s * 0.12, s * 0.3, s * 0.3, Math.PI, Math.PI * 2, 16).slice(1), [s * 0.34, s * 0.2], [s * 0.42, s * 0.3], [-s * 0.42, s * 0.3]] },
  { p: WB.circ(0, s * 0.38, s * 0.07, 1.05), w: 0.9 }, { p: [[0, -s * 0.42], [0, -s * 0.52]], w: 1.2, smooth: false }, { p: WB.circ(0, -s * 0.56, s * 0.05, 1.05), w: 0.8 },
  { p: [[-s * 0.55, -s * 0.2], [-s * 0.68, -s * 0.28]], o: 1, smooth: false }, { p: [[-s * 0.56, s * 0.02], [-s * 0.72, s * 0.02]], o: 1, smooth: false }, { p: [[s * 0.55, -s * 0.2], [s * 0.68, -s * 0.28]], o: 1, smooth: false }, { p: [[s * 0.56, s * 0.02], [s * 0.72, s * 0.02]], o: 1, smooth: false }];
// 一个简笔大脑（AI 的符号）：中心 (0,0)，宽 s
D.brain = (s) => [{ p: [[0, s * 0.3], ...A(-s * 0.22, 0, s * 0.27, s * 0.3, Math.PI / 2, Math.PI * 1.5, 14), ...A(0, -s * 0.28, s * 0.22, s * 0.12, Math.PI, Math.PI * 2, 10), ...A(s * 0.22, 0, s * 0.27, s * 0.3, -Math.PI / 2, Math.PI / 2, 14), [0, s * 0.3]] },
  { p: [[0, -s * 0.3], [0, s * 0.3]], w: 0.7 }, { p: [[-s * 0.36, -s * 0.05], [-s * 0.22, -s * 0.12], [-s * 0.1, 0]], w: 0.6 }, { p: [[s * 0.36, s * 0.06], [s * 0.22, -s * 0.06], [s * 0.1, s * 0.08]], w: 0.6 }];
// 补丁：中心 (0,0)，边长 s，带十字缝线
D.patch = (s, r = 0.2) => { const c = Math.cos(r), n = Math.sin(r), R = ([x, y]) => [x * c - y * n, x * n + y * c];
  return [{ p: WB.dense([[-s / 2, -s / 2.4], [s / 2, -s / 2.4], [s / 2, s / 2.4], [-s / 2, s / 2.4], [-s / 2, -s / 2.4]], 3).map(R), w: 0.75, smooth: false },
    ...[-0.25, 0, 0.25].map(f => ({ p: [[f * s - 5, -s / 2.4 - 6], [f * s + 5, -s / 2.4 + 6]].map(R), w: 0.5, smooth: false }))]; };
D.chopsticks = (L) => [{ p: [[-L * 0.5, -L * 0.1], [L * 0.5, L * 0.02]], w: 1.4, smooth: false }, { p: [[-L * 0.5, L * 0.1], [L * 0.5, L * 0.06]], w: 1.4, smooth: false }];
})();
