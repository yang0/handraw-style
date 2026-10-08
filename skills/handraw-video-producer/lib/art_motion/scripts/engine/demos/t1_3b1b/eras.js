// 示范 · 3b1b / manim 式讲解「神经网络一层是怎么把像素变成『猫』的」（8 秒三镜）。语法卡：references/动画语法/t1_3b1b.md
//   预览 index.html?film=demos/t1_3b1b   渲染 render.py --film demos/t1_3b1b --out t1.mp4
// 镜头 1→2 无转场：首帧 = 上一镜末帧，Transform 接续（100 个像素变成一列神经元）。镜头 2→3 穿进一个隐藏层神经元看它在找什么。
window.PUNCH = 0;
window.SCENE_DIR = 'demos/t1_3b1b';
window.ERAS = [
  { id: 't1_s1', dur: 2.6 },
  { id: 't1_s2', dur: 2.8 },
  // cx,cy = 目标神经元在镜头 2 末帧的屏幕位置（r = 22×1.1）；live：镜头 2 自己在转场里继续推相机（矢量重画）
  { id: 't1_s3', dur: 2.6, transition: { type: 'zoomThrough', dur: 0.75, cx: 850, cy: 391.5, zoom: 48, r0: 24.2, live: true, focus: [640, 585] } },
];
