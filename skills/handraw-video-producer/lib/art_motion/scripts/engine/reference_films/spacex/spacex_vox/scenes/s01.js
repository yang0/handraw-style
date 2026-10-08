// S01 · 冷开场：「9.28」那一格。第 0 帧就是证据——黑底「2008」标签＋三张失败发射的网点照片。
// 连败三次 → 三个红叉一顿一顿划上去；最后一发 → 相机移到发射台照片，打字条「最后一发」被红笔圈住；
// 9月28号 → 日历页滑进来；成了 → 推满照片、硬切成同一次发射的大幅扫描；18 年后的同一天 → 两张日历一根红线；
// 星舰入轨 → 照片滑进来红圈圈住；两分钟，看完它这 24 年 → 相机长尾拉到全桌，红线一口气走完 12 格，「24年」打出来。
(() => {
const ID = 's01', V = VOX, C = V.C, F = V.F, PH = V.PH, RK0 = RK, TAU = Math.PI * 2;
const { clamp, lerp } = U, seg = MO.seg, step = V.step;
const cell = V.cell(ID), X0 = cell.x, Y0 = cell.y, P = (x, y) => [X0 + x, Y0 + y];
const cue = k => TM.cue(ID, k), G = k => V.cue(ID, k);
const T = { y2008: '2008', f: ['2006', '2007', '2008.8'], last: '最后一发', cal: ['2008', '2026'], m: '9月', d: '28', y18: '18年', big: '24年', ins: '2008.9.28', ok: '成了' };

const { failDraw, padDraw, launchDraw, shipDraw } = V.DRAW;
const S = {};
const calSprite = (yr) => V.spr('s01cal' + yr, 300, 380, (g, w, h) => {
  V.paper(g, w, h, 5 + +yr % 7, { col: '#f3f1ea', amp: 2, age: 0.15 });
  g.fillStyle = C.black; g.fillRect(0, 0, w, 50); g.fillStyle = '#c9c2b2'; for (const x of [70, w - 70]) { g.beginPath(); g.arc(x, 25, 9, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(40,36,30,.35)'; for (let x = 12; x < w; x += 14) { g.beginPath(); g.arc(x, 60, 2.2, 0, TAU); g.fill(); }
  V.text(g, yr, w / 2, 112, 42, F.type, C.ink2, 'center'); V.text(g, T.m, w / 2, 168, 44, F.heavy, C.red, 'center');
  V.text(g, T.d, w / 2, 352, 190, F.num, C.ink, 'center');
});

// ---------- 桌上物件 ----------
const at0 = -1;
V.item({ key: 's01lab', ...xy(330, 520), r: -0.02, at: at0, draw(g) { V.blit(g, S.lab || (S.lab = V.spr('s01lab', V.labelW(PAINT.scratch('m').getContext('2d'), T.y2008, 118, F.num, 34), 190, (gg, w, h) => { gg.save(); CL.tornRect(gg, w, h, 41, 3); gg.fillStyle = C.black; gg.fill(); gg.restore(); V.text(gg, T.y2008, w / 2, h / 2 + 42, 118, F.num, C.paper, 'center'); }, { S: 1.5 }))); } });
const UL = V.handPts('s01ul', [[-150, 0], [-40, 6], [80, 2], [160, 8]], { amp: 1.6, seed: 9 });
V.item({ key: 's01ul', ...xy(330, 620), r: -0.02, z: 12, at: 0.25, draw(g, T_) { V.pen(g, UL, MO.cubicOut(seg(step(T_), 0.3, 0.85)), { lw: 9 }); } });
const tLose = G('连败');
V.item({ key: 's01lose', ...xy(720, 520), r: 0.025, z: 12, at: at0, draw(g) { V.label(g, '连败三次', 64, { bg: C.red2, padX: 26 }); } });   // 第 0 帧就把冲突摆出来
const FP = [[330, 800, -0.03], [745, 780, 0.025], [1150, 810, -0.015]];
const FX = FP.map((_, i) => V.cross('s01f' + i, 120, 3 + i * 5));
const tX = [cue('连'), cue('败'), cue('三')];
FP.forEach(([x, y, r], i) => {
  V.item({ key: 's01f' + i, ...xy(x, y), r, at: at0, draw(g, T_) {
    const sp = V.photo('s01f' + i, 370, 250, failDraw(i), { cell: 5, border: 13 }); V.blit(g, sp);
    V.tape(g, -150, -134, -0.5, 100); V.tape(g, 150, -134, 0.45, 100);
    // 打字机日期条
    g.save(); g.translate(-110, 180); g.rotate(0.02); g.fillStyle = C.paper; CL.tornRect(g, 220, 64, 9 + i, 2); g.fill(); V.text(g, T.f[i], 110, 46, 40, F.type, C.ink, 'center'); g.restore();
    V.drawCross(g, FX[i], T_, V.t0(ID) + tX[i], { lw: 13, d: 0.17 });
  } });
});
function xy(x, y) { const [a, b] = P(x, y); return { x: a, y: b }; }
// 发射台照片＋「最后一发」字条
const tNote = G('最后'), tCirc = G('一发');
const NC = V.circle('s01note', 170, 58, 7);
V.item({ key: 's01pad', ...xy(1480, 760), r: 0.03, at: at0, draw(g) { const sp = V.photo('s01pad', 340, 460, padDraw, { cell: 5, border: 14 }); V.blit(g, sp); V.tape(g, 0, -244, 0.04, 140); } });
V.item({ key: 's01note', ...xy(1480, 545), r: -0.035, z: 12, at: tNote - 0.25, enter: { from: [60, -200], tilt: -0.12, dur: 0.4 }, draw(g, T_) {
  g.save(); g.translate(-150, -48); V.paper(g, 300, 96, 13, { amp: 3 }); g.restore();
  V.typed(g, T.last, -116, 22, V.nTyped(T_, tNote, 14), 60, F.heavy, C.ink);
  V.pen(g, NC, MO.cubicOut(seg(step(T_), tCirc + 0.15, tCirc + 0.65)), { lw: 7 });
} });
// 日历两页＋中间红线「18年」
V.item({ key: 's01cal08', ...xy(1890, 745), r: 0.04, z: 11, at: G('月') - 0.12, enter: { from: [320, -260], tilt: 0.2, dur: 0.45 }, draw(g, T_) {
  V.blit(g, calSprite('2008')); V.hl(g, -104, 16, 208, 154, MO.sineInOut(seg(step(T_), G('同一') - 0.05, G('同一') + 0.35)));
} });
V.item({ key: 's01cal26', ...xy(1890, 1310), r: -0.03, z: 11, at: G('年后') - 0.1, enter: { from: [260, 380], tilt: -0.2, dur: 0.45 }, draw(g, T_) {
  V.blit(g, calSprite('2026')); V.hl(g, -104, 16, 208, 154, MO.sineInOut(seg(step(T_), G('一天') - 0.05, G('一天') + 0.35)));
} });
const s18 = (() => { const a = P(1895, 950), b = P(1885, 1105), pts = CL.stringPts(a, b, 0.05, 20); return { a, b, pts, cum: DG.cum(pts) }; })();
V.item({ key: 's01str', x: s18.a[0], y: (s18.a[1] + s18.b[1]) / 2, z: 13, at: G('整整') + 0.3, draw(g, T_) {
  const q = MO.sineInOut(seg(step(T_), G('整整') + 0.3, G('18年'))); g.save(); g.translate(-s18.a[0], -(s18.a[1] + s18.b[1]) / 2);
  CL.string(g, s18.pts, s18.cum, s18.cum[s18.cum.length - 1] * q, { col: C.red, lw: 5 }); V.pin(g, s18.a[0], s18.a[1]); if (q >= 1) V.pin(g, s18.b[0], s18.b[1]);
  if (step(T_) >= G('18年') - 0.05) { g.save(); g.translate(s18.a[0] + 112, (s18.a[1] + s18.b[1]) / 2); g.rotate(0.03); g.fillStyle = C.card; g.fillRect(-90, -44, 180, 88); V.text(g, T.y18, 0, 24, 62, F.heavy, C.ink, 'center'); g.restore(); }
  g.restore();
} });
// 星舰在轨照片：滑进来、红笔圈住
const SC = V.circle('s01ship', 165, 120, 11);
V.item({ key: 's01ship', ...xy(1290, 1385), r: -0.045, z: 12, at: G('星舰') - 0.12, enter: { from: [-520, 140], tilt: -0.2, dur: 0.5 }, draw(g, T_) {
  const sp = V.photo('s01ship', 400, 470, shipDraw, { cell: 5, border: 14 }); V.blit(g, sp); V.tape(g, -160, -246, -0.45, 110); V.tape(g, 160, -246, 0.5, 110);
  g.save(); g.translate(16, 10); V.pen(g, SC, MO.cubicOut(seg(step(T_), G('进入'), G('进入') + 0.6)), { lw: 8 }); g.restore();
} });
// 承诺：拉到全桌时红笔圈出三个转折点——连败（2006–2008）、回收（2015–2017）、入轨（2026.9.28）
const TURN = [['s03', '2006–2008'], ['s05', '2015–2017'], ['s01', '2026.9.28']].map(([id, txt], k) => { const [x, y] = V.tagPos(id); return { x, y: y + 140, c: V.circle('s01turn' + k, V.tagW(txt) / 2 + 110, 210, 3 + k) }; });
V.item({ key: 's01turn', x: V.DW / 2, y: V.DH / 2, z: 61, rad: 1e6, at: G('看完') - 0.05, until: V.t0('s02') + 1.3, draw(g, T_) {
  const st = step(T_); g.save(); g.translate(-V.DW / 2, -V.DH / 2);
  TURN.forEach((t, k) => { const t0_ = G('看完') + k * 0.22; g.save(); g.translate(t.x, t.y); V.pen(g, t.c, MO.cubicOut(seg(st, t0_, t0_ + 0.3)), { lw: Math.max(9, 3.2 / V.zoom) }); g.restore(); });
  g.restore();
} });
// 「24年」：拉到全桌时在桌子正中打出来（下一段飞进 2002 后撤掉）
V.item({ key: 's01big', x: 5750, y: 1975, r: -0.015, z: 60, rad: 3000, at: G('24') - 0.1, until: V.t0('s02') + 1.3, enter: { drop: 0.25, dur: 0.3 }, draw(g, T_) { g.scale(0.68, 0.68);
  V.blit(g, S.big || (S.big = V.spr('s01big', 1500, 640, (gg, w, h) => { gg.save(); CL.tornRect(gg, w, h, 55, 6); gg.fillStyle = C.black; gg.fill(); gg.restore(); V.text(gg, '24', 120, h / 2 + 205, 560, F.num, C.yel); V.text(gg, '年', 120 + 470, h / 2 + 200, 420, F.heavy, C.paper); }, { S: 0.6, pad: 40, sh: { blur: 30, y: 20 } })));
} });

// ---------- 相机 ----------
const ins0 = cue('成了'), ins1 = cue('整整') + 0.45;
const OV = V.overview(), OV1 = { ...OV, y: OV.y + 220, z: OV.z * 0.92 };   // 这一次全景下面有字幕：整张桌子往上让一点
const at = (x, y, z, sy) => { const [a, b] = P(x, y); return V.at(a, b, z, sy); };
const K = [
  V.key(0, at(740, 735, 1.44)),
  V.key(2.2, at(740, 730, 1.33), MO.longTail),
  V.key(cue('钱') - 0.1, at(745, 728, 1.335), MO.sineInOut),
  V.key(cue('够'), at(1300, 820, 1.2), MO.sineInOut),            // 「找下一张卡」：对称 Easy Ease
  V.key(cue('9'), at(1310, 815, 1.22), MO.sineInOut),
  V.key(cue('号'), at(1400, 820, 1.08), MO.longTail),
  V.key(cue('那一'), at(1410, 822, 1.1), MO.sineInOut),
  V.key(ins1 - 0.001, at(1420, 822, 1.11), MO.sineInOut),
  V.key(ins1, at(1500, 1000, 0.86)),                             // 硬切回桌面：两张日历
  V.key(cue('星舰') + 0.05, at(1510, 1005, 0.89), MO.sineInOut),
  V.key(cue('进入') + 0.1, at(1600, 1270, 1.06), MO.sineInOut),
  V.key(cue('两分钟') + 0.08, at(1590, 1272, 1.09), MO.sineInOut),
  V.key(cue('24') + 0.1, OV1, MO.longTail),                      // 拉出揭示：长尾，红线跟着走完全桌
  V.key(TM.dur(ID) + 0.01, { ...OV1, z: OV1.z * 1.012 }, MO.sineInOut),
];
const PUSH = [cue('那一') + 0.02, ins0];
const cam = (lt) => {
  const base = CAM.at(K, lt);
  if (lt < PUSH[0] || lt >= ins1) return base;
  const [px, py] = P(1480, 760);
  return CAM.pushTo(base, px, py, 4.2, MO.sineInOut(seg(lt, PUSH[0], PUSH[1])));
};
// 插入镜头：大幅扫描＋红笔圈＋黑标签打字
const IC = V.circle('s01ins', 130, 300, 4, -2.2, 1.08);
const insertShot = (c, lt) => {
  const sp = V.photo('s01ins', 1640, 900, launchDraw, { cell: 8, border: 22, S: 1 });
  V.insert(c, sp, lt - ins0, { z0: 0.95, z1: 0.99, d: 1.2, bg: C.desk, sy: -75 });
  const st = step(lt), z = lerp(0.95, 0.99, MO.sineInOut(clamp((lt - ins0) / 1.2)));
  c.save(); c.translate(960, 465); c.scale(z, z);
  c.save(); c.translate(-29, -147); V.pen(c, IC, MO.cubicOut(seg(st, ins0 + 0.12, ins0 + 0.62)), { lw: 9 }); c.restore();
  c.restore();
  c.save(); c.translate(520, 210); c.rotate(-0.02); const n = TY.typedCount(st, ins0 + 0.05, 16); V.label(c, T.ins, 54, { fam: F.type, n }); c.restore();
  if (st >= cue('了') - 0.02) { c.save(); c.translate(1360, 760); c.rotate(-0.06); const s = 1 + 0.25 * (1 - MO.quartOut(clamp(step(lt - cue('了') + 0.02) / 0.25))); c.scale(s, s); V.label(c, T.ok, 96, { bg: C.red2, padX: 30 }); c.restore(); }
};
V.warm.push(() => V.photo('s01ins', 1640, 900, launchDraw, { cell: 8, border: 22, S: 1 }));
V.scene(ID, {
  cam,
  shots: [{ t: 0 }, { t: ins0, fn: insertShot }, { t: ins1 }],
  init() { V.checkTags(); V.glyphs(ID, [[F.num, T.y2008 + T.d + '24'], [F.type, T.f.join('') + T.ins + '20082026'], [F.heavy, T.last + T.m + T.y18 + T.ok + '年连败三次']]); },
});
})();
