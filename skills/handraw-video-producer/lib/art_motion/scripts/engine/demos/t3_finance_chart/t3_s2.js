// t3 · 镜头 2（2.7s，开头 0.5s 是面板横推转场）：股价折线。网格先出 → 折线按时间从左画到右（头部圆点＋价格跟随）→
// 画过 2023 年 3 月时弹出事件标注（一镜只标一件事） → 相机缓慢推向最新一个点；转场期间继续推近（矢量重画），穿进 K 线镜头。
(() => {
const { clamp, lerp } = U;
const W = 1920, H = 1080;
const DUR = 2.7;
SCENES['t3_s2'] = {
  draw(c, lt) {
    const { COL, CN, NUM, F, PRICE, frame } = T3;
    const yS = CH.lin(0, 300, F.y + F.h, F.y), xm = m => F.x + m / 59 * (F.w - 220);
    const pts = PRICE.map((v, m) => [xm(m), yS(v)]);
    const P = pts[59];
    // 相机：镜头内 1 → 1.05，转场期间（lt > DUR）指数推近到 ×6，始终绕最新点（屏幕位置不动）
    const tr = ERAS.find(e => e.id === 't3_s3').transition;
    const z = lt <= DUR ? lerp(1, 1.05, MO.smooth(lt / DUR)) : 1.05 * Math.pow(tr.zoom / 1.05, MO.smooth(clamp((lt - DUR) / tr.dur)));
    c.fillStyle = COL.bg; c.fillRect(0, 0, W, H);
    c.save(); c.translate(P[0], P[1]); c.scale(z, z); c.translate(-P[0], -P[1]);
    frame(c, lt, { title: '股价：先跌后涨，五年涨到原来的 7.5 倍', sub: '月收盘价，元' });
    CH.grid(c, F, [0, 100, 200, 300], yS, MO.seg(lt, 0.2, 0.75), { col: COL.grid, zeroCol: COL.ink, font: `400 30px ${NUM}`, labelCol: '#5b666b', side: 'right', lw: 1.5, zeroLw: 3 });
    CH.xLabels(c, [2021, 2022, 2023, 2024, 2025].map((y, i) => ({ x: xm(i * 12 + 5.5), label: String(y) })), F.y + F.h + 50, MO.seg(lt, 0.3, 0.8), { font: `400 32px ${NUM}`, col: '#3a4246' });
    // 年份分隔短刻度
    c.save(); c.strokeStyle = 'rgba(12,12,12,.35)'; c.lineWidth = 2; c.globalAlpha = MO.seg(lt, 0.3, 0.6);
    for (let y = 1; y < 5; y++) { const x = xm(y * 12 - 0.5); c.beginPath(); c.moveTo(x, F.y + F.h); c.lineTo(x, F.y + F.h + 14); c.stroke(); } c.restore();
    // 折线：0.45–1.95s 按时间画出（smooth：起步和落定都慢，最后一个价格「落」在点上）
    const lp = MO.smooth(MO.seg(lt, 0.45, 1.95));
    const hp = CH.line(c, pts, lp, { col: COL.red, lw: 5, headR: 9, area: { top: F.y, base: F.y + F.h, c0: 'rgba(227,18,11,0.14)', c1: 'rgba(227,18,11,0)' } });
    if (hp) {                                                            // 价格标签跟着头走（等宽数字，不抖）
      const v = yS.inv(hp[1]);
      c.save(); c.globalAlpha = 1 - clamp((lt - DUR) / 0.2);           // 推进转场一开始就收掉，免得和下一镜右上的价格叠影
      c.font = `700 38px ${NUM}`; c.fillStyle = COL.red; c.textAlign = 'left'; c.textBaseline = 'middle';
      TY.tabular(c, '¥' + v.toFixed(0), hp[0] + 22, hp[1] - 4); c.restore();
    }
    // 事件标注：线头经过 2023 年 3 月（第 26 个月）时触发
    const m26 = xm(26), tHit = 0.45 + 1.5 * invSmooth((m26 - pts[0][0]) / (pts[59][0] - pts[0][0]));
    CH.callout(c, lt, tHit, { x: m26, y: pts[26][1], tx: m26 - 30, ty: pts[26][1] - 150, lines: ['2023.3', '发布自研大模型'], col: COL.ink, dotCol: COL.ink,
      font: `700 34px ${NUM}`, font2: `400 30px ${CN}`, align: 'right', r: 8 });
    c.restore();
  },
};
// smooth 的反函数（二分），用于「线头到达某个 x 的时刻」
function invSmooth(y) { let a = 0, b = 1; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (MO.smooth(m) < y) a = m; else b = m; } return (a + b) / 2; }
})();
