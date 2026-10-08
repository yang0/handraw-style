// 示范 · 财经图表（经济学人 / 财经频道）「深算科技营收与股价」（8 秒三镜，公司与数据全部虚构，每镜标「示意数据」）。语法卡：references/动画语法/t3_finance_chart.md
//   预览 index.html?film=demos/t3_finance_chart   渲染 render.py --film demos/t3_finance_chart --out t3.mp4
// 镜头 2→3：相机绕股价线最新点推近（矢量重画、屏幕位置不动），穿进最近 20 日 K 线。
window.PUNCH = 0;
window.SCENE_DIR = 'demos/t3_finance_chart';
window.ERAS = [
  { id: 't3_s1', dur: 2.8 },
  { id: 't3_s2', dur: 2.7, transition: { type: 'slidePush', dur: 0.5, bar: '#E3120B' } },
  { id: 't3_s3', dur: 2.5, transition: { type: 'zoomThrough', dur: 0.6, cx: 1530, cy: 297.65, zoom: 6, live: true, bScale0: 0.6, bg: '#FFFFFF',
      get focus() { return SCENES.t3_s3.focus; } } },                 // focus = 最新一根 K 线
];
