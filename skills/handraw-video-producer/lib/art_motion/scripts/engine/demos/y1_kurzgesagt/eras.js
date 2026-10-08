// 示范 · Kurzgesagt 式扁平科普「AI 是怎么学会认猫的」（8 秒三镜）。语法卡：references/动画语法/y1_kurzgesagt.md
//   预览 index.html?film=demos/y1_kurzgesagt   渲染 render.py --film demos/y1_kurzgesagt --out y1.mp4
// 镜头按口播切，dur 用秒；解说片不要拍点冲击（PUNCH = 0）。相机运动全在场景里按时间算（CAM），转场只管 A、B 怎么合。
window.PUNCH = 0;
window.SCENE_LIBS = ['demos/_shared/hero.js', 'demos/y1_kurzgesagt/kurzgesagt.js'];
window.ERAS = [
  { id: 'y1_s1', dur: 2.6 },                                                                         // 夜晚山坡：5 层视差慢推，机器人扫描猫
  { id: 'y1_s2', dur: 2.7, transition: { type: 'lensReveal', dur: 1.0, lens: t => Y1.lensAt(t) } },  // 钻进镜头：相机指数推进眼睛，眼睛里是下一个世界
  { id: 'y1_s3', dur: 2.7, transition: { type: 'matchCut', dur: 0.9 } },                             // 填满再拉出：推满黄色输出节点 → 从黄色的眼睛里拉出
];
