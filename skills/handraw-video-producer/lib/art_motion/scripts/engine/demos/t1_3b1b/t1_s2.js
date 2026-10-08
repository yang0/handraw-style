// t1 · 镜头 2（2.8s）：一层网络。连线按权重着色（蓝正红负、线宽 ∝ |w|³）逐条画出 → 公式 Write →
// 黄色信号沿连线闪过（ShowPassingFlash）→ 隐藏层按激活值变亮 → 输出层「猫」最亮 → Indicate → 激活 0.95 的隐藏神经元描边染黄，镜头推进它。
// 开头一帧与镜头 1 的最后一帧逐像素相同（Transform 接续，没有切）。
(() => {
const { clamp, lerp } = U;
const C = DG.MANIM;
const DUR = 2.8;
const CAM_END = { x: 1000, y: 500, z: 1.1 };
const TGT = { k: 2 };                                  // 要推进去看的隐藏层神经元（激活 0.95 的那个）
const camAt = lt => {
  if (lt <= DUR) { const k = MO.smooth(clamp(lt / DUR)); return { x: lerp(960, CAM_END.x, k), y: lerp(540, CAM_END.y, k), z: lerp(1, CAM_END.z, k) }; }
  // 转场期间（lt>时长）：绕目标神经元的屏幕位置继续推相机，矢量重画；与 eras.js 里 zoomThrough 的 dur/zoom 一致
  const T = window.T1, wx = T.HID_X, wy = T.hidY(TGT.k);
  const tr = ERAS.find(e => e.id === 't1_s3').transition, e = MO.smooth(clamp((lt - DUR) / tr.dur));
  return CAM.pushTo(CAM_END, wx, wy, CAM_END.z * tr.zoom, e, 0);                // k=0：目标在屏幕上原地不动，只放大
};
SCENES['t1_s2'] = {
  camAt,
  draw(c, lt) {
    const T = window.T1;
    c.fillStyle = '#000'; c.fillRect(0, 0, 1920, 1080);
    const cam = camAt(lt);
    CAM.with(c, cam, (c) => {
      const inE = T.VIS.map((pi, j) => [T.IN_X, T.inY(j)]);
      const hid = Array.from({ length: T.HID_N }, (_, k) => [T.HID_X, T.hidY(k)]);
      // ---- 连线：ShowCreation，LaggedStart lag 0.006 ----
      const e1p = MO.seg(lt, 0.15, 0.95), e2p = MO.seg(lt, 0.55, 1.05);
      const n1 = inE.length * hid.length;
      inE.forEach((a, j) => hid.forEach((b, k) => {
        const i = j * hid.length + k, q = MO.smooth(MO.lagged(i, n1, e1p, 0.006));
        DG.edge(c, DG.edgeEnds(a[0], a[1], T.IN_R, b[0], b[1], T.HID_R), T.W1(j, k), q, { alpha: 0.7, maxW: 3 });
      }));
      hid.forEach((a, k) => T.OUT.forEach((o, m) => {
        const q = MO.smooth(MO.lagged(k * 3 + m, 30, e2p, 0.02));
        DG.edge(c, DG.edgeEnds(a[0], a[1], T.HID_R, T.OUT_X, o.y, T.OUT_R), T.W2(k, m), q, { alpha: 0.8, maxW: 3.4 });
      }));
      // ---- 信号：连线复制一份染黄、线宽 ×1.5，ShowPassingFlash（time_width 2），按输入行错开 ----
      const f1 = MO.seg(lt, 0.95, 1.75);
      if (f1 > 0 && f1 < 1) inE.forEach((a, j) => { if (T.PIX[T.VIS[j]] < 0.3) return; hid.forEach((b, k) => {
        const q = MO.smooth(MO.lagged(j, 16, f1, 0.04)); const [lo, hi] = DG.flash(q); if (hi <= lo) return;
        const e = DG.edgeEnds(a[0], a[1], T.IN_R, b[0], b[1], T.HID_R);
        c.save(); c.strokeStyle = C.YELLOW; c.globalAlpha = 0.85; c.lineWidth = 3; c.beginPath(); c.moveTo(lerp(e[0], e[2], lo), lerp(e[1], e[3], lo)); c.lineTo(lerp(e[0], e[2], hi), lerp(e[1], e[3], hi)); c.stroke(); c.restore();
      }); });
      const f2 = MO.seg(lt, 1.6, 2.25);
      if (f2 > 0 && f2 < 1) hid.forEach((a, k) => { if (T.HID_A[k] < 0.4) return; T.OUT.forEach((o, m) => {
        const q = MO.smooth(MO.lagged(k, 10, f2, 0.05)); const [lo, hi] = DG.flash(q); if (hi <= lo) return;
        const e = DG.edgeEnds(a[0], a[1], T.HID_R, T.OUT_X, o.y, T.OUT_R);
        c.save(); c.strokeStyle = C.YELLOW; c.globalAlpha = 0.9; c.lineWidth = 4.5; c.beginPath(); c.moveTo(lerp(e[0], e[2], lo), lerp(e[1], e[3], lo)); c.lineTo(lerp(e[0], e[2], hi), lerp(e[1], e[3], hi)); c.stroke(); c.restore();
      }); });
      // ---- 神经元 ----
      T.drawInputs(c); T.drawBrace(c, 1);
      const ha = MO.seg(lt, 0.0, 0.55), hf = MO.seg(lt, 1.3, 1.95);
      const pick = MO.smooth(MO.seg(lt, 2.3, 2.6));      // 末尾：目标隐藏神经元描边染黄（「我们来看这一个」），相机随后推进去
      hid.forEach((b, k) => { const q = MO.smooth(MO.lagged(k, 10, ha, 0.05)); if (q <= 0) return;
        const hk = k === TGT.k ? pick : 0;
        c.save(); c.globalAlpha = q; DG.neuron(c, b[0] + 24 * (1 - q), b[1], T.HID_R, T.HID_A[k] * MO.smooth(MO.lagged(k, 10, hf, 0.08)), { stroke: DG.mix('#ffffff', C.YELLOW, hk), lw: 2 + 2 * hk }); c.restore(); });
      const oa = MO.seg(lt, 0.2, 0.7), of = MO.seg(lt, 1.95, 2.4);
      T.OUT.forEach((o, m) => { const q = MO.smooth(MO.lagged(m, 3, oa, 0.2)); if (q <= 0) return;
        const fill = o.a * MO.smooth(of);
        c.save(); c.globalAlpha = q; DG.neuron(c, T.OUT_X + 24 * (1 - q), o.y, T.OUT_R, fill, { lw: 2.5 });
        // 标签＋数值；「猫」Indicate：放大 1.2、染黄、回来
        const ind = m === 0 ? DG.indicate(MO.seg(lt, 2.0, 2.45)) : { s: 1, k: 0 };
        c.translate(T.OUT_X + 62, o.y + 15); c.scale(ind.s, ind.s);
        c.font = `600 46px "${DG.FONT.zh}"`; c.fillStyle = DG.mix('#ffffff', C.YELLOW, ind.k); c.textAlign = 'left'; c.fillText(o.name, 0, 0);
        if (of > 0) { c.font = `40px "${DG.FONT.rm}"`; c.fillStyle = DG.mix(C.GREY_B, C.YELLOW, ind.k); c.globalAlpha = q * clamp(of * 2); c.fillText(TY.fmt(fill, 2), 62, 0); }
        c.restore(); });
    });
    // 公式（不随相机动：屏幕固定层），颜色编码：黄=激活，蓝=权重
    const Y = C.YELLOW, B = C.BLUE_C;
    DG.math(c, [{ s: 'a', it: true, col: Y, sup: '(1)' }, { s: '=', gap: 14 }, { s: 'σ', it: true, gap: 4 }, { s: '(', gap: 6 }, { s: 'W', it: true, col: B, gap: 8 },
      { s: 'a', it: true, col: Y, sup: '(0)', gap: 14 }, { s: '+', gap: 14 }, { s: 'b', it: true }, { s: ')' }], 960, 112, 64, { p: MO.seg(lt, 0.3, 1.3) });
  },
};
})();
