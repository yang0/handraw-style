// 示范 · Vox 式拼贴解说「AI 是怎么学会认猫的」（8 秒三镜）。语法卡：references/动画语法/y2_vox.md
//   预览 index.html?film=demos/y2_vox   渲染 render.py --film demos/y2_vox --out y2.mp4
// 一张大桌面＝世界；相机 60fps 平滑推移，桌上的纸片/荧光笔/红笔/打字按 12fps 步进。
window.PUNCH = 0;
window.SCENE_LIBS = ['demos/_shared/hero.js', 'demos/y2_vox/vox.js'];
window.ERAS = [
  { id: 'y2_s1', dur: 2.6 },                                                 // 剪报＋网点照片：荧光笔扫行、红笔圈词、相机慢推
  { id: 'y2_s2', dur: 3.3, transition: { type: 'same', dur: 1.1 } },         // 沿红线平移到调查墙（同一桌面，相机连续走）
  { id: 'y2_s3', dur: 2.1, transition: { type: 'cut', dur: 1 / 60 } },       // 推满小照片 → 硬切到同一张图的大幅扫描，再拉出揭示黑底拼贴
];
