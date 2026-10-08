// t1 · 镜头 3（2.6s，前 0.75s 是「镜头穿进隐藏层神经元」转场）：
// 神经元内部 = 它连向 100 个像素的权重图（蓝正红负，长得像猫脸）→ 像素图滑进来叠上去（逐格相乘）→ 100 格收拢成一个数 →
// σ 压到 0.95（= 镜头 2 里它的亮度）→ 「像猫脸」；最后 0.6s 停住给观众读。3b1b 原片讲隐藏层也是这样把权重画成图。
(() => {
const { clamp, lerp } = U;
const C = DG.MANIM;
const WG = { cx: 640, cy: 585, cell: 44 };
const cxy = (g, i) => [g.cx + ((i % 10) - 4.5) * g.cell, g.cy + (((i / 10) | 0) - 4.5) * g.cell];
const wcol = (w, a = 1) => DG.rgba(w >= 0 ? C.BLUE_C : C.RED_C, clamp(Math.abs(w)) * a);
const NEU = { x: 1460, y: 585, r: 78 };
SCENES['t1_s3'] = {
  draw(c, lt) {
    const T = window.T1;
    c.fillStyle = '#000'; c.fillRect(0, 0, 1920, 1080);
    DG.write(c, '这个神经元在找什么？', 960, 135, 58, MO.seg(lt, 0.75, 1.5));
    const appear = MO.seg(lt, 0.0, 0.7), slideIn = MO.seg(lt, 0.7, 0.95), merge = MO.seg(lt, 0.95, 1.3), collapse = MO.seg(lt, 1.35, 1.75);
    // ---- 权重图 ----
    for (let i = 0; i < 100; i++) {
      const [x, y] = cxy(WG, i), w = T.WTS[i], v = T.PIX[i];
      const qa = MO.smooth(MO.lagged(i, 100, appear, 0.008)); if (qa <= 0) continue;
      const qm = MO.smooth(merge), qc = MO.smooth(MO.lagged(i, 100, collapse, 0.008));
      // 相乘后的颜色：w·a（只有猫形处的亮像素还亮着蓝，背景被乘成接近 0）
      const prod = w * (v > 0 ? v : 0.06);
      const fill = DG.mix(DG.mixA(w >= 0 ? C.BLUE_C : C.RED_C, '#000000', 1 - clamp(Math.abs(w))), DG.mixA(prod >= 0 ? C.BLUE_C : C.RED_C, '#000000', 1 - clamp(Math.abs(prod) * 1.3)), qm);
      const s = WG.cell * lerp(0.94, 0.3, qc) * qa;
      const px = lerp(x, NEU.x, qc), py = lerp(y, NEU.y, qc);
      if (qc > 0) { const g = 0.28 * MO.smooth(clamp(qc * 1.5)), gs = WG.cell * 0.94;      // 收拢后原位留一张淡的权重图（它在找的图案）
        c.save(); c.globalAlpha = g; c.fillStyle = DG.mix(w >= 0 ? C.BLUE_C : C.RED_C, '#000000', 1 - clamp(Math.abs(w))); c.fillRect(x - gs / 2, y - gs / 2, gs, gs); c.restore(); }
      c.save(); c.globalAlpha = 1 - clamp((qc - 0.75) / 0.25);
      c.fillStyle = fill; c.fillRect(px - s / 2, py - s / 2, s, s);
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; c.strokeRect(px - s / 2, py - s / 2, s, s); c.restore();
    }
    // 说明（FadeIn shift=UP），合并时淡出
    const la = MO.smooth(MO.seg(lt, 0.75, 1.1));                    // 图例留到片尾（相乘后还要靠它读颜色）
    if (la > 0) { c.save(); c.globalAlpha = la; c.font = `600 34px "${DG.FONT.zh}"`; c.textAlign = 'center';
      c.fillStyle = C.BLUE_C; c.fillText('蓝 = 希望这里亮', WG.cx - 120, 885 + 20 * (1 - la)); c.fillStyle = C.RED_C; c.fillText('红 = 希望这里暗', WG.cx + 150, 885 + 20 * (1 - la)); c.restore(); }
    // ---- 像素图：从右边 FadeIn，再整体移到权重图上（Transform 位置），叠上后淡出成「相乘」 ----
    if (slideIn > 0 && merge < 1) {
      const qs = MO.smooth(slideIn), qm = MO.smooth(merge);
      const gx = lerp(lerp(1340, 1290, qs), WG.cx, qm);
      for (let i = 0; i < 100; i++) {
        const v = T.PIX[i], x = gx + ((i % 10) - 4.5) * WG.cell, y = WG.cy + (((i / 10) | 0) - 4.5) * WG.cell, s = WG.cell * 0.94;
        c.save(); c.globalAlpha = qs * (1 - qm * 0.9); c.fillStyle = `rgba(255,255,255,${v})`; c.fillRect(x - s / 2, y - s / 2, s, s);
        c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.strokeRect(x - s / 2, y - s / 2, s, s); c.restore();
      }
      c.save(); c.globalAlpha = qs * (1 - qm); c.font = `64px "${DG.FONT.rm}"`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('×', (WG.cx + 5 * WG.cell + gx - 5 * WG.cell) / 2, WG.cy + 22); c.restore();
    }
    // ---- 收拢成一个神经元：加权求和 → σ → 0.92 ----
    const nq = MO.smooth(MO.seg(lt, 1.3, 1.6));
    if (nq > 0) {
      const fillA = 0.95 * MO.smooth(MO.seg(lt, 1.65, 2.0));          // = 镜头 2 里它的激活值 0.95
      const ind = DG.indicate(MO.seg(lt, 1.9, 2.3));
      c.save(); c.translate(NEU.x, NEU.y); c.scale(ind.s, ind.s); c.translate(-NEU.x, -NEU.y); c.globalAlpha = nq;
      DG.neuron(c, NEU.x, NEU.y, NEU.r * (0.6 + 0.4 * nq), fillA, { lw: 3, stroke: DG.mix('#ffffff', C.YELLOW, ind.k) });
      c.restore();
      c.save(); c.globalAlpha = nq; c.textAlign = 'center';
      c.font = `600 52px "${DG.FONT.zh}"`; c.fillStyle = DG.mix('#ffffff', C.YELLOW, ind.k); c.fillText('像猫脸', NEU.x, NEU.y - NEU.r - 34);
      c.font = `48px "${DG.FONT.rm}"`; c.fillStyle = C.GREY_A; c.fillText(TY.fmt(fillA, 2), NEU.x, NEU.y + NEU.r + 62);
      c.restore();
    }
    DG.math(c, [{ s: 'σ', it: true }, { s: '(', gap: 4 }, { s: 'Σ', gap: 6 }, { s: 'w', it: true, col: C.BLUE_C, sub: 'i', gap: 2 }, { s: 'a', it: true, col: C.YELLOW, sub: 'i', gap: 12 },
      { s: '+', gap: 12 }, { s: 'b', it: true }, { s: ')', gap: 14 }, { s: '=', gap: 14 }, { s: TY.fmt(0.95 * MO.smooth(MO.seg(lt, 1.65, 2.0)), 2) }], 1180, 965, 54, { p: MO.seg(lt, 1.45, 1.95) });
  },
};
})();
