// y5 本片共用：节拍网格、配色、字号阶梯、拍点微冲、进度轨（全片唯一连续的叙事锚）、背景点阵。
// 一切「落点」都写成拍号：b(4) = 第 4 拍 = 2.0s。120 BPM：一拍 0.5s，八分 0.25s。
// 用到的库：TY（slam 砸入、rise 遮罩升起、keyword 关键词强调、marker 荧光笔、underline）、CAM（with、drift）、MO（springHz、拍号）。
(() => {
const { clamp, lerp } = U;
window.BPM = 120;
const K = window.KT = {};
K.b = n => MO.beat(n, 120);                           // 拍 → 秒
const C0 = K.C = { ink: '#111111', paper: '#F4EFE6', yellow: '#FFD23F', coral: '#FF5A36', navy: '#14213D', blue: '#3A86FF', green: '#2BB673', white: '#FFFFFF', code: '#1B1D29' };
// 字号阶梯：主词 : 辅句 : 标签 ≈ 3.4 : 1 : 0.4（主词必须一眼读完，辅句给耳朵对位）
K.SZ = { hero: 340, sub: 96, label: 40 };
// 拍点微冲：每个四分拍让画面放大 1.2%，0.12s 衰减（e^-25t）——画面跟着鼓「呼吸」
K.bump = t => { const ph = t % 0.5; return 1 + 0.012 * Math.exp(-ph * 25); };
// 背景点阵：斜向缓慢平移 36px/s（持续运动，低对比 8%，不和字抢）
K.dots = (c, t, col, alpha = 0.1) => {
  const g = 64, ox = (t * 36) % g, oy = (t * 18) % g;
  c.save(); c.globalAlpha = alpha; c.fillStyle = col;
  for (let y = -g; y < 1080 + g; y += g) for (let x = -g; x < 1920 + g; x += g) { c.beginPath(); c.arc(x + ox, y + oy, 4, 0, Math.PI * 2); c.fill(); }
  c.restore();
};
// 进度轨：右上三格，画在固定层（GLOBAL_OVERLAY），不跟页面一起被推走（返修：第一版画在各段里，推页时跟着跳）。
// 颜色在转场「揭开」那一帧换（2.0 / 4.0 / 6.0s），亮格同一帧点亮。
K.STAGES = [2.0, 4.0, 6.0];
K.trackCol = t => t < 4.0 ? [C0.white, 'rgba(255,255,255,0.35)'] : t < 6.0 ? [C0.yellow, 'rgba(255,255,255,0.25)'] : [C0.coral, 'rgba(17,17,17,0.18)'];
window.GLOBAL_OVERLAY = (c, t) => {
  if (t < 2.0) return;
  const [col, dim] = K.trackCol(t), a = MO.expoOut(clamp((t - 2.0) / 0.3));
  c.save(); c.globalAlpha = a;
  for (let i = 0; i < 3; i++) {
    const x = 1520 + i * 120, y = 92, on = t >= K.STAGES[i], fill = on ? MO.expoOut(clamp((t - K.STAGES[i]) / 0.3)) : 0;
    c.fillStyle = dim; c.fillRect(x, y, 100, 10); c.fillStyle = col; c.fillRect(x, y, 100 * fill, 10);
    TY.text(c, '0' + (i + 1), x, y - 18, { size: 30, fam: 'PuHui-Bold', color: on ? col : dim, align: 'left', track: 2 });
  }
  c.restore();
};
// 背景巨型阶段数字（900px、低对比、斜向慢漂）：数字是章节的主角之一，但不和主词抢（返修：审片说 01/02/03 太小，退成了装饰）
K.bigNum = (c, t, s, t0, x, y, col) => {
  const lt = t - t0; if (lt < 0) return;
  const k = MO.springHz(lt, 2.0, 8), sc = lerp(1.35, 1, k);
  TY.text(c, s, x + lt * 14, y - lt * 10, { size: 900, fam: 'PuHui-Black', align: 'right', color: col, scale: sc, alpha: clamp(lt / 0.08), ox: x - 250, oy: y - 320 });
};
// 关键词：先从槽里升起，到「强调拍」再放大 1.35 倍并钉住，荧光笔跟着放大（TY.keyword / TY.keywordMarker）
K.key = TY.keyword;
K.keyMarker = TY.keywordMarker;
// 主词「砸」进来：从 1.7 倍缩到 1（弹簧 2.2Hz/10，过冲 ≈8%），前 0.06s 透明→不透明（TY.slam）
K.slam = (c, s, x, y, t, t0, o = {}) => TY.slam(c, s, x, y, t - t0, { size: K.SZ.hero, ...o });
// 镜头：微漂＋极慢旋转（±0.5°）＋拍点微冲
K.cam = (c, t, fn, extra = {}) => {
  const [dx, dy] = CAM.drift(t, 5, 2);
  CAM.with(c, { x: 960 + dx + (extra.x || 0), y: 540 + dy + (extra.y || 0), z: K.bump(t) * (extra.zoom || 1), r: 0.009 * Math.sin(t * 0.8) + (extra.rot || 0) }, fn);
};
})();
