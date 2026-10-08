// t3 · 财经图表：「某虚构 AI 公司 5 年营收增长与股价」（数据全部虚构，每一镜角落标「示意数据」）
// 镜头 1（2.8s）：版式先出（顶红线＋红色小旗＋标题＋单位）→ 网格从左往右画出（零线最深）→ 柱子从 0 依次长出、数值同步计数 →
// 高亮最后一根（其余变灰）→ 标注「8.7 倍」。本文件同时放 t3 共用的版式与数据（window.T3）。
(() => {
const { clamp, lerp, rng } = U;
const W = 1920, H = 1080;
// 颜色：经济学人图表色板（2017 图表风格指南）
const COL = { red: '#E3120B', blue: '#006BA2', blue2: '#3EBCD2', grey: '#758D99', dim: '#C6D2D8', ink: '#0C0C0C', sub: '#4F5B61', grid: 'rgba(12,12,12,0.13)', bg: '#FFFFFF', up: '#E3120B', down: '#1B9E5A', gold: '#EBB434' };
const CN = '"NotoSansSC"', NUM = '"RobotoCondensed", "NotoSansSC"';
const F = { x: 170, y: 270, w: 1580, h: 610 };                            // 绘图区
// ---- 虚构数据 ----
const REV = [{ y: 2021, v: 12.4 }, { y: 2022, v: 19.8 }, { y: 2023, v: 34.6 }, { y: 2024, v: 61.2 }, { y: 2025, v: 107.9 }];
// 月收盘价 60 个点：带种子的随机游走，2022 回撤、2023-03 跳涨，再整体缩放到 38 → 286.4
const PRICE = (() => { const r = rng(2025), a = []; let v = 0;
  for (let m = 0; m < 60; m++) { const drift = m < 12 ? 0.02 : m < 24 ? -0.035 : m === 26 ? 0.35 : 0.045; v += drift + (r() - 0.5) * 0.11; a.push(v); }
  const e = a.map(Math.exp), k0 = e[0], k1 = e[59], out = e.map(x => 38 + (x - k0) / (k1 - k0) * (286.4 - 38));
  out[58] = 242; return out; })();                                     // 末点 = 最新价 286.4，倒数第二个月收盘 = 日 K 起点 242（两镜数字对得上）
// 最近 20 个交易日 K 线：从 242 走到 286.4（+18.3%），有涨有跌
const KL = (() => { const r = rng(77), out = []; let c = 242;
  for (let i = 0; i < 20; i++) { const tgt = 242 + (286.4 - 242) * (i + 1) / 20; const o = c; const cl = i === 19 ? 286.4 : tgt + (r() - 0.5) * 9 + (i % 5 === 3 ? -7 : 0);
    const hi = Math.max(o, cl) + 1.5 + r() * 4, lo = Math.min(o, cl) - 1.5 - r() * 4; out.push({ o, c: cl, h: hi, l: lo, vol: 0.4 + r() * 0.6 + (Math.abs(cl - o) / 10) }); c = cl; }
  return out; })();

// ---- 版式（每镜都画）：经济学人式整页版式 CH.frame（顶部红线、左上红色小旗、标题、副标题＝单位、来源、示意数据角标）----
const frame = (c, lt, { title, sub, source = '来源：示意数据，公司与数字均为虚构' } = {}) => CH.frame(c, lt, { title, sub, source, font: CN, red: COL.red, ink: COL.ink, subCol: COL.sub });
window.T3 = { COL, CN, NUM, F, REV, PRICE, KL, frame };

// ---- 镜头 1 ----
const yS = CH.lin(0, 120, F.y + F.h, F.y);
const xs = REV.map((d, i) => F.x + 130 + i * ((F.w - 330) / 4));
SCENES['t3_s1'] = {
  draw(c, lt) {
    c.fillStyle = T3.COL.bg; c.fillRect(0, 0, 1920, 1080);
    const z = 1 + 0.03 * lt / 2.8;                                       // 匀速慢推 1→1.03（财经频道图表镜头的常规呼吸感）
    c.save(); c.translate(960, 575); c.scale(z, z); c.translate(-960, -575);
    frame(c, lt, { title: '深算科技：营收五年涨到原来的近 9 倍', sub: '年营收，亿元' });
    CH.grid(c, F, [0, 30, 60, 90, 120], yS, MO.seg(lt, 0.25, 0.85), { col: COL.grid, zeroCol: COL.ink, font: `400 30px ${NUM}`, labelCol: '#5b666b', side: 'right', lw: 1.5, zeroLw: 3 });
    CH.xLabels(c, REV.map((d, i) => ({ x: xs[i], label: String(d.y) })), F.y + F.h + 50, MO.seg(lt, 0.45, 1.0), { font: `400 32px ${NUM}`, col: '#3a4246' });
    const hiP = MO.smooth(MO.seg(lt, 1.95, 2.35));
    const tops = CH.bars(c, REV.map((d, i) => ({ x: xs[i], v: d.v })), yS, 150, MO.seg(lt, 0.65, 1.95),
      { lag: 0.22, col: COL.blue, hi: lt > 1.95 ? 4 : -1, hiP, hiCol: COL.blue, dimCol: COL.dim, fmt: v => v.toFixed(1), font: `600 34px ${NUM}`, labelCol: COL.ink });
    // 标注：最后一根柱旁，点 → 引线 → 两行字（数字先说，比较后说）
    CH.callout(c, lt, 2.15, { x: xs[4] - 75, y: tops[4][1], tx: xs[4] - 330, ty: yS(96), lines: ['8.7 倍', '2025 年 107.9 亿 ÷ 2021 年 12.4 亿'],
      col: COL.ink, dotCol: COL.red, font: `700 54px ${NUM}`, font2: `400 28px ${CN}`, align: 'right', r: 9 });
    c.restore();
  },
};
})();
