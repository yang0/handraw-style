// S03 → S04 进入转场（Vox「从单张照片拉出 → 露出整面拼贴」）：
// 旧画面原地变成桌上一张网点照片——p=0 时照片内框正好铺满画面（= 旧画面原样），相机长尾拉出，桌面、剪报、红线露出来；
// 旧画面逐帧过 45° 网点、叠旧纸色，p=1 时与 s04 段内缓存的那张照片逐像素一致。相机与网点都在 spacex/scenes/s04.js（S04X）。
TRANSITIONS.deskPullOut = (c, A, B, p, o) => { c.drawImage(B, 0, 0); S04X.photoLive(c, A, o.lt, p); };
