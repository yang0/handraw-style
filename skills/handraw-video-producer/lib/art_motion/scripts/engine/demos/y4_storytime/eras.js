// 示范 · 故事型简笔角色（storytime）「我第一次让 AI 帮我写代码」（8.75 秒五镜）。语法卡：references/动画语法/y4_storytime.md
//   预览 index.html?film=demos/y4_storytime   渲染 render.py --film demos/y4_storytime --out y4.mp4（口播音轨另配；口型读 vo_env.js 的包络）
// 镜头按口播切（不是按节拍）：一句口播 ≈ 一个镜头，反应镜头放在两句之间的「沉默」里。
window.PUNCH = 0;                    // storytime 不卡音乐拍
window.FILM_DURATION = 8.75;
window.SCENE_LIBS = ['demos/y4_storytime/vo_env.js', 'demos/y4_storytime/story.js', 'demos/y4_storytime/world.js'];
window.SCENE_DIR = 'demos/y4_storytime';
window.ERAS = [
  { id: 's1_desk', dur: 2.0 },                                                  // 中景：对镜头讲
  { id: 's2_screen', dur: 2.4, transition: { type: 'whip', dur: 0.26, dir: 1 } }, // 甩镜 → 屏幕（过肩）。甩在两句之间的换气里，别切在句中
  { id: 's3_react', dur: 1.2, transition: { type: 'smash', dur: 0.32 } },        // 砸镜 → 反应大特写（沉默）
  { id: 's4_wide', dur: 1.65, transition: { type: 'cut', dur: 0.02 } },          // 硬切 → 同一房间大全景
  { id: 's5_close', dur: 1.5, transition: { type: 'cut', dur: 0.02 } },          // 跳近 → 近景，笑点＋定住
];
