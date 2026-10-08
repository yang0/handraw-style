// 示范 · 动态文字排版（kinetic typography）「AI 写代码的 3 个阶段」 120 BPM，8 秒 = 4 小节 = 16 拍，再静住 0.5s。
//   语法卡：references/动画语法/y5_kinetic_type.md
//   预览 index.html?film=demos/y5_kinetic_type   渲染 render.py --film demos/y5_kinetic_type --out y5.mp4
// 揭开那一帧落在拍上：段起点 = 小节线 − 揭开点 × 转场时长（MO.onBeat）——
//   fillZoom 揭开点 .55、dur .45 → 2.0−.25 = 1.75；bands 揭开点 ≈.6、dur .5 → 4.0−.3 = 3.7；push 到 90% 位移在 p≈.58、dur .35 → 6.0−.2 ≈ 5.80
window.PUNCH = 0;                    // 拍点冲击由 kinetic.js 的 K.bump 自己做（每拍 1.2%）
window.FILM_DURATION = 8.5;
window.SCENE_LIBS = ['demos/y5_kinetic_type/kinetic.js'];
window.SCENE_DIR = 'demos/y5_kinetic_type';
window.ERAS = [
  { id: 'k1_title', dur: 1.75 },
  { id: 'k2_complete', dur: 1.95,   // 冲进点选在圆内、避开「3」字形（冲进白字会一片白）
    transition: { type: 'fillZoom', dur: 0.45, k: 0.55, cx: 1075, cy: 773, maxZoom: 30, fill: '#FF5A36' } },
  { id: 'k3_chat', dur: 2.1, transition: { type: 'bands', dur: 0.5, gap: 0.12, colors: ['#FFD23F', '#FFFFFF', '#14213D'] } },
  { id: 'k4_agent', dur: 2.7, transition: { type: 'push', dur: 0.35 } },
];
