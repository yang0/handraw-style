// 花叔卡通形象骨架（侧面，FK 关节）。来源：花叔形象的 superflat 三视图设定稿（未随仓库附带），侧视图叠网格读点。
// 角色定规：纯白渔夫帽、圆框黑眼镜、白 T、卡其短裤、白洞洞鞋、近侧手腕黑手表、大头小身体（头≈全身 38%）。
// 坐标：本地单位 1 = 设定图侧视 1px；原点 = 双脚之间的地面；y 向上为负；原生朝左（-x 为前）。全身高 740 单位。
// 用法：
//   const H = HUASHU.build({ x, y, s: 0.6, face: 1 /*1朝右 -1朝左*/, pose: HUASHU.pose('walk', phase) });
//   HUASHU.draw(c, H, pal)             // 默认扁平画法；pal.mode: 'fill' | 'line' | 'both'
//   H.parts = [{ name, role, path, z }]  // 按画序；role ∈ skin/shirt/shorts/hat/hair/shoe/watch/glass/line
//   H.J = { hip, knee1, ankle1, toe1, knee2, ..., shoulder1, elbow1, wrist1, ..., neck, head, hatTop, mouth, eye }
// 角度约定：0 = 自然下垂；正 = 往脸朝的方向（前）转；大头小身体手够不到头顶：举手=近侧手臂向前上(~1.9)、远侧向后上(~-1.9)，侧视里成 V 字，不要直上。1 = 近侧肢体（画在最前），2 = 远侧。
(() => {
const HS = window.HUASHU = {};
const { lerp, clamp } = U;
const D = (a, b, c, d, e, f) => new DOMMatrix([a, b, c, d, e, f]);
const P2 = (pts, closed = true) => (RIG && RIG.smooth) ? RIG.smooth(pts, closed) : (() => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(...q) : p.moveTo(...q)); if (closed) p.closePath(); return p; })();
const add = (dst, path, m) => { dst.addPath(path, m); return dst; };
const tf = (m, x, y) => { const p = m.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; };

// ---------- 局部形状（各自骨骼坐标系，原点 = 该骨骼起点关节，沿 +y 向下） ----------
const SHAPE = {
  // 头：原点 = 颈点；脸朝 -x
  face: P2([[-30, -158], [-78, -150], [-108, -128], [-122, -98], [-124, -66], [-118, -38], [-102, -14], [-80, 2], [-50, 8], [-18, 2], [8, -14], [22, -40], [24, -78], [10, -120]]),
  hairBack: P2([[-70, -168], [-10, -176], [56, -168], [102, -140], [118, -96], [112, -58], [86, -30], [52, -18], [26, -28], [20, -62], [8, -110], [-30, -140], [-62, -140]]),
  bangs: P2([[-122, -120], [-110, -146], [-76, -164], [-34, -166], [-10, -150], [-28, -138], [-52, -132], [-70, -118], [-86, -132], [-102, -116]]),
  ear: (() => { const p = new Path2D(); p.ellipse(16, -66, 17, 22, 0.15, 0, Math.PI * 2); return p; })(),
  crown: P2([[-100, -170], [-94, -232], [-64, -262], [-4, -274], [62, -266], [100, -236], [116, -180], [124, -110], [64, -118], [-10, -150], [-60, -166]]),
  brim: P2([[-160, -166], [-112, -186], [-30, -190], [52, -164], [116, -112], [134, -62], [116, -52], [64, -86], [-16, -128], [-100, -150], [-156, -150]]),
  band: P2([[-100, -186], [-30, -196], [60, -176], [118, -128], [120, -112], [60, -158], [-30, -180], [-100, -172]]),
  lens: (() => { const p = new Path2D(); p.roundRect(-128, -118, 44, 62, 16); return p; })(),
  // 躯干（T 恤）：原点 = 胯；肩约 (0,-250)
  shirt: P2([[-18, -272], [-40, -258], [-60, -200], [-72, -120], [-82, -42], [-84, -32], [74, -34], [72, -40], [70, -140], [62, -230], [44, -262], [14, -274]]),
  collar: P2([[-18, -272], [0, -262], [14, -274]], false),
  shorts: P2([[-74, -44], [76, -42], [80, 18], [70, 44], [-70, 46], [-78, 16]]),
  // 大腿裤管：原点 = 胯侧关节；长 62
  thigh: P2([[-40, -6], [38, -6], [42, 58], [-40, 62]]),
  // 小腿：原点 = 膝；长 66
  shin: P2([[-24, 0], [22, 0], [21, 66], [-21, 66]]),
  // 洞洞鞋：原点 = 踝；鞋尖朝 -x
  shoe: P2([[-104, 26], [-100, 6], [-80, -4], [-50, -8], [-20, -12], [18, -10], [46, -2], [58, 18], [56, 46], [40, 60], [-60, 62], [-96, 54], [-106, 40]]),
  // 袖子：原点 = 肩；长 112
  sleeve: P2([[-40, -10], [36, -14], [44, 100], [-34, 112]]),
  upper: P2([[-19, 0], [19, 0], [18, 126], [-18, 126]]),
  fore: P2([[-18, 0], [18, 0], [16, 74], [-16, 74]]),
  hand: (() => { const p = new Path2D(); p.ellipse(0, 18, 22, 25, 0, 0, Math.PI * 2); return p; })(),
  watch: (() => { const p = new Path2D(); p.roundRect(-24, 50, 48, 22, 6); return p; })(),
  watchFace: (() => { const p = new Path2D(); p.roundRect(-16, 46, 32, 30, 7); return p; })(),
};
const SHOE_HOLES = [[-80, 18], [-58, 12], [-34, 10], [-10, 12], [-70, 32], [-46, 30], [-22, 30]];

