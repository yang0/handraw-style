// S08 · 发射越来越密（数据段，纸面往上滚三屏）：① 可爱柱状图：猎鹰火箭年发射次数 2017 / 2022–2025 依次长出（2017 与 2022 之间断轴），
// 念到 2025 其余变灰，165 计数落定＋红圈 ② 两周小日历里每隔两天多冒出一枚小火箭「平均两天多一发」；天平：猎鹰9号这边比「全世界其他火箭」更沉
// ③ 一枚助推器＋37 个小火箭图标逐个点亮（Isotype），「37次」。数据只用核对表第 16–18 条。转场：整页左推（lin_slide）。
(() => {
const ID = 's08', L = LIN, { C, TAU } = L, { clamp, lerp } = U;
let Q = null;
const q = () => Q || (Q = { hs: TM.cue(ID, '回收之后'), fs: TM.cue(ID, '发射越来越密'), y25: TM.cue(ID, '2025年'), n165: TM.cue(ID, '165次'), n165E: TM.end(ID, '165次'),
  pj: TM.cue(ID, '平均两天多一发'), pjE: TM.end(ID, '一发'), sj: TM.cue(ID, '比全世界'), qt: TM.cue(ID, '其他火箭'), hd: TM.cue(ID, '还多'), yym: TM.cue(ID, '有一枚助推器'),
  yj: TM.cue(ID, '已经飞了'), n37: TM.cue(ID, '37次'), n37E: TM.end(ID, '37次') });

const BARS = [{ y: '2017', v: 18, x: 800 }, { y: '2022', v: 61, x: 1090 }, { y: '2023', v: 96, x: 1270 }, { y: '2024', v: 134, x: 1450 }, { y: '2025', v: 165, x: 1630 }];
const BASE = 790, KH = 2.85, BW = 128;
function pageA(g, lt) {
  const Qv = q();
  const hiK = clamp((lt - Qv.y25) / 0.35);
  // 2025 柱的计数：从「2025年」开始爬，念到「165」那个字时落定；落定后才圈、才放大
  const t5 = Qv.y25 - 0.4, land = Qv.n165 + 0.12, vp5 = MO.cubicOut(clamp((lt - t5) / (land - t5)));
  const hit = lt - land, punch = hit > 0 ? MO.settle(hit, 0.18, 2.5, 6) : 0;
  // 镜头：落定那一下推近 2025 柱，停住，翻页前拉回
  const push = MO.cubicInOut(clamp((lt - (land - 0.15)) / 0.45)) * (1 - MO.cubicInOut(clamp((lt - (Qv.pj + 0.25)) / 0.35)));
  const dimAll = 0.82 * push;   // 大数字砸入时，整张图退到背景
  g.save(); g.globalAlpha *= 1 - dimAll;
  // 底线＋断轴
  const ax = MO.cubicOut(clamp((lt - 0.05) / 0.45));
  g.save(); g.lineCap = 'round'; g.strokeStyle = C.ink; g.lineWidth = 6; g.beginPath(); g.moveTo(690, BASE); g.lineTo(lerp(690, 940, ax), BASE); g.stroke();
  if (ax > 0.5) { g.beginPath(); g.moveTo(1000, BASE); g.lineTo(lerp(1000, 1740, ax), BASE); g.stroke();
    g.lineWidth = 5; for (const dx of [0, 22]) { g.beginPath(); g.moveTo(950 + dx, BASE + 18); g.lineTo(966 + dx, BASE - 18); g.stroke(); } }
  g.restore();
  BARS.forEach((b, i) => {
    const last = i === 4, t0 = last ? t5 : Qv.hs + 0.2 + i * 0.28, gp = last ? vp5 : MO.cubicOut(clamp((lt - t0) / 0.35));
    if (lt < t0) return;
    const h = Math.max(2, b.v * KH * gp), dim = last ? 0 : hiK;
    g.save(); g.globalAlpha = 1 - 0.55 * dim;
    L.card(g, b.x - BW / 2, BASE - h, BW, h, { fill: last ? C.red : C.blue, r: 14, lw: 4, sh: 6 });
    L.txt(g, b.y, b.x, BASE + 52, 38, { align: 'center', col: last ? C.red : C.ink });
    if (last) L.at(g, b.x, BASE - h - 22, 1 + punch, hh => L.txt(hh, String(Math.round(165 * vp5)), 0, 0, 74, { align: 'center', w: 'Black', col: C.red }));
    else L.at(g, b.x, BASE - h - 22, L.popK(lt, t0 + 0.3, 0.3, 2.4), hh => L.txt(hh, String(b.v), 0, 0, 46, { align: 'center', w: 'Black' }));   // 柱子长完才亮出数，不出现中途倒挂
    g.restore();
  });
  const h5 = 165 * KH * vp5;
  if (lt > t5) L.rocket(g, L.F1(), BARS[4].x + 112, BASE - h5 + 40 - 8 * Math.abs(Math.sin(lt * 4)), 4.2, { fins: true, sx: 3.6, rot: 0.3 });
  L.ring(g, lt, BARS[4].x, BASE - h5 - 48, 124, 66, clamp((lt - land - 0.05) / 0.35), { seed: 17, col: C.red, lw: 7 });
  if (hit > 0) L.twinkles(g, lt, [[BARS[4].x - 150, BASE - h5 - 90], [BARS[4].x + 150, BASE - h5 - 70]], { r: 18 });
  g.restore();
  // 大数字砸入：165 次独占一屏（停 1.3 秒左右），翻页前收回
  // 卡片从 2025 那根红柱顶上长出来、讲完再缩回红柱
  // 进场：从 2025 红柱顶上长出来；退场：原地淡出（不再缩回去压住柱顶的数）
  const entering = lt < land + 0.6, ks = push > 0.01 ? (entering ? 0.15 + 0.85 * push : 1) * (1 + MO.settle(lt - land - 0.3, 0.06, 3, 6)) : 0, kx = entering ? lerp(1630, 1000, push) : 1000, ky = entering ? lerp(300, 520, push) : 520;
  if (ks > 0) { g.save(); g.globalAlpha *= entering ? 1 : push; L.at(g, kx, ky, ks, h => {
    L.card(h, -380, -230, 760, 430, { fill: C.white, r: 40, lw: 6, sh: 12 });
    L.txt(h, '2025年 · 猎鹰9号发射', 0, -150, 44, { align: 'center', col: C.sub });
    L.txt(h, '165', 60, 105, 230, { align: 'right', w: 'Black', col: C.red }); L.txt(h, '次', 80, 105, 110, { w: 'Black' });
    L.marker(h, -300, 130, 600, 26, MO.cubicOut(clamp((lt - land - 0.25) / 0.3)), C.hl, 9);
  }, -0.03); g.restore(); }
  if (push > 0.9) L.burstLines(g, 1000, 520, 460, 580, clamp((lt - land) / 0.55), { n: 14, col: C.red, lw: 8 });
  const kk = L.popK(lt, Qv.y25 + 0.1, 0.4, 2.4);
  if (kk > 0) L.at(g, 1060, 210, kk, h => L.kw(h, '2025年 · 全是猎鹰9号', 0, 0, { size: 46, fill: C.yel, col: C.ink }), -0.03);   // 和图题「猎鹰火箭」对上口径
  // 因果链：回收 → 发射越来越密（念「回收之后，发射越来越密」）
  const out = 1 - hiK;
  if (out > 0) { g.save(); g.globalAlpha *= out;
    const k1 = L.popK(lt, Qv.hs, 0.4, 2.2), k2 = L.popK(lt, Qv.fs, 0.4, 2.2);
    if (k1 > 0) L.at(g, 820, 220, k1, h => L.kw(h, '回收重复用', 0, 0, { size: 42, fill: C.teal }));
    L.arrow(g, lt, 990, 220, 1120, 220, MO.cubicOut(clamp((lt - Qv.fs + 0.2) / 0.3)), { seed: 31, bend: -14, lw: 7, head: 24 });
    if (k2 > 0) L.at(g, 1290, 220, k2, h => L.kw(h, '发射越来越密', 0, 0, { size: 42, fill: C.blue }));
    g.restore(); }
}
// ② 日历＋天平
const DAYS = [0, 2, 5, 7, 9, 12];   // 两周 6 发≈2.3 天一发（「两天多一发」）
function calendar(g, lt) {
  const Qv = q(), k = L.popK(lt, Qv.pj + 0.6, 0.45, 1.8); if (k <= 0) return;
  L.at(g, 840, 560, k * 0.94, h => {   // 日历放低一点：讲解员要坐在它上沿
    L.card(h, -280, -190, 560, 380, { fill: C.white }); h.save(); h.clip(L.rrp(-280, -190, 560, 380, 26)); h.fillStyle = C.red; h.fillRect(-280, -190, 560, 70); h.restore();
    h.lineWidth = 4; h.strokeStyle = C.ink; h.stroke(L.rrp(-280, -190, 560, 380, 26)); h.beginPath(); h.moveTo(-280, -120); h.lineTo(280, -120); h.stroke();
    L.txt(h, '两周', 0, -152, 38, { col: C.white, align: 'center', base: 'middle' });
    for (let d = 0; d < 14; d++) { const cx = -234 + (d % 7) * 78, cy = -60 + Math.floor(d / 7) * 130;
      h.fillStyle = '#F4EFE6'; h.fill(L.rrp(cx - 32, cy - 50, 64, 110, 12));
      const i = DAYS.indexOf(d); if (i < 0) continue; const kr = L.popK(lt, Qv.pj + 0.75 + i * 0.1, 0.3, 2.6);
      if (kr > 0) L.at(h, cx, cy + 40, kr, s => L.rocket(s, L.F1(), 0, 0, 3.4, { fins: true, sx: 3.6, flame: 0.6, lt, seed: d })); }
  });
  const kw = L.popK(lt, Qv.pj + 0.8, 0.4, 2.2);
  if (kw > 0) L.at(g, 840, 868, kw, h => L.kw(h, '平均两天多一发', 0, 0, { size: 46, fill: C.teal }));
}
function scale(g, lt) {
  const Qv = q(), k = L.popK(lt, Qv.sj - 0.1, 0.45, 1.8); if (k <= 0) return;
  const tilt = 0.06 * MO.cubicInOut(clamp((lt - Qv.qt) / 0.5)) + 0.26 * MO.cubicInOut(clamp((lt - Qv.hd + 0.2) / 0.35)) + MO.settle(lt - Qv.hd - 0.2, 0.05, 2.5, 4) + 0.012 * Math.sin(lt * 2);
  L.at(g, 1430, 560, k * 0.92, h => {
    h.lineWidth = 5; h.strokeStyle = C.ink; h.lineJoin = 'round'; h.lineCap = 'round';
    h.fillStyle = C.tile; h.beginPath(); h.moveTo(-90, 250); h.lineTo(90, 250); h.lineTo(20, 200); h.lineTo(20, -40); h.lineTo(-20, -40); h.lineTo(-20, 200); h.closePath(); h.fill(); h.stroke();
    h.save(); h.rotate(-tilt); h.fillStyle = C.goldD; h.fill(L.rrp(-260, -56, 520, 22, 11)); h.stroke(L.rrp(-260, -56, 520, 22, 11)); h.restore();
    h.beginPath(); h.arc(0, -45, 16, 0, TAU); h.fillStyle = C.gold; h.fill(); h.stroke();
    for (const d of [-1, 1]) { const ex = d * 240 * Math.cos(tilt), yy = -45 - d * 240 * Math.sin(tilt);
      h.beginPath(); h.moveTo(ex, yy); h.lineTo(ex - 70, yy + 120); h.moveTo(ex, yy); h.lineTo(ex + 70, yy + 120); h.stroke();
      h.beginPath(); h.moveTo(ex - 100, yy + 120); h.quadraticCurveTo(ex, yy + 175, ex + 100, yy + 120); h.closePath(); h.fillStyle = C.steel; h.fill(); h.stroke();
      if (d < 0) { for (let i = 0; i < 5; i++) L.rocket(h, L.F1(), ex - 64 + i * 32, yy + 124, 3.2, { fins: true, sx: 3.2 }); L.kw(h, '猎鹰9号', ex, yy + 214, { size: 38, fill: C.red }); }
      else { const r = U.rng(5); for (let i = 0; i < 4; i++) L.rocket(h, L.F1(), ex - 54 + i * 36, yy + 124, 2.4 + r() * 0.8, { fins: true, sx: 3.2, pal: { nose: C.mute, body: '#EDEAE4' } }); L.kw(h, '其他火箭加起来', ex - 20, yy + 214, { size: 38, fill: C.white, col: C.ink }); }
    }
  });
  const kh = L.popK(lt, Qv.hd - 0.05, 0.38, 2.8);
  if (kh > 0) L.at(g, 1430, 300, kh, h => L.kw(h, '还多！', 0, 0, { size: 56, fill: C.red }), -0.05);
}
// ③ 37 次
function pageC(g, lt) {
  const Qv = q(), kb = L.popK(lt, Qv.yym - 0.2, 0.45, 1.8);
  if (kb > 0) L.at(g, 1440, 850, kb, h => { L.rocket(h, RK.falcon9({ stage: 'booster', legs: 1, fins: 1 }), 0, 0, 10.5, { sx: 1.75, lw: 5 });
    // 身上贴满飞行贴纸
    const n = Math.round(37 * MO.expoOut(clamp((lt - Qv.yj + 0.4) / (Qv.n37E - Qv.yj + 0.4))));
    for (let i = 0; i < Math.min(n, 12); i++) { const yy = -90 - i * 26, xx = (i % 2 ? 1 : -1) * 4; h.fillStyle = [C.yel, C.teal, C.pink, C.blue][i % 4]; h.beginPath(); h.arc(xx, yy, 8, 0, TAU); h.fill(); h.lineWidth = 2; h.strokeStyle = C.ink; h.stroke(); } }, 0.015 * Math.sin(lt * 1.8));
  if (kb > 0) L.at(g, 1440, 350, kb, h => L.kw(h, '有一枚助推器', 0, 0, { size: 40, fill: C.white, col: C.ink }));
  if (kb > 0) L.at(g, 840, 872, L.popK(lt, Qv.n37 + 0.1, 0.4, 2.2), h => L.kw(h, '截至2026年8月', 0, 0, { size: 36, fill: C.yel, col: C.ink }), 0.03);
  const c0 = Qv.yj - 0.4, c1 = Qv.n37E, cp = clamp((lt - c0) / (c1 - c0)), n = Math.floor(37 * MO.cubicOut(cp) + 1e-6);
  if (lt < c0 - 0.3) return;
  for (let i = 0; i < 37; i++) { const x = 548 + (i % 10) * 64, y = 270 + Math.floor(i / 10) * 108, on = i < n;   // 这一屏讲解员在右边，点数图挪到左边
    g.save(); g.globalAlpha = on ? 1 : 0.22; const pk = on ? MO.settle(lt - (c0 + (c1 - c0) * MO.invert(MO.cubicOut, (i + 1) / 37)), 0.25, 3, 8) : 0;
    L.rocket(g, L.F1(), x, y + 34, 3.4 * (1 + pk), { fins: true, sx: 3.6, pal: on ? {} : { nose: C.mute } }); g.restore(); }
  const kn = L.popK(lt, c0, 0.35, 2);
  if (kn > 0) L.at(g, 850, 790, kn, h => { L.txt(h, String(n), 30, 0, 150, { w: 'Black', col: C.red, align: 'right' }); L.txt(h, '次', 44, 0, 70); });
  if (cp >= 1) { L.ring(g, lt, 840, 740, 170, 80, clamp((lt - c1) / 0.4), { seed: 23, col: C.red, lw: 7 }); L.twinkles(g, lt, [[600, 720], [1100, 700]], { r: 20 }); }
}

SCENES[ID] = {
  init() { U.assertGlyphs('PuHui-Heavy', '全是截至2026年8月回收重复用发射越来越密猎鹰火箭每年发射次数20172022202320242025年·猎鹰9号165次越来越密两周平均两天多一发其他火箭加起来还多！有一枚助推器0123456789', ID); U.assertGlyphs('PuHui-Black', '0123456789', ID); },
  draw(c, lt) {
    L.CUR_T = L.T0(ID) + lt;
    const Qv = q();
    L.bg(c, lt, { seed: 2618 });
    const s1 = MO.cubicInOut(clamp((lt - (Qv.pj + 0.55)) / 0.5)), s2 = MO.cubicInOut(clamp((lt - (Qv.yym - 0.5)) / 0.5)), off = -1080 * (s1 + s2);
    if (s1 < 1) { c.save(); c.globalAlpha = Math.max(0, 1 - 2 * s1); c.translate(0, off); pageA(c, lt); c.restore(); }
    if (s1 > 0 && s2 < 1) { c.save(); if (s1 < 1) { c.beginPath(); c.rect(0, 0, 1920, 905); c.clip(); } c.globalAlpha = Math.max(0, 1 - 2 * s2); c.translate(0, off + 1080); calendar(c, lt); scale(c, lt); c.restore(); }
    if (s2 > 0) { c.save(); if (s2 < 1) { c.beginPath(); c.rect(0, 0, 1920, 905); c.clip(); } c.translate(0, off + 2160); pageC(c, lt); c.restore(); }
    // 页眉不跟着卷（卷动的内容只在讲解员右边走）
    if (s1 < 0.5) L.pageTitle(c, lt, '猎鹰火箭每年发射次数', Qv.hs - 0.1, { col: C.blue, size: 40 });
    else if (s2 < 0.5) L.pageTitle(c, lt, '发射有多密', Qv.pj + 0.75, { col: C.teal, size: 42 }); else L.pageTitle(c, lt, '最能飞的一枚', Qv.yym - 0.25, { col: C.red, size: 42 });
  },
};
ERAS.find(e => e.id === ID).transition = { type: 'lin_zoom', dur: 0.6, x: 1560, y: 560 };   // 推镜穿过「送进轨道」那张卡
L.cast(ID, [
  { t: 0.05, pose: 'stick', fr: 'talk', x: 330, walk: 0.85 },   // 退回左边，给图表让出位置
  { t: TM.cue(ID, '2025年') - 0.1, pose: 'stick', fr: 'talk', x: 165, s: 0.4, glide: 0.45 },   // 图表和 165 满屏，讲解员退到角落
  { t: TM.cue(ID, '165次') + 0.1, pose: 'wow', fr: 'bounce' },
  { t: TM.cue(ID, '平均两天多一发') + 0.6, pose: 'count', fr: 1, x: 330, s: 0.66, glide: 0.45 },
  { t: TM.cue(ID, '比全世界') - 0.3, pose: 'sit', fr: 'talk', x: 700, y: 383, s: 0.6 },   // 跳上日历坐着，指着右边的天平
  { t: TM.cue(ID, '还多') - 0.05, pose: 'sit', fr: 2 },
  { t: TM.cue(ID, '有一枚助推器') - 0.5, pose: 'point', fr: 'talk', x: 330, y: 908, s: 0.66 },   // 日历卷走之前先跳下来
  { t: TM.cue(ID, '有一枚助推器') - 0.02, pose: 'walk', fr: 'walk', x: -260, walk: 0.4 },   // 从左边出画，再从右边进来：这一屏换边，不从图上走过去
  { t: TM.cue(ID, '有一枚助推器') + 0.4, pose: 'walk', fr: 'walk', x: 2150 },
  { t: TM.cue(ID, '有一枚助推器') + 0.42, pose: 'lean', fr: 'talk', x: 1600, walk: 0.6, flip: true },   // 从右边进来，胳膊肘搭在这枚助推器上
  { t: TM.cue(ID, '37次'), pose: 'lean', fr: 2, flip: true },
]);
L.year(ID, [[0.3, 2017], [TM.cue(ID, '2025年'), 2025], [TM.cue(ID, '有一枚助推器') - 0.2, 2026]]);   // 第 37 次是 2026 年 8 月
L.push(ID, TM.cue(ID, '165次') - 0.1, TM.cue(ID, '平均两天多一发') + 0.5, 1.07, 1050, 900);
})();
