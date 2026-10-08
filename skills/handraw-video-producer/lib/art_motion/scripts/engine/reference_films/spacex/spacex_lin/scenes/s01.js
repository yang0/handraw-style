// S01 · 开头钩子（快切段，13 秒六个知识点）：第 0 帧就是「2008」＋第一张失败卡已盖红叉＋讲解员竖一根手指。
// ① 连败三次：三张猎鹰1号卡依次盖红叉、火箭歪倒冒烟，讲解员 1→2→3 比数字 ② 钱只够最后一发：小猪存钱罐抖出最后一枚金币，飞进第四张卡
// ③ 9月28号那一发成了：日历弹出，第四枚火箭点火升空，绿勾＋彩纸，讲解员跳起来 ④ 整整18年后的同一天：两张 9月28号日历并排、弧线箭头「18年后」、等号
// ⑤ 星舰第一次进入地球轨道：小地球＋轨道虚线，星舰入轨绕圈 ⑥ 两分钟看完这24年：标题卡＋秒表＋2002→2026 时间轴，时间轴缩进顶栏，成为全片的进度条。
(() => {
const ID = 's01', L = LIN, { C, W, H, TAU } = L, { clamp, lerp } = U;
let Q = null;
const q = () => Q || (Q = {
  y08: TM.cue(ID, '2008年'), hj: TM.cue(ID, '火箭'), lb: TM.cue(ID, '连败'), sc: TM.cue(ID, '三次'), qian: TM.cue(ID, '钱只够'), zh: TM.cue(ID, '最后一发'),
  d928: TM.cue(ID, '9月28号'), nyf: TM.cue(ID, '那一发'), cl: TM.cue(ID, '成了'), zz: TM.cue(ID, '整整'), n18: TM.cue(ID, '18年后'), tyt: TM.cue(ID, '同一天'),
  xj: TM.cue(ID, '星舰'), dyc: TM.cue(ID, '第一次'), gd: TM.cue(ID, '地球轨道'), lfz: TM.cue(ID, '两分钟'), kw: TM.cue(ID, '看完'), n24: TM.cue(ID, '24年'), end: TM.dur(ID),
});

// ---------- ① 三张失败卡 ----------
const CARD_X = [840, 1190, 1540], CARD_Y = 450;
function failCard(g, lt, i, xT) {                  // xT：盖红叉的时刻
  const k = lt - xT;
  L.card(g, -120, -165, 240, 330, { fill: C.white });
  // 火箭：盖叉那一刻歪倒，冒烟
  const fall = MO.backOut(clamp(k / 0.45), 1.4) * 0.62 * (i % 2 ? -1 : 1);
  g.save(); g.beginPath(); g.rect(-116, -161, 232, 260); g.clip();
  L.rocket(g, L.F1(), 0, 72, 8.4, { fins: true, rot: fall, sx: 3.6, pal: { nose: C.mute, body: '#F1EEE8' } });
  if (k > 0) for (let j = 0; j < 3; j++) { const ph = ((lt * 0.7 + j / 3) % 1); g.globalAlpha = 0.5 * (1 - ph); g.fillStyle = '#CFC8BC';
    g.beginPath(); g.arc(-10 + j * 14 + Math.sin(ph * 6 + j) * 10, 40 - ph * 150, 14 + ph * 22, 0, TAU); g.fill(); }
  g.restore();
  L.txt(g, ['2006年', '2007年', '2008年8月'][i], 0, 140, 36, { align: 'center', col: C.sub, w: 'Heavy' });
  L.stamp(g, 'x', 0, -20, k, { s: 1.25, rot: -0.1 + i * 0.08 });
}
function beat1(g, lt) {
  const Qv = q(), xs = [-0.07, Qv.hj, Qv.sc - 0.05];   // 第 0 帧就是第一个红叉正砸下来
  // 三张卡在 ② 时缩到上方一排，当背景证据
  const up = MO.cubicInOut(clamp((lt - (Qv.qian - 0.15)) / 0.45)), gone = L.outK(lt, Qv.d928 - 0.1, 0.3);
  if (gone >= 1) return;
  g.save(); g.globalAlpha = 1 - gone;
  for (let i = 0; i < 3; i++) {
    const k = 1;
    const x = lerp(CARD_X[i], 700 + i * 150, up), y = lerp(CARD_Y, 250, up), s = lerp(1.22, 0.42, up);
    L.at(g, x, y + 4 * Math.sin(lt * 2.2 + i), k * s, h => failCard(h, lt, i, xs[i]), 0.02 * Math.sin(lt * 1.3 + i * 2));
  }
  // 「连败三次」
  const kb = L.popK(lt, Qv.lb, 0.4, 2.6), ob = up;
  if (kb > 0 && ob < 1) { g.save(); g.globalAlpha *= 1 - ob; L.at(g, 1190, 800, kb, h => { L.kw(h, '连败三次', 0, 0, { size: 72, fill: C.red }); L.burstLines(h, 0, 0, 200, 270, clamp((lt - Qv.lb) / 0.45), { n: 10, col: C.red }); }); g.restore(); }
  g.restore();
}
// ---------- ② 存钱罐 → 最后一枚金币 ----------
function piggy(g, shake) {
  g.save(); g.rotate(shake); g.lineWidth = 5; g.strokeStyle = C.ink; g.lineJoin = 'round';
  for (const lx of [-70, -30, 30, 70]) { g.fillStyle = C.pink; g.fill(L.rrp(lx - 16, 60, 32, 50, 10)); g.stroke(L.rrp(lx - 16, 60, 32, 50, 10)); }
  g.beginPath(); g.ellipse(0, 0, 150, 108, 0, 0, TAU); g.fillStyle = '#FFB8C6'; g.fill(); g.stroke();
  g.beginPath(); g.ellipse(146, 4, 30, 38, 0, 0, TAU); g.fillStyle = C.pink; g.fill(); g.stroke();
  g.fillStyle = C.ink; for (const ny of [-8, 16]) { g.beginPath(); g.ellipse(150, ny, 5, 7, 0, 0, TAU); g.fill(); }
  g.beginPath(); g.arc(88, -40, 9, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(40, -96); g.lineTo(70, -150); g.lineTo(100, -88); g.closePath(); g.fillStyle = C.pink; g.fill(); g.stroke();
  g.fillStyle = C.ink; g.fill(L.rrp(-50, -112, 100, 14, 7));
  g.restore();
}
const LAST = { x: 1400, y: 560 };
function beat2(g, lt) {
  const Qv = q(); if (lt < Qv.qian - 0.05) return;
  const kp = L.popK(lt, Qv.qian + 0.22, 0.4), out = L.outK(lt, Qv.d928 - 0.1, 0.3);
  const shake = lt > Qv.qian + 0.35 && lt < Qv.zh ? 0.16 * Math.sin(lt * 42) : 0;
  if (out < 1) L.at(g, 870, 600, kp * (1 - out), h => {
    piggy(h, shake);
    // 罐口上方一个「空」的小虚线框：只剩一枚
    if (lt > Qv.qian + 0.35) { h.save(); h.setLineDash([10, 9]); h.lineWidth = 4; h.strokeStyle = C.mute; h.beginPath(); h.ellipse(0, -170, 60, 22, 0, 0, TAU); h.stroke(); h.restore(); }
  });
  // 金币：从罐口弹起，抛物线飞进第四张卡
  const c0 = Qv.qian + 0.55, c1 = Qv.zh + 0.15, u = clamp((lt - c0) / (c1 - c0));
  if (lt >= c0 && u < 1) { const e = MO.sineInOut(u), x = lerp(870, LAST.x, e), y = lerp(500, LAST.y - 40, e) - Math.sin(Math.PI * e) * 260;
    g.save(); g.translate(x, y); g.rotate(lt * 9); g.scale(1, Math.abs(Math.cos(lt * 9)) * 0.8 + 0.2); g.rotate(-lt * 9); L.flatCoin(g, 0, 0, 60); g.restore(); }
  if (lt >= c0 && u >= 1 && lt < Qv.d928) L.spark(g, LAST.x + 70, LAST.y - 120, 22 * Math.abs(Math.sin((lt - c1) * 6)), C.yel);
}
// ---------- 第四张卡：最后一发 → 点火升空 → 成了 ----------
function beat3(g, lt) {
  const Qv = q(); if (lt < Qv.zh - 0.1) return;
  const out = L.outK(lt, Qv.zz - 0.05, 0.3); if (out >= 1) return;
  const k = L.popK(lt, Qv.zh - 0.05, 0.42, 2.2), x = lerp(LAST.x, 1450, MO.cubicInOut(clamp((lt - Qv.d928) / 0.4)));
  g.save(); g.globalAlpha = 1 - out;
  L.at(g, x, LAST.y, k, h => {
    L.card(h, -140, -190, 280, 380, { fill: C.cream, lw: 5 });
    const lift = lt < Qv.nyf ? 0 : Math.pow(Math.max(0, lt - Qv.nyf), 2) * 520, fl = lt >= Qv.nyf - 0.15 ? clamp((lt - Qv.nyf + 0.15) / 0.2) : 0;
    h.save(); h.beginPath(); h.rect(-136, -186, 272, 372); h.clip();
    if (fl > 0) { for (let j = 0; j < 4; j++) { const ph = (lt * 1.6 + j / 4) % 1; h.globalAlpha = 0.45 * (1 - ph); h.fillStyle = '#E6DFD2'; h.beginPath(); h.arc(-60 + j * 40, 160 - ph * 30, 20 + ph * 26, 0, TAU); h.fill(); } h.globalAlpha = 1; }
    L.rocket(h, L.F1(), 0, 110 - lift, 9.2, { fins: true, sx: 3.6, flame: fl, lt });
    h.restore();
    if (lt < Qv.cl) L.kw(h, '最后一发', 0, 236, { size: 44, fill: C.yel, col: C.ink });
    else L.kw(h, '成了！', 0, 236, { size: 52, fill: C.green });
    L.stamp(h, 'v', 0, -10, lt - Qv.cl, { s: 1.6, rot: -0.12 });
  });
  g.restore();
  // 日历 2008 年 9 月 28 号
  const kc = L.popK(lt, Qv.d928, 0.42, 2.2);
  // 日历不退场：念到「整整」时它自己挪到左边，变成 ④ 的左日历（beat4 接手）
  if (kc > 0 && lt < Qv.zz) L.at(g, 890, 560, kc, h => L.calPage(h, '2008年9月', '28', C.red, '号', { w: 280, h: 280 }), -0.05 + 0.02 * Math.sin(lt * 1.5));
}
// ---------- ④ 18 年后的同一天 ----------
const CL = { x: 820, y: 470 }, CR = { x: 1560, y: 470 };
function beat4(g, lt) {
  const Qv = q(); if (lt < Qv.zz - 0.05) return;
  const out = L.outK(lt, Qv.lfz - 0.1, 0.3); if (out >= 1) return;
  g.save(); g.globalAlpha = 1 - out;
  const toTop = MO.cubicInOut(clamp((lt - (Qv.xj - 0.1)) / 0.5));
  const kl = 1, kr = L.popK(lt, Qv.n18 + 0.15, 0.42, 2.4), mv = MO.cubicInOut(clamp((lt - Qv.zz) / 0.4));
  const lx = lerp(lerp(890, CL.x, mv), 760, toTop), ly = lerp(lerp(560, CL.y, mv), 330, toTop), ls = lerp(lerp(280 / 260, 1, mv), 0.62, toTop);
  const rx = lerp(CR.x, 1560, toTop), ry = lerp(CR.y, 260, toTop), rs = lerp(1, 0.55, toTop);
  L.at(g, lx, ly, kl * ls, h => { L.calPage(h, '2008年9月', '28', C.red, '号', { w: 260, h: 260 }); }, lerp(-0.05, 0, mv));
  if (kl > 0) L.at(g, lx, ly + 230 * ls, kl * ls, h => L.rocket(h, L.F1(), 0, 50, 3.6, { fins: true, sx: 3.6 }));   // 小小的猎鹰1号
  L.at(g, rx, ry, kr * rs, h => { L.calPage(h, '2026年9月', '28', C.blue, '号', { w: 260, h: 260 }); });
  // 弧线箭头＋「整整18年」
  const ap = MO.cubicOut(clamp((lt - Qv.n18 + 0.25) / 0.45)) * (1 - toTop);
  L.arrow(g, lt, CL.x + 150, CL.y - 120, CR.x - 150, CR.y - 120, ap, { seed: 3, bend: 120, lw: 8 });
  const k18 = L.popK(lt, Qv.n18, 0.4, 2.4) * (1 - toTop);
  if (k18 > 0) L.at(g, (CL.x + CR.x) / 2, 250, k18, h => L.kw(h, '整整18年', 0, 0, { size: 50, fill: C.purple }));
  // 同一天：等号＋两个「28」都被圈出来
  const ke = L.popK(lt, Qv.tyt, 0.36, 2.6) * (1 - toTop);
  if (ke > 0) { L.at(g, (CL.x + CR.x) / 2, CL.y + 30, ke, h => { h.lineCap = 'round'; for (const dy of [-18, 18]) { h.strokeStyle = C.ink; h.lineWidth = 22; h.beginPath(); h.moveTo(-54, dy); h.lineTo(54, dy); h.stroke(); h.strokeStyle = C.yel; h.lineWidth = 12; h.stroke(); } });
    L.at(g, (CL.x + CR.x) / 2, CL.y + 170, ke, h => L.kw(h, '同一天', 0, 0, { size: 48, fill: C.yel, col: C.ink }));
    const rp = toTop > 0.02 ? 0 : clamp((lt - Qv.tyt) / 0.4);   // 日历一动就收掉圈，不留孤儿圈
    L.ring(g, lt, CL.x, CL.y + 40, 110, 80, rp, { seed: 11, col: C.red, lw: 7 }); L.ring(g, lt, CR.x, CR.y + 40, 110, 80, rp, { seed: 12, col: C.red, lw: 7 }); }
  g.restore();
}
// ---------- ⑤ 星舰第一次进入地球轨道 ----------
const EX = 1250, EY = 590, ER = 165, ORX = 370, ORY = 118, TILT = -0.16, ct = Math.cos(TILT), st = Math.sin(TILT);
const orb = th => { const x = ORX * Math.cos(th), y = ORY * Math.sin(th); return [EX + x * ct - y * st, EY + x * st + y * ct]; };
const orbV = th => { const x = -ORX * Math.sin(th), y = ORY * Math.cos(th); return [x * ct - y * st, x * st + y * ct]; };
function orbitHalf(g, lt, p, back) {
  if (p <= 0) return; g.save(); g.strokeStyle = C.ink; g.globalAlpha *= back ? 0.35 : 0.65; g.lineWidth = 4; g.setLineDash([16, 13]); g.lineDashOffset = -lt * 40; g.lineCap = 'round';
  g.beginPath(); const a0 = back ? Math.PI : 0; for (let i = 0; i <= 40; i++) { const u = i / 40; if (u > p) break; const [x, y] = orb(a0 + u * Math.PI); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.restore();
}
function ship(g, x, y, rot, s, lt, burn) {
  L.rocket(g, RK.ship(), x, y, s, { rot, sx: 1.9, pal: L.SS_PAL, flame: burn, lt, lw: 3.5 });
}
function beat5(g, lt) {
  const Qv = q(); if (lt < Qv.xj - 0.1) return;
  const out = L.outK(lt, Qv.lfz - 0.1, 0.3); if (out >= 1) return;
  g.save(); g.globalAlpha = 1 - out;
  const ek = L.popK(lt, Qv.xj - 0.05, 0.45, 1.8), op = MO.cubicOut(clamp((lt - Qv.xj - 0.2) / 0.5));
  const tL = Qv.xj + 0.15, tR = Qv.gd + 0.1, TH0 = Math.PI * 0.98;
  let sx, sy, rot, front, burn = 1, sc = 3.6;
  if (lt < tR) { const e = MO.cubicInOut(clamp((lt - tL) / (tR - tL))), [ox, oy] = orb(TH0), dx = ox - EX, dy = oy - EY, dl = Math.hypot(dx, dy);
    sx = lerp(EX + dx / dl * ER * 0.7, ox, e); sy = lerp(EY + dy / dl * ER * 0.7, oy, e); const [vx, vy] = orbV(TH0);
    rot = lerp(Math.atan2(dy, dx) + Math.PI / 2, Math.atan2(vy, vx) + Math.PI / 2, MO.smooth(e)); front = e > 0.6; sc = lerp(2.4, 3.6, e); }
  else { const th = TH0 + (lt - tR) * TAU / 2.4, [x, y] = orb(th), [vx, vy] = orbV(th); sx = x; sy = y; rot = Math.atan2(vy, vx) + Math.PI / 2; front = Math.sin(th) > 0; burn = clamp(1 - (lt - tR) / 0.4); }
  orbitHalf(g, lt, op, true);
  if (lt >= tL && !front) ship(g, sx, sy, rot, sc, lt, burn);
  L.earth(g, EX, EY, ER, lt, { k: ek });
  orbitHalf(g, lt, op, false);
  if (lt >= tL && front) ship(g, sx, sy, rot, sc, lt, burn);
  const kk = L.popK(lt, Qv.dyc, 0.4, 2.4);
  if (kk > 0) L.at(g, EX, 830, kk, h => L.kw(h, '星舰 · 第一次进入地球轨道', 0, 0, { size: 46, fill: C.blue }));
  g.restore();
}
// ---------- ⑥ 两分钟看完这 24 年 → 时间轴缩进顶栏 ----------
const TLX0 = 760, TLX1 = 1560, TLY = 640;
function beat6(g, lt) {
  const Qv = q(); if (lt < Qv.lfz - 0.1) return;
  const fly = MO.cubicInOut(clamp((lt - (Qv.end - 0.62)) / 0.5));
  const kt = L.popK(lt, Qv.lfz + 0.22, 0.45, 1.9), fade = 0;   // 标题留到转场（色带擦除），不留空帧
  g.save(); g.globalAlpha = 1 - fade;
  L.at(g, 1160, 420, kt, h => {
    L.txt(h, 'SpaceX', -20, 0, 150, { w: 'Black', align: 'right' });
    L.txt(h, '这', 10, 0, 120, { w: 'Black' });
    L.txt(h, '24', 140, 6, 168, { w: 'Black', col: C.red }); L.txt(h, '年', 345, 0, 120, { w: 'Black' });
  });
  const ks = L.popK(lt, Qv.lfz + 0.1, 0.4, 2.4);
  if (ks > 0) { L.stopwatch(g, 760, 250, 64, clamp((lt - Qv.lfz) / 2.2), { k: ks, col: C.teal }); L.at(g, 900, 250, ks, h => L.kw(h, '2分钟', 0, 0, { size: 44, fill: C.teal, align: 'left' })); }
  g.restore();
  // 时间轴：念到「24年」画出来，片尾飞进顶栏
  const tp = MO.cubicOut(clamp((lt - Qv.kw) / 0.7)); if (tp <= 0) return;
  const x0 = lerp(TLX0, L.TL.x0, fly), x1 = lerp(TLX0 + (TLX1 - TLX0) * tp, L.TL.x1, fly), y = lerp(TLY, L.TL.y, fly);
  g.save(); g.lineCap = 'round'; g.lineWidth = lerp(14, 8, fly); g.strokeStyle = C.red; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  for (const [yy, lab] of [[2002, '2002'], [2026, '2026']]) { const px = lerp(x0, lerp(TLX1, L.TL.x1, fly), (yy - 2002) / 24); if (px > x1 + 1) continue;
    g.beginPath(); g.arc(px, y, lerp(14, 6, fly), 0, TAU); g.fillStyle = C.white; g.fill(); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
    g.globalAlpha = 1 - fly; L.txt(g, lab, px, y + 62, 44, { align: 'center', w: 'Black' }); g.globalAlpha = 1; }
  g.restore();
}

SCENES[ID] = {
  init() { U.assertGlyphs('PuHui-Heavy', '2006年2007年2008年8月第1次2次3次连败三次最后一发成了！2008年9月2026年整整18年同一天第一次进入地球轨道2分钟号星舰·', ID);
    U.assertGlyphs('PuHui-Black', 'SpaceX这24年2820262002', ID); U.assertGlyphs('PuHui-Bold', '号', ID); },
  draw(c, lt) {
    L.CUR_T = L.T0(ID) + lt;
    L.bg(c, lt);
    const Qv = q();
    if (lt < Qv.zz) L.pageTitle(c, lt, '2008年', -1, { col: C.red, size: 46 });
    else if (lt < Qv.lfz - 0.1) L.pageTitle(c, lt, '2026年', Qv.n18 + 0.1, { col: C.blue, size: 46 });
    beat1(c, lt); beat2(c, lt); beat3(c, lt); beat4(c, lt); beat5(c, lt); beat6(c, lt);
  },
};
// 讲解员：第 0 帧就在（竖一根手指）
L.cast(ID, [
  { t: 0, pose: 'count', fr: [[0, 0], [TM.cue(ID, '火箭'), 1], [TM.cue(ID, '三次') - 0.05, 2]], x: 330, s: 0.66 },
  { t: TM.cue(ID, '钱只够') - 0.05, pose: 'nervous', fr: 'talk' },
  { t: TM.cue(ID, '成了') - 0.02, pose: 'cheer', fr: 'bounce' },
  { t: TM.cue(ID, '整整') - 0.05, pose: 'present', fr: 'talk' },
  { t: TM.cue(ID, '星舰') - 0.05, pose: 'wow', fr: 'bounce' },
  { t: TM.cue(ID, '两分钟') - 0.05, pose: 'wave', fr: 'loop' },
]);
L.setHud(L.T0(ID) + TM.dur(ID) - 0.1);
L.push(ID, TM.cue(ID, '成了') - 0.1, TM.cue(ID, '整整') - 0.05, 1.08, 1450, 900);   // 「成了」那一下整屏推近
L.year(ID, [[0, 2002]]);
L.push(ID, TM.cue(ID, '星舰') - 0.1, TM.cue(ID, '两分钟') - 0.1, 1.1, 1250, 900);   // 开头的钩子：星舰入轨推近
})();
