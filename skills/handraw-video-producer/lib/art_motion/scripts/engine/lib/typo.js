// 文字动效 TY：逐字/逐词弹入、遮罩升起、弹入、打字、从模糊浮出、荧光笔、下划线、主词砸入、关键词强调、数字计数与等宽数字。
// 约定：p 是 0..1 进度；lt/t 是秒。字体用 CSS 字体串或 family 名（中文默认 PuHui-*，开源版是思源黑体，见 lib/fonts.js）。
// 可读性底线（y5/y1 卡片）：主词 : 辅句 : 标签 ≈ 3.4 : 1 : 0.4；一句辅句在屏 ≥1.2s；入场慢（0.3–0.4s）、退场快（≈0.18s）。
(() => {
const { clamp, lerp } = U;
const TY = window.TY = {};

// ---------- 基础 ----------
TY.font = (size, fam = 'PuHui-Black') => `${size}px "${fam}"`;
// 画一段字：可带透明、缩放、旋转（绕 ox,oy）、字距 track、描边
TY.text = (c, s, x, y, { size = 120, fam = 'PuHui-Black', color = '#111', align = 'center', base = 'alphabetic', alpha = 1, scale = 1, rot = 0, track = 0, stroke, strokeW = 0, ox = x, oy = y } = {}) => {
  if (alpha <= 0 || scale <= 0) return;
  c.save(); c.globalAlpha *= alpha; c.translate(ox, oy); c.rotate(rot); c.scale(scale, scale); c.translate(-ox, -oy);
  c.font = TY.font(size, fam); c.textAlign = align; c.textBaseline = base; if (track) c.letterSpacing = track + 'px';
  if (stroke && strokeW) { c.lineJoin = 'round'; c.strokeStyle = stroke; c.lineWidth = strokeW; c.strokeText(s, x, y); }
  c.fillStyle = color; c.fillText(s, x, y); c.restore();
};
TY.width = (c, s, size, fam = 'PuHui-Black', track = 0) => { c.save(); c.font = TY.font(size, fam); if (track) c.letterSpacing = track + 'px'; const w = c.measureText(s).width; c.restore(); return w; };
// 折行：按 maxW 把一段字拆成多行（中文逐字可断；英文/数字按词断；行首不放中文标点）。font 是 CSS 字体串
TY.wrap = (c, text, maxW, font) => {
  c.save(); if (font) c.font = font;
  const toks = String(text).match(/[A-Za-z0-9.,%+\-'’]+\s*|\s+|./gu) || [], lines = []; let cur = '';
  for (const tk of toks) {
    if (tk === '\n') { lines.push(cur); cur = ''; continue; }
    if (cur && c.measureText(cur + tk.trimEnd()).width > maxW && !/^[，。、：；！？」』）》,.!?)]$/.test(tk)) { lines.push(cur.trimEnd()); cur = tk.trimStart(); }
    else cur += tk;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  c.restore(); return lines;
};
// 把字号从 size 往下缩，直到真放得下：折行后不超过 maxLines 行，而且量过每行宽 ≤ maxW（单个长英文词/长数字折不开，只数行数会超宽）。返回 {size, lines, ok}
// 先在 [min, 1] 倍里找；找不到时 soft:true 返回 ok:false 让调用方换方案（如改折两行），否则继续缩（最低 0.2 倍）。balance:true 时多行折成等长。
TY.fit = (c, text, maxW, size, fam, { maxLines = 2, min = 0.45, weight = '', soft = false, balance = false } = {}) => {
  const font = s => `${weight}${s}px "${fam}"`, ok = (s, lines) => { c.save(); c.font = font(s); const r = lines.length <= maxLines && lines.every(l => c.measureText(l).width <= maxW + 0.5); c.restore(); return r; };
  let s = size, lines = [String(text)], good = false;
  for (; s >= size * (soft ? min : 0.2) - 1e-9; s *= 0.94) { lines = TY.wrap(c, text, maxW, font(s)); if (ok(s, lines)) { good = true; break; } if (s < size * min && soft) break; }
  if (!good && !soft) s /= 0.94;
  if (good && balance && lines.length > 1) { const n = lines.length; let lo = maxW * 0.4, hi = maxW; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (TY.wrap(c, text, m, font(s)).length > n) lo = m; else hi = m; } lines = TY.wrap(c, text, hi, font(s)); }
  return { size: s, lines, ok: good };
};

// ---------- 入场 ----------
// 逐字错开出现：每字 dur 秒，从 dy 往上、透明→不透明、可带缩放；Kurzgesagt 标题 0.5s/字、错开 45ms。返回总宽。
TY.charsIn = (c, str, x, y, lt, { font, color, dur = 0.35, stagger = 0.04, dy = 24, scale0 = 1, align = 'left', ease = MO.cubicOut, shadow, spacing = 0 } = {}) => {
  c.save(); c.font = font; c.textBaseline = 'alphabetic'; c.fillStyle = color; const A0 = c.globalAlpha;   // 乘上调用方的透明度（外面包一层淡出才生效）
  const chars = [...str]; const ws = chars.map(ch => c.measureText(ch).width + spacing); const tw = ws.reduce((a, b) => a + b, 0) - spacing;
  let cx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  chars.forEach((ch, i) => {
    const q = clamp((lt - i * stagger) / dur); if (q > 0) {
      const e = ease(q); c.save(); c.globalAlpha = A0 * clamp(q * 2.2);
      c.translate(cx + ws[i] / 2, y + dy * (1 - e)); const s = lerp(scale0, 1, e); c.scale(s, s);
      if (shadow) { c.shadowColor = shadow.color; c.shadowOffsetX = shadow.x || 0; c.shadowOffsetY = shadow.y || 0; c.shadowBlur = shadow.blur || 0; }
      c.fillText(ch, -ws[i] / 2 + spacing / 2, 0); c.restore();
    }
    cx += ws[i];
  });
  c.restore(); return tw;
};
// 遮罩升起：字从基线下的「槽」里推上来（动态文字最常见的出字法）。p 0..1，o.dir=+1 往上出，-1 往下收。o 同 TY.text
TY.rise = (c, s, x, y, p, o = {}) => {
  const size = o.size || 120, e = MO.expoOut(clamp(p)), w = TY.width(c, s, size, o.fam, o.track), a = o.align || 'left';
  const x0 = a === 'left' ? x : a === 'center' ? x - w / 2 : x - w;
  c.save(); c.beginPath(); c.rect(x0 - 20, y - size * 1.05, w + 40, size * 1.32); c.clip();
  TY.text(c, s, x, y + size * 1.2 * (1 - e) * (o.dir || 1), { ...o, align: a }); c.restore();
};
// 弹入：从 0 放大到 1，backOut 过冲后停（以字中心为轴）。o.over = backOut 的 s
TY.pop = (c, s, x, y, p, o = {}) => {
  if (p <= 0) return; const size = o.size || 120, sc = MO.backOut(clamp(p), o.over ?? 2.2) * (o.scale || 1);
  TY.text(c, s, x, y, { ...o, scale: sc, ox: x, oy: y - size * 0.36 });
};
// 从模糊浮出（发布会标题）：模糊→清晰＋上移＋透明→不透明。用调用方设好的 font/fillStyle/textAlign。
TY.blurIn = (c, text, x, y, p, { blur = 18, dy = 28, scale = 0 } = {}) => {
  if (p <= 0) return;
  c.save(); c.globalAlpha *= clamp(p * 1.4);
  const b = (1 - p) * blur; if (b > 0.3) c.filter = `blur(${b.toFixed(2)}px)`;
  c.translate(x, y + (1 - p) * dy); if (scale) { const s = 1 + (1 - p) * scale; c.scale(s, s); }
  c.fillText(text, 0, 0); c.restore();
};
// 打字：按字符数截断（p 0..1）
TY.typed = (s, p) => [...s].slice(0, Math.round(clamp(p) * [...s].length)).join('');
// 打字机：t 时刻已打出的字数（rate 字/秒，可按 fps 步进；Vox 13 字/秒＋12fps，白板正文 16 字/秒）
TY.typedCount = (t, t0, rate, fps = 0) => Math.max(0, Math.floor(((fps ? MO.step(t, fps) : t) - t0) * rate + 1e-6) + 1);

// ---------- 强调 ----------
// 荧光笔：从左往右刷出的斜切色块，放在字后面（动态文字）。拼贴风的毛边 multiply 荧光笔见 CL.highlight
TY.marker = (c, x, y, w, h, p, color = '#FFE14D', skew = 0.18) => {
  if (p <= 0) return; const e = MO.expoOut(clamp(p)), ww = w * e;
  c.save(); c.fillStyle = color; c.beginPath(); c.moveTo(x + h * skew, y); c.lineTo(x + ww + h * skew, y); c.lineTo(x + ww, y + h); c.lineTo(x, y + h); c.closePath(); c.fill(); c.restore();
};
TY.underline = (c, x, y, w, p, color, lw = 10) => { if (p <= 0) return; c.save(); c.strokeStyle = color; c.lineCap = 'round'; c.lineWidth = lw; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * MO.expoOut(clamp(p)), y); c.stroke(); c.restore(); };
// 主词「砸」进来：从 from 倍缩到 1（弹簧 2.2Hz/10，过冲 ≈8%），前 0.06s 透明→不透明。lt = 本词出现后的秒数
TY.slam = (c, s, x, y, lt, o = {}) => {
  if (lt < 0) return; const size = o.size || 340, k = MO.springHz(lt, o.freq || 2.2, o.decay || 10), sc = lerp(o.from || 1.7, 1, k);
  TY.text(c, s, x, y, { size, fam: 'PuHui-Black', align: 'left', ...o, scale: sc * (o.scale || 1), alpha: clamp(lt / 0.06), ox: o.ox ?? x, oy: o.oy ?? y - size * 0.36 });
};
// 关键词：tIn 起从槽里升起，到「强调拍」tHit 放大到 1.35 倍并钉住（弹簧 2.5Hz/9）。返回当前缩放（给荧光笔/下划线跟着放大）。
// 字和动作说同一件事：「下一行」放大的那一拍正好按下 Tab（y5）。
TY.keyword = (c, s, x, y, t, tIn, tHit, o) => {
  if (t < tHit) { TY.rise(c, s, x, y, MO.at(t, tIn, 0.35), { ...o, align: 'left' }); return 1; }
  const sc = lerp(1, 1.35, MO.springHz(t - tHit, 2.5, 9));
  TY.text(c, s, x, y, { ...o, align: 'left', scale: sc, ox: x, oy: y });
  return sc;
};
// 关键词后面的荧光笔：跟关键词同一拍出现、同一缩放
TY.keywordMarker = (c, x, y, w, size, t, tHit, sc, col) => { if (t < tHit) return; TY.marker(c, x - 8, y - size * 0.98 * sc, (w + 16) * sc, size * 1.18 * sc, MO.at(t, tHit, 0.3), col); };

// ---------- 数字 ----------
// 千分位格式；负号用真减号「−」
TY.fmt = (v, dec = 0, sep = true) => { const s = Math.abs(v).toFixed(dec); const [i, f] = s.split('.'); const ii = sep ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i; return (v < 0 ? '−' : '') + ii + (f ? '.' + f : ''); };
// 计数：[start, start+dur] 内从 a 滚到 b；默认 expoOut（先快后慢，最后一位落定）。数字和动画只改「怎么出现」，不改口径。
TY.count = (lt, start, dur, a, b, ease = MO.expoOut) => lerp(a, b, ease(clamp((lt - start) / dur)));
// 等宽数字排布：canvas 开不了 tnum，滚动时数字宽度会抖，必须每个数字占同宽格子自己排。用调用方设好的 font/fillStyle。返回总宽
TY.tabular = (c, str, x, y, { align = 'left', digitW } = {}) => {
  const dw = digitW || c.measureText('0').width;
  const ws = [...str].map(ch => /[0-9]/.test(ch) ? dw : c.measureText(ch).width);
  const total = ws.reduce((s, w) => s + w, 0);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  const ta = c.textAlign; c.textAlign = 'center';
  [...str].forEach((ch, i) => { c.fillText(ch, cx + ws[i] / 2, y); cx += ws[i]; });
  c.textAlign = ta; return total;
};
})();
