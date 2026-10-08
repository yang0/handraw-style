// 1642 伦勃朗明暗法 —— 纯代码。
// 管线：①亮态底稿（按「全亮」时的颜色画房间、桌毯、窗）→ ②褐色笔触重画（静态缓存）→ ③角色平涂＋体积渐变＋细笔触
//      → ④光照图 multiply（环境≈0.13，窗光池/人脸/猫/桌面/烛光，缓慢摇曳）→ ⑤厚涂高光（凸起：暗影偏移＋主笔＋亮脊）
//      → ⑥光柱浮尘、烛焰、热气 → ⑦金褐釉＋龟裂＋暗角＋颗粒
SCENES['32_rembrandt'] = (() => {
  const W = 1920, H = 1080, { clamp, lerp, rng } = U, P = PAINT;
  const WIN = [350, 120, 810, 560];
  const flick = (t, k = 0) => 0.5 * P.noise(t * 2.2 + k * 7.3, k * 3.1) + 0.25 * P.noise(t * 6.5 + k, 9 + k);   // 约 ±0.35

  // ---------- ① 亮态底稿（静态） ----------
  function room(g) {
    // 墙：暖褐，向右变深
    const wg = g.createLinearGradient(0, 0, W, 0); wg.addColorStop(0, '#6a4a2a'); wg.addColorStop(0.5, '#4a321c'); wg.addColorStop(1, '#2a1a0e');
    g.fillStyle = wg; g.fillRect(0, 0, W, H);
    // 地面
    g.fillStyle = '#3a2614'; g.fillRect(0, 880, W, 200);
    // 窗洞（厚墙斜面）
    g.fillStyle = '#8a6a44'; g.beginPath(); g.moveTo(322, 96); g.lineTo(838, 96); g.lineTo(810, 120); g.lineTo(350, 120); g.closePath(); g.fill();
    g.fillStyle = '#9a7a50'; g.beginPath(); g.moveTo(322, 96); g.lineTo(350, 120); g.lineTo(350, 560); g.lineTo(322, 590); g.closePath(); g.fill();
    g.fillStyle = '#5a3e22'; g.beginPath(); g.moveTo(838, 96); g.lineTo(810, 120); g.lineTo(810, 560); g.lineTo(838, 590); g.closePath(); g.fill();
    // 玻璃：铅条菱格＋牛眼玻璃
    g.save(); g.beginPath(); g.rect(350, 120, 460, 440); g.clip();
    const gg = g.createRadialGradient(560, 300, 20, 580, 340, 360); gg.addColorStop(0, '#fff6dc'); gg.addColorStop(0.6, '#f0d8a0'); gg.addColorStop(1, '#c49a5a');
    g.fillStyle = gg; g.fillRect(350, 120, 460, 440);
    const r = rng(42);
    for (let i = 0; i < 70; i++) { const x = 350 + r() * 460, y = 120 + r() * 440, rr = 6 + r() * 14; g.fillStyle = `rgba(${r() < .5 ? '255,250,230' : '190,150,90'},${0.15 + r() * 0.2})`; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 3;
    for (let k = -12; k < 16; k++) { g.beginPath(); g.moveTo(350 + k * 46, 120); g.lineTo(350 + k * 46 + 440 * 0.55, 560); g.stroke(); g.beginPath(); g.moveTo(350 + k * 46, 560); g.lineTo(350 + k * 46 + 440 * 0.55, 120); g.stroke(); }
    g.restore();
    // 窗框与中梃、横档
    g.fillStyle = '#2a1a0e'; g.fillRect(350, 120, 460, 12); g.fillRect(350, 548, 460, 12); g.fillRect(350, 120, 12, 440); g.fillRect(798, 120, 12, 440);
    g.fillRect(573, 120, 14, 440); g.fillRect(350, 330, 460, 12);
    // 窗台
    g.fillStyle = '#7a5a36'; g.fillRect(310, 560, 540, 24); g.fillStyle = '#4a321c'; g.fillRect(310, 584, 540, 14);
    // 右侧重帷幕（深红褐，大褶）
    const cg = g.createLinearGradient(1500, 0, 1920, 0); cg.addColorStop(0, '#4a1a10'); cg.addColorStop(1, '#2a0c06'); g.fillStyle = cg;
    g.beginPath(); g.moveTo(1560, 0); g.bezierCurveTo(1600, 300, 1540, 600, 1600, 1080); g.lineTo(1920, 1080); g.lineTo(1920, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,50,30,.6)'; g.lineWidth = 10; [1640, 1720, 1810].forEach((x, k) => { g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 30, 300, x - 30, 650, x + 10 * k, 1080); g.stroke(); });
    // 椅背（少女身后，深色雕花）
    g.fillStyle = '#2e1c0e'; g.fillRect(1428, 450, 22, 470); g.fillRect(1476, 460, 20, 460); g.fillRect(1424, 440, 80, 24);
    g.fillStyle = '#6a3a22'; g.fillRect(1440, 500, 50, 180);
  }
  function table(g) {
    // 桌：土耳其桌毯盖住，垂到地面，金色流苏
    g.fillStyle = '#7a2a18'; g.beginPath(); g.moveTo(800, 618); g.lineTo(1215, 618); g.lineTo(1240, 880); g.quadraticCurveTo(1020, 900, 790, 885); g.closePath(); g.fill();
    g.fillStyle = '#9a3a1e'; g.fillRect(800, 610, 415, 22);
    // 毯面纹样：菱形徽章＋边带
    g.strokeStyle = '#c8943a'; g.lineWidth = 6; g.beginPath(); g.moveTo(805, 660); g.lineTo(1220, 660); g.stroke(); g.beginPath(); g.moveTo(800, 840); g.lineTo(1236, 840); g.stroke();
    g.fillStyle = '#2a3a5a'; [[900, 750], [1020, 755], [1140, 750]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y - 60); g.lineTo(x + 45, y); g.lineTo(x, y + 60); g.lineTo(x - 45, y); g.closePath(); g.fill(); });
    g.fillStyle = '#c8943a'; [[900, 750], [1020, 755], [1140, 750]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x + 20, y); g.lineTo(x, y + 26); g.lineTo(x - 20, y); g.closePath(); g.fill(); });
    g.strokeStyle = '#d0a050'; g.lineWidth = 3; for (let x = 795; x < 1238; x += 9) { g.beginPath(); g.moveTo(x, 884); g.lineTo(x + 2, 902); g.stroke(); }
  }
  function tableProps(g) {
    // 桌上：打开的书、锡壶、烛台
    g.fillStyle = '#e8d6aa'; g.beginPath(); g.moveTo(940, 612); g.lineTo(1010, 598); g.lineTo(1080, 612); g.lineTo(1010, 624); g.closePath(); g.fill();
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(1010, 598); g.lineTo(1010, 624); g.stroke();
    g.fillStyle = '#7a7466'; g.beginPath(); g.moveTo(1100, 610); g.quadraticCurveTo(1090, 560, 1108, 530); g.lineTo(1132, 530); g.quadraticCurveTo(1150, 560, 1140, 610); g.closePath(); g.fill();
    g.strokeStyle = '#7a7466'; g.lineWidth = 7; g.beginPath(); g.arc(1150, 565, 18, -1.3, 1.3); g.stroke();
    // 烛台（黄铜）＋蜡烛
    g.fillStyle = '#9a7432'; g.beginPath(); g.ellipse(870, 612, 36, 9, 0, 0, Math.PI * 2); g.fill(); g.fillRect(864, 560, 12, 52); g.beginPath(); g.ellipse(870, 560, 20, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#efe2c0'; g.fillRect(861, 500, 18, 60);
  }
  // ---------- ② 褐色笔触重画（静态，缓存） ----------
  const SW = {
    wall: P.swatch(['#5a3c20', '#6e4a28', '#4e3418', '#6a4a28', '#4a3018', '#765030'], 0.7),
    dark: P.swatch(['#2a1a0c', '#3a2412', '#1e1208', '#4a2e16'], 0.5),
    rug: P.swatch(['#8a2e18', '#6a2010', '#a8441e', '#c8943a', '#2a3a5a'], 0.7),
    glass: P.swatch(['#fff2d0', '#f2d8a0', '#e8c888', '#fff8e8'], 0.6),
  };
  const stat = () => P.cached('rb_static', W, H, (g, cv) => {
    const b = P.canvas(), bg = b.getContext('2d'); room(bg);
    g.drawImage(b, 0, 0);
    // 背景：宽松的褐色笔触（伦勃朗背景的刷痕），再整体轻模糊成「揉开」的底子
    P.strokes(g, b, { cell: 18, len: 54, width: 16, seed: 3, t: 0, boil: 0, outline: 0, jitterCol: 6,
      angle: (x, y) => -0.9 + 1.6 * P.noise(x * 0.003, y * 0.003),
      palette: (x, y, col, r) => (x > 1520 || y > 880 ? SW.dark(col, r) : SW.wall(col, r)),
      mask: (x, y) => !(x > 300 && x < 860 && y > 80 && y < 610) });
    { const tmp = P.canvas(), tg = tmp.getContext('2d'); tg.filter = 'blur(2.2px)'; tg.drawImage(cv, 0, 0); g.globalAlpha = 0.75; g.drawImage(tmp, 0, 0); g.globalAlpha = 1; }
    g.drawImage(b, 300, 80, 560, 530, 300, 80, 560, 530);                  // 窗与窗台保留清楚的木作
    // 桌毯：单独一层、单独更细的笔触（小物件不被大笔触打碎），再放桌上小物
    const tb = P.canvas(), tbg = tb.getContext('2d'); table(tbg);
    tbg.save(); tbg.globalCompositeOperation = 'source-atop';
    P.strokes(tbg, tb, { cell: 8, len: 16, width: 6, seed: 5, t: 0, boil: 0, outline: 0.25, outlineCol: [30, 10, 5], outlineMix: 0.6, jitterCol: 14, alphaMask: true, angle: (x, y) => y > 840 ? Math.PI / 2 : 0.1 * P.noise(x * 0.02, y * 0.02) });
    tbg.restore(); tableProps(tbg); g.drawImage(tb, 0, 0);
  });

  // ---------- 光照图（每帧） ----------
  const pool = P.pool;   // 光池（径向渐变）
  const beam = () => P.cached('rb_beam', W, H, (g) => {
    g.filter = 'blur(40px)'; g.fillStyle = 'rgba(255,232,190,0.55)';
    g.beginPath(); g.moveTo(360, 130); g.lineTo(800, 130); g.lineTo(1500, 760); g.lineTo(1300, 1000); g.lineTo(380, 1000); g.lineTo(340, 560); g.closePath(); g.fill();
    g.filter = 'none';
  });
  const cloudAt = t => 0.5 + 0.5 * Math.sin(t * 2.2 - 0.6);                    // 云影：窗光慢慢暗下去又回来
  // 光照图：环境光 rgb(30,21,13) 打底，lighter 叠光池（P.lightMap），之后整幅 multiply（P.applyLight）
  function lightMap(t, G, K) {
    const f = flick(t), fc = flick(t * 1.7, 3);
    return P.lightMap('rembrandt', 'rgb(30,21,13)', g => {
      const cloud = cloudAt(t);
      g.globalAlpha = (0.8 + 0.15 * f) * (1 - 0.35 * cloud); g.drawImage(beam(), 0, 0); g.globalAlpha = 1;
      pool(g, 580, 340, 330, '255,246,225', 1 - 0.3 * cloud);                     // 窗本身
      pool(g, 1470, 400, 300, '200,150,90', 0.35);                                // 背后墙面的分离光（暗侧亮墙）
      const dx = 14 * P.noise(t * 0.9, 1), dy = 10 * P.noise(t * 0.9, 5);        // 光池缓慢漂移（云影/烛焰摇曳）
      pool(g, G.A.headC[0] - 30 + dx, G.A.headC[1] + 10 + dy, 250, '255,226,180', 0.95 + 0.08 * f);
      pool(g, G.A.chest[0] - 40 + dx, G.A.chest[1] + 40, 230, '255,214,160', 0.55);
      pool(g, K.headC[0] - 10, K.headC[1] + 90 + dy, 240, '255,220,170', 0.8 + 0.08 * f);
      pool(g, 1010, 640 + dy, 280, '255,214,160', 0.6);
      pool(g, 870, 490, 190 + 40 * fc, '255,180,90', 0.6 + 0.4 * fc);            // 烛光（快闪）
    });
  }
  // ---------- 厚涂：凸起的颜料（暗影偏移＋主笔＋亮脊） ----------
  // 第一版「暗影＋主笔＋亮脊」三条整齐的线读成贴纸。改成鬃毛笔：一笔 = 若干条平行细鬃（各自明暗抖动、两端随机缩短），
  // 下侧一条很淡的投影，上侧零星亮点——读成「一坨被刷开的厚颜料」。
  const impasto = P.impasto;   // 厚涂鬃毛笔

  const girlPal = { skin: '#eccaa0', hair: '#b8873a', hairLine: '#6a4818', dress: '#3a2014', sleeve: '#5c2c18', fold: '#24120a', cuff: '#efe6d0',
    cheek: 'rgba(220,120,90,.35)', lip: '#b8524a', iris: '#4a3a2a', line: '#3a2010', lw: 0, cupBody: '#e6e4dc', cupRim: '#6a4a28', shoe: '#1a0e06', browC: '#9a6a2a' };
  const catPal = { orange: '#c47a34', white: '#eedcb8', stripe: '#8a4a18', line: '#2a160a', lw: 0, eye: '#b89a3a', earInner: '#c88a70', noseC: '#b86a5a', whisker: '#efe0c0' };

  return {
    draw(c, lt, t) {
      const ch = P.choreo(lt, t);
      const G = RIG.girl({ cup: ch.cup, sip: ch.sip, breathe: ch.breathe, hair: 'bun' });
      const K = RIG.cat({ tail: ch.tail, blink: ch.blink, breathe: ch.breathe });
      // ① ② 静态底
      const S = P.scratch('rbScene'), sg = S.getContext('2d'); sg.reset(); sg.drawImage(stat(), 0, 0);
      // ③ 角色层
      const L = P.scratch('rbChars'), lg = L.getContext('2d'); lg.reset();
      RIG.drawCat(lg, K, catPal);
      RIG.drawGirl(lg, G, { ...girlPal, mode: 'fill' });
      // 服饰：宽白领（平摊在肩上的花边大领）、白亚麻小帽、珍珠耳坠
      lg.save(); lg.lineJoin = 'round';
      const n = G.A.neck, ch_ = G.A.chest, bk = G.A.back;
      lg.fillStyle = '#f0e8d4';
      const collar = [[n[0] - 22, n[1] - 8], [n[0] - 30, n[1] + 22], [ch_[0] - 14, ch_[1] - 4], [n[0] + 10, ch_[1] + 16], [n[0] + 52, ch_[1] + 6], [bk[0] - 26, n[1] + 52], [n[0] + 46, n[1] - 4], [n[0] + 10, n[1] - 14]];
      lg.fill(RIG.smooth(collar));
      lg.fillStyle = '#f6f0e2'; for (let k = 0; k < 11; k++) { const q = k / 10, x = lerp(ch_[0] - 14, bk[0] - 26, q), y = lerp(ch_[1] - 4, n[1] + 52, q) + Math.sin(q * Math.PI) * 22; lg.beginPath(); lg.arc(x, y, 7, 0, Math.PI * 2); lg.fill(); }
      lg.strokeStyle = 'rgba(150,130,100,.7)'; lg.lineWidth = 1.5; lg.setLineDash([2, 4]); lg.stroke(RIG.smooth(collar.map(p => [lerp(p[0], n[0] + 14, 0.25), lerp(p[1], n[1] + 30, 0.25)]))); lg.setLineDash([]);
      const hc = G.A.headC;
      lg.fillStyle = '#efe6d0'; for (let k = 0; k < 9; k++) { const a = -2.2 + k * 0.32; lg.beginPath(); lg.arc(G.bunSpiral[0] + Math.cos(a) * 27, G.bunSpiral[1] + Math.sin(a) * 27, 4.5, 0, Math.PI * 2); lg.fill(); }
      lg.fillStyle = '#f6f0e0'; lg.beginPath(); lg.arc(G.ear[0] - 2, G.ear[1] + 24, 5, 0, Math.PI * 2); lg.fill();
      lg.restore();
      // 体积：左上受光 → 右下沉入暗部（source-atop 只染在角色上）
      lg.save(); lg.globalCompositeOperation = 'source-atop';
      let vg = lg.createLinearGradient(1180, 300, 1480, 760); vg.addColorStop(0, 'rgba(255,240,200,.12)'); vg.addColorStop(0.5, 'rgba(30,14,6,.15)'); vg.addColorStop(1, 'rgba(10,5,2,.7)'); lg.fillStyle = vg; lg.fillRect(1060, 200, 460, 760);
      vg = lg.createLinearGradient(420, 600, 680, 900); vg.addColorStop(0, 'rgba(255,240,200,.1)'); vg.addColorStop(1, 'rgba(20,10,4,.55)'); lg.fillStyle = vg; lg.fillRect(380, 520, 360, 400);
      // 裙子厚褶：几道深浅交替的宽笔
      lg.lineCap = 'round'; G.folds.forEach((f, i) => { lg.strokeStyle = 'rgba(10,4,2,.5)'; lg.lineWidth = 16; lg.stroke(f); lg.strokeStyle = 'rgba(120,70,40,.25)'; lg.lineWidth = 6; lg.save(); lg.translate(-12, 0); lg.stroke(f); lg.restore(); });
      // 细笔触肌理（不沸腾：古典油画）
      P.strokes(lg, L, { cell: 6, len: 13, width: 5, seed: 8, t: 0, boil: 0, outline: 0, jitterCol: 9, alphaMask: true,
        angle: (x, y) => x < 760 ? Math.atan2(y - 780, x - 540) + Math.PI / 2 : 1.2 + 0.4 * P.noise(x * 0.01, y * 0.01) });
      lg.restore();
      // 脸再盖一层平滑（伦勃朗的脸是揉开的，不留碎笔）＋眼睛
      lg.save(); lg.clip(G.face); const fg = lg.createRadialGradient(G.A.forehead[0], G.A.forehead[1] + 20, 5, G.A.headC[0], G.A.headC[1], 90);
      fg.addColorStop(0, '#f6dcb6'); fg.addColorStop(0.6, '#d8a87a'); fg.addColorStop(1, '#7a4a2a'); lg.fillStyle = fg; lg.fill(G.face); lg.restore();
      // 面部塑形：脸后半（靠耳）沉入暖褐半调；眼窝一抹阴影；颧骨一块三角受光（伦勃朗光的小三角）
      lg.save(); lg.clip(G.face);
      let sg2 = lg.createLinearGradient(G.A.forehead[0], 0, G.ear[0] + 10, 0); sg2.addColorStop(0, 'rgba(0,0,0,0)'); sg2.addColorStop(0.5, 'rgba(120,60,25,.25)'); sg2.addColorStop(1, 'rgba(70,32,12,.75)'); lg.fillStyle = sg2; lg.fill(G.face);
      lg.fillStyle = 'rgba(110,55,25,.35)'; lg.beginPath(); lg.ellipse(G.eye.x + 4, G.eye.y - 2, 13, 8, 0.2, 0, 7); lg.fill();
      lg.fillStyle = 'rgba(255,232,190,.55)'; lg.beginPath(); lg.moveTo(G.eye.x - 4, G.eye.y + 10); lg.lineTo(G.eye.x + 20, G.eye.y + 12); lg.lineTo(G.eye.x + 4, G.eye.y + 34); lg.closePath(); lg.fill();
      lg.restore();
      lg.fillStyle = '#c48a70'; lg.beginPath(); lg.moveTo(...G.lips[0]); lg.lineTo(...G.lips[1]); lg.lineTo(...G.lips[2]); lg.fill();
      lg.strokeStyle = '#4a2a14'; lg.lineWidth = 2.6; lg.lineCap = 'round'; lg.stroke(G.lid); lg.strokeStyle = '#8a5a2a'; lg.lineWidth = 2; lg.stroke(G.brow);
      if (!ch.blink) { lg.fillStyle = '#2a1a0e'; lg.beginPath(); lg.arc(G.eye.x - 1, G.eye.y + 1.5, 4, 0, Math.PI * 2); lg.fill(); }
      // 刘海重新盖在脸上
      lg.fillStyle = girlPal.hair; lg.fill(G.bangs); lg.strokeStyle = 'rgba(120,80,30,.6)'; lg.lineWidth = 2; G.hairLines.forEach(h => lg.stroke(h));
      // 杯与手重新盖上（白瓷杯＋青花一圈）
      lg.fillStyle = '#e2b890'; lg.fill(G.hand);
      RIG.drawCup(lg, G.cup, { body: '#e8e6de', rim: '#5a3a1c', hw: 6 });
      lg.save(); lg.translate(G.cup.x, G.cup.y); lg.rotate(G.cup.tilt); lg.strokeStyle = '#3a4a8a'; lg.lineWidth = 3; lg.beginPath(); lg.moveTo(-G.cup.w * 0.46, G.cup.h * 0.45); lg.quadraticCurveTo(0, G.cup.h * 0.6, G.cup.w * 0.46, G.cup.h * 0.45); lg.stroke(); lg.restore();
      lg.save(); lg.translate(G.cup.x, G.cup.y); lg.rotate(G.cup.tilt); lg.fillStyle = '#d9ad82';
      for (let k = 0; k < 3; k++) { lg.beginPath(); lg.ellipse(G.cup.w * 0.42, G.cup.h * (0.3 + k * 0.22), 9, 5.5, 0.2, 0, 7); lg.fill(); } lg.restore();
      lg.fillStyle = '#e2b890'; lg.beginPath(); lg.arc(G.thumb[0], G.thumb[1], 7, 0, Math.PI * 2); lg.fill();
      // 「失边」：角色先糊一遍整层（暗侧会和背景融成一片），再叠 0.6 清晰层留住五官
      sg.save(); sg.filter = 'blur(2.4px)'; sg.drawImage(L, 0, 0); sg.restore(); sg.globalAlpha = 0.62; sg.drawImage(L, 0, 0); sg.globalAlpha = 1;
      // ④ 光照 multiply
      P.applyLight(sg, lightMap(t, G, K));
      // 窗玻璃本身是光源：再亮一点（screen）
      sg.save(); sg.globalCompositeOperation = 'screen'; sg.globalAlpha = 0.35 + 0.08 * flick(t); sg.drawImage(stat(), 352, 122, 456, 436, 352, 122, 456, 436); sg.restore();
      c.drawImage(S, 0, 0);
      c.save(); c.beginPath(); c.rect(352, 122, 456, 436); c.clip();
      const cx_ = 200 + ((t * 260) % 900); const cgr = c.createRadialGradient(cx_, 300, 20, cx_, 300, 260); cgr.addColorStop(0, 'rgba(60,40,20,.35)'); cgr.addColorStop(1, 'rgba(60,40,20,0)');
      c.fillStyle = cgr; c.fillRect(352, 122, 456, 436); c.restore();
      // ⑤ 厚涂高光（跟着锚点走）
      const fh = G.A.forehead, hd = G.hand, cp = G.cup;
      [[0, -14, 40, -26], [14, -2, 56, -12], [40, 6, 84, 2]].forEach(([a, b, c2, d]) => impasto(c, [[fh[0] + a, fh[1] + b], [fh[0] + (a + c2) / 2, fh[1] + (b + d) / 2 - 4], [fh[0] + c2, fh[1] + d]], 7, '#f0c870', 'rgba(255,240,190,.8)'));   // 金发受光
      impasto(c, [[G.cheek[0] - 22, G.cheek[1] - 10], [G.cheek[0] - 12, G.cheek[1] - 14]], 4, '#eecba0', 'rgba(255,240,210,.5)');
      for (let k = 0; k < 6; k++) { const q = k / 5, x = lerp(n[0] - 26, ch_[0] - 12, q) + 6, y = lerp(n[1] + 6, ch_[1] - 6, q); impasto(c, [[x, y], [x + 9, y + 3]], 4.5, 'rgba(246,238,218,.9)', 'rgba(255,255,245,.45)'); }   // 领口受光边：一串短厚笔
      impasto(c, [[cp.x - cp.w * 0.28, cp.y + 6], [cp.x - cp.w * 0.3, cp.y + cp.h * 0.6]], 3.5, '#fbf8f0');                                    // 瓷杯反光
      impasto(c, [[G.ear[0] - 3, G.ear[1] + 22], [G.ear[0] - 2, G.ear[1] + 23]], 3.5, '#ffffff');                                              // 珍珠
      for (let k = 0; k < 9; k += 2) { const a = -2.2 + k * 0.32; const px = G.bunSpiral[0] + Math.cos(a) * 27, py = G.bunSpiral[1] + Math.sin(a) * 27; impasto(c, [[px - 1, py - 1], [px, py - 1.5]], 3, '#fff8e8'); }
      const fur = U.rng(23); for (let k = 0; k < 9; k++) { const x = 572 + fur() * 40, y = 706 + k * 12; impasto(c, [[x, y], [x + 4, y + 8]], 4, '#ecdcba', 'rgba(255,248,226,.55)'); }   // 猫白胸短毛
      impasto(c, [[K.nose[0] - 28, K.nose[1] + 8], [K.nose[0] - 16, K.nose[1] + 12]], 4, '#efe0c0', 'rgba(255,248,226,.55)');
      for (let k = 0; k < 5; k++) impasto(c, [[572 + k * 14, 590 - (k % 2) * 4], [580 + k * 14, 598]], 4, '#d88a40', 'rgba(255,214,150,.6)');   // 猫头顶橘毛
      if (!ch.blink) K.eyes.forEach(e => { c.fillStyle = 'rgba(255,248,220,.95)'; c.beginPath(); c.arc(e.x - 2, e.y - 3, 2.6, 0, Math.PI * 2); c.fill(); });
      impasto(c, [[1030, 610], [1060, 606]], 5, '#f6e8c0'); impasto(c, [[1114, 545], [1111, 588]], 4, '#a8a498', 'rgba(240,236,220,.6)');          // 书页、锡壶
      // ⑥ 会动：烛焰（摇曳）、光柱浮尘、热气
      const fc = flick(t * 1.7, 3), fx = 870 + 5 * P.noise(t * 5, 2), lean = 6 * P.noise(t * 3, 8);
      c.save(); c.globalCompositeOperation = 'lighter';
      pool(c, fx, 470, 70 + 12 * fc, '255,170,70', 0.45 + 0.2 * fc);
      c.fillStyle = '#ffd890'; c.beginPath(); c.moveTo(fx - 8, 498); c.quadraticCurveTo(fx - 10, 478, fx + lean, 452 - 8 * fc); c.quadraticCurveTo(fx + 10, 478, fx + 8, 498); c.closePath(); c.fill();
      c.fillStyle = '#fff6d8'; c.beginPath(); c.ellipse(fx + lean * 0.3, 488, 4, 9, 0, 0, Math.PI * 2); c.fill();
      const dust = P.particles(70, 17, t * 0.35, { x0: 420, x1: 1300, y0: 980, y1: 160, speed: 40, drift: 26, life: 9 });
      dust.forEach((d, i) => { const along = (d.x - 380) / 1000, inBeam = d.y > 130 + along * 520 - 120 && d.y < 560 + along * 520; if (!inBeam) return;
        const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 2.1); c.fillStyle = `rgba(255,236,190,${0.25 + 0.5 * tw})`; c.beginPath(); c.arc(d.x, d.y, 1.4 + d.s * 1.6, 0, Math.PI * 2); c.fill(); });
      c.restore();
      P.steam(c, t, cp.x, cp.y - 6, { h: 60, n: 2, color: 'rgba(255,236,200,.5)', width: 3, spread: 12, wobble: 8 });
      // ⑦ 罩层：金褐釉、龟裂、暗角、颗粒（缓存）
      c.drawImage(P.cached('rb_over', W, H, (g) => {
        const vg2 = g.createRadialGradient(900, 520, 300, 960, 540, 1150); vg2.addColorStop(0, 'rgba(10,5,0,0)'); vg2.addColorStop(1, 'rgba(8,4,0,.75)'); g.fillStyle = vg2; g.fillRect(0, 0, W, H);
        g.globalAlpha = 0.28; g.drawImage(P.craquelure('rb', 0.28), 0, 0); g.globalAlpha = 1;
        g.drawImage(P.grain('rbg', 0.05, [30, 15, 5], 0.12), 0, 0);
      }), 0, 0);
      c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = 'rgba(200,140,60,.35)'; c.fillRect(0, 0, W, H); c.restore();
    },
  };
})();
