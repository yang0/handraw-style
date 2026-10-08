// Y1 · Kurzgesagt 式扁平科普：「AI 是怎么学会认猫的」
// 三镜：①夜晚山坡，机器人扫描一只猫（视差 5 层、慢推） → 转场 A「钻进镜头」：相机指数推进机器人眼睛，眼睛里是下一个世界
// ②机器人脑中：像素猫 → 神经网络逐层点亮（边缘→形状→猫） → 转场 B「填满再拉出」：推进点亮的输出节点直到满屏黄，切到机器人发黄光的眼睛再指数拉远
// ③白天草坡：花叔招手，机器人认出一只没见过的黑猫，标签弹出
// 时间全部用片内时间 ft = t - F0。镜头表在 Y1.SHOTS。
// 用到的库：CAM（世界相机、视差层、对数缩放、推进锚点）、TOON（双色分面 flat、glow）、TY.charsIn（逐字上浮）、MO（k75 等缓动）。
(() => {
const W = 1920, H = 1080;
const { clamp, lerp, rng } = U;
const seg = MO.seg;
const Y1 = window.Y1 = {};
const F0 = 0;                                   // 本片在时间轴上的起点
Y1.F0 = F0;
Y1.SHOTS = { s1: [0, 2.6], s2: [2.6, 5.3], s3: [5.3, 8.0] };
const T1 = { a: 2.6, d: 1.0 }, T2 = { a: 5.3, d: 0.9 };
// 调研 §6.2：官方「其他动作用 75% influence」≈ cubic-bezier(.75,0,.25,1)；循环用 Easy Ease ≈ (.333,0,.667,1)
const K75 = MO.k75;

// ---------- 配色（夜 / 机内 / 昼 三套，Kurzgesagt 换场景＝换整套色板） ----------
const C = {
  // 色值取自调研 §7.1（2025 深色系实测）：深靛紫底＋青/橙黄/品红三个强调色
  night: { sky: ['#05020F', '#0E0631', '#2a1a6e'], star: '#F9FCFB', moon: '#FAF3CC', moonSh: '#E2C34E', hillFar: '#1a1260', hillFarHi: '#261c86', hill: '#2b1f86', hillHi: '#3a2c9e', hillSh: '#1f1668', fg: '#0E0631', grass: '#34269a' },
  mind: { bg: ['#010718', '#130C4B'], grid: 'rgba(125,211,220,.07)', line: 'rgba(95,88,219,.35)', node: '#191670', nodeHi: '#3826A3', pulse: '#32BAEE', hot: '#FACC12', label: '#7DD3DC' },
  day: { sky: ['#3fb4f5', '#8fd8ff', '#dcf6ff'], sun: '#fff1a8', cloud: '#ffffff', cloudSh: '#d6efff', hillFar: '#9ad66b', hillMid: '#6cc04d', ground: '#4ea83f', groundHi: '#66c24c', tree: '#2f8f3c', treeHi: '#4fb34f', trunk: '#8a5a3c' },
  cat: { fur: '#F48301', sh: '#BF5E07', hi: '#ffab4a', belly: '#ffe0b5', ear: '#C83C7F', eye: '#ffffff', pupil: '#0E0631' },
  bot: { shell: '#E7DFE1', sh: '#b3a6d6', hi: '#ffffff', face: '#0E0631', eye: '#32BAEE', eyeHot: '#FACC12', ant: '#BE3A95' },
};

// ---------- 扁平＋双色阴影（Kurzgesagt 的「无描边、靠色块分面」）：TOON.flat；视差层：CAM.layer ----------
const flat = TOON.flat, glow = TOON.glow, circ = TOON.circle, ell = TOON.ellipse, vgrad = TOON.vgrad, layer = CAM.layer;
Y1.flat = flat;
const poly = (pts, smooth = true) => smooth ? RIG.smooth(pts, true) : U.poly(pts);

// ---------- 角色：猫 ----------
// 原点 = 坐姿底部中心；face=-1 朝左
Y1.cat = (c, x, y, ft, { s = 1, face = -1, pal = C.cat, look = 0 } = {}) => {
  const P = pal; c.save(); c.translate(x, y); c.scale(face * -s, s);           // 本地朝左（-x 为脸）
  const br = Math.sin(ft * 2.6) * 0.012;                                       // 呼吸
  c.scale(1 - br, 1 + br);
  // 尾巴：两段贝塞尔，尖端画 8 字摆
  const tw = Math.sin(ft * 2.2) * 0.5, tw2 = Math.sin(ft * 2.2 - 0.9) * 0.6;
  const tail = new Path2D(); const tx = 120 + Math.cos(tw) * 30, ty = -150 + Math.sin(tw) * 40;
  c.lineCap = 'round'; c.strokeStyle = P.sh; c.lineWidth = 30;
  c.beginPath(); c.moveTo(70, -20); c.bezierCurveTo(150, -10, 170, -80, tx, ty); c.quadraticCurveTo(tx + 30 * Math.cos(tw2), ty - 40, tx - 10 + 30 * Math.sin(tw2), ty - 70); c.stroke();
  c.strokeStyle = P.fur; c.lineWidth = 22; c.stroke();
  // 身体：水滴形坐姿
  const body = poly([[-70, 0], [-82, -60], [-64, -140], [-20, -190], [36, -186], [74, -140], [92, -60], [86, 0]]);
  flat(c, body, P.fur, P.sh, P.hi, [-14, 12], [-5, 5]);
  flat(c, poly([[-58, -4], [-62, -70], [-40, -140], [-6, -150], [10, -100], [10, -4]]), P.belly, '#f3c99a', '#fff3e0', [-8, 8], [-3, 3]);
  // 前爪
  flat(c, ell(-38, -6, 26, 14), P.belly, '#efc392', '#fff', [-4, 4], [-2, 2]);
  flat(c, ell(12, -6, 26, 14), P.hi, P.sh, '#fff', [-4, 4], [-2, 2]);
  // 头
  c.save(); c.translate(-16, -210); c.rotate(look * 0.12 + Math.sin(ft * 1.3) * 0.03);
  const earL = poly([[-70, -30], [-82, -118], [-20, -64]], false), earR = poly([[20, -64], [64, -120], [72, -30]], false);
  flat(c, earL, P.fur, P.sh, P.hi, [-6, 6], [-2, 2]); flat(c, earR, P.fur, P.sh, P.hi, [-6, 6], [-2, 2]);
  c.fillStyle = P.ear; c.fill(poly([[-62, -44], [-72, -98], [-32, -62]], false)); c.fill(poly([[30, -62], [58, -100], [62, -44]], false));
  const head = ell(0, 0, 86, 74);
  flat(c, head, P.fur, P.sh, P.hi, [-14, 12], [-5, 5]);
  flat(c, ell(-12, 26, 46, 30), P.belly, '#f3c99a', '#fff', [-6, 6], [-2, 2]);
  // 眼：大白眼＋瞳孔看向 look 方向，眨眼
  const bl = (ft % 3.1) > 2.98 ? 0.15 : 1;
  for (const ex of [-44, 16]) {
    c.save(); c.translate(ex, -8); c.scale(1, bl);
    c.fillStyle = P.eye; c.beginPath(); c.ellipse(0, 0, 19, 23, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.pupil; c.beginPath(); c.ellipse(-6 - look * 3, 2, 11, 16, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-10 - look * 3, -5, 4.5, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  c.fillStyle = '#ff6f8a'; c.beginPath(); c.moveTo(-22, 18); c.lineTo(-6, 18); c.lineTo(-14, 28); c.closePath(); c.fill();
  // 胡须
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3;
  for (const k of [-1, 1]) { c.beginPath(); c.moveTo(-40, 26 + k * 6); c.lineTo(-104, 18 + k * 16 + Math.sin(ft * 3) * 2); c.stroke(); }
  c.restore();
  c.restore();
};

// ---------- 角色：机器人（AI） ----------
// 原点 = 头部中心；返回眼睛中心（世界坐标）
Y1.bot = (c, x, y, ft, { eye = C.bot.eye, eyeR = 34, look = 0, s = 1 } = {}) => {
  const P = C.bot; c.save(); c.translate(x, y); c.scale(s, s); c.rotate(Math.sin(ft * 1.7) * 0.04);
  // 喷射光
  const jf = 1 + Math.sin(ft * 23) * 0.08 + Math.sin(ft * 37) * 0.05;
  glow(c, 0, 128, 70 * jf, '#7df9ff', 0.55);
  c.fillStyle = '#c9fbff'; c.beginPath(); c.moveTo(-22, 96); c.quadraticCurveTo(0, 96 + 70 * jf, 22, 96); c.closePath(); c.fill();
  flat(c, (() => { const p = new Path2D(); p.roundRect(-46, 70, 92, 34, 14); return p; })(), '#d6d3fb', P.sh, P.hi, [6, 8], [2, 3]);
  // 天线
  c.strokeStyle = P.sh; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -84); c.quadraticCurveTo(8, -120, 0 + Math.sin(ft * 3) * 6, -142); c.stroke();
  const ab = 0.6 + 0.4 * Math.max(0, Math.sin(ft * 5));
  glow(c, Math.sin(ft * 3) * 6, -148, 34, P.ant, 0.6 * ab); flat(c, circ(Math.sin(ft * 3) * 6, -148, 13), P.ant, '#d84a7b', '#ffc2d6', [3, 3], [1, 1]);
  // 头壳
  const shell = new Path2D(); shell.roundRect(-118, -88, 236, 176, 64);
  flat(c, shell, P.shell, P.sh, P.hi, [16, 18], [6, 7]);
  // 侧耳
  for (const k of [-1, 1]) flat(c, (() => { const p = new Path2D(); p.roundRect(k * 118 - 14, -30, 28, 60, 12); return p; })(), '#d6d3fb', P.sh, P.hi, [4, 4], [2, 2]);
  // 屏幕脸
  const face = new Path2D(); face.roundRect(-88, -60, 176, 120, 44); c.fillStyle = P.face; c.fill(face);
  c.save(); c.clip(face); c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.ellipse(-40, -50, 90, 30, -0.3, 0, Math.PI * 2); c.fill(); c.restore();
  // 眼睛（镜头）
  const ex = look * 14, ey = 0;
  glow(c, ex, ey, eyeR * 2.6, eye, 0.55);
  const g = c.createRadialGradient(ex - eyeR * 0.25, ey - eyeR * 0.25, 0, ex, ey, eyeR); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, eye); g.addColorStop(1, eye);
  c.fillStyle = g; c.beginPath(); c.arc(ex, ey, eyeR, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(ex, ey, eyeR * 0.7, -2.4, -1.2); c.stroke();
  c.restore();
  const cs = Math.cos(Math.sin(ft * 1.7) * 0.04), sn = Math.sin(Math.sin(ft * 1.7) * 0.04);
  return [x + (ex * cs - ey * sn) * s, y + (ex * sn + ey * cs) * s, eyeR * s];
};

// ---------- 小鸟（Kurzgesagt 的签名角色：圆身、大眼、三角喙） ----------
Y1.bird = (c, x, y, ft, { s = 1, col = '#ff5d8f', sh = '#d63c70', face = 1, ph = 0 } = {}) => {
  c.save(); c.translate(x, y); c.scale(face * s, s);
  const fl = Math.sin((ft + ph) * 2 * Math.PI / 0.36);
  const wing = poly([[-6, -6], [-30, -6 - 34 * fl], [-44, -2 - 30 * fl], [-14, 8]], false);
  c.fillStyle = sh; c.fill(wing);
  flat(c, ell(0, 0, 30, 24), col, sh, '#ffa3c2', [5, 5], [2, 2]);
  c.fillStyle = '#fff1f5'; c.beginPath(); c.ellipse(6, 8, 18, 12, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffb02e'; c.beginPath(); c.moveTo(26, -4); c.lineTo(44, 2); c.lineTo(26, 8); c.closePath(); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(12, -6, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1d1640'; c.beginPath(); c.arc(15, -5, 5, 0, Math.PI * 2); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(-26, -4); c.lineTo(-44, -12); c.lineTo(-40, 6); c.closePath(); c.fill();
  c.restore();
};

// ---------- 镜 1：夜晚山坡 ----------
const BOT1 = [700, 470];
const s1cam = (ft) => {
  // 慢推：0→2.6s 从 1.00 推到 1.10（sine 进出），中心略偏向机器人
  const k = MO.sineInOut(seg(ft, 0, 2.6));
  const cam = { x: lerp(960, 900, k), y: lerp(540, 520, k), z: lerp(1.0, 1.1, k) };
  if (ft <= T1.a) return cam;
  // 钻进镜头：0.9s 对数插值推进 1.1 → 60，眼睛中心平滑移到画面中心（缓动用 sineIn 偏 InOut：起步不拖，中段最快）
  const e = K75(Math.pow(seg(ft, T1.a, T1.a + T1.d), 0.85));
  const eye = Y1.eyeWorld(ft);
  const k2 = MO.cubicOut(seg(ft, T1.a, T1.a + T1.d * 0.7));              // 眼睛移到画面中心比推进先完成
  return { ...CAM.pushTo(cam, eye[0], eye[1], 60, e, k2), e };
};
Y1.botPos = (ft) => [BOT1[0] + Math.sin(ft * 1.9) * 6, BOT1[1] + Math.sin(ft * 2.4) * 12];
Y1.eyeWorld = (ft) => { const [bx, by] = Y1.botPos(ft); const a = Math.sin(ft * 1.7) * 0.04; const ex = 0.6 * 14; return [bx + ex * Math.cos(a), by + ex * Math.sin(a), 34]; };
// 转场 A 要的「镜头圆」：屏幕上的圆心与半径
Y1.lensAt = (t) => { const ft = t - F0, cam = s1cam(ft), e = Y1.eyeWorld(ft), s = CAM.toScreen(cam, e[0], e[1]); return { x: s[0], y: s[1], r: e[2] * cam.z, e: cam.e || 0 }; };

const STARS = (() => { const r = rng(11), o = []; for (let i = 0; i < 170; i++) o.push({ x: r() * 2400 - 240, y: r() * 760 - 80, r: 0.8 + r() * r() * 3.2, ph: r() * 6.28, sp: 1 + r() * 2.5 }); return o; })();
const GRASS = (() => { const r = rng(12), o = []; for (let i = 0; i < 46; i++) o.push({ x: 820 + r() * 900, h: 18 + r() * 26, ph: r() * 6.28 }); return o; })();
const MOTES = (() => { const r = rng(13), o = []; for (let i = 0; i < 26; i++) o.push({ x: r() * W, y: 300 + r() * 600, ph: r() * 6.28, d: 0.8 + r() * 0.5, s: 2 + r() * 3 }); return o; })();

Y1.shot1 = (c, lt, t) => {
  const ft = t - F0, P = C.night, cam = s1cam(ft);
  c.fillStyle = vgrad(c, 0, H, P.sky); c.fillRect(0, 0, W, H);
  // d=0.05 星空：闪烁
  layer(c, cam, 0.05, g => { for (const s of STARS) { const a = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(ft * s.sp + s.ph)); g.globalAlpha = a; g.fillStyle = P.star; g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; });
  // d=0.12 月亮：光晕呼吸
  layer(c, cam, 0.12, g => { glow(g, 1500, 230, 260 + Math.sin(ft * 1.2) * 12, '#ffd9a0', 0.22); flat(g, circ(1500, 230, 92), P.moon, P.moonSh, '#fff8ea', [-18, 14], [-6, 5]);
    g.fillStyle = 'rgba(214,180,130,.45)'; for (const [x, y, r] of [[1470, 205, 16], [1528, 262, 11], [1520, 196, 7]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } });
  // d=0.3 远山
  layer(c, cam, 0.3, g => { const p = poly([[-300, 760], [-80, 640], [200, 700], [520, 610], [860, 690], [1180, 600], [1520, 680], [1840, 620], [2200, 700], [2200, 1300], [-300, 1300]]); flat(g, p, P.hillFar, P.hillFar, P.hillFarHi, [0, -10], [0, 4]); });
  // d=0.65 近坡
  layer(c, cam, 0.65, g => { const p = poly([[-300, 900], [200, 840], [700, 820], [1100, 740], [1500, 760], [1900, 840], [2300, 900], [2300, 1400], [-300, 1400]]); flat(g, p, P.hill, P.hillSh, P.hillHi, [0, -14], [0, 5]); });
  // d=1 主体：山顶小丘、草、猫、机器人与扫描光
  layer(c, cam, 1, g => {
    flat(g, poly([[860, 1200], [960, 860], [1180, 790], [1400, 810], [1620, 900], [1760, 1200]]), P.hill, P.hillSh, P.hillHi, [0, -12], [0, 5]);
    // 草叶：填色的细三角（不用线条——线条会读成描边）
    g.fillStyle = P.grass;
    for (const q of GRASS) { const by = 806 + Math.pow((q.x - 1240) / 420, 2) * 70; const sw = Math.sin(ft * 2.1 + q.ph) * 6; g.beginPath(); g.moveTo(q.x - 5, by + 10); g.quadraticCurveTo(q.x + sw * 0.4, by - q.h * 0.5, q.x + sw, by - q.h); g.quadraticCurveTo(q.x + 2 + sw * 0.3, by - q.h * 0.4, q.x + 5, by + 10); g.closePath(); g.fill(); }
    // 扫描光束：从眼睛扇形照到猫，扫描线上下扫
    const [ex, ey] = Y1.eyeWorld(ft), cx = 1240, sy = 640 + Math.sin(ft * 3.2) * 110;
    const beam = new Path2D(); beam.moveTo(ex, ey); beam.lineTo(cx + 40, 420); beam.lineTo(cx + 60, 830); beam.closePath();
    const bg = g.createLinearGradient(ex, ey, cx, ey); bg.addColorStop(0, 'rgba(50,186,238,.45)'); bg.addColorStop(1, 'rgba(50,186,238,.06)');
    g.fillStyle = bg; g.fill(beam);
    Y1.cat(g, 1240, 810, ft, { s: 1.05, face: -1, look: 0.4 });
    g.save(); g.clip(beam); g.strokeStyle = 'rgba(150,245,255,.9)'; g.lineWidth = 5; g.beginPath(); g.moveTo(1080, sy); g.lineTo(1420, sy); g.stroke(); glow(g, 1240, sy, 160, '#46e6ff', 0.18); g.restore();
    const [bx, by] = Y1.botPos(ft); Y1.bot(g, bx, by, ft, { look: 0.6 });
  });
  // d=0.9–1.3 萤火微粒
  for (const m of MOTES) layer(c, cam, m.d, g => { const x = m.x + Math.sin(ft * 0.8 + m.ph) * 30, y = m.y - ((ft * 22 + m.ph * 40) % 120); g.globalAlpha = 0.5 + 0.5 * Math.sin(ft * 2 + m.ph); glow(g, x, y, m.s * 5, '#ffe9a8', 0.5); g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(x, y, m.s, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; });
  // d=1.5 前景叶片剪影（近景最快，景深靠它）
  // 前景叶片：虚焦（景深），实测 2025 片大量用前景虚化
  layer(c, cam, 1.5, g => { const sw = Math.sin(ft * 1.4) * 0.05; g.filter = 'blur(7px)';
    const leaf = (x, y, a, L, w) => { g.save(); g.translate(x, y); g.rotate(a); const p = poly([[0, 0], [w, -L * 0.35], [w * 0.7, -L * 0.75], [0, -L], [-w * 0.7, -L * 0.75], [-w, -L * 0.35]]);
      flat(g, p, P.fg, '#0a0824', '#241e5a', [8, 0], [3, 0]); g.strokeStyle = '#241e5a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, -L * 0.9); g.stroke(); g.restore(); };
    leaf(-30, 1130, -0.75 + sw, 380, 90); leaf(60, 1150, -0.25 + sw * 1.3, 300, 70); leaf(1960, 1150, 0.6 - sw, 400, 95); g.filter = 'none'; });
  // 标题：逐字上浮（0.25s 起，每字错开 45ms，单字 0.5s cubicOut），钻镜头前淡出
  const out = 1 - MO.sineInOut(seg(ft, 1.95, 2.5));                         // 0.55s 淡出，别一帧消失
  if (out > 0) { c.save(); c.globalAlpha = out;
    TY.charsIn(c, 'AI 是怎么学会认猫的？', W / 2, 150, ft - 0.25, { font: '76px "PuHui-Heavy"', color: '#ffffff', dur: 0.5, stagger: 0.045, dy: 30, align: 'center', shadow: { color: 'rgba(10,8,40,.45)', y: 6, blur: 0 } });
    c.restore(); }
};

// ---------- 镜 2：机器脑内 ----------
const PIX = [
  '..O......O..', '.OOO....OOO.', '.OPOOOOOOPO.', '.OOOOOOOOOO.', 'OOWWOOOOWWOO', 'OOWKOOOOWKOO',
  'OOOOOOOOOOOO', 'OOOOCPPCOOOO', 'OOOCCCCCCOOO', '.OOOCCCCOOO.', '..OOOOOOOO..', '....OOOO....'];
const PCOL = { O: '#F48301', P: '#C83C7F', W: '#ffffff', K: '#0E0631', C: '#ffe0b5' };
const LAYERS = [{ x: 860, n: 4, label: '边缘' }, { x: 1120, n: 5, label: '形状' }, { x: 1370, n: 3, label: '部件' }, { x: 1600, n: 1, label: '猫', out: true }];
LAYERS.forEach((L, i) => { L.ys = []; for (let k = 0; k < L.n; k++) L.ys.push(L.n === 1 ? 520 : 520 + (k - (L.n - 1) / 2) * (L.n > 4 ? 118 : 140)); L.i = i; });
const OUT = [1600, 520, 50];
const pulseT = 1.0;                                      // 信号从像素出发的时刻（镜内时间）
const layerHit = i => pulseT + 0.32 * (i + 1);           // 第 i 层被点亮的时刻
Y1.outNode = OUT;
const s2cam = (ft) => {
  const lt = ft - Y1.SHOTS.s2[0];
  // 从镜头里浮出：0→0.9s z 0.42→1.0（expoOut），之后极慢漂移推进
  const k = MO.expoOut(seg(lt, 0, 1.2));
  let cam = { x: lerp(1020, 1000, k) + lt * 12, y: 540, z: CAM.zlerp(0.42, 1.0, k) * (1 + 0.012 * lt) };
  if (ft <= T2.a) return cam;
  // 推进输出节点直到满屏（0.45s，cubicIn）
  const e = MO.cubicIn(seg(ft, T2.a, T2.a + T2.d * 0.5));
  return CAM.pushTo(cam, OUT[0], OUT[1], 26, e);
};
const DUST = (() => { const r = rng(21), o = []; for (let i = 0; i < 90; i++) o.push({ x: r() * 2600 - 340, y: r() * 1500 - 210, r: 1 + r() * 2.5, d: 0.3 + r() * 0.5, ph: r() * 6.28 }); return o; })();
const nodeIcon = (g, li, k, x, y, a) => {
  g.save(); g.globalAlpha = a; g.strokeStyle = '#e8f6ff'; g.fillStyle = '#e8f6ff'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
  if (li === 0) { const ang = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4][k]; g.beginPath(); g.moveTo(x - Math.cos(ang) * 16, y - Math.sin(ang) * 16); g.lineTo(x + Math.cos(ang) * 16, y + Math.sin(ang) * 16); g.stroke(); }
  if (li === 1) { g.beginPath(); if (k === 0 || k === 4) { g.moveTo(x - 14, y + 10); g.lineTo(x, y - 14); g.lineTo(x + 14, y + 10); g.closePath(); } else if (k === 1) { g.ellipse(x, y, 10, 14, 0, 0, Math.PI * 2); } else if (k === 2) { g.moveTo(x - 16, y - 6); g.lineTo(x + 16, y - 10); g.moveTo(x - 16, y + 6); g.lineTo(x + 16, y + 8); } else { g.arc(x, y, 13, 0.2, Math.PI - 0.2); } g.stroke(); }
  if (li === 2) { g.beginPath(); if (k === 0) { g.moveTo(x - 18, y + 8); g.lineTo(x - 10, y - 14); g.lineTo(x - 2, y + 2); g.moveTo(x + 2, y + 2); g.lineTo(x + 10, y - 14); g.lineTo(x + 18, y + 8); } else if (k === 1) { g.ellipse(x - 9, y, 6, 9, 0, 0, Math.PI * 2); g.moveTo(x + 15, y); g.ellipse(x + 9, y, 6, 9, 0, 0, Math.PI * 2); } else { g.moveTo(x - 6, y - 4); g.lineTo(x + 6, y - 4); g.lineTo(x, y + 4); g.closePath(); g.moveTo(x - 20, y + 2); g.lineTo(x - 8, y + 4); g.moveTo(x + 8, y + 4); g.lineTo(x + 20, y + 2); } g.stroke(); }
  g.restore();
};
Y1.shot2 = (c, lt, t) => {
  const ft = t - F0, P = C.mind, cam = s2cam(ft), l = ft - Y1.SHOTS.s2[0];
  c.fillStyle = vgrad(c, 0, H, P.bg); c.fillRect(0, 0, W, H);
  // 远景：点阵网格＋漂浮尘埃（视差）
  layer(c, cam, 0.35, g => { g.fillStyle = P.grid; for (let y = -400; y < 1500; y += 60) for (let x = -600; x < 2600; x += 60) { g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill(); } });
  for (const d of DUST) layer(c, cam, d.d, g => { g.globalAlpha = 0.35 + 0.35 * Math.sin(ft * 1.5 + d.ph); g.fillStyle = '#8fb0ff'; g.beginPath(); g.arc(d.x + Math.sin(ft * 0.6 + d.ph) * 20, d.y + Math.cos(ft * 0.5 + d.ph) * 14, d.r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; });
  layer(c, cam, 1, g => {
    // 像素猫：144 块从四周飞入就位（每块 0.5s backOut，按到中心的距离错开），之后整体轻微呼吸
    const cell = 30, gx = 400 - 6 * cell, gy = 520 - 6 * cell, r = rng(31);
    for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
      const ch = PIX[j][i], fx = r() * 2 - 1, fy = r() * 2 - 1; if (ch === '.') continue;
      const dl = 0.05 + Math.hypot(i - 5.5, j - 5.5) * 0.035, q = clamp((l - dl) / 0.5), e = MO.backOut(q, 1.4);
      const x = gx + i * cell + (1 - e) * fx * 260, y = gy + j * cell + (1 - e) * fy * 260, s = (cell - 4) * (0.3 + 0.7 * e) * (1 + 0.04 * Math.sin(ft * 3 + i * 0.5 + j * 0.3));
      g.globalAlpha = clamp(q * 3); g.fillStyle = PCOL[ch]; g.beginPath(); g.roundRect(x + (cell - s) / 2, y + (cell - s) / 2, s, s, 5); g.fill();
    }
    g.globalAlpha = 1;
    // 连线：像素 → 第一层 → … 全连接
    const cols = [{ x: 600, ys: [380, 470, 570, 660] }, ...LAYERS];
    g.lineWidth = 2.5;
    for (let a = 0; a < cols.length - 1; a++) for (const y0 of cols[a].ys) for (const y1 of cols[a + 1].ys) {
      const lit = clamp((l - layerHit(a) + 0.1) / 0.3);
      g.strokeStyle = lit > 0 ? `rgba(${lerp(110, 120, lit) | 0},${lerp(140, 230, lit) | 0},255,${0.22 + 0.25 * lit})` : P.line;
      g.beginPath(); g.moveTo(cols[a].x, y0); g.lineTo(cols[a + 1].x, y1); g.stroke();
    }
    // 信号脉冲：沿每条连线跑，0.32s 跑完一层；之后循环流动（持续的「思考」）
    for (let a = 0; a < cols.length - 1; a++) {
      const rr = rng(40 + a);
      for (const y0 of cols[a].ys) for (const y1 of cols[a + 1].ys) {
        if (rr() < 0.45) continue;
        const start = pulseT + 0.32 * a, ph = rr() * 0.3;
        let q = (l - start - ph * 0.3) / 0.32; if (q < 0) continue; if (q > 1) q = ((l - start) * 1.6 + ph) % 1;
        const x = lerp(cols[a].x, cols[a + 1].x, q), y = lerp(y0, y1, q);
        glow(g, x, y, 22, P.pulse, 0.6); g.fillStyle = '#e9fdff'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
      }
    }
    // 节点：被信号点亮时弹一下（backOut 0.35s）＋显示该层学到的特征图标
    for (const L of LAYERS) L.ys.forEach((y, k) => {
      const hit = layerHit(L.i) + k * 0.04, q = clamp((l - hit) / 0.35), pop = q > 0 ? 1 + 0.25 * Math.sin(Math.PI * clamp(q * 1.2)) : 1;
      const r = (L.out ? OUT[2] : 34) * pop * (1 + 0.03 * Math.sin(ft * 4 + k));
      if (L.out) {
        if (q > 0) glow(g, L.x, y, r * (3.2 + 0.4 * Math.sin(ft * 5)), P.hot, 0.55 * q);
        const gg = g.createRadialGradient(L.x - r * 0.3, y - r * 0.3, 0, L.x, y, r); gg.addColorStop(0, q > 0 ? '#fff6c8' : P.nodeHi); gg.addColorStop(1, q > 0 ? P.hot : P.node);
        g.fillStyle = gg; g.beginPath(); g.arc(L.x, y, r, 0, Math.PI * 2); g.fill();
      } else {
        if (q > 0) glow(g, L.x, y, r * 2.4, P.pulse, 0.32 * q);
        flat(g, circ(L.x, y, r), q > 0 ? '#3e6fd8' : P.node, q > 0 ? '#2b4fb0' : '#1c275a', q > 0 ? '#7fb2ff' : P.nodeHi, [-6, -6], [-2, -2]);
        if (q > 0) nodeIcon(g, L.i, k, L.x, y, q);
      }
    });
    // 层标签：逐个出现（文字是从下往上浮 + 短下划线伸出）
    const labs = [{ x: 400, s: '像素' }, ...LAYERS.map(L => ({ x: L.x, s: L.label }))];
    labs.forEach((L, i) => { const t0 = 0.55 + (i ? layerHit(i - 1) - 0.55 + 0.1 : 0); const q = MO.cubicOut(seg(l, t0, t0 + 0.45));
      if (q <= 0) return; TY.charsIn(g, L.s, L.x, 880, l - t0, { font: '40px "PuHui-Medium"', color: i === 4 ? P.hot : P.label, dur: 0.4, stagger: 0.06, dy: 18, align: 'center' });
      g.strokeStyle = i === 4 ? P.hot : P.label; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(L.x - 34 * q, 904); g.lineTo(L.x + 34 * q, 904); g.stroke(); });
    // 箭头：标签之间
    g.fillStyle = 'rgba(169,188,255,.55)'; for (let i = 0; i < 4; i++) { const xa = [400, ...LAYERS.map(L => L.x)]; const q = seg(l, 0.6 + (i ? layerHit(i - 1) - 0.5 : 0.2), 1.0 + (i ? layerHit(i - 1) - 0.5 : 0.2)); if (q <= 0) continue; const mx = (xa[i] + xa[i + 1]) / 2; g.globalAlpha = q; g.beginPath(); g.moveTo(mx - 10, 868); g.lineTo(mx + 10, 878); g.lineTo(mx - 10, 888); g.closePath(); g.fill(); }
    g.globalAlpha = 1;
  });
};

// ---------- 镜 3：白天草坡 ----------
const BOT3 = [1010, 400];
Y1.bot3Pos = (ft) => [BOT3[0] + Math.sin(ft * 1.9) * 6, BOT3[1] + Math.sin(ft * 2.4) * 10];
const s3cam = (ft) => {
  const l = ft - Y1.SHOTS.s3[0];
  const [bx, by] = Y1.bot3Pos(ft); const eye = [bx, by];          // look=0 时眼睛在头中心
  // 0–0.45s 停在满屏黄色的眼睛里；0.45→1.9s 对数插值拉远 42→1.0。
  // 用 cubicInOut 而不是 expoOut：expoOut 起步斜率太大，第一帧就从 42 倍跳到 15 倍（qa 量到 9 帧跳变）；实测 Kurzgesagt 穿越是先加速后减速、峰值在中段
  const e = MO.cubicInOut(seg(l, 0.45, 1.9));
  const z = CAM.zlerp(42, 1.0, e) * (1 + 0.04 * Math.max(0, l - 1.9));       // 落定后 4%/s 慢推（实测待机推 3–4.5%/s）
  const final = { x: 960, y: 540 };
  const s0 = [W / 2, H / 2], s1 = CAM.toScreen({ ...final, z: 1 }, eye[0], eye[1]);
  return CAM.anchor(eye[0], eye[1], z, lerp(s0[0], s1[0], e), lerp(s0[1], s1[1], e));
};
const CLOUDS = [[300, 230, 1.0], [880, 150, 0.7], [1480, 260, 1.15], [2100, 180, 0.8]];
const TREES = [[180, 760, 1], [330, 790, 0.7], [1580, 770, 0.9], [1760, 790, 1.2]];
const cloud = (g, x, y, s) => { const p = new Path2D(); for (const [dx, dy, r] of [[-70, 10, 50], [-20, -18, 66], [50, -4, 56], [100, 16, 40], [0, 22, 46]]) p.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); flat(g, p, C.day.cloud, C.day.cloudSh, '#ffffff', [0, -10 * s], [0, 4]); };
Y1.shot3 = (c, lt, t) => {
  const ft = t - F0, P = C.day, cam = s3cam(ft), l = ft - Y1.SHOTS.s3[0];
  c.fillStyle = vgrad(c, 0, H, P.sky); c.fillRect(0, 0, W, H);
  layer(c, cam, 0.08, g => { glow(g, 1640, 170, 300, '#fff6c0', 0.55); g.fillStyle = P.sun; g.beginPath(); g.arc(1640, 170, 80 + Math.sin(ft * 2) * 3, 0, Math.PI * 2); g.fill(); });
  layer(c, cam, 0.2, g => { for (const [x, y, s] of CLOUDS) cloud(g, ((x + ft * 26) % 2600) - 340, y, s); });
  layer(c, cam, 0.35, g => flat(g, poly([[-300, 760], [100, 650], [520, 700], [900, 620], [1300, 690], [1700, 610], [2200, 700], [2200, 1300], [-300, 1300]]), P.hillFar, '#86c45c', '#b4e889', [0, -10], [0, 4]));
  layer(c, cam, 0.6, g => { flat(g, poly([[-300, 820], [300, 760], [900, 800], [1500, 740], [2200, 820], [2200, 1300], [-300, 1300]]), P.hillMid, '#58a63e', '#8fd468', [0, -12], [0, 4]);
    for (const [x, y, s] of TREES) { g.fillStyle = P.trunk; g.fillRect(x - 8 * s, y - 60 * s, 16 * s, 70 * s); const sw = Math.sin(ft * 1.6 + x) * 4; flat(g, circ(x + sw, y - 100 * s, 62 * s), P.tree, '#23753a', P.treeHi, [-12 * s, -10 * s], [-4, -4]); } });
  // 鸟：两只从左飞到右（Kurzgesagt 的签名彩蛋）
  layer(c, cam, 0.75, g => { Y1.bird(g, -200 + ft * 150, 175 + Math.sin(ft * 3) * 14, ft, { s: 0.9, col: '#ff5d8f', sh: '#d63c70' }); Y1.bird(g, -420 + ft * 165, 225 + Math.sin(ft * 3 + 1) * 12, ft, { s: 0.7, col: '#ffb02e', sh: '#e08a10', ph: 0.15 }); });
  layer(c, cam, 1, g => {
    flat(g, poly([[-300, 900], [400, 860], [1000, 880], [1600, 850], [2300, 900], [2300, 1400], [-300, 1400]]), P.ground, '#3d8f33', P.groundHi, [0, -14], [0, 5]);
    // 花叔：指向黑猫（point 姿势＋手臂与头的小幅持续摆动，嘴在说话）
    if (HERO.y1(g, ft) === false) {                                             // 形象方向见 lib/hero.js
    const HSb = HUASHU.build({ x: 470, y: 900 + Math.sin(ft * 3.2) * 2, s: 0.66, face: 1, pose: HUASHU.pose('point', 0, { ua1: 1.38 + 0.07 * Math.sin(ft * 3.4), fa1: 0.05 + 0.05 * Math.sin(ft * 3.4 + 1), head: -0.04 + 0.03 * Math.sin(ft * 2.1), mouth: 0.45 + 0.4 * Math.max(0, Math.sin(ft * 9)) }) });
      const pal = { skin: '#ffd3b4', hair: '#1f1a3a', shirt: '#ffffff', shorts: '#d9c9a8', hat: '#ffffff', hatBand: '#d8d4f2', shoe: '#f4f2ff', watch: '#2a2550' };
      const shade = { skin: '#f0a98a', hair: '#120f26', shirt: '#cfcbee', shorts: '#b39f7c', hat: '#d3cff0', hatBand: '#b6b0e0', shoe: '#c9c5ea', watch: '#14112b' };
      for (const p of HSb.parts) flat(g, p.path, pal[p.role] || pal.skin, shade[p.role] || shade.skin, '#ffffff', [-10, -8], [-4, -3]);
      HUASHU.details(g, HSb, { line: '#1f1a3a', lw: 3.5, glass: '#1f1a3a', cheek: 'rgba(255,120,120,.35)', earLine: 'rgba(200,110,90,.7)', shoeHole: '#8a86b8' });
    }
    // 认识的那只橙猫蹲在花叔脚边；镜头要认的是一只「没见过的」黑猫
    Y1.cat(g, 790, 905, ft + 0.3, { s: 0.55, face: -1, look: 0.5 });
    Y1.cat(g, 1420, 880, ft + 0.7, { s: 0.85, face: -1, pal: { fur: '#3a3550', sh: '#24203a', hi: '#5a5478', belly: '#4a4566', ear: '#ff8fa3', eye: '#d9ff6b', pupil: '#16132a' }, look: 0.2 });
    // 扫描光与机器人
    const [bx, by] = Y1.bot3Pos(ft);
    const bq = MO.cubicOut(seg(l, 1.5, 1.85));
    if (bq > 0) { const beam = new Path2D(); beam.moveTo(bx, by); beam.lineTo(1300, 660); beam.lineTo(1540, 660); beam.closePath(); g.save(); g.globalAlpha = bq; const bg = g.createLinearGradient(bx, by, 1420, 760); bg.addColorStop(0, 'rgba(255,210,63,.55)'); bg.addColorStop(1, 'rgba(255,210,63,.08)'); g.fillStyle = bg; g.fill(beam); g.restore(); }
    Y1.bot(g, bx, by, ft, { eye: C.bot.eyeHot, eyeR: 30, look: 0 });
    // 小字：一只没见过的猫（引线先画出，再逐字打出，实测标注≈40 字/秒）
    const cq = seg(l, 1.0, 1.25), cout = 1 - seg(l, 1.65, 1.8);
    if (cq > 0 && cout > 0) { g.save(); g.globalAlpha = cout; g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(1500, 700); g.lineTo(1500 + 80 * cq, 640 - 40 * cq); g.lineTo(1500 + 80 * cq + 120 * clamp(cq * 2 - 1), 600); g.stroke();
      const str = '没见过的猫', n = Math.floor((l - 1.2) * 25);                     // 中文按 25 字/秒打出
      g.fillStyle = '#ffffff'; g.font = '34px "PuHui-Medium"'; g.textBaseline = 'alphabetic'; g.fillText([...str].slice(0, Math.min(5, Math.max(0, n))).join(''), 1590, 590); g.restore(); }
    // 识别标签：从猫头上方弹出，之后轻轻上下浮
    const q = seg(l, 1.75, 2.25); if (q > 0) {
      // 实测卡片弹出 ≈0.5s、过冲到 108% 回 100%
      const e = MO.backOut(q, 1.1), y = 560 + Math.sin(ft * 2.5) * 6;
      g.save(); g.translate(1420, y); g.scale(e, e);
      g.fillStyle = 'rgba(20,40,20,.18)'; g.beginPath(); g.roundRect(-122, -40, 252, 92, 46); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(-130, -50, 252, 92, 46); g.fill();
      g.beginPath(); g.moveTo(-14, 40); g.lineTo(0, 64); g.lineTo(14, 40); g.fill();
      g.fillStyle = '#2fbf71'; g.beginPath(); g.arc(-80, -4, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-94, -4); g.lineTo(-84, 8); g.lineTo(-64, -16); g.stroke();
      g.fillStyle = '#1f1a3a'; g.font = '52px "PuHui-Heavy"'; g.textBaseline = 'middle'; g.fillText('猫', -36, -2);
      g.font = '34px "PuHui-Medium"'; g.fillStyle = '#2fbf71'; g.fillText('98%', 26, 0);
      g.restore();
    }
  });
};
})();

SCENES['y1_s1'] = { draw: (c, lt, t) => Y1.shot1(c, lt, t) };
SCENES['y1_s2'] = { draw: (c, lt, t) => Y1.shot2(c, lt, t) };
SCENES['y1_s3'] = { draw: (c, lt, t) => Y1.shot3(c, lt, t) };