// ---------- 姿势库 ----------
// 每个姿势返回关节角（弧度）与根偏移。phase 用于循环动作（0..1）。
HS.pose = (name, ph = 0, k = {}) => {
  const s = Math.sin(2 * Math.PI * ph), c = Math.cos(2 * Math.PI * ph);
  const P = { lean: 0, head: 0, bob: 0, dx: 0, th1: 0, sh1: 0, ft1: 0, th2: 0, sh2: 0, ft2: 0, ua1: 0, fa1: 0, ua2: 0, fa2: 0, pocket1: 0, pocket2: 0, mouth: 0.3, blink: 0 };
  switch (name) {
    case 'idle': Object.assign(P, { pocket1: 1, pocket2: 1, ua1: -0.05, fa1: 0.25, ua2: -0.05, fa2: 0.25, bob: 2 * s, head: 0.03 * s }); break;
    case 'walk': Object.assign(P, { lean: 0.05, bob: -6 * Math.abs(c), th1: 0.42 * s, sh1: -0.55 * Math.max(0, -s) - 0.15, ft1: 0.1 * s, th2: -0.42 * s, sh2: -0.55 * Math.max(0, s) - 0.15, ft2: -0.1 * s,
      ua1: -0.45 * s, fa1: 0.35, ua2: 0.45 * s, fa2: 0.35, head: 0.03 * c }); break;
    case 'run': Object.assign(P, { lean: 0.22, bob: -14 * Math.abs(c), th1: 0.8 * s + 0.1, sh1: -1.1 * Math.max(0, -s) - 0.3, th2: -0.8 * s + 0.1, sh2: -1.1 * Math.max(0, s) - 0.3,
      ua1: -0.9 * s, fa1: 1.4, ua2: 0.9 * s, fa2: 1.4, head: -0.06, mouth: 0.6 }); break;
    case 'crouch': Object.assign(P, { lean: 0.35, bob: 52, th1: 1.25, sh1: -1.9, ft1: 0.5, th2: 1.05, sh2: -1.8, ft2: 0.6, ua1: 0.5, fa1: 0.4, ua2: 0.3, fa2: 0.5, head: -0.2 }); break;
    case 'jump': Object.assign(P, { lean: 0.05, th1: 0.7, sh1: -1.2, th2: 0.2, sh2: -0.6, ua1: 1.95, fa1: 0.7, ua2: -1.95, fa2: -0.7, head: -0.15, mouth: 1 }); break;
    case 'wave': Object.assign(P, { pocket2: 1, ua2: -0.05, fa2: 0.25, ua1: 2.15, fa1: 0.15 + 0.5 * (0.5 + 0.5 * s), head: 0.08, mouth: 0.8, bob: 2 * s }); break;
    case 'sit': Object.assign(P, { bob: 62, th1: 1.55, sh1: -1.55, th2: 1.5, sh2: -1.5, ua1: 0.5, fa1: 0.9, ua2: 0.4, fa2: 0.9, lean: -0.05 }); break;
    case 'point': Object.assign(P, { pocket2: 1, ua2: -0.05, fa2: 0.25, ua1: 1.45, fa1: 0.05, head: -0.05, mouth: 0.7 }); break;
    case 'think': Object.assign(P, { pocket2: 1, ua2: -0.05, fa2: 0.25, ua1: 0.6, fa1: 2.3, head: -0.1, mouth: 0.1 }); break;
    case 'cheer': Object.assign(P, { ua1: 2.05, fa1: 0.55, ua2: -2.05, fa2: -0.55, bob: -10 * Math.abs(s), head: -0.12, mouth: 1 }); break;
    // 侧身甩臂扔（打水漂）：ph 0→1 = 蓄力 → 出手 → 随挥
    case 'throw': { const w = ph < 0.45 ? ph / 0.45 : 1, r = ph < 0.45 ? 0 : clamp((ph - 0.45) / 0.25), f = clamp((ph - 0.7) / 0.3);
      Object.assign(P, { lean: lerp(lerp(0, -0.12, w), 0.32, r), bob: lerp(0, 34, w) - 10 * r, th1: lerp(0, 0.65, w) - 0.3 * r, sh1: lerp(0, -0.9, w) + 0.4 * r, th2: lerp(0, -0.35, w) + 0.25 * r, sh2: lerp(-0.1, -0.5, w),
        ua1: lerp(lerp(0, -1.3, w), 1.1, r) + 0.3 * f, fa1: lerp(lerp(0.3, 0.9, w), 0.15, r), ua2: lerp(0, 0.9, w) - 0.5 * r, fa2: 0.6, head: lerp(0, -0.05, w), mouth: 0.5 + 0.5 * r }); break; }
  }
  return Object.assign(P, k);
};

