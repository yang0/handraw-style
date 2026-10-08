# 握笔手三姿势：hand_raw_N.png（gpt-image 生成，绿幕；2、3 以 1 为参考图）→ hand_N.png（去绿、保留 1024 原坐标，缩到 640）
# 并量出：笔尖 tip、袖子出画的上沿点 U / 下沿点 L、袖子方向 d（都是 1024 坐标）→ 打印成 JS 常量，贴进 common.js 的 HANDS。
# 用法：python3 make_hand.py
import json, numpy as np
from PIL import Image
TIPDIR = {1: (1, 1), 2: (1, 0.3), 3: (0.5, 1)}   # 笔尖朝哪个方向最远：取 x*a+y*b 最小的不透明像素
out = {}
for n in (1, 2, 3):
    im = np.asarray(Image.open(f'hand_raw_{n}.png').convert('RGB').resize((1024, 1024))).astype(np.float32); r, g, b = im[..., 0], im[..., 1], im[..., 2]
    spill = g - np.maximum(r, b); al = 1 - np.clip((spill - 30) / 70, 0, 1)
    g2 = np.where(spill > 0, np.minimum(g, np.maximum(r, b) + 0.25 * np.clip(spill, 0, 30)), g)
    Image.fromarray(np.dstack([r, g2, b, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA').resize((640, 640), Image.LANCZOS).save(f'hand_{n}.png', optimize=True)
    a = al > 0.5; ys, xs = np.where(a); A, B = TIPDIR[n]; i = np.argmin(xs * A + ys * B); tip = [int(xs[i]), int(ys[i])]
    ry = np.where(a[:, 1023])[0]; bx = np.where(a[1023])[0]
    U = [1023, int(ry.min())]; L = [int(bx.min()), 1023] if len(bx) else [1023, int(ry.max())]
    cols = range(840, 1024, 8); tops = [(x, np.where(a[:, x])[0].min()) for x in cols if a[:, x].any()]
    k = np.polyfit([p[0] for p in tops], [p[1] for p in tops], 1)[0]; d = np.array([1, k]); d = (d / np.linalg.norm(d)).round(3).tolist()
    out[n] = {'tip': tip, 'U': U, 'L': L, 'd': d}
print(json.dumps(out))
