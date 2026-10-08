// 讲解员版（lin）的翻页转场：讲解员和顶栏画在全片叠加层，不参与转场——换的只是「这一页」。
// 一个文件注册四种（eras_lin.js 的 SCENE_LIBS 里先加载它）：
//   lin_page  = lin_slide 的别名（按文件名自动加载的入口）
//   lin_slide 整页推走：o.dir 'left'（默认）/ 'up' / 'right'；新页边缘带一条纸卡投影
//   lin_iris  圆形扩张揭开：o.x, o.y 圆心（画面坐标），o.col 圆边彩带色
//   lin_wipe  斜向彩色色带扫过：o.cols 色带颜色（2–3 条），o.dir 1 从左往右 / -1 从右往左
//   lin_flip  纸卡绕竖轴翻面（退远→翻→回满屏），o.bg 翻卡时露出的底色
// p=0 与旧画面、p=1 与新画面逐像素一致。
(() => {
const W = 1920, H = 1080, INK = '#2B2A33';
const cl = x => Math.max(0, Math.min(1, x));
const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

TRANSITIONS.lin_slide = (c, A, B, p, o) => {
  if (p <= 0) { c.drawImage(A, 0, 0); return; } if (p >= 1) { c.drawImage(B, 0, 0); return; }
  const e = ease(cl(p)), dir = o.dir || 'left';
  const [dx, dy] = dir === 'up' ? [0, -H] : dir === 'right' ? [W, 0] : [-W, 0];
  const ax = dx * e, ay = dy * e, bx = ax - dx, by = ay - dy;
  c.drawImage(A, ax, ay);
  c.save(); c.fillStyle = 'rgba(43,42,51,0.16)';                       // 新页压在旧页上的投影
  if (dir === 'up') c.fillRect(0, by - 14, W, 14); else if (dir === 'right') c.fillRect(bx + W, 0, 18, H); else c.fillRect(bx - 18, 0, 18, H);
  c.restore();
  c.drawImage(B, bx, by);
};
TRANSITIONS.lin_page = TRANSITIONS.lin_slide;

TRANSITIONS.lin_iris = (c, A, B, p, o) => {
  if (p <= 0) { c.drawImage(A, 0, 0); return; } if (p >= 1) { c.drawImage(B, 0, 0); return; }
  const x = o.x ?? W / 2, y = o.y ?? H / 2, Rmax = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 60;
  const e = p < 0.5 ? 0.5 * Math.pow(2 * p, 2.2) : 1 - 0.5 * Math.pow(2 - 2 * p, 1.6), R = Rmax * e, band = 34 * (1 - e * 0.4);
  c.drawImage(A, 0, 0);
  c.save(); c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
  c.save(); c.lineWidth = band; c.strokeStyle = o.col || '#FFD447'; c.beginPath(); c.arc(x, y, R + band / 2, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 5; c.strokeStyle = INK; c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x, y, R + band, 0, Math.PI * 2); c.stroke(); c.restore();
};

TRANSITIONS.lin_wipe = (c, A, B, p, o) => {
  if (p <= 0) { c.drawImage(A, 0, 0); return; } if (p >= 1) { c.drawImage(B, 0, 0); return; }
  const cols = o.cols || ['#FFD447', '#4C8DF6'], d = o.dir || 1, sl = 420, bw = 150, n = cols.length;
  const span = W + sl + bw * n + 40, e = ease(cl(p)), lead = -sl - bw * n + span * e;   // 最前一条色带的左边（从左往右）
  const quad = (x0, x1) => { c.beginPath(); c.moveTo(x0 + sl, 0); c.lineTo(x1 + sl, 0); c.lineTo(x1, H); c.lineTo(x0, H); c.closePath(); };
  const flip = d < 0;
  c.save(); if (flip) { c.translate(W, 0); c.scale(-1, 1); }
  // 新页：色带后面
  c.save(); c.beginPath(); c.moveTo(-sl - 10, 0); c.lineTo(lead + sl, 0); c.lineTo(lead, H); c.lineTo(-sl - 10, H); c.closePath(); c.clip();
  if (flip) { c.translate(W, 0); c.scale(-1, 1); } c.drawImage(B, 0, 0); c.restore();
  c.save(); c.beginPath(); c.moveTo(lead + bw * n + sl, 0); c.lineTo(W + sl + 10, 0); c.lineTo(W + sl + 10, H); c.lineTo(lead + bw * n, H); c.closePath(); c.clip();
  if (flip) { c.translate(W, 0); c.scale(-1, 1); } c.drawImage(A, 0, 0); c.restore();
  for (let i = 0; i < n; i++) { const x0 = lead + i * bw; quad(x0, x0 + bw); c.fillStyle = cols[n - 1 - i]; c.fill(); c.lineWidth = 5; c.strokeStyle = INK; c.stroke(); }
  c.restore();
};

// lin_zoom 推镜穿过：旧页以 (o.x,o.y) 为中心放大淡出，新页从 0.86 倍放大到满屏淡入（讲解员与顶栏不动）
TRANSITIONS.lin_zoom = (c, A, B, p, o) => {
  if (p <= 0) { c.drawImage(A, 0, 0); return; } if (p >= 1) { c.drawImage(B, 0, 0); return; }
  const e = ease(cl(p)), x = o.x ?? W / 2, y = o.y ?? H / 2;
  c.fillStyle = o.bg || '#F8F2E6'; c.fillRect(0, 0, W, H);
  const za = 1 + 2.2 * e, zb = 0.86 + 0.14 * e;
  c.save(); c.globalAlpha = 1 - cl(e * 1.6); c.translate(x, y); c.scale(za, za); c.translate(-x, -y); c.drawImage(A, 0, 0); c.restore();
  c.save(); c.globalAlpha = cl((e - 0.25) / 0.6); c.translate(W / 2, H / 2); c.scale(zb, zb); c.translate(-W / 2, -H / 2); c.drawImage(B, 0, 0); c.restore();
};
TRANSITIONS.lin_flip = (c, A, B, p, o) => {
  if (p <= 0) { c.drawImage(A, 0, 0); return; } if (p >= 1) { c.drawImage(B, 0, 0); return; }
  const e = ease(cl(p)), ang = e * Math.PI, s = 1 - 0.24 * Math.sin(Math.PI * e);
  const front = ang < Math.PI / 2, img = front ? A : B, a = front ? ang : ang - Math.PI;
  const cs = Math.cos(a), sn = Math.sin(a), dist = 2600, N = 120, sw = W / N;
  c.fillStyle = o.bg || '#F8F2E6'; c.fillRect(0, 0, W, H);
  const proj = u => { const f = dist / (dist + u * sn); return [W / 2 + u * cs * f * s, f]; };
  const [xl, fl] = proj(-W / 2), [xr, fr] = proj(W / 2), k = Math.sin(Math.PI * e);
  c.save(); c.globalAlpha = 0.16 * k; c.fillStyle = INK;
  c.beginPath(); c.moveTo(xl + 14, H / 2 - H * fl * s / 2 + 22); c.lineTo(xr + 14, H / 2 - H * fr * s / 2 + 22); c.lineTo(xr + 14, H / 2 + H * fr * s / 2 + 22); c.lineTo(xl + 14, H / 2 + H * fl * s / 2 + 22); c.closePath(); c.fill(); c.restore();
  for (let i = 0; i < N; i++) {
    const [x0, f0] = proj(-W / 2 + i * sw), [x1, f1] = proj(-W / 2 + (i + 1) * sw);
    const h = H * (f0 + f1) / 2 * s, lo = Math.min(x0, x1), w = Math.abs(x1 - x0) + 0.8;
    if (w < 0.85) continue;
    c.drawImage(img, i * sw, 0, sw, H, lo, H / 2 - h / 2, w, h);
  }
  c.save(); c.globalAlpha = k; c.strokeStyle = INK; c.lineWidth = 5; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(xl, H / 2 - H * fl * s / 2); c.lineTo(xr, H / 2 - H * fr * s / 2); c.lineTo(xr, H / 2 + H * fr * s / 2); c.lineTo(xl, H / 2 + H * fl * s / 2); c.closePath(); c.stroke(); c.restore();
};
})();