// ---------- 组装 ----------
// o: { x, y, s, face, pose, squash }  squash = 竖向挤压（落地 0.85、起跳 1.1）
HS.build = (o = {}) => {
  const { x = 960, y = 900, s = 0.6, face = 1, pose = HS.pose('idle'), squash = 1, rot = 0 } = o;
  const P = pose;
  // 根：先挪到世界坐标，按朝向镜像（原生朝左，face=1 朝右要翻），挤压以脚底为轴
  const root = new DOMMatrix().translate(x, y).rotate(rot * 180 / Math.PI).scale(-face * s, s * squash);
  const hip = root.translate(P.dx, -185 + P.bob).rotate(-P.lean * 180 / Math.PI);  // lean>0 往前倾；本地前=-x，rotate 负角让上身朝 -x 倒
  const deg = a => a * 180 / Math.PI;
  const parts = [], J = {};
  const push = (name, role, shape, m, z) => parts.push({ name, role, path: add(new Path2D(), shape, m), z, m });
  const leg = (i, th, sh, ft, zBase) => {
    const hipJ = hip.translate(i === 1 ? -8 : 10, 0);
    const mT = hipJ.rotate(deg(th));                       // 大腿往前（-x）：正角 rotate → (0,1) 转向 -x ✓
    const knee = mT.translate(0, 60), mS = knee.rotate(deg(sh)), ankle = mS.translate(0, 64), mF = ankle.rotate(deg(ft));
    push('thigh' + i, 'shorts', SHAPE.thigh, mT, zBase + 2);
    push('shin' + i, 'skin', SHAPE.shin, mS, zBase);
    push('shoe' + i, 'shoe', SHAPE.shoe, mF, zBase + 1);
    J['hip' + i] = tf(hipJ, 0, 0); J['knee' + i] = tf(knee, 0, 0); J['ankle' + i] = tf(ankle, 0, 0); J['toe' + i] = tf(mF, -104, 40); J['heel' + i] = tf(mF, 56, 46);
    J['shoeM' + i] = mF;
  };
  const arm = (i, ua, fa, pocket, zBase) => {
    const sh = hip.translate(i === 1 ? -4 : 14, -250);
    const mU = sh.rotate(deg(ua)), elbow = mU.translate(0, 124), mFo = elbow.rotate(deg(fa)), wrist = mFo.translate(0, 70);
    push('sleeve' + i, 'shirt', SHAPE.sleeve, mU, zBase + 3);
    push('upper' + i, 'skin', SHAPE.upper, mU, zBase);
    if (!pocket) { push('fore' + i, 'skin', SHAPE.fore, mFo, zBase + 1); push('hand' + i, 'skin', SHAPE.hand, wrist, zBase + 2); }
    else push('fore' + i, 'skin', SHAPE.fore, mFo, zBase - 30);          // 插兜：前臂藏到裤子后面
    if (i === 1) { push('watch', 'watch', SHAPE.watch, mFo, zBase + (pocket ? -29 : 2)); push('watchFace', 'watch', SHAPE.watchFace, mFo, zBase + (pocket ? -28 : 3)); }
    J['shoulder' + i] = tf(sh, 0, 0); J['elbow' + i] = tf(elbow, 0, 0); J['wrist' + i] = tf(wrist, 0, 0); J['hand' + i] = tf(wrist, 0, 18); J['handM' + i] = wrist;
  };
  // 远侧在后
  leg(2, P.th2, P.sh2, P.ft2, 0);
  arm(2, P.ua2, P.fa2, P.pocket2, 10);
  push('shorts', 'shorts', SHAPE.shorts, hip, 40);
  push('shirt', 'shirt', SHAPE.shirt, hip, 50);
  leg(1, P.th1, P.sh1, P.ft1, 60);
  push('shortsFront', 'shorts', SHAPE.shorts, hip, 64);
  push('shirtFront', 'shirt', SHAPE.shirt, hip, 66);
  // 头
  const neck = hip.translate(6, -272), mH = neck.rotate(deg(-P.head));
  push('hairBack', 'hair', SHAPE.hairBack, mH, 80);
  push('face', 'skin', SHAPE.face, mH, 81);
  push('ear', 'skin', SHAPE.ear, mH, 82);
  push('bangs', 'hair', SHAPE.bangs, mH, 83);
  push('crown', 'hat', SHAPE.crown, mH, 85);
  push('band', 'hatBand', SHAPE.band, mH, 86);
  push('brim', 'hat', SHAPE.brim, mH, 87);
  arm(1, P.ua1, P.fa1, P.pocket1, 70);
  parts.sort((a, b) => a.z - b.z);
  J.hip = tf(hip, 0, 0); J.neck = tf(neck, 0, 0); J.head = tf(mH, -40, -80); J.hatTop = tf(mH, 0, -275); J.mouth = tf(mH, -104, -34); J.eye = tf(mH, -104, -88);
  J.chest = tf(hip, -40, -180); J.face = face; J.s = s;
  return { parts, J, mH, root, hip, P, s, face };
};

