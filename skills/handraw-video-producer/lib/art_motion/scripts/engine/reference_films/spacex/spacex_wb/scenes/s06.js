// S06 · 重型猎鹰（C 行左段，x 0–2300）。换行用「拉远再扎进去」：相机先退到能看见 A、B 两行的远处（全片第一次看到这块板有多大），再扎进 C 行。
// 快节奏三拍：「2018年」＋三芯并联的重型猎鹰 → 相机快推到一颗橙色太阳，一辆小跑车（车里一个戴头盔的小人）沿虚线绕太阳转 →
// 两个着陆圈，两枚助推器同步竖着落下，「并排」弹出，落地扬起两团小尘。
WB.chapter('s06', id => {
  const q = k => WB.q(id, k), { OR, INK } = WB, D = WB.D, Y = v => WB.ROW.C + v;
  const t0 = WB.T0(id);
  // ---- 换行：拉远 → 扎进 C 行 ----
  // ---- 2018年，重型猎鹰首飞 ----
  WB.go(t0 + 0.9); WB.text('2018年', 130, Y(250), 130, { rate: 11 });
  WB.go(q('重型猎鹰') - 0.1); WB.text('重型猎鹰首飞', 130, Y(370), 66, { rate: 15 });   // 标签先写完，镜头走之前不留半截字
  WB.go(WB.cur + 0.02); WB.sk(D.heavy(520), 720, Y(820), { speed: 6200, w: 5.5 });
  // ---- 把一辆跑车送上了绕太阳的轨道 ----
  const SX = 1470, SY = Y(430), SR = 105;
  WB.go(q('跑车') - 0.3);
  WB.line(WB.circ(SX, SY, SR, 1.04), { col: OR, w: 7, speed: 4200 });
  WB.hatchCircle(SX, SY, SR, { gap: 20, ang: -Math.PI / 4 });
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.2; WB.line([[SX + Math.cos(a) * (SR + 22), SY + Math.sin(a) * (SR + 22)], [SX + Math.cos(a) * (SR + 56), SY + Math.sin(a) * (SR + 56)]], { col: OR, w: 5.5, speed: 4000, min: 0.018, gap: 0.004, smooth: false }); }
  const tRays = WB.cur, ORX = 370, ORY = 150, ROT = -0.08;
  WB.go(q('绕太阳') - 0.25); WB.line(WB.ell(SX, SY, ORX, ORY, Math.PI * 0.6, 1.02, ROT, 72), { w: 3.2, speed: 7000, smooth: false });
  const CAR = WB.prep([...D.car(150), ...D.fig(70, 'wave', { helmet: true }).map(k => k.fillPts ? { ...k, fillPts: k.fillPts.map(([x, y]) => [x + 4, y - 30]) } : { ...k, p: k.p.map(([x, y]) => [x + 4, y - 30]) })], 5);
  const tC = q('跑车') + 0.1;
  WB.custom({ t0: tC, t1: tC + 0.3, bb: [SX - ORX - 160, SY - ORY - 160, SX + ORX + 160, SY + ORY + 160], draw(g, qq, t) {
    const w = (t - tC) * 0.75 + Math.PI * 0.75, c = Math.cos(ROT), n = Math.sin(ROT), X0 = Math.cos(w) * ORX, Y0 = Math.sin(w) * ORY;
    const x = SX + X0 * c - Y0 * n, y = SY + X0 * n + Y0 * c, a = Math.atan2(Math.cos(w) * ORY, -Math.sin(w) * ORX) + ROT;
    const behind = Math.sin(w) < 0;
    if (behind) { g.beginPath(); g.rect(-1e5, -1e5, 2e5, 2e5); g.arc(SX, SY, SR + 60, 0, Math.PI * 2, true); g.clip(); }
    const flip = Math.cos(a) < 0 ? -1 : 1;
    g.translate(x, y); g.rotate((flip < 0 ? a + Math.PI : a) * 0.3); g.scale(flip, 1); WB.drawPrep(g, CAR, 0, 0, MO.backOut(qq, 2), 0); return null; } });
  WB.text('跑车', SX - ORX - 30, SY + ORY + 70, 60, { rate: 14, t0: Math.max(q('跑车') + 0.45, tRays + 0.02) });
  // ---- 两枚助推器并排落回地面 ----
  const G = Y(800), BX = [2060, 2290], BH = 330;
  WB.go(q('两枚') - 0.2);
  WB.line([[1900, G], [2460, G]], { speed: 8000, w: 6 });
  BX.forEach(x => WB.line(WB.ell(x, G + 4, 90, 20, Math.PI, 1.03, 0, 36), { w: 5, speed: 6000 }));
  const B0 = WB.prep(D.falcon9(BH, { stage: 'booster', legs: 0, fins: 1 }), 5.5), B1 = WB.prep(D.falcon9(BH, { stage: 'booster', legs: 1, fins: 1 }), 5.5);
  const FL = WB.prep([{ p: [[-15, 2], [0, 76], [15, 2]], o: 1, w: 0.9 }], 5.5), m = BH / 41;
  const tD0 = q('助推器') - 0.15, tD1 = q('地面') + 0.02;
  WB.custom({ t0: tD0, t1: tD1, bb: [1830, Y(-700), 2530, G + 80], draw(g, qq, t) {
    const u = 1 - Math.pow(1 - qq, 2.2), yb = U.lerp(Y(-260), G - 2.5 * m, u), leg = U.clamp((qq - 0.7) / 0.2);
    BX.forEach((x, i) => {
      if (qq < 1) WB.drawPrep(g, FL, x, yb, 1, 0, 0.7 + 0.3 * Math.sin(t * 41 + i));
      WB.drawPrep(g, leg > 0.5 ? B1 : B0, x, yb, 1, 0);
      if (qq >= 1) { const k = U.clamp((t - tD1) / 0.7); if (k < 1) { g.save(); g.globalAlpha = 1 - k; g.strokeStyle = INK; g.lineWidth = 4; for (const sx of [-1, 1]) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x + sx * (70 + j * 24 + k * 36), G - 10 - j * 6, 9 + j * 4, Math.PI, Math.PI * 2); g.stroke(); } g.restore(); } }
    });
    return null; } });
  WB.pop('并排', 2175, Y(250), 110, { at: q('并排') + 0.2 });
  WB.line([[2070, Y(285)], [2280, Y(292)]], { col: OR, w: 6, t0: q('并排') + 0.35, dur: 0.18 });
  // ---- 相机 ----
  const T = t0 + TIMING.seg[id].dur;
  WB.shot(t0 - 1.0, 0.7, -10, t0, { zmax: 0.3, pad: 80, sy: 520, ease: MO.cubicInOut, creep: 0 });
  WB.shot(t0 + 0.45, 0.7, t0, q('跑车') - 0.32, { zmax: 1.15, ease: MO.cubicInOut, creep: 0 });
  WB.shot(q('跑车') - 0.45, 0.4, q('跑车') - 0.32, q('两枚') - 0.25, { zmax: 1.2, ease: MO.cubicInOut, add: [[SX - ORX - 80, SY - ORY - 80, SX + ORX + 80, SY + ORY + 80]] });
  WB.shot(q('两枚') - 0.35, 0.6, q('两枚') - 0.25, T, { ease: MO.cubicInOut, add: [[SX + 100, SY - 50, 2460, G + 30], [1950, Y(330), 2400, Y(400)]] });
});
SCENES['s06'] = WB.scene;
