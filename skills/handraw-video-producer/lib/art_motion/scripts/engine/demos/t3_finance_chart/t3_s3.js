// t3 · 镜头 3（2.5s，前 0.6s 是从上一镜最新点「推进来」的转场）：最近 20 个交易日 K 线。
// 价格区网格先出 → K 线逐根长出（红涨绿跌，A 股惯例）、成交量同步 → 右上价格跟着最新一根滚动 → 起点参考虚线＋区间涨幅标注 → 停 0.75s。
// （审片后删掉了 5 日均线：2 秒里读不完 K 线＋均线＋量＋括注）
(() => {
const { clamp, lerp } = U;
const W = 1920, H = 1080;
const L = (() => {
  const { F, KL } = T3;
  const lo = Math.min(...KL.map(k => k.l)), hi = Math.max(...KL.map(k => k.h));
  const ticks = CH.ticks(lo - 4, hi + 4, 4), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const PB = F.y + F.h * 0.74;                                           // 价格区底
  const yS = CH.lin(y0, y1, PB, F.y + 10);
  const xs = KL.map((_, i) => F.x + 40 + i * ((F.w - 330) / 19));
  return { ticks, yS, xs, PB, VB: F.y + F.h, VT: F.y + F.h * 0.8 };
})();
SCENES['t3_s3'] = {
  focus: [L.xs[19], L.yS(286.4)],
  draw(c, lt) {
    const { COL, CN, NUM, F, KL, frame } = T3;
    c.fillStyle = COL.bg; c.fillRect(0, 0, 1920, 1080);
    const z = 1 + 0.03 * lt / 2.5;                                       // 匀速慢推 1→1.03
    c.save(); c.translate(960, 575); c.scale(z, z); c.translate(-960, -575);
    frame(c, lt + 0.6, { title: '最近 20 个交易日：涨了 18.3%', sub: '日 K 线，元　红涨绿跌（A 股惯例）　纵轴未从 0 开始' });
    const PF = { x: F.x, y: F.y, w: F.w, h: L.PB - F.y };
    CH.grid(c, PF, L.ticks, L.yS, MO.seg(lt, 0.1, 0.6), { col: COL.grid, zeroCol: COL.grid, font: `400 30px ${NUM}`, labelCol: '#5b666b', side: 'right', lw: 1.5 });
    // 成交量区基线
    c.fillStyle = COL.ink; c.fillRect(F.x, L.VB - 1, F.w * MO.quintOut(MO.seg(lt, 0.1, 0.6)), 2);
    c.save(); c.font = `400 26px ${CN}`; c.fillStyle = '#7c868b'; c.textAlign = 'right'; c.globalAlpha = MO.seg(lt, 0.3, 0.6); c.fillText('成交量', F.x + F.w, L.VB - 14); c.restore();   // 放右下角空处，不压 K 线
    // K 线 + 成交量：逐根（lag 0.06），0.2–1.3s
    const kp = MO.seg(lt, 0.2, 1.3);
    CH.candles(c, KL, L.xs, L.yS, 30, kp, { up: COL.up, down: COL.down, lag: 0.06 });
    const VMAX = Math.max(...KL.map(k => k.vol));
    KL.forEach((k, i) => { const q = MO.quintOut(MO.lagged(i, 20, kp, 0.06)); if (q <= 0) return;
      const h = (L.VB - L.VT - 6) * k.vol / VMAX * q;                   // 按最大量归一，量柱不顶到价格区
      c.fillStyle = k.c >= k.o ? 'rgba(227,18,11,.35)' : 'rgba(27,158,90,.35)'; c.fillRect(L.xs[i] - 15, L.VB - h, 30, h); });
    // 右上价格：跟着「最新出现的那根」滚动；涨跌色 = 相对区间起点
    let n = 0; for (let i = 0; i < 20; i++) if (MO.lagged(i, 20, kp, 0.06) > 0) n = i;
    const qn = MO.quintOut(MO.lagged(n, 20, kp, 0.06)), v = lt < 0.2 ? 242 : lerp(KL[n].o, KL[n].c, qn), pct = (v / 242 - 1) * 100;
    c.save(); c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.font = `700 76px ${NUM}`; c.fillStyle = pct >= 0 ? COL.up : COL.down;
    TY.tabular(c, '¥' + v.toFixed(2), W - 80, 150, { align: 'right' });
    c.font = `700 40px ${NUM}`; TY.tabular(c, (pct >= 0 ? '▲ +' : '▼ ') + pct.toFixed(1) + '%', W - 80, 205, { align: 'right' }); c.restore();
    // 起点参考虚线 + 区间涨幅括注
    const rp = MO.quintOut(MO.seg(lt, 1.35, 1.75));               // 1.75s 落定，停 0.75s 给人读
    if (rp > 0) { const y = L.yS(242); c.save(); c.setLineDash([10, 8]); c.strokeStyle = COL.sub; c.lineWidth = 2; c.beginPath(); c.moveTo(L.xs[0], y); c.lineTo(lerp(L.xs[0], L.xs[19] + 60, rp), y); c.stroke(); c.setLineDash([]);
      const x = L.xs[19] + 60, yt = L.yS(286.4); c.strokeStyle = COL.up; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, lerp(y, yt, rp)); c.stroke();
      c.globalAlpha = MO.seg(lt, 1.5, 1.8); c.font = `700 40px ${NUM}`; c.fillStyle = COL.up; c.fillText('+18.3%', x + 14, (y + yt) / 2 + 14);
      c.font = `400 26px ${CN}`; c.fillStyle = COL.sub; c.textAlign = 'right'; c.fillText('区间起点 ¥242', x - 14, y + 32); c.restore(); }
    c.restore();
  },
};
})();
