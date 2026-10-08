// paperSlide 白纸推入：一张白板纸从右边滑进来盖住上一页（带左缘投影、微微回正的 1.2° 倾角），纸到位＝白板段开始。
// 给「色块页 → 白板手绘」用：白板的签名是「一张白纸」，所以转场就是纸本身进场。揭开点 ≈ p 0.6（纸盖住 90%）。
(() => {
const { clamp } = U;
TRANSITIONS.paperSlide = (c, A, B, p, o) => {
  const W = o.W, H = o.H, e = MO.cubicInOut(clamp(p)), x = W * (1 - e) * 1.03, rot = 0.021 * (1 - e);
  c.drawImage(A, 0, 0);
  c.fillStyle = `rgba(0,0,0,${0.18 * e})`; c.fillRect(0, 0, W, H);                // 旧页被纸盖住前稍微压暗
  c.save(); c.translate(x, 0); c.rotate(rot);
  const g = c.createLinearGradient(-60, 0, 0, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
  c.fillStyle = g; c.fillRect(-60, -40, 60, H + 80);                                   // 纸的左缘投影
  c.drawImage(B, 0, 0); c.fillStyle = '#FBFBFB'; c.fillRect(0, H, W, 80); c.fillRect(0, -80, W, 80);   // 倾斜时上下补纸边
  c.restore();
};
})();
