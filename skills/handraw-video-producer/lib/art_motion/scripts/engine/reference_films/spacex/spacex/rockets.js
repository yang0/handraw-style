// SpaceX 短片共用：火箭/飞船/发射塔的通用几何（不含任何官方 logo、字样）。
// 坐标：单位＝米，原点＝箭体底部（发动机喷口平面）中心，向上为 −y。调用方自己 translate/rotate/scale(px/m)。
// 每个函数返回 { parts:[{k, p:Path2D}], h（总高 m）, w（最大宽 m）, a:{锚点} }。
//   k：'body' 主体（白漆/不锈钢）、'dark' 深色部件（级间段、栅格舵、着陆腿、发动机）、'nose' 头锥/整流罩、
//      'window' 舷窗、'trunk' 龙飞船尾段、'flap' 星舰襟翼、'engine' 发动机喷管。
// 风格怎么画由各 scene 决定：RK.fill(c, shape, palette) 是最朴素的平涂，各风格可以只拿 parts 自己处理。
// 比例按真实外形（约数）：猎鹰1 21×1.7m；猎鹰9 70×3.7m；重型猎鹰三芯并联；星舰全箭 ~123×9m（超重 71m＋飞船 52m）。
window.RK = (() => {
  const rect = (p, x, y, w, h) => p.rect(x, y, w, h);
  const P2 = () => new Path2D();
  const poly = (pts) => { const p = P2(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; };
  // 尖拱头锥（ogive）：底宽 w、高 h，底边 y0
  const ogive = (w, h, y0, n = 18) => { const pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push([-w / 2 * Math.sqrt(1 - u * u) * (1 - 0.15 * u), y0 - h * u]); }
    for (let i = n; i >= 0; i--) { const u = i / n; pts.push([w / 2 * Math.sqrt(1 - u * u) * (1 - 0.15 * u), y0 - h * u]); } return poly(pts); };
  const bell = (x, y, w, h) => poly([[x - w * 0.28, y - h], [x + w * 0.28, y - h], [x + w / 2, y], [x - w / 2, y]]);

  // 猎鹰1：单级细长箭体＋二级＋小整流罩（2006–2008）
  function falcon1() {
    const D = 1.7, parts = [];
    const body = P2(); rect(body, -D / 2, -15.5, D, 15.5); rect(body, -D / 2 * 0.95, -19.5, D * 0.95, 3.6); parts.push({ k: 'body', p: body });
    const dark = P2(); rect(dark, -D / 2, -16.1, D, 0.6); rect(dark, -D / 2, -1.2, D, 1.2); parts.push({ k: 'dark', p: dark });
    parts.push({ k: 'nose', p: ogive(D * 0.95, 3.2, -19.5) });
    parts.push({ k: 'engine', p: bell(0, 0.9, 1.2, 0.9) });
    return { parts, h: 22.7, w: D, a: { top: [0, -22.7], base: [0, 0.9] } };
  }

  // 猎鹰9：opts.payload = 'fairing' | 'dragon' | 'none'；opts.legs 0..1 着陆腿展开；opts.fins 0..1 栅格舵展开；opts.stage = 'full' | 'booster'
  function falcon9(o = {}) {
    const D = 3.7, parts = [], legs = o.legs ?? 0, fins = o.fins ?? 0, booster = o.stage === 'booster';
    const H1 = 41;                          // 一级（含级间段）
    const body = P2(); rect(body, -D / 2, -H1, D, H1);
    if (!booster) rect(body, -D / 2, -H1 - 13, D, 13);
    parts.push({ k: 'body', p: body });
    const dark = P2();
    rect(dark, -D / 2, -H1, D, 4.2);         // 黑色级间段
    rect(dark, -D / 2, -1.4, D, 1.4);        // 底部发动机罩
    parts.push({ k: 'dark', p: dark });
    // 栅格舵（顶部四片，侧视两片）：展开时向外翻出
    const gf = P2(), fy = -H1 + 0.6, fl = 1.0 + fins * 0.9;
    rect(gf, -D / 2 - fl, fy, fl, 1.4); rect(gf, D / 2, fy, fl, 1.4); parts.push({ k: 'dark', p: gf });
    // 着陆腿：铰接在箭体底部，收起时贴着箭体朝上，展开时向下外翻，脚落在发动机喷口平面略下方（legs=1 时脚底 y≈+1.3）
    const lg = P2(), L = 9.5, ang = legs * 1.82;
    for (const s of [-1, 1]) { const x0 = s * D / 2, y0 = -1.2, x1 = x0 + s * Math.sin(ang) * L, y1 = y0 - Math.cos(ang) * L;
      lg.moveTo(x0, y0); lg.lineTo(x0, y0 - 0.6); lg.lineTo(x1 + s * 0.15, y1 - 0.2); lg.lineTo(x1 + s * 0.45, y1 + 0.3); lg.lineTo(x1 - s * 0.35, y1 + 0.3); lg.closePath(); }
    parts.push({ k: 'dark', p: lg });
    parts.push({ k: 'engine', p: bell(0, 1.0, 2.6, 1.0) });
    let h = H1;
    if (!booster) {
      if (o.payload === 'dragon') { const dr = dragon({ trunk: true }); dr.parts.forEach(q => { const p = P2(); p.addPath(q.p, new DOMMatrix().translate(0, -H1 - 13)); parts.push({ k: q.k, p }); }); h = H1 + 13 + dr.h; }
      else if (o.payload !== 'none') { const f = P2(); rect(f, -2.6, -H1 - 13 - 6.5, 5.2, 6.5); parts.push({ k: 'nose', p: f }); parts.push({ k: 'nose', p: ogive(5.2, 6.5, -H1 - 13 - 6.5) }); h = H1 + 26; }
      else h = H1 + 13;
    }
    return { parts, h, w: D, a: { top: [0, -h], base: [0, 1.0], interstage: [0, -H1], legs: [0, -9.5] } };
  }

  // 龙飞船（载人龙外形：截锥舱体＋尾段 trunk），底部在 y=0
  function dragon(o = {}) {
    const parts = [], tr = o.trunk !== false, y0 = tr ? -2.8 : 0;
    if (tr) { const t = P2(); rect(t, -1.85, -2.8, 3.7, 2.8); parts.push({ k: 'trunk', p: t }); }
    parts.push({ k: 'body', p: poly([[-1.95, y0], [1.95, y0], [1.25, y0 - 3.6], [-1.25, y0 - 3.6]]) });
    const nose = P2(); nose.ellipse(0, y0 - 3.6, 1.25, 0.75, 0, Math.PI, 0); parts.push({ k: 'nose', p: nose });
    const win = P2(); for (const x of [-0.75, 0.75]) { win.moveTo(x + 0.28, y0 - 2.0); win.ellipse(x, y0 - 2.0, 0.28, 0.32, 0, 0, Math.PI * 2); } parts.push({ k: 'window', p: win });
    const h = (tr ? 2.8 : 0) + 4.35;
    return { parts, h, w: 3.9, a: { top: [0, -h], port: [0, -h] } };
  }

  // 重型猎鹰：三个一级并排＋中芯二级＋整流罩；opts 同 falcon9
  function heavy(o = {}) {
    const parts = [], D = 3.7, gap = 0.35;
    const c = falcon9({ ...o, payload: o.payload || 'fairing' });
    c.parts.forEach(q => parts.push(q));
    for (const s of [-1, 1]) {
      const sb = falcon9({ ...o, stage: 'booster' });
      const m = new DOMMatrix().translate(s * (D + gap), 0);
      sb.parts.forEach(q => { const p = P2(); p.addPath(q.p, m); parts.push({ k: q.k, p }); });
      const cone = P2(); cone.addPath(ogive(D, 4.5, -41), m); parts.push({ k: 'nose', p: cone });
    }
    return { parts, h: c.h, w: 3 * D + 2 * gap, a: { top: [0, -c.h], base: [0, 1.0] } };
  }

  // 超重助推器（Super Heavy）：9m 直径不锈钢，顶部热分离环＋四片栅格舵（侧视两片）
  function superHeavy(o = {}) {
    const D = 9, H = 71, parts = [];
    const b = P2(); rect(b, -D / 2, -H, D, H); parts.push({ k: 'body', p: b });
    const d = P2(); rect(d, -D / 2, -H, D, 1.8); for (let i = 0; i < 6; i++) rect(d, -D / 2 + 0.6 + i * 1.35, -H + 0.3, 0.7, 1.2);   // 热分离环（镂空格）
    rect(d, -D / 2 - 2.6 * (o.fins ?? 1), -H + 3.5, 2.6 * (o.fins ?? 1), 2.2); rect(d, D / 2, -H + 3.5, 2.6 * (o.fins ?? 1), 2.2);   // 栅格舵
    parts.push({ k: 'dark', p: d });
    // 接驳销（被「筷子」接住的位置），在栅格舵下方两侧
    const pin = P2(); rect(pin, -D / 2 - 0.9, -H + 7.2, 0.9, 0.8); rect(pin, D / 2, -H + 7.2, 0.9, 0.8); parts.push({ k: 'dark', p: pin });
    const eng = P2(); for (let i = -3; i <= 3; i++) { eng.addPath(bell(i * 1.2, 1.2, 1.1, 1.2)); } parts.push({ k: 'engine', p: eng });
    return { parts, h: H, w: D, a: { top: [0, -H], base: [0, 1.2], pins: [0, -H + 7.6] } };
  }

  // 星舰飞船（Ship）：不锈钢圆柱＋尖拱头锥＋前后两对襟翼（侧视各两片）
  function ship(o = {}) {
    const D = 9, H = 52, Hc = 36, parts = [], fl = o.flap ?? 0;   // flap：襟翼摆角（弧度，±0.6）
    const b = P2(); rect(b, -D / 2, -Hc, D, Hc); parts.push({ k: 'body', p: b });
    parts.push({ k: 'nose', p: ogive(D, H - Hc, -Hc) });
    const f = P2();
    for (const s of [-1, 1]) {
      const fx = s * D / 2;   // 后襟翼（大）
      const aft = [[fx, -2], [fx + s * 3.2, -1 + Math.sin(fl) * 2], [fx + s * 3.2, -9 + Math.sin(fl) * 2], [fx, -11]];
      f.addPath(poly(aft));
      const fw = [[s * D * 0.42, -Hc - 6], [s * (D * 0.42 + 2.2), -Hc - 5 + Math.sin(-fl) * 1.5], [s * (D * 0.38 + 2.0), -Hc - 11 + Math.sin(-fl) * 1.5], [s * D * 0.36, -Hc - 12]];
      f.addPath(poly(fw));
    }
    parts.push({ k: 'flap', p: f });
    const eng = P2(); for (let i = -1; i <= 1; i++) eng.addPath(bell(i * 2.4, 1.6, 2.0, 1.6)); parts.push({ k: 'engine', p: eng });
    const tiles = P2(); rect(tiles, -D / 2, -Hc, D * 0.32, Hc); parts.push({ k: 'tiles', p: tiles });   // 迎风面黑色隔热瓦（左半）
    return { parts, h: H, w: D, a: { top: [0, -H], base: [0, 1.6] } };
  }

  // 全箭：超重＋飞船叠放
  function starship(o = {}) {
    const sh = superHeavy(o), sp = ship(o), parts = [...sh.parts];
    const m = new DOMMatrix().translate(0, -sh.h);
    sp.parts.forEach(q => { if (q.k === 'engine') return; const p = P2(); p.addPath(q.p, m); parts.push({ k: q.k, p }); });
    return { parts, h: sh.h + sp.h, w: 9, a: { top: [0, -(sh.h + sp.h)], base: [0, 1.2], stage: [0, -sh.h] } };
  }

  // 发射塔（「机甲哥斯拉」）：桁架塔＋两只「筷子」机械臂。opts.armY 臂所在高度（m，向上为正），opts.open 0..1 张开角
  function tower(o = {}) {
    const H = 146, Wt = 12, parts = [], armY = o.armY ?? 70, open = o.open ?? 0;
    const t = P2(); rect(t, 0, -H, Wt, H); parts.push({ k: 'body', p: t });
    const lat = P2();                                   // 桁架斜撑（细线，作为 dark 填充的细条）
    for (let y = 0; y < H; y += 8) { lat.moveTo(0, -y); lat.lineTo(Wt, -y - 8); lat.lineTo(Wt, -y - 7.4); lat.lineTo(0.6, -y); lat.closePath(); }
    parts.push({ k: 'truss', p: lat });
    const arm = P2(), L = o.len ?? 30;                  // 两只臂从塔左侧伸出（略俯视的 V 字）：open=0 合拢夹住，1 张开
    for (const s of [-1, 1]) {
      const y0 = -armY, dy = s * (1.3 + open * 5.5);
      arm.moveTo(0, y0 + s * 1.3 - 1.1); arm.lineTo(-L, y0 + dy - 0.9); arm.lineTo(-L, y0 + dy + 0.9); arm.lineTo(0, y0 + s * 1.3 + 1.1); arm.closePath();
    }
    parts.push({ k: 'dark', p: arm });
    return { parts, h: H, w: Wt, a: { top: [Wt / 2, -H], armRoot: [0, -armY], armTip: [-L, -armY] } };
  }

  // 尾焰：在 (x, y) 向下（局部 +y）喷 len 长，w 宽；t 驱动闪烁（确定性）；pal = [外, 中, 芯]
  function flame(c, x, y, len, w, t, pal = ['rgba(255,120,30,0.85)', 'rgba(255,200,80,0.95)', '#fff6d8'], seed = 0) {
    const fl = (k) => 1 + 0.08 * Math.sin(t * 37 + k + seed) + 0.05 * Math.sin(t * 61 + 2 * k + seed);
    const layer = (sc, col, k) => { const L = len * sc * fl(k), ww = w * (0.55 + 0.45 * sc);
      c.fillStyle = col; c.beginPath(); c.moveTo(x - ww / 2, y); c.quadraticCurveTo(x - ww * 0.55, y + L * 0.45, x, y + L); c.quadraticCurveTo(x + ww * 0.55, y + L * 0.45, x + ww / 2, y); c.closePath(); c.fill(); };
    layer(1, pal[0], 1); layer(0.66, pal[1], 2); layer(0.36, pal[2], 3);
  }

  // 朴素平涂：pal = {body, dark, nose, window, trunk, flap, engine, tiles, truss, line?, lw?}
  function fill(c, shape, pal) {
    for (const q of shape.parts) { const col = pal[q.k] ?? pal.body; if (!col) continue; c.fillStyle = col; c.fill(q.p); }
    if (pal.line) { c.lineWidth = pal.lw || 0.25; c.strokeStyle = pal.line; c.lineJoin = 'round'; for (const q of shape.parts) if (q.k !== 'truss') c.stroke(q.p); }
  }
  // 放置：在屏幕 (x, y) 处、以 px/m 缩放、旋转 rot（弧度，0＝竖直向上）画 fn(c)
  function at(c, x, y, s, rot, fn) { c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s); fn(c); c.restore(); }

  return { falcon1, falcon9, dragon, heavy, superHeavy, ship, starship, tower, flame, fill, at, ogive, poly };
})();
