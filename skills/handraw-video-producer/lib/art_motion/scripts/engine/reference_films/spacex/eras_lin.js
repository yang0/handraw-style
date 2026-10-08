// SpaceX 这 24 年 · 单风格版（lin）。段长来自 spacex/timing.js（与混合风格版同一条口播），勿手改段长。
// 每段进入转场由该段 scene 文件写：ERAS.find(e => e.id === 'sXX').transition = { type, dur }（单风格片常用 same＝同一画布相机运动即转场）。
window.PUNCH = 0;
window.SCENE_LIBS = ['spacex/timing.js', 'spacex/tm.js', 'spacex/rockets.js', 'transitions/lin_page.js', 'spacex_lin/presenter_meta.js', 'spacex_lin/common.js'];   // 本片共用：翻页转场、讲解员帧表、LIN 库（讲解员＋顶栏在 GLOBAL_OVERLAY）
window.SCENE_DIR = 'spacex_lin/scenes';
window.ERAS = ['s01','s02','s03','s04','s05','s06','s07','s08','s09','s10','s11','s12'].map(id => ({ id, get dur() { return TIMING.seg[id].dur; } }));
