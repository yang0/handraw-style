// 卡片翻面（S10 浮世绘 → S11讲解员式财经讲解）：上一段整幅画退远成一张纸卡，绕竖轴翻过去，
// 背面就是米白信息页，翻完卡片回到满屏。透视按竖条切片：每条按深度（相机距离 d）缩放高度，过 90° 换面。
// 参数：o.bg 翻卡时露出的底色（默认 S11 的米白）。p=0 与旧画面、p=1 与新画面逐像素一致。
(() => {
const W = 1920, H = 1080;
TRANSITIONS.cardFlip = (c, A, B, p, o) => {
  const e = MO.cubicInOut(U.clamp(p)), ang = e * Math.PI;
  const s = 1 - 0.24 * Math.sin(Math.PI * e);                 // 翻的时候卡片退远
  const front = ang < Math.PI / 2, img = front ? A : B, a = front ? ang : ang - Math.PI;
  const cs = Math.cos(a), sn = Math.sin(a), d = 2600, N = 120, sw = W / N;
  c.fillStyle = o.bg || '#F7F0E1'; c.fillRect(0, 0, W, H);
  const proj = u => { const f = d / (d + u * sn); return [W / 2 + u * cs * f * s, f]; };
  const [xl, fl] = proj(-W / 2), [xr, fr] = proj(W / 2);
  const k = Math.sin(Math.PI * e);                            // 卡片边、影子只在翻的过程中出现
  if (k < 0.002) { c.drawImage(img, 0, 0); return; }         // 两端不切片，免得重采样发虚
  if (k > 0.001) {                                         // 落在纸面上的软影
    c.save(); c.globalAlpha = 0.16 * k; c.fillStyle = '#2B2A33';
    c.beginPath(); c.moveTo(xl + 14, H / 2 - H * fl * s / 2 + 22); c.lineTo(xr + 14, H / 2 - H * fr * s / 2 + 22);
    c.lineTo(xr + 14, H / 2 + H * fr * s / 2 + 22); c.lineTo(xl + 14, H / 2 + H * fl * s / 2 + 22); c.closePath(); c.fill(); c.restore();
  }
  for (let i = 0; i < N; i++) {
    const [x0, f0] = proj(-W / 2 + i * sw), [x1, f1] = proj(-W / 2 + (i + 1) * sw);
    const h = H * (f0 + f1) / 2 * s, lo = Math.min(x0, x1), w = Math.abs(x1 - x0) + 0.8;
    if (w < 0.85) continue;
    c.drawImage(img, i * sw, 0, sw, H, lo, H / 2 - h / 2, w, h);
  }
  if (k > 0.001) {                                            // 纸卡描边（扁平信息图的深色线）
    c.save(); c.globalAlpha = k; c.strokeStyle = '#2B2A33'; c.lineWidth = 5; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(xl, H / 2 - H * fl * s / 2); c.lineTo(xr, H / 2 - H * fr * s / 2);
    c.lineTo(xr, H / 2 + H * fr * s / 2); c.lineTo(xl, H / 2 + H * fl * s / 2); c.closePath(); c.stroke(); c.restore();
  }
};
})();
