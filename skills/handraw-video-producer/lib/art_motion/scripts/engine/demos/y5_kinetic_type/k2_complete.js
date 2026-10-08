// K2 阶段一「补全」（一小节 = 第 4–7 拍，2.0–4.0s）
// 第 4 拍主词砸进＋巨型「1」→ 4.5 拍代码卡滑入、开始打字 → 第 5 拍辅句「它补完」升起、5.25 拍「下一行」→
// 第 6 拍灰色补全闪现＋Tab 键弹出 → 6.5 拍按下 Tab、灰字变实、「下一行」放大 1.35 倍＋荧光笔（字和动作说同一件事）。
// 返修：辅句原在第 6 拍出、7 个字，到被色带盖住只剩 0.7s；现在提前一拍、压到 6 个字，可读 1.2s。
(() => {
const K = KT, C = K.C, b = K.b;
const { clamp } = U;
const MONO = 'Menlo';      // 代码用等宽（返修：第一版用了比例字体，不像代码）
SCENES['k2_complete'] = {
  draw(c, lt, t) {
    c.fillStyle = C.coral; c.fillRect(0, 0, 1920, 1080);
    K.dots(c, t, C.white, 0.1);
    K.cam(c, t, c => {
      K.bigNum(c, t, '1', b(4), 1880, 1150, 'rgba(255,255,255,0.13)');
      TY.rise(c, '阶段 01', 140, 250, MO.at(t, b(4), 0.3), { size: K.SZ.label, fam: 'PuHui-Bold', color: C.white, track: 6 });
      TY.underline(c, 140, 272, 170, MO.at(t, b(4.25), 0.3), C.white, 6);
      K.slam(c, '补全', 130, 600, t, b(4), { color: C.white });
      const sub = '它补完', key = '下一行', sw = TY.width(c, sub, K.SZ.sub, 'PuHui-Heavy'), kw = TY.width(c, key, K.SZ.sub, 'PuHui-Heavy');
      const ky = 775, kx = 150 + sw;
      TY.rise(c, sub, 140, ky, MO.at(t, b(5), 0.35), { size: K.SZ.sub, fam: 'PuHui-Heavy', color: C.white });
      const ksc = t >= b(6.5) ? 1 + 0.35 * MO.springHz(t - b(6.5), 2.5, 9) : 1;
      K.keyMarker(c, kx, ky, kw, K.SZ.sub, t, b(6.5), ksc, C.yellow);
      K.key(c, key, kx, ky, t, b(5.25), b(6.5), { size: K.SZ.sub, fam: 'PuHui-Heavy', color: t >= b(6.5) ? C.ink : C.white });
      // 代码卡：4.5 拍从右侧滑入（expoOut 0.4s，起点 +700px，带 3.4° 回正）
      const pin = MO.expoOut(MO.at(t, b(4.5), 0.4));
      if (pin > 0) {
        const cx = 1010 + 700 * (1 - pin), cy = 330;
        c.save(); c.translate(cx, cy); c.rotate(0.06 * (1 - pin));
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.roundRect(14, 18, 800, 330, 26); c.fill();
        c.fillStyle = C.code; c.beginPath(); c.roundRect(0, 0, 800, 330, 26); c.fill();
        ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(40 + i * 30, 40, 9, 0, Math.PI * 2); c.fill(); });
        const T = (s, x, y, col, a = 1) => TY.text(c, s, x, y, { size: 40, fam: MONO, color: col, align: 'left', alpha: a });
        T('1', 40, 130, '#555A72'); T('function hello() {', 96, 130, '#82AAFF');
        T('2', 40, 210, '#555A72');
        const typed = TY.typed('  const name =', MO.at(t, b(4.75), 0.5)); T(typed, 96, 210, '#E9ECF5');
        const tw = TY.width(c, typed, 40, MONO), acc = t >= b(6.5);
        // 补全：第 6 拍整段灰字 0 帧闪现（补全本来就是瞬间出现），Tab 按下后变实色
        if (t >= b(6)) T(" 'huashu';", 96 + tw, 210, acc ? '#C3E88D' : 'rgba(233,236,245,0.35)');
        T('3', 40, 290, '#555A72'); if (acc) T('}', 96, 290, '#82AAFF', MO.at(t, b(6.6), 0.1));
        if (Math.floor(t * 4) % 2 === 0) { const cxr = 96 + tw + (acc ? TY.width(c, " 'huashu';", 40, MONO) : 0); c.fillStyle = '#FFD23F'; c.fillRect(cxr + 4, 172, 5, 50); }
        c.restore();
      }
      // Tab 键帽：第 6 拍弹出，6.5 拍按下（压 14%，e^-18t 回弹）
      const kp = MO.at(t, b(6), 0.3); if (kp > 0) {
        const press = t >= b(6.5) ? 1 - 0.14 * Math.exp(-(t - b(6.5)) * 18) : 1, s = MO.backOut(kp, 2.6) * press;
        c.save(); c.translate(1410, 790); c.scale(s, s);
        c.fillStyle = '#C24128'; c.beginPath(); c.roundRect(-130, -62, 260, 136, 22); c.fill();
        c.fillStyle = C.white; c.beginPath(); c.roundRect(-130, -76 + (1 - press) * 70, 260, 128, 22); c.fill();
        TY.text(c, 'TAB', 0, 12 + (1 - press) * 70, { size: 64, fam: 'PuHui-Black', color: C.coral });
        c.restore();
      }
    });
  },
};
})();
