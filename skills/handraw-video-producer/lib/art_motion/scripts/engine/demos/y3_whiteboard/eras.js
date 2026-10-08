// 示范 · 白板手绘解说（RSA Animate 型）「AI 是怎么学会认猫的」（8 秒三镜）。语法卡：references/动画语法/y3_whiteboard.md
//   预览 index.html?film=demos/y3_whiteboard   渲染 render.py --film demos/y3_whiteboard --out y3.mp4
// 一整块大白板＝世界，相机在板上移动；三段是同一个画面函数（DG.board 的笔画时间线），段只是为了 qa 分镜。
window.PUNCH = 0;
window.SCENE_LIBS = ['demos/_shared/hero.js', 'demos/y3_whiteboard/whiteboard.js'];
window.ERAS = [
  { id: 'y3_s1', dur: 2.5 },                                                  // 画猫、写「猫？」、写问题
  { id: 'y3_s2', dur: 2.25, transition: { type: 'same', dur: 0.8 } },         // 甩镜（0.8s 带运动模糊，笔不离板）
  { id: 'y3_s3', dur: 3.25, transition: { type: 'same', dur: 0.85 } },        // 板上平滑移动 → 画花叔、「是猫！」→ 拉远看全图
];
