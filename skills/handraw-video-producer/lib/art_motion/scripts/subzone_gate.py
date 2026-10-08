#!/usr/bin/env python3
"""字幕带门禁：扫「无字幕版」成片，字幕带里出现画面内容（字、描边、火箭、火焰）就报时间码。

    python3 subzone_gate.py <无字幕版.mp4> [--band 920] [--fps 10] [--thresh 150]

qa.py检查文字框；本脚本补充检查图形是否进入字幕带。
数的是灰度 <95 的深色像素，只适合浅底干净的风格（白板、米白纸面、发布会浅色版）。
纹理底（Vox 牛皮纸桌面）按字幕带主色差判断容易产生大量误报：这类风格靠 qa.py 的框景，
或者像 Vox 版那样让文字 API 登记所属物件再查遮挡。
阈值是那支片子的实测值（字幕带缩半成 960×80 后 >150 个像素），换风格先拿已知好／坏的两帧校一下。
"""
import argparse, subprocess, numpy as np
ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--band', type=int, default=920, help='字幕带上沿 y（1080 高）')
ap.add_argument('--fps', type=float, default=10); ap.add_argument('--thresh', type=int, default=150)
a = ap.parse_args()
h = 1080 - a.band; W, H = 960, h // 2
cmd = ['ffmpeg', '-v', 'error', '-i', a.video, '-vf', f'fps={a.fps},scale=1920:1080,crop=1920:{h}:0:{a.band},scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']
raw = subprocess.run(cmd, capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W)
bad = []
for i, f in enumerate(fr):
    n = int((f < 95).sum())
    if n > a.thresh: bad.append((i / a.fps, n))
runs = []
for t, n in bad:
    if runs and t - runs[-1][1] <= 1.5 / a.fps: runs[-1][1] = t; runs[-1][2] = max(runs[-1][2], n)
    else: runs.append([t, t, n])
print(f'{len(fr)} 帧，命中 {len(bad)} 帧')
for t0, t1, n in runs: print(f'  {t0:7.2f}–{t1:7.2f}s  最多 {n} 个像素')
