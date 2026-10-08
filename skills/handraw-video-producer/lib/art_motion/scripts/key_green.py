#!/usr/bin/env python3
"""绿幕抠图且保留原画面坐标：输出裁到主体的 RGBA png ＋ sprites.json 里记下它在 1920x1080 画面中的左上角。
gpt-image 用原片帧当参考图、只画角色铺 #00FF00 时，角色已经站在原片坐标上——裁剪时丢掉坐标就白对齐了。
用法：python3 key_green.py raw/*.png --out ../工程/sprites [--soft 40 --hard 110]"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='+'); ap.add_argument('--out', required=True)
ap.add_argument('--soft', type=float, default=30); ap.add_argument('--hard', type=float, default=100); ap.add_argument('--pad', type=int, default=4)
a = ap.parse_args()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
meta_p = out / 'sprites.json'; meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
for f in a.files:
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    spill = g - np.maximum(r, b)                      # 绿色占优程度
    alpha = 1 - np.clip((spill - a.soft) / (a.hard - a.soft), 0, 1)
    # 去绿溢：半透明及边缘像素的绿通道压到 max(r,b)
    g2 = np.where(spill > 0, np.minimum(g, np.maximum(r, b) + 0.25 * np.clip(spill, 0, 30)), g)
    rgba = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    ys, xs = np.where(alpha > 0.05)
    if len(xs) == 0: print('empty', f); continue
    x0, y0 = max(0, xs.min() - a.pad), max(0, ys.min() - a.pad)
    x1, y1 = min(im.shape[1], xs.max() + a.pad + 1), min(im.shape[0], ys.max() + a.pad + 1)
    name = Path(f).stem
    Image.fromarray(rgba[y0:y1, x0:x1]).save(out / f'{name}.png')
    meta[name] = {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}
    print(name, meta[name])
meta_p.write_text(json.dumps(meta, indent=1))
