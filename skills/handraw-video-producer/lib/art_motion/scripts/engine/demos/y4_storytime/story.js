// y4 本片共用：配色、姿势时间线（pose-to-pose＋换姿势回弹）、眨眼、字幕。
// 用到的库：TOON（豆子花叔 bean、poseAt、blinkAt、alive、口型读 VO_ENV）、TY.text（字幕）、CAM（镜头）、MO（步进、弹簧）。
(() => {
const S = window.STORY = {};
// 背景压低饱和与对比、线更细更灰；角色线最黑最粗 —— 视线永远先落到角色上
S.C = { wall: '#DCE9EC', wall2: '#CFE0E4', floor: '#E8DCC8', desk: '#E2C29B', deskSide: '#CDA97F', bgLine: '#5B6470', line: '#1B1B1F',
  sky: '#BFE3F5', cloud: '#FFFFFF', laptop: '#C9CDD6', screen: '#20222D', glow: 'rgba(120,200,255,0.35)', void: '#3D405B' };
S.bgLW = 3;
// 口播时间（秒，全片时间）：与 共享/音频/build_y4.py 的摆放一致
S.LINES = [[0.12, 2.0, '我第一次让AI帮我写代码，'], [2.13, 4.40, '它一口气，给了我三千行。'], [5.75, 8.75, '我问它：这些……贴哪儿？']];   // 字幕和镜头切点同一帧换

// 姿势时间线：keys = [[t, poseName, expr], ...]（全片时间）。换姿势 = TOON.poseAt：手臂 0.1s 快切、身体挤压 7% 后弹簧回弹
S.poseAt = TOON.poseAt;
// 眨眼：固定时刻表（「随机」间隔 2.4–3.6s 写死），闭眼 2 帧@24fps ≈ 0.083s
S.blinkAt = (t, extra = []) => TOON.blinkAt(t, [0.9, 3.4, 6.1, ...extra]);
// 说话时头随音节轻点＋呼吸（1.6s 一周期，±1.2%）
S.alive = TOON.alive;

// 字幕（中文平台需要烧录；YouTube 原生 storytime 不烧，靠 CC）：白字黑描边，整句切入切出，不做花样
window.GLOBAL_OVERLAY = (c, t) => {
  for (const [a, b, s] of S.LINES) if (t >= a && t < b) {
    TY.text(c, s, 960, 1022, { size: 50, fam: 'PuHui-Bold', color: '#fff', stroke: '#1B1B1F', strokeW: 10, track: 1 });
  }
};
})();
