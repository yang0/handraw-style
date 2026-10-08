// SpaceX 这 24 年 · 段落表。段长来自 spacex/timing.js（按口播实测生成，勿手改）；
// 每段的进入转场由该段 scene 文件在加载时写：ERAS.find(e => e.id === 'sXX').transition = { type, dur }。
window.PUNCH = 0;
window.FPS_HINT = 30;
window.SCENE_LIBS = ['spacex/timing.js', 'spacex/tm.js', 'spacex/rockets.js'];
window.SCENE_DIR = 'spacex/scenes';
window.ERAS = ['s01','s02','s03','s04','s05','s06','s07','s08','s09','s10','s11','s12'].map(id => ({ id, get dur() { return TIMING.seg[id].dur; } }));
