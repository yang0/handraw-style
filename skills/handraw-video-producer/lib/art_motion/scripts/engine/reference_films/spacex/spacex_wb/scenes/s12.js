// S12 · 接下来（D 行末段，x 10410–12610）＋全片收尾。还没发生的事一律画成虚线（白板上「计划」的写法）：
// 「接下来」→ 虚线发射塔用两只橙臂夹住一艘虚线飞船 → 两艘飞船尾对尾、中间一滴橙色燃料「加油」→ 虚线弧飞向月球，月面上一艘小船和一个戴头盔的小人；
// 相机右移「再往后」→ 火星：橙色排线＋插着 S02 那座小房子，「火星」弹出。
// 最后相机一口气拉到最远，整块白板 24 年的笔记一次看全；一支小火箭沿一条长长的橙色虚线，从 S02 那颗「别的星球」一路飞到火星。
WB.chapter('s12', id => {
  const q = k => WB.q(id, k), { OR, INK } = WB, D = WB.D, Y = v => WB.ROW.D + v;
  const t0 = WB.T0(id), G = Y(880), DASH = [18, 14];
  const dashed = (arr, d = DASH) => arr.map(k => k.fillPts ? k : { ...k, dash: d });
  // ---- 接下来，它要用筷子夹住飞船 ----
  WB.lead([10040, Y(620)], [10410, Y(300)], q('接下来') - 0.12 - 0.62, 0.5);   // 引线和相机同时走：笔领着相机，落位那一刻正好开写
  WB.go(q('接下来') - 0.12); WB.text('接下来', 10430, Y(240), 104, { rate: 9 });
  WB.arrow([10770, Y(205)], [10940, Y(205)], { col: OR, head: 24, w: 6 });
  const TX = 10710, TH = 600;
  WB.go(q('筷子') - 0.25); WB.line([[10510, G], [11010, G]], { speed: 8300, w: 6 });
  WB.sk(D.tower(TH, 80), TX, G, { speed: 8300, w: 5.5 });
  const AY = G - TH + 160;
  WB.line([[TX + 40, AY - 12], [TX + 300, AY - 30]], { col: OR, w: 10, speed: 3600, smooth: false, dash: [24, 14] });
  WB.line([[TX + 40, AY + 12], [TX + 300, AY + 30]], { col: OR, w: 10, speed: 3600, smooth: false, dash: [24, 14] });
  const SH = 380, m = SH / 52;
  WB.go(q('飞船') - 0.1); WB.sk(dashed(D.starship(SH, 'ship', { flap: 0.2 })), TX + 190, AY + (52 - 30) * m, { speed: 6300, w: 5.5 });
  // ---- 在太空里加油 ----
  WB.go(q('在太空') - 0.05);
  const RY0 = Y(330), RS = 210;
  WB.sk(dashed(D.starship(RS, 'ship')), 11270, RY0, { rot: -Math.PI / 2, speed: 10710, w: 5 });
  WB.sk(dashed(D.starship(RS, 'ship')), 11380, RY0, { rot: Math.PI / 2, speed: 10710, w: 5 });
  WB.sk(D.drop(70), 11325, RY0, { speed: 4000 });
  WB.text('加油', 11325, RY0 + 130, 62, { align: 'center', rate: 12, col: OR });
  // ---- 争取把美国人重新送上月球 ----
  const MX = 11960, MY = Y(470), MR = 150;
  WB.go(q('美国人') - 0.05); WB.sk(D.moon(MR), MX, MY, { speed: 5300 });
  WB.line(WB.quad([11590, RY0 - 40], [11810, Y(160)], [MX - 40, MY - MR - 10], 26), { col: OR, w: 5, dash: [14, 12], speed: 5300, smooth: false });
  WB.go(q('送上') - 0.15);
  WB.sk(dashed(D.starship(110, 'ship')), MX + 20, MY - MR + 4, { speed: 7300, w: 4.5 });
  WB.sk(dashed(D.fig(64, 'wave', { helmet: true }), [5, 9]), MX - 50, MY - MR + 8, { speed: 5300, w: 4.5 });
  WB.go(q('月球') + 0.05); WB.text('月球', MX, MY + MR + 80, 66, { align: 'center', rate: 10 });
  // ---- 再往后，是火星：相机一边往后拉到全板，笔一边在板的最右端画一颗很大的火星（橙色排线＋S02 那座小房子，虚线＝还没发生）----
  const FX = MX + 780, FY = Y(500), FR = 400;
  const tOut0 = q('再往后') + 0.05, tOut1 = tOut0 + 1.75;
  WB.go(q('再往后') + 0.15); WB.line(WB.circ(FX, FY, FR, 1.04, Math.PI), { w: 12, speed: 6500 });
  WB.hatchCircle(FX, FY, FR, { gap: 40, ang: -Math.PI / 4, w: 8, speed: WB.SPEED * 9 });
  WB.sk(dashed(D.house(240), [30, 22]).map(k => ({ ...k, w: 1.8 })), FX, FY - FR + 14, { speed: 7000 });
  WB.go(q('火星') - 0.1); WB.pop('火星', FX + FR + 60, FY + 70, 230, { align: 'left', wdur: 0.32 });
  // ---- 收尾：一条橙色虚线从 S02 的「别的星球」一路飞到火星；然后全板定格 ----
  const A0 = [6840, 430], C0 = [14010, 700], B0 = [FX + 20, FY - FR - 260];
  const bz = u => [(1 - u) ** 2 * A0[0] + 2 * u * (1 - u) * C0[0] + u * u * B0[0], (1 - u) ** 2 * A0[1] + 2 * u * (1 - u) * C0[1] + u * u * B0[1]];
  const path = []; for (let i = 0; i <= 80; i++) path.push(bz(i / 80)); const pc = DG.cum(path), PL = pc[pc.length - 1];
  const RK1 = WB.prep([{ p: [[0, -38], [10, -28], [14, 4], [14, 22], [-14, 22], [-14, 4], [-10, -28], [0, -38]] }, { p: [[-14, 8], [-26, 26], [-14, 22]] }, { p: [[14, 8], [26, 26], [14, 22]] }], 5);
  const tF0 = tOut0 + 1.0, tF1 = tF0 + 1.25;
  WB.custom({ t0: tF0, t1: tF1, bb: null, draw(g, qq, t) {
    const e = MO.sineInOut(qq), d = PL * e;
    g.strokeStyle = OR; g.lineWidth = 26; g.setLineDash([70, 52]); DG.drawPartial(g, path, pc, Math.max(0, d - 60)); g.setLineDash([]);
    const [x, y] = DG.pointAt(path, pc, d), [x2, y2] = DG.pointAt(path, pc, Math.min(PL, d + 4)), a = Math.atan2(y2 - y, x2 - x) || 0.3;
    if (qq < 1) { g.translate(x, y); g.rotate(a + Math.PI / 2); g.scale(5, 5); g.fillStyle = OR; g.beginPath(); g.moveTo(-8, 26); g.lineTo(0, 46 + 6 * Math.sin(t * 40)); g.lineTo(8, 26); g.closePath(); g.fill(); WB.drawPrep(g, RK1, 0, 0, 1, 0); }
    else { g.strokeStyle = OR; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - Math.cos(a - 0.5) * 140, y - Math.sin(a - 0.5) * 140); g.lineTo(x, y); g.lineTo(x - Math.cos(a + 0.5) * 140, y - Math.sin(a + 0.5) * 140); g.stroke(); }
    return null; } });
  // ---- 相机 ----
  const T = t0 + TIMING.seg[id].dur;
  WB.shot(q('接下来') - 0.12 - 0.62, 0.6, t0, q('美国人'), { zmax: 1.15 });
  WB.shot(q('美国人') - 0.3, 0.8, q('加油') - 0.4, q('再往后'), { zmax: 1.15 });
  const [cx, cy, zF] = WB.fit(-10, T, { zmax: 0.3, pad: 90, sy: 520, add: [[A0[0], A0[1], 13660, B0[1]], [FX + FR, FY - 100, FX + FR + 560, FY + 120]] });
  WB.move(tOut0, tOut1, cx, cy, zF, { ease: MO.sineInOut });
  // 全板定格，最后一秒往火星轻推 6%（火星在画面上的位置不动）
  const ms = CAM.toScreen({ x: cx, y: cy, z: zF }, FX, FY), fin = CAM.anchor(FX, FY, zF * 1.06, ms[0], ms[1]);
  WB.move(Math.max(tOut1 + 0.05, T - 1.15), T, fin.x, fin.y, fin.z, { ease: MO.sineInOut, creep: 0 });
});
SCENES['s12'] = WB.scene;
