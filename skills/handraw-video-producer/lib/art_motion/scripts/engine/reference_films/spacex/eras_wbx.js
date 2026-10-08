// SpaceX 这 24 年 · 单风格版（wbx：白板参考实现）。段长来自 spacex/timing.js（与混合风格版同一条口播），勿手改段长。
// 每段进入转场由该段 scene 文件写：ERAS.find(e => e.id === 'sXX').transition = { type, dur }（单风格片常用 same＝同一画布相机运动即转场）。
window.PUNCH = 0;
window.SCENE_LIBS = ['spacex/timing.js', 'spacex/tm.js', 'spacex/rockets.js', 'spacex_wb/assets/strokes.js', 'spacex_wb/common.js'];   // 本片自己的共用脚本可追加到这里（如 'spacex_wb/common.js'）
window.SCENE_DIR = 'spacex_wb/scenes';
window.EXTRA_ASSETS = ['spacex_wb/assets/hand_1.png', 'spacex_wb/assets/hand_2.png', 'spacex_wb/assets/hand_3.png'];   // 握笔手（gpt-image 线稿，绿幕抠图，见 assets/make_hand.py）
window.ERAS = ['s01','s02','s03','s04','s05','s06','s07','s08','s09','s10','s11','s12'].map(id => ({ id, get dur() { return TIMING.seg[id].dur; } }));
