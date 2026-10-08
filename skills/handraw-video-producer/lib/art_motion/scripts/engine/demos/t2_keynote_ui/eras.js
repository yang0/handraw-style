// 示范 · 发布会式（Apple keynote / 产品发布 UI）「Plover 2 的三个功能」（8 秒三镜，产品与数字虚构）。语法卡：references/动画语法/t2_keynote_ui.md
//   预览 index.html?film=demos/t2_keynote_ui   渲染 render.py --film demos/t2_keynote_ui --out t2.mp4
// 光斑底只依赖全片时间 t，三个镜头之间无缝；卡片 → 全屏是共享元素展开（rect = 中间卡在镜头 2 末帧的屏幕矩形）。
window.PUNCH = 0;
window.SCENE_DIR = 'demos/t2_keynote_ui';
window.ERAS = [
  { id: 't2_s1', dur: 2.6 },
  { id: 't2_s2', dur: 3.0, transition: { type: 'blurPush', dur: 0.55 } },
  { id: 't2_s3', dur: 2.4, transition: { type: 'expandRect', dur: 0.6, rect: { x: 705.6, y: 252.6, w: 508.8, h: 614.8 }, r: 38 } },
];
