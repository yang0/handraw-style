// 1924 俄罗斯构成主义海报（罗德琴科 / 李西茨基）——纯代码。
// 管线：①缓存底版（米白旧纸＋斜红地面＋黑圆＋窗内网点照片与舒霍夫塔＋排版小构件）
//      → ②会动的母题（红楔刺入黑圆、塔顶无线电波外扩、黑圆外虚线环旋转、标语字逐个盖章后波浪跳）
//      → ③角色：平涂剪纸（红头巾共青团少女）＋皮肤是 45° 网点照片（照片拼贴）＋白色剪切边
SCENES['22_constructivism'] = (() => {
  const W = 1920, H = 1080, { clamp, lerp, ease } = U, P = PAINT, TAU = Math.PI * 2;
  const C = { paper: '#e9dfc4', red: '#c8231c', redD: '#8f1711', ink: '#151311', cream: '#f4ecd6', gray: '#4a4640', ochre: '#e3b03e', ochreD: '#a87a1c', orange: '#e2741c' };
  const poly = U.poly;

  // 网点：P.halftoneGray（灰度照片网点，照片拼贴的核心）、P.shadeDots（路径内按函数落点的网点阴影）
  const halftone = P.halftoneGray, shadeDots = P.shadeDots;

  // ---------- 几何西里尔字（5×7 模块，罗德琴科式手绘方块字） ----------
  const GL = {
    'П': [[0, 0, 5, 1.3], [0, 0, 1.3, 7], [3.7, 0, 1.3, 7]],
    'Е': [[0, 0, 1.3, 7], [0, 0, 5, 1.3], [0, 2.9, 4, 1.2], [0, 5.7, 5, 1.3]],
    'Т': [[0, 0, 5, 1.3], [1.85, 0, 1.3, 7]],
    'Ч': [[0, 0, 1.3, 4], [3.7, 0, 1.3, 7], [0, 2.9, 5, 1.2]],
    'А': [{ p: [[0, 7], [1.8, 0], [3.2, 0], [1.4, 7]] }, { p: [[5, 7], [3.2, 0], [1.8, 0], [3.6, 7]] }, [1.0, 4.3, 3.0, 1.15]],
    'Й': [[0, 1.7, 1.3, 5.3], [3.7, 1.7, 1.3, 5.3], { p: [[1.3, 5.5], [3.7, 2.0], [3.7, 3.7], [1.3, 7]] }, [1.2, 0, 2.6, 1.0]],   // 短音符收在字格内：伸出格外会被相邻字母/人物盖掉（第一版踩到）
    '!': [[1.85, 0, 1.3, 4.8], [1.85, 5.7, 1.3, 1.3]],
  };
  function glyph(c, ch, x, y, u) {
    const g = GL[ch]; if (!g) return;
    // 逐部件各自 fill：同一 path 里反向绕行的两条斜腿会按 nonzero 规则互相抵消出洞（А 第一版踩到）
    g.forEach(r => { c.beginPath(); if (r.p) { r.p.forEach((q, i) => i ? c.lineTo(x + q[0] * u, y + q[1] * u) : c.moveTo(x + q[0] * u, y + q[1] * u)); c.closePath(); } else c.rect(x + r[0] * u, y + r[1] * u, r[2] * u, r[3] * u); c.fill(); });
  }

  // ---------- ① 底版 ----------
  const TOWER = [[540, 170, 430, 108], [430, 100, 342, 70], [342, 66, 268, 47], [268, 44, 208, 32], [208, 30, 168, 22]];
  const TX = 600;
  const bg = () => P.cached('cs_bg', W, H, (g) => {
    g.drawImage(P.texture('cs_paper', C.paper, { scale: 0.0035, amt: 16, grain: 18, seed: 5, dark: '#d9c9a4' }), 0, 0);
    // 左侧排版构件：斜黑条、红方块、几行「正文」黑条
    g.save(); g.translate(170, 610); g.rotate(-0.5); g.fillStyle = C.ink; g.fillRect(-260, -30, 560, 58); g.restore();
    g.save(); g.translate(150, 200); g.rotate(0.26); g.fillStyle = C.red; g.fillRect(-70, -70, 140, 140); g.restore();
    g.save(); g.translate(60, 330); g.rotate(-0.08); g.fillStyle = C.ink; [180, 150, 200, 120, 170].forEach((w, k) => g.fillRect(0, k * 26, w, 10)); g.restore();
    // 右侧：细斜线＋红圆点＋竖排「ЧАЙ」
    g.strokeStyle = C.ink; g.lineWidth = 6; g.beginPath(); g.moveTo(1520, 250); g.lineTo(1920, 760); g.stroke();
    g.fillStyle = C.red; g.beginPath(); g.arc(1790, 340, 46, 0, TAU); g.fill();
    g.fillStyle = C.ink; g.fillRect(1660, 430, 120, 400);
    g.fillStyle = C.cream; ['Ч', 'А', 'Й'].forEach((ch, k) => glyph(g, ch, 1682, 470 + k * 120, 15.5));
    // 大黑圆（人物头后）
    g.fillStyle = C.ink; g.beginPath(); g.arc(1330, 395, 215, 0, TAU); g.fill();
    // 红色斜地面
    g.fillStyle = C.red; g.beginPath(); g.moveTo(0, 905); g.lineTo(W, 856); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    g.fillStyle = C.ink; g.beginPath(); g.moveTo(0, 899); g.lineTo(W, 850); g.lineTo(W, 862); g.lineTo(0, 911); g.closePath(); g.fill();
    // 窗：网点照片（天空＋云）
    const ph = P.canvas(), pg = ph.getContext('2d');
    const sg = pg.createLinearGradient(0, 140, 0, 540); sg.addColorStop(0, '#5e5e5e'); sg.addColorStop(0.75, '#cfcfcf'); sg.addColorStop(1, '#e8e8e8');
    pg.fillStyle = sg; pg.fillRect(370, 140, 420, 400);
    [[460, 240, 90, 34], [700, 300, 110, 30], [520, 400, 140, 26]].forEach(([x, y, rx, ry]) => { const rg = pg.createRadialGradient(x, y, 4, x, y, rx); rg.addColorStop(0, 'rgba(250,250,250,.95)'); rg.addColorStop(1, 'rgba(250,250,250,0)'); pg.fillStyle = rg; pg.beginPath(); pg.ellipse(x, y, rx, ry * 2, 0, 0, TAU); pg.fill(); });
    pg.fillStyle = '#2a2a2a'; pg.fillRect(370, 505, 420, 35);               // 远处厂房屋脊（暗）
    [[390, 470, 50], [470, 485, 36], [690, 460, 70], [760, 480, 30]].forEach(([x, y, w]) => pg.fillRect(x, y, w, 60));
    pg.fillRect(712, 360, 18, 120);                                           // 烟囱
    g.fillStyle = C.cream; g.fillRect(370, 140, 420, 400);
    halftone(g, ph, 370, 140, 420, 400, 7, C.ink, 0.8);
    // 舒霍夫塔：五节双曲面，两组直母线
    g.save(); g.beginPath(); g.rect(370, 140, 420, 400); g.clip();
    g.strokeStyle = C.ink; g.lineCap = 'round';
    TOWER.forEach(([y0, w0, y1, w1], k) => {
      g.lineWidth = 2.6 - k * 0.25;
      for (const dir of [1, -1]) for (let i = 0; i < 18; i++) {
        const a = i / 18 * TAU, b = a + dir * 1.1;
        const x0 = TX + Math.cos(a) * w0 / 2, x1 = TX + Math.cos(b) * w1 / 2;
        if (Math.sin(a) < -0.2 && Math.sin(b) < -0.2) continue;               // 背面的线省掉，读起来更清楚
        g.beginPath(); g.moveTo(x0, y0 + Math.sin(a) * w0 * 0.08); g.lineTo(x1, y1 + Math.sin(b) * w1 * 0.08); g.stroke();
      }
      g.lineWidth = 4; g.beginPath(); g.ellipse(TX, y1, w1 / 2, w1 * 0.08, 0, 0, TAU); g.stroke();
    });
    g.lineWidth = 4; g.beginPath(); g.moveTo(TX, 168); g.lineTo(TX, 140); g.stroke();
    g.restore();
    // 窗框（粗黑）＋红窗台
    g.strokeStyle = C.ink; g.lineWidth = 26; g.strokeRect(357, 127, 446, 426);
    g.fillStyle = C.red; g.fillRect(330, 554, 500, 30); g.fillStyle = C.ink; g.fillRect(330, 584, 500, 8);
    // 桌：黑板面＋红边＋斜撑
    g.fillStyle = C.ink; g.fillRect(810, 618, 400, 34); g.fillStyle = C.red; g.fillRect(810, 652, 400, 12);
    g.fillStyle = C.ink; g.fillRect(842, 664, 24, 220); g.fillRect(1158, 664, 24, 220);
    g.lineWidth = 14; g.strokeStyle = C.ink; g.beginPath(); g.moveTo(854, 870); g.lineTo(1170, 680); g.stroke();
    // 凳：黑块
    g.fillStyle = C.ink; g.fillRect(1440, 470, 34, 420); g.fillRect(1290, 740, 190, 26); g.fillRect(1300, 760, 22, 120);
  });

  // ---------- 少女 ----------
  const girlPal = { skin: C.cream, hair: C.ochre, dress: '#2f2c29', sleeve: C.cream, cuff: C.red, line: C.ink, lw: 3 };
  function girl(c, G, ch, lt) {
    const tilt = G.tilt, nk = [1300, 425];
    const HP = (x, y) => { const X = x - nk[0], Y = y - nk[1], cs = Math.cos(tilt), sn = Math.sin(tilt); return [nk[0] + X * cs - Y * sn, nk[1] + X * sn + Y * cs]; };
    const L = C.ink;
    const F = (p, col, lw = 3) => { if (!p) return; c.fillStyle = col; c.fill(p); if (lw) { c.strokeStyle = L; c.lineWidth = lw; c.stroke(p); } };
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    // 远侧袖（白衬衫）＋手
    F(G.farSleeve, C.cream); F(G.farCuff, C.red, 2);
    // 裙：深灰平涂＋网点阴影
    F(G.skirt, '#34302c', 0);
    shadeDots(c, G.skirt, 1090, 600, 380, 340, 9, '#0d0c0b', (x, y) => clamp((x - 1180) / 260) * 0.9);
    c.strokeStyle = L; c.lineWidth = 3; c.stroke(G.skirt);
    F(G.shoe, L, 0);
    // 上身：白衬衫＋红领巾三角
    F(G.torso, C.cream);
    shadeDots(c, G.torso, 1270, 420, 170, 210, 8, '#7d766a', (x, y) => clamp((x - 1350) / 80));
    const nkA = G.A.neck;
    c.fillStyle = C.red; c.beginPath(); c.moveTo(nkA[0] - 18, nkA[1] - 2); c.lineTo(nkA[0] + 26, nkA[1] + 2); c.lineTo(nkA[0] - 2, nkA[1] + 62); c.closePath(); c.fill();
    // 头发（金）＋红头巾
    F(G.hairBack, C.ochre, 0); F(G.bangs, C.ochre, 0);
    c.strokeStyle = C.ochreD; c.lineWidth = 3; G.hairLines.forEach(h => c.stroke(h));
    // 皮肤：先画灰度「照片」到离屏，再网点化 → 照片拼贴
    const S = P.scratch('csSkin'), sg = S.getContext('2d', { willReadFrequently: true });
    sg.reset(); sg.clearRect(1100, 270, 300, 400);
    const shade = (p, x0, x1, a, b) => { const gr = sg.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, a); gr.addColorStop(1, b); sg.fillStyle = gr; sg.fill(p); };
    shade(G.neck, 1285, 1325, '#b4b4b4', '#767676');
    shade(G.face, 1250, 1330, '#fafafa', '#9c9c9c');
    sg.fillStyle = 'rgba(90,90,90,.28)'; sg.beginPath(); sg.ellipse(G.cheek[0] + 16, G.cheek[1] + 4, 16, 12, 0, 0, TAU); sg.fill();   // 颧下阴影（轻）
    shade(G.hand, G.A.hand[0] - 20, G.A.hand[0] + 20, '#d8d8d8', '#8a8a8a'); shade(G.farHand, 1146, 1218, '#f4f4f4', '#b0b0b0');
    // 白色剪切边 + 网点
    c.save(); c.strokeStyle = '#fbf7ea'; c.lineWidth = 7; [G.neck, G.face, G.farHand].forEach(p => c.stroke(p)); c.restore();
    [G.neck, G.face, G.farHand].forEach(p => { c.fillStyle = C.cream; c.fill(p); });
    halftone(c, S, 1135, 280, 220, 360, 4.6, C.ink, 0.74);
    // 五官（照片上手工补的清晰笔画）＋红唇
    if (ch.blink) { c.strokeStyle = L; c.lineWidth = 3; c.stroke(G.lid); }
    else { c.fillStyle = L; c.beginPath(); c.ellipse(G.eye.x - 1, G.eye.y + 1, 5, 6.5, 0, 0, TAU); c.fill(); c.strokeStyle = L; c.lineWidth = 3; c.stroke(G.lid); G.lashes.forEach(l => { c.beginPath(); c.moveTo(...l[0]); c.lineTo(...l[1]); c.stroke(); }); }
    c.lineWidth = 3.4; c.stroke(G.brow);
    c.fillStyle = C.red; c.beginPath(); c.moveTo(...G.lips[0]); c.lineTo(...G.lips[1]); c.lineTo(...G.lips[2]); c.closePath(); c.fill();
    // 头巾：盖住头顶与后脑，额前露金发；颈后打结两条尾
    const kf = poly([[1280, 296], [1300, 285], [1330, 280], [1368, 291], [1402, 321], [1415, 368], [1405, 414], [1382, 440], [1356, 442], [1350, 410], [1342, 372], [1326, 334], [1304, 309]].map(p => HP(...p)));
    const lock = poly([[1352, 425], [1372, 432], [1380, 470], [1372, 505], [1360, 470]].map(p => HP(...p)));
    F(lock, C.ochre, 0); c.strokeStyle = C.ochreD; c.lineWidth = 2.5; c.stroke(lock);
    F(kf, C.red, 3);
    c.strokeStyle = C.redD; c.lineWidth = 3; c.beginPath(); [[1300, 300, 1390, 360], [1330, 292, 1400, 330]].forEach(([a, b, x, y]) => { const p0 = HP(a, b), p1 = HP(x, y); c.moveTo(...p0); c.lineTo(...p1); }); c.stroke();
    const sw = Math.sin(lt * 9) * 6;                       // 头巾尾随动作轻摆
    [[[1384, 432], [1446, 470 + sw], [1416, 478 + sw]], [[1378, 438], [1428, 500 - sw], [1400, 498 - sw]]].forEach(tri => F(poly(tri.map(p => HP(...p))), C.red, 3));
    // 近侧手臂（白袖＋红袖口）、杯、手
    F(G.upperArm, C.cream); F(G.foreArm, C.cream); F(G.cuff, C.red, 2);
    sg.reset(); sg.clearRect(1100, 270, 300, 400); shade(G.hand, G.A.hand[0] - 18, G.A.hand[0] + 18, '#dcdcdc', '#7a7a7a');
    c.save(); c.strokeStyle = '#fbf7ea'; c.lineWidth = 7; c.stroke(G.hand); c.restore(); c.fillStyle = C.cream; c.fill(G.hand);
    halftone(c, S, G.A.hand[0] - 26, G.A.hand[1] - 26, 52, 52, 4.6, C.ink, 0.74);
    RIG.drawCup(c, G.cup, { body: C.cream, rim: C.ink, line: L, lw: 3, hw: 7 });
    c.save(); c.translate(G.cup.x, G.cup.y); c.rotate(G.cup.tilt); c.fillStyle = C.red; c.fillRect(-G.cup.w * 0.46, G.cup.h * 0.38, G.cup.w * 0.92, 9); c.restore();
    c.fillStyle = C.cream; c.beginPath(); c.arc(G.thumb[0], G.thumb[1], 7, 0, TAU); c.fill(); c.strokeStyle = L; c.lineWidth = 2.4; c.stroke();
    c.restore();
  }

  // ---------- 猫：剪纸平涂＋网点阴影＋粗黑条纹 ----------
  function cat(c, K) {
    c.save(); c.lineJoin = 'round'; c.lineCap = 'butt';
    c.strokeStyle = C.ink; c.lineWidth = K.tailW + 8; c.stroke(K.tail); c.strokeStyle = C.orange; c.lineWidth = K.tailW; c.stroke(K.tail);
    c.setLineDash([12, 14]); c.strokeStyle = C.ink; c.lineWidth = K.tailW * 0.9; c.stroke(K.tail); c.setLineDash([]);
    const tip = K.tailPts[K.tailPts.length - 1]; c.fillStyle = C.cream; c.beginPath(); c.arc(tip[0], tip[1], K.tailW / 2, 0, TAU); c.fill();
    c.fillStyle = C.orange; c.fill(K.body); shadeDots(c, K.body, 420, 660, 250, 250, 9, '#7a2f0c', (x, y) => clamp((x - 520) / 140) * 0.8 + clamp((y - 820) / 90) * 0.3);
    c.strokeStyle = C.ink; c.lineWidth = 4; c.stroke(K.body);
    K.legs.forEach(l => { c.fillStyle = C.cream; c.fill(l); c.stroke(l); });
    c.fillStyle = C.cream; c.fill(K.white);
    c.fillStyle = C.orange; c.fill(K.head); c.stroke(K.head);
    c.save(); c.clip(K.head); c.fillStyle = C.cream; c.beginPath(); c.ellipse(K.nose[0] - 22, K.nose[1] + 12, 36, 26, 0, 0, TAU); c.fill(); c.restore();
    c.fillStyle = C.red; K.earInner.forEach(e => { c.beginPath(); e.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.fill(); });
    c.strokeStyle = C.ink; c.lineWidth = 10; K.stripes.forEach(s => { c.beginPath(); c.moveTo(...s[0]); c.lineTo(...s[1]); c.stroke(); });
    K.eyes.forEach(e => { if (K.blink) { c.lineWidth = 4; c.beginPath(); c.moveTo(e.x - 9, e.y); c.lineTo(e.x + 9, e.y); c.stroke(); }
      else { c.fillStyle = C.cream; c.beginPath(); c.arc(e.x, e.y, 10, 0, TAU); c.fill(); c.lineWidth = 3; c.stroke(); c.fillStyle = C.ink; c.fillRect(e.x - 1, e.y - 8, 5, 16); } });
    c.fillStyle = C.red; c.beginPath(); c.moveTo(K.nose[0] - 7, K.nose[1] - 4); c.lineTo(K.nose[0] + 7, K.nose[1] - 4); c.lineTo(K.nose[0], K.nose[1] + 5); c.fill();
    c.lineWidth = 2; K.whiskers.forEach(w => { c.beginPath(); c.moveTo(...w[0]); c.lineTo(...w[1]); c.stroke(); });
    c.restore();
  }

  const SLOGAN = 'ПЕЙТЕ ЧАЙ!';
  return {
    draw(c, lt, t) {
      const ch = P.choreo(lt, t);
      c.drawImage(bg(), 0, 0);
      // 黑圆外的红虚线环（旋转）
      c.save(); c.strokeStyle = C.red; c.lineWidth = 12; c.setLineDash([46, 22]); c.lineDashOffset = -lt * 260;
      c.beginPath(); c.arc(1330, 395, 242, 0, TAU); c.stroke(); c.restore();
      // 李西茨基红楔：沿轴线刺入黑圆（1.6Hz 进退）
      const thrust = 70 * (0.5 - 0.5 * Math.cos(lt * TAU * 1.6)), ax = Math.cos(0.34), ay = Math.sin(0.34);
      const tipX = 1150 + ax * thrust, tipY = 360 + ay * thrust;
      c.fillStyle = C.red; c.beginPath(); c.moveTo(tipX, tipY); c.lineTo(tipX - ax * 330 - ay * 95, tipY - ay * 330 + ax * 95); c.lineTo(tipX - ax * 330 + ay * 95, tipY - ay * 330 - ax * 95); c.closePath(); c.fill();
      // 窗内：塔顶无线电波（红弧外扩）
      c.save(); c.beginPath(); c.rect(370, 140, 420, 400); c.clip(); c.strokeStyle = C.red; c.lineCap = 'butt';
      for (let k = 0; k < 4; k++) { const ph = (lt * 1.4 + k / 4) % 1, r = 18 + ph * 230; c.globalAlpha = 1 - ph; c.lineWidth = 10 - ph * 6;
        c.beginPath(); c.arc(TX, 150, r, Math.PI * 0.05, Math.PI * 0.95, true); c.stroke(); }
      c.restore();
      // 角色
      const K = RIG.cat({ tail: ch.tail, blink: ch.blink, breathe: ch.breathe });
      cat(c, K);
      const G = RIG.girl({ cup: ch.cup, sip: ch.sip, breathe: ch.breathe });
      girl(c, G, ch, lt);
      // 地面标语（画在角色之上：海报字压人物）：逐字盖章（0–0.5s）→ 之后波浪跳
      c.save(); c.translate(0, 0); const ang = Math.atan2(-49, W); c.rotate(ang);
      const u = 19, adv = 6.3 * u; let x = 350;
      [...SLOGAN].forEach((chh, k) => {
        if (chh === ' ') { x += 3.5 * u; return; }
        const q = clamp((lt - k * 0.045) / 0.12); if (q <= 0) { x += adv; return; }
        const s = 1 + 0.5 * (1 - ease.out(q)), hop = -10 * Math.max(0, Math.sin(lt * 11 - k * 0.8));
        c.save(); c.translate(x + 2.5 * u, 990 + hop); c.scale(s, s); c.globalAlpha = q;
        c.fillStyle = k % 4 === 3 ? C.ink : C.cream; glyph(c, chh, -2.5 * u, -3.5 * u, u); c.restore();
        x += adv;
      });
      c.restore();
      // 杯上热气：三条黑折线上行
      c.save(); c.strokeStyle = C.ink; c.lineWidth = 4; c.lineJoin = 'miter';
      for (let k = 0; k < 3; k++) { const ph = (lt * 2 + k / 3) % 1, x0 = G.cup.x - 14 + k * 14, y0 = G.cup.y - 12 - ph * 60; c.globalAlpha = 1 - ph;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 7, y0 - 9); c.lineTo(x0, y0 - 18); c.lineTo(x0 + 7, y0 - 27); c.stroke(); }
      c.restore();
    },
  };
})();
