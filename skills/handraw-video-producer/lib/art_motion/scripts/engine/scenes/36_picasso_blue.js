// 1903 毕加索蓝色时期 —— 纯代码。
// 管线：①蓝单色平涂底稿（墙/地/窗外夜海）→ ②宽而干的笔触重画（区域蓝色板，墙竖刷、地横刷，不沸腾）
//      → ③角色：骨架整体拉长变瘦（El Greco 式：绕脚底 scale(0.88,1.09)），平涂＋小笔触，披肩罩头 → ④普鲁士蓝粗轮廓（只取看得见的线）
//      → ⑤会动的：缓慢呼吸（幅度×2、频率×0.45）、窗外海浪横移、月光碎影闪、热气慢升 → ⑥画布纹＋冷暗角
SCENES['36_picasso_blue'] = (() => {
  const W = 1920, H = 1080, { clamp, lerp, rng } = U, P = PAINT;
  const C = { navy: '#132240', prus: '#1d3866', cob: '#2d5a94', cer: '#6b8fb6', pale: '#b6c8d8', teal: '#3b6878', ochre: '#8c7a54', line: '#0c1830' };
  // 拉长变瘦（El Greco 式）：RIG 原生非等比缩放，以脚底为轴——路径、锚点、杯子一起变，线宽不被压扁
  const GSTR = { sx: 0.84, sy: 1.12, anchor: [1240, 932] }, CSTR = { sx: 0.82, sy: 1.14, anchor: [540, 905] };

  function base(g) {
    g.fillStyle = C.prus; g.fillRect(0, 0, W, 720);
    const wg = g.createLinearGradient(0, 0, W, 0); wg.addColorStop(0, 'rgba(110,145,185,.35)'); wg.addColorStop(0.6, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(5,10,25,.45)'); g.fillStyle = wg; g.fillRect(0, 0, W, 720);
    g.fillStyle = '#4a6c94'; g.fillRect(0, 720, W, 360);
    const fg = g.createLinearGradient(0, 720, 0, H); fg.addColorStop(0, 'rgba(10,20,40,.4)'); fg.addColorStop(1, 'rgba(150,175,200,.25)'); g.fillStyle = fg; g.fillRect(0, 720, W, 360);
    // 窗：夜海＋月
    g.fillStyle = '#7d9cbc'; g.fillRect(340, 110, 480, 460);
    const sk = g.createLinearGradient(0, 130, 0, 400); sk.addColorStop(0, '#1a2f58'); sk.addColorStop(1, '#4f74a4'); g.fillStyle = sk; g.fillRect(360, 130, 440, 270);
    g.fillStyle = '#16284c'; g.fillRect(360, 400, 440, 150);
    g.fillStyle = '#c9d6e2'; g.beginPath(); g.arc(670, 220, 30, 0, 7); g.fill();
    g.fillStyle = '#7d9cbc'; g.fillRect(572, 130, 16, 420); g.fillRect(360, 330, 440, 12);
    g.fillStyle = '#91aecb'; g.fillRect(320, 560, 520, 24);
  }
  function table(g) {
    g.fillStyle = '#20406c'; g.fillRect(806, 614, 408, 34); g.fillStyle = '#16305a'; g.fillRect(826, 648, 368, 40); g.fillRect(842, 688, 22, 216); g.fillRect(1156, 688, 22, 216);
    g.fillStyle = '#1a3460'; g.fillRect(1430, 470, 18, 440); g.fillRect(1478, 480, 18, 430); for (let k = 0; k < 3; k++) g.fillRect(1434, 520 + k * 70, 60, 12);
    // 桌上：一只水罐和一块面包（蓝色时期静物的穷与静）
    g.fillStyle = '#9fb6cc'; g.beginPath(); g.moveTo(880, 614); g.quadraticCurveTo(860, 560, 886, 530); g.lineTo(914, 530); g.quadraticCurveTo(940, 560, 920, 614); g.closePath(); g.fill();
    g.fillStyle = '#6c7f8e'; g.beginPath(); g.ellipse(1040, 604, 50, 14, 0, 0, 7); g.fill();
  }
  const SW = {
    wall: P.swatch(['#1d3866', '#24457a', '#163056', '#2e5a94', '#20406e', '#3b6878'], 0.8),
    floor: P.swatch(['#4a6c94', '#587ca2', '#3e5f86', '#6b8fb6', '#456a8a'], 0.75),
    win: P.swatch(['#7d9cbc', '#8eaac6', '#6f90b2'], 0.6),
  };
  // 第一版 cell16/len40/w14 满墙竖刷＝「下雨/毛毯」，像印象派。蓝色时期是宽、长、低对比的刷面：cell34 len110 w34，色板混底 0.8，再糊 3px。
  const stat = () => P.cached('bp_static', W, H, (g, cv) => {
    const b = P.canvas(), bg = b.getContext('2d'); base(bg); g.drawImage(b, 0, 0);
    P.strokes(g, b, { cell: 34, len: 110, width: 34, seed: 12, t: 0, boil: 0, outline: 0, jitterCol: 4,
      angle: (x, y) => y > 720 ? 0.05 * P.noise(x * 0.01, y * 0.01) : -Math.PI / 2 + 0.5 * P.noise(x * 0.003, y * 0.003),
      palette: (x, y, col, r) => (y > 720 ? SW.floor(col, r) : SW.wall(col, r)),
      mask: (x, y) => !(x > 330 && x < 830 && y > 100 && y < 595) && Math.abs(y - 720) > 20 });
    { const tmp = P.canvas(), tg = tmp.getContext('2d'); tg.filter = 'blur(7px)'; tg.drawImage(cv, 0, 0); g.globalAlpha = 0.8; g.drawImage(tmp, 0, 0); g.globalAlpha = 1; }
    // 干刷：笔触末端露底的细丝（很淡）
    const r = rng(9); g.globalAlpha = 0.07; g.strokeStyle = '#a8c0d6'; g.lineWidth = 1.2;
    for (let i = 0; i < 900; i++) { const x = r() * W, y = r() * H; if (x > 330 && x < 830 && y > 100 && y < 595) continue; const a = y > 720 ? 0 : -Math.PI / 2, L = 30 + r() * 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
    g.globalAlpha = 1;
    // 窗：保留清楚的框，只给框上小刷痕
    g.drawImage(b, 320, 100, 520, 500, 320, 100, 520, 500);
    g.save(); g.beginPath(); g.rect(320, 100, 520, 500); g.clip();
    P.strokes(g, b, { cell: 9, len: 20, width: 8, seed: 13, t: 0, boil: 0, outline: 0, jitterCol: 8, angle: (x, y) => (x > 560 && x < 600) ? -Math.PI / 2 : 0.03,
      palette: (x, y, col, r) => SW.win(col, r), mask: (x, y) => !(x > 362 && x < 798 && y > 132 && y < 548) || (x > 572 && x < 588) || (y > 330 && y < 342) });
    g.restore();
    // 桌：单独一层＋小笔触
    const tb = P.canvas(), tbg = tb.getContext('2d'); table(tbg); tbg.save(); tbg.globalCompositeOperation = 'source-atop';
    P.strokes(tbg, tb, { cell: 9, len: 26, width: 9, seed: 14, t: 0, boil: 0, outline: 0, jitterCol: 10, alphaMask: true, angle: (x, y) => y > 690 ? -Math.PI / 2 : 0.02 }); tbg.restore(); g.drawImage(tb, 0, 0);
    // 环境轮廓（普鲁士蓝粗线，不抖）
    g.strokeStyle = C.line; g.lineWidth = 5; g.lineJoin = 'round';
    [[340, 110, 480, 460], [360, 130, 440, 420], [806, 614, 408, 34], [826, 648, 368, 40], [842, 688, 22, 216], [1156, 688, 22, 216]].forEach(r_ => g.strokeRect(...r_));
    g.beginPath(); g.moveTo(0, 720); g.lineTo(806, 720); g.moveTo(1214, 720); g.lineTo(W, 720); g.stroke();
    g.beginPath(); g.moveTo(880, 614); g.quadraticCurveTo(860, 560, 886, 530); g.lineTo(914, 530); g.quadraticCurveTo(940, 560, 920, 614); g.stroke();
  });

  const girlPal = { skin: '#90a9be', hair: '#cbd8e0', hairLine: '#5f7896', dress: '#1e3a6a', sleeve: '#24457a', fold: '#10223f', cuff: '#24457a', cheek: null, lip: '#4a6a8c', iris: '#0c1830', line: C.line, lw: 5, cupBody: '#c6d4e0', cupRim: '#2d4a6e', shoe: '#0c1830', browC: '#2a3a52' };
  const catPal = { orange: '#4f719a', white: '#b6c8d8', stripe: '#273f66', line: C.line, lw: 5, eye: '#c9d6e2', earInner: '#6b8fb6', noseC: '#4a6a8c', whisker: '#c9d6e2' };

  return {
    draw(c, lt, t) {
      const br = Math.sin(t * 1.8) * 0.026;                                   // 缓慢而深的呼吸
      const cup = 0.5 - 0.5 * Math.cos(Math.min(1, lt / 1.25) * Math.PI);     // 端杯也慢
      const tail = Math.sin(t * 2.2) * 0.3;
      c.drawImage(stat(), 0, 0);
      // 窗外：海浪（横向短笔，左移）＋月光碎影（闪）
      c.save(); c.beginPath(); c.rect(360, 400, 440, 150); c.clip();
      const wr = rng(5); c.lineCap = 'round';
      for (let i = 0; i < 70; i++) { const y = 405 + wr() * 140, sp = 20 + (y - 400) * 0.25, x = 360 + ((wr() * 520 - t * sp) % 520 + 520) % 520 - 40;
        c.strokeStyle = wr() < 0.5 ? 'rgba(90,125,170,.8)' : 'rgba(30,55,95,.9)'; c.lineWidth = 3 + (y - 400) * 0.04; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 26 + (y - 400) * 0.2, y + 1); c.stroke(); }
      for (let k = 0; k < 14; k++) { const y = 410 + k * 10, tw = 0.5 + 0.5 * Math.sin(t * 5 + k * 1.9), w = (10 + k * 4) * tw; c.fillStyle = `rgba(205,220,235,${0.35 + 0.5 * tw})`; c.fillRect(670 - w / 2 + Math.sin(t * 2 + k) * 6, y, w, 3); }
      c.restore();
      // 云：一条苍白的长云缓慢横过月亮
      c.save(); c.beginPath(); c.rect(360, 130, 440, 270); c.clip(); c.fillStyle = 'rgba(150,175,205,.45)'; const cx = 400 + t * 45; c.beginPath(); c.ellipse(cx, 236, 130, 14, -0.04, 0, 7); c.fill(); c.beginPath(); c.ellipse(cx + 90, 250, 90, 9, 0, 0, 7); c.fill(); c.restore();
      // 角色
      const K = RIG.cat({ tail, blink: 0, breathe: br * 1.4, ...CSTR });
      const G = RIG.girl({ cup, sip: 0, breathe: br, hair: 'down', ...GSTR });
      const L = P.scratch('bpChars'), lg = L.getContext('2d'); lg.reset();
      RIG.drawCat(lg, K, { ...catPal, lw: 0 });
      lg.save();
      RIG.drawGirl(lg, G, { ...girlPal, mode: 'fill' });
      // 披肩：从头顶罩下，盖住后脑与肩背，落到腰
      const ht = G.A.headTop, fh = G.A.forehead, np = G.A.nape, bk = G.A.back, wa = G.A.waist, sh = G.A.shoulder;
      const shawl = RIG.smooth([[fh[0] + 14, fh[1] - 22], [ht[0] + 10, ht[1] - 26], [ht[0] + 80, ht[1] + 4], [np[0] + 50, np[1] + 10], [bk[0] + 24, bk[1] + 20], [wa[0] + 70, wa[1] - 10], [wa[0] + 20, wa[1] - 40], [sh[0] + 10, sh[1] + 30], [np[0] - 10, np[1] + 10], [ht[0] + 30, ht[1] + 40], [fh[0] + 30, fh[1] - 4]]);
      lg.fillStyle = '#6b8fb6'; lg.fill(shawl);
      // 端杯的手：长指（El Greco 式），手指绕杯
      lg.fillStyle = girlPal.skin; const hd = G.A.hand; for (let k = 0; k < 3; k++) { lg.save(); lg.translate(hd[0], hd[1]); lg.rotate(-2.4 + k * 0.28); lg.beginPath(); lg.ellipse(18, 0, 22, 4.5, 0, 0, 7); lg.fill(); lg.restore(); }
      lg.restore();
      // 小笔触肌理（只在角色上）
      lg.save(); lg.globalCompositeOperation = 'source-atop';
      P.strokes(lg, L, { cell: 7, len: 18, width: 6, seed: 21, t: 0, boil: 0, outline: 0, jitterCol: 14, alphaMask: true,
        angle: (x, y) => x < 760 ? -Math.PI / 2 + 0.6 * Math.sin(y * 0.02) : -Math.PI / 2 + 0.25 * Math.sin(x * 0.03) });
      // 冷光：左上来的微弱亮、右下沉暗
      let vg = lg.createLinearGradient(1150, 250, 1480, 900); vg.addColorStop(0, 'rgba(190,210,230,.18)'); vg.addColorStop(1, 'rgba(5,12,30,.45)'); lg.fillStyle = vg; lg.fillRect(1050, 150, 500, 820);
      vg = lg.createLinearGradient(420, 560, 700, 920); vg.addColorStop(0, 'rgba(190,210,230,.12)'); vg.addColorStop(1, 'rgba(5,12,30,.4)'); lg.fillStyle = vg; lg.fillRect(360, 500, 380, 420);
      lg.restore();
      c.drawImage(L, 0, 0);
      // 粗轮廓：只取看得见的线（猫、少女各自在拉长后的坐标里算）
      c.drawImage(RIG.visibleLines('bpCat', (g, lc) => RIG.drawCat(g, K, { ...catPal, line: lc, whisker: lc }), C.line, [330, 480, 760, 940]), 0, 0);
      c.drawImage(RIG.visibleLines('bpGirl', (g, lc) => { RIG.drawGirl(g, G, { ...girlPal, line: lc });
        g.fillStyle = '#6b8fb6'; g.fill(shawl); g.strokeStyle = lc; g.lineWidth = 5; g.stroke(shawl); }, C.line, [1040, 150, 1540, 960]), 0, 0);
      // 披肩褶：几道深蓝长线
      c.save(); c.save(); c.clip(shawl); c.strokeStyle = 'rgba(20,40,80,.6)'; c.lineWidth = 4; c.lineCap = 'round';
      [[0, 0], [24, 10], [48, 22]].forEach(([dx, dy]) => { c.beginPath(); c.moveTo(ht[0] + 30 + dx, ht[1] + dy); c.quadraticCurveTo(np[0] + 30 + dx, np[1] + 40, bk[0] + dx * 0.3, bk[1] + 60 + dy); c.stroke(); }); c.restore();
      c.restore();
      // 热气：慢
      const cpp = [G.cup.x, G.cup.y];
      P.steam(c, t * 0.5, cpp[0], cpp[1] - 8, { h: 70, n: 2, color: 'rgba(200,215,230,.55)', width: 3.5, spread: 12, wobble: 10 });
      // 画布纹＋冷暗角
      c.drawImage(P.cached('bp_over', W, H, (g) => {
        g.strokeStyle = 'rgba(10,20,40,.06)'; g.lineWidth = 1; for (let x = 0; x < W; x += 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        const v = g.createRadialGradient(900, 520, 380, 960, 540, 1150); v.addColorStop(0, 'rgba(5,10,25,0)'); v.addColorStop(1, 'rgba(5,10,25,.6)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
      }), 0, 0);
    },
  };
})();
