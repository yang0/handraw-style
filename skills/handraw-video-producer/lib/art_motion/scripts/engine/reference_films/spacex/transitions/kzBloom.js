// 【Kurzgesagt】kzBloom 光铺满画面：一团暖光（辉光芯 #F9EF93）从 (o.cx, o.cy) 长大，前半程铺满成白场，后半程退开，新世界从 1.1 倍落回 1。
//   Kurzgesagt 的转场 4「用画面里的光源做白场，约 0.5s」；用在从别的风格进入 Kurzgesagt 段：光一退，就是深靛底上的发光世界。
TRANSITIONS.kzBloom = (c, A, B, p, o) => {
  const W = o.W || 1920, H = o.H || 1080, cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, k = o.peak ?? 0.48;
  const veil = (a) => { if (a <= 0) return; c.save(); c.globalAlpha = Math.min(1, a); c.fillStyle = '#FFF8DC'; c.fillRect(0, 0, W, H); c.restore(); };
  if (p < k) {
    const q = p / k, s = 1 + 0.06 * q * q;
    c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); c.drawImage(A, 0, 0); c.restore();
    const r = 40 + Math.pow(q, 2.1) * 2500;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,253,240,0.85)'); g.addColorStop(0.3, 'rgba(249,239,147,0.7)'); g.addColorStop(0.62, 'rgba(250,204,18,0.55)'); g.addColorStop(1, 'rgba(244,131,1,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    veil(MO.smooth(Math.max(0, (q - 0.55) / 0.45)) * 0.5);   // 白场上限 0.95→0.5：前后都是深色，满屏闪白太刺眼
  } else {
    const q = (p - k) / (1 - k), e = MO.k75(q), s = 1.1 - 0.1 * e;
    c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); c.drawImage(B, 0, 0); c.restore();
    const r = 2600 * (1 - e) + 60;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,253,240,${0.9 * (1 - e)})`); g.addColorStop(0.5, `rgba(249,239,147,${0.6 * (1 - e)})`); g.addColorStop(1, 'rgba(250,204,18,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    veil(Math.pow(1 - q, 2.2) * 0.5);
  }
};