// 五官与细节线（在头部坐标里画）
HS.details = (c, H, pal) => {
  const L = pal.line || '#151515', lw = (pal.lw ?? 5);
  c.save(); c.setTransform(c.getTransform().multiply(H.mH)); c.lineCap = 'round'; c.lineJoin = 'round';
  // 眼镜：前镜片＋镜腿；镜片里一只黑眼睛
  c.fillStyle = pal.lensFill || 'rgba(255,255,255,0.0)'; c.fill(SHAPE.lens);
  if (!H.P.blink) { c.fillStyle = pal.eye || L; c.beginPath(); c.ellipse(-104, -86, 9, 13, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-107, -91, 3, 0, Math.PI * 2); c.fill(); }
  else { c.strokeStyle = pal.eye || L; c.lineWidth = lw * 0.8; c.beginPath(); c.arc(-104, -90, 9, 0.2, Math.PI - 0.2); c.stroke(); }
  c.strokeStyle = pal.glass || L; c.lineWidth = lw * 1.6; c.stroke(SHAPE.lens);
  c.lineWidth = lw * 1.3; c.beginPath(); c.moveTo(-84, -96); c.lineTo(8, -84); c.stroke();
  // 嘴：mouth 0 闭嘴微笑 → 1 张嘴
  const m = H.P.mouth;
  c.strokeStyle = L; c.lineWidth = lw * 0.8;
  if (m < 0.5) { c.beginPath(); c.moveTo(-112, -40); c.quadraticCurveTo(-100, -28 - 8 * m, -88, -38); c.stroke(); }
  else { c.fillStyle = pal.mouthFill || '#7a2e2e'; c.beginPath(); c.ellipse(-102, -34, 9, 6 + 6 * m, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
  // 腮红、耳廓
  if (pal.cheek) { c.fillStyle = pal.cheek; c.beginPath(); c.ellipse(-70, -48, 14, 9, 0, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = pal.earLine || 'rgba(190,110,90,.8)'; c.lineWidth = lw * 0.6; c.beginPath(); c.arc(16, -66, 8, -1.2, 1.6); c.stroke();
  c.restore();
  // 鞋洞
  for (const i of [1, 2]) { const m2 = H.J['shoeM' + i]; c.save(); c.setTransform(c.getTransform().multiply(m2)); c.fillStyle = pal.shoeHole || '#2a2a2a'; SHOE_HOLES.forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 4.5, 3.5, 0, 0, Math.PI * 2); c.fill(); }); c.strokeStyle = pal.shoeHole || '#2a2a2a'; c.lineWidth = 3; c.beginPath(); c.arc(40, 24, 9, 0, Math.PI * 2); c.stroke(); c.restore(); }
};

HS.PAL = { skin: '#fbd9bf', hair: '#151515', shirt: '#ffffff', shorts: '#d8cdb8', hat: '#ffffff', hatBand: '#e9e9e9', shoe: '#fbfaf6', watch: '#1d1f22', line: '#151515', lw: 5, cheek: 'rgba(245,140,120,.35)' };

// 默认画法：逐部件「填→描」，天然只剩看得见的线（遮挡正确）
HS.draw = (c, H, pal = HS.PAL) => {
  pal = { ...HS.PAL, ...pal };
  const mode = pal.mode || 'both', L = pal.line, lw = pal.lw / H.s * H.s;   // 线宽按世界像素
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  for (const p of H.parts) {
    const col = pal[p.role] ?? pal.skin;
    if (mode !== 'line') { c.fillStyle = col; c.fill(p.path); }
    if (mode !== 'fill' && lw) {
      if (mode === 'line') { c.save(); c.globalCompositeOperation = 'destination-out'; c.fill(p.path); c.restore(); }   // 线稿模式：后画的部件先挖掉前面的线
      c.strokeStyle = L; c.lineWidth = lw; c.stroke(p.path);
    }
  }
  HS.details(c, H, pal);
  c.restore();
};
})();
