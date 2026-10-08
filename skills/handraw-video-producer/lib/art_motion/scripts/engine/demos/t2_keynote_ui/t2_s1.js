// t2 · 发布会式：「一个 AI 产品发布：三个功能卡片」
// 镜头 1（2.6s）：深色底上柔和光斑缓慢漂移；眉题 → 产品名（模糊→清晰＋上移，渐变字，光扫过）→ 一句话副标题。相机极慢推近。
// 本文件同时放 t2 共用的东西（window.T2）：光斑底、字体、颜色。
(() => {
const { clamp, lerp } = U;
const W = 1920, H = 1080;
const BASE = '#050508';
const BLOBS = [                                                   // 色相取 Stripe 渐变一系（紫/蓝/青）+ 一点暖色；周期避开 5s（HIG：避免 ~0.2Hz 持续摆动）
  { x: 430, y: 300, r: 760, col: [150, 90, 238], a: 0.75, ax: 220, ay: 120, period: 11, ph: 0 },
  { x: 1520, y: 260, r: 700, col: [56, 104, 255], a: 0.7, ax: 200, ay: 160, period: 13, ph: 2.1 },
  { x: 1320, y: 930, r: 560, col: [120, 214, 255], a: 0.5, ax: 260, ay: 100, period: 9.5, ph: 4 },
  { x: 520, y: 960, r: 520, col: [255, 96, 84], a: 0.42, ax: 180, ay: 90, period: 12, ph: 1.3 },
];
const SANS = '"Inter", "NotoSansSC"', ZH = '"NotoSansSC"';
// 光斑底：只依赖全片时间 t，三个镜头之间无缝（换镜头时背景不跳）
const bg = (c, t, { dim = 0.38 } = {}) => {
  UI.mesh(c, t, { base: BASE, blobs: BLOBS, blur: 90, scale: 0.25, grain: 0.035, key: 't2mesh' });
  // 中心压暗一点，给白字留对比
  const g = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1000); g.addColorStop(0, `rgba(0,0,0,${dim})`); g.addColorStop(1, 'rgba(0,0,0,0.1)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
};
// 大字：字距收紧 −0.02em（苹果/Linear 官网 64px 以上 −0.015～−0.03em）
const track = (c, size, em = -0.02) => { c.letterSpacing = (size * em).toFixed(2) + 'px'; };
// 光斑漂移、卡片漂浮、图标律动都读全片时间 t。PHASE：沿用实验时这支片排在 8–16s 的相位，保持定稿画面的构图（换题目时删掉或随便改）
const PHASE = 8;
window.T2 = { bg, SANS, ZH, track, BASE, PHASE };

const DUR = 2.6;
SCENES['t2_s1'] = {
  draw(c, lt, t) {
    t += T2.PHASE;
    bg(c, t);
    // 相机匀速慢推：1.0 → 1.045（整镜线性，发布会片的慢推不减速，减速到停会让画面「死」掉）
    const s = lerp(1, 1.045, lt / (DUR + 0.55));
    c.save(); c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    // 眉题
    c.font = `500 34px ${ZH}`; c.fillStyle = '#a7a7b4'; c.letterSpacing = '6px';
    TY.blurIn(c, '全 新 发 布', W / 2, 372, MO.appleOut(MO.seg(lt, 0.1, 0.8)), { blur: 10, dy: 16 });
    // 产品名：渐变字画进离屏 → 光扫过（source-atop 只亮在字上）→ 模糊→清晰贴回
    const p = MO.appleOut(MO.seg(lt, 0.3, 1.3));
    if (p > 0) {
      const tx = UI.scratch('t2title', W, 420), g = tx.getContext('2d'); g.reset();
      g.font = `600 220px ${SANS}`; track(g, 220); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const gr = g.createLinearGradient(600, 0, 1320, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#ddd2ff'); gr.addColorStop(1, '#a8dcff');
      g.fillStyle = gr; g.fillText('Plover 2', W / 2, 300);
      UI.sheen(g, null, MO.seg(lt, 1.25, 2.15), { x0: 560, x1: 1360, width: 140, angle: -0.38, alpha: 0.85, comp: 'source-atop' });
      c.save(); c.globalAlpha = clamp(p * 1.5); const b = (1 - p) * 26; if (b > 0.3) c.filter = `blur(${b.toFixed(1)}px)`;
      c.drawImage(tx, 0, 620 - 300 + (1 - p) * 40); c.restore();               // 纹理基线 y=300 → 屏幕 y=620
    }
    // 副标题
    c.font = `400 50px ${ZH}`; c.fillStyle = '#c9c9d4'; c.letterSpacing = '1px';
    TY.blurIn(c, '会思考、会记忆、会动手的 AI 助手', W / 2, 740, MO.appleOut(MO.seg(lt, 0.7, 1.6)), { blur: 12, dy: 22 });
    c.restore();
  },
};
})();
