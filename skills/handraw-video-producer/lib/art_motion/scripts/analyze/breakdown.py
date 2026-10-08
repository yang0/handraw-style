#!/usr/bin/env python3
# /// script
# dependencies = ["numpy", "pillow"]
# ///
"""一条命令把参考动画拆成「能写代码的地图」：接触表、逐帧差、转场起点＋节拍网格拟合、每个转场的 60fps 接触表、每段运动热图、关键帧总览。

    uv run breakdown.py --video 原片.mp4 --out 拆解/ [--thresh 5] [--debounce 12]

产物（都在 --out 下）：
  sheet_*.jpg          4fps 接触表（每张 30 帧，标秒）
  diff.npy             逐帧平均灰度差（192x108），长度 N-1
  cuts.json            转场起点帧号、节拍网格拟合（起点≈t0+k·step，报残差与 BPM 候选）
  转场/T??.jpg         每个转场起点前 2 帧起、每 2 帧一格、15 格的原分辨率缩略接触表
  镜内运动/运动热图.jpg 每段静止区间的逐像素最大帧差（红）叠在灰度底图上，标运动面积占比
  关键帧总览.jpg        每段最后一帧（下个转场前 3 帧）拼图 = 每段的「参考帧」
  ref/seg??.png        同上，原分辨率，喂给生图模型当构图参考
判断阈值：静止段帧差 <2，转场段 10–40；默认阈值 5、去抖 12 帧，按片子调。
"""
import argparse, json, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
ap.add_argument('--video', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--thresh', type=float, default=5); ap.add_argument('--debounce', type=int, default=12)
a = ap.parse_args()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)

def probe():
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', a.video], capture_output=True, text=True)
    s = json.loads(r.stdout)['streams'][0]; n, d = s['r_frame_rate'].split('/'); return s['width'], s['height'], float(n) / float(d)
W, H, FPS = probe()

def frames(w, h, fmt='rgb24'):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.video, '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', fmt, '-'], capture_output=True).stdout
    c = 3 if fmt == 'rgb24' else 1
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, c) if c == 3 else np.frombuffer(raw, np.uint8).reshape(-1, h, w)

# 1) 逐帧差
g = frames(192, 108, 'gray').astype(np.float32)
d = np.abs(np.diff(g, axis=0)).mean(axis=(1, 2)); np.save(out / 'diff.npy', d)
starts = []
for i in range(1, len(d)):
    if d[i] > a.thresh and d[i - 1] <= a.thresh and (not starts or i - starts[-1] > a.debounce): starts.append(i)
# 网格拟合：找「大部分起点都落在 t0+k·step 上」的最大 step（容差 1.5 帧，允许 20% 离群——镜内大动作会被误检成转场）
grid = None
if len(starts) >= 4:
    S_ = np.array(starts, float); best = None
    for step in np.arange(4.0, np.diff(S_).max() + 0.01, 0.01):
        for t0 in S_[:3]:
            k = np.round((S_ - t0) / step); res = S_ - (t0 + k * step); inl = np.abs(res) <= 1.5
            if inl.mean() < 0.8: continue
            t0f = t0 + res[inl].mean(); res = S_ - (t0f + k * step); score = (step, inl.sum())   # 先要最大步长（小步长能硬凑任何点）
            if best is None or score > best[0]: best = (score, step, t0f, k.astype(int).tolist(), np.abs(res[inl]).max(), (~inl).nonzero()[0].tolist())
    if best:
        _, step, t0, k, e, outl = best
        grid = {'t0_frame': round(float(t0), 2), 'step_frames': round(float(step), 3), 'max_residual_frames': round(float(e), 2), 'units_per_cut': k,
                'outlier_cut_index': outl, 'bpm_if_step_is_eighth': round(float(60 * FPS / step / 2), 2), 'bpm_if_step_is_quarter': round(float(60 * FPS / step), 2)}
json.dump({'fps': FPS, 'size': [W, H], 'cuts_frames': starts, 'cuts_sec': [round(s / FPS, 3) for s in starts], 'grid': grid}, open(out / 'cuts.json', 'w'), indent=1, ensure_ascii=False)
print('转场起点(秒):', [round(s / FPS, 3) for s in starts]); print('网格:', grid)

# 2) 4fps 接触表
small = frames(480, 270)
step4 = max(1, round(FPS / 4)); idx = list(range(0, len(small), step4))
for p in range(0, len(idx), 30):
    sub = idx[p:p + 30]; rows = (len(sub) + 5) // 6
    S = Image.new('RGB', (6 * 480, rows * 288), 'white'); dr = ImageDraw.Draw(S)
    for i, f in enumerate(sub):
        x, y = (i % 6) * 480, (i // 6) * 288; S.paste(Image.fromarray(small[f]), (x, y + 18)); dr.text((x + 4, y + 3), f'{f / FPS:.2f}s', fill='black')
    S.save(out / f'sheet_{p // 30}.jpg', quality=85)

# 3) 每个转场的接触表
(out / '转场').mkdir(exist_ok=True)
mid = frames(384, 216)
for n, s in enumerate(starts):
    S = Image.new('RGB', (5 * 384, 3 * 230), 'white'); dr = ImageDraw.Draw(S)
    for i, f in enumerate(range(s - 2, s + 28, 2)):
        if f >= len(mid): break
        x, y = (i % 5) * 384, (i // 5) * 230; S.paste(Image.fromarray(mid[f]), (x, y + 14)); dr.text((x + 3, y + 1), f'f{f} {f / FPS:.3f}s', fill='black')
    S.save(out / '转场' / f'T{n + 1:02d}.jpg', quality=85)

# 4) 运动热图 + 5) 参考帧
(out / '镜内运动').mkdir(exist_ok=True); (out / 'ref').mkdir(exist_ok=True)
bounds = [0] + starts + [len(small)]
heat, keys = [], []
for i in range(len(bounds) - 1):
    a0 = bounds[i] + (round(0.35 * FPS) if i else 0); b0 = bounds[i + 1] - 2
    ref_f = max(bounds[i], bounds[i + 1] - 3)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.video, '-vf', f'select=eq(n\\,{ref_f})', '-frames:v', '1', str(out / 'ref' / f'seg{i + 1:02d}.png')])
    keys.append((i + 1, Image.fromarray(small[min(ref_f, len(small) - 1)])))
    if b0 - a0 < 4: continue
    seq = small[a0:b0].astype(np.float32); m = np.abs(np.diff(seq, axis=0)).mean(axis=3).max(axis=0); frac = (m > 25).mean()
    base = Image.fromarray(seq[0].astype(np.uint8)).convert('L').convert('RGB'); hm = np.zeros((270, 480, 3), np.uint8); hm[..., 0] = np.clip(m * 4, 0, 255)
    im = Image.blend(base, Image.fromarray(hm), 0.6); ImageDraw.Draw(im).text((4, 4), f'段{i + 1} f{a0}-{b0} 运动{frac * 100:.1f}%', fill='yellow'); heat.append(im)
for name, ims in [('镜内运动/运动热图.jpg', heat), ('关键帧总览.jpg', [k[1] for k in keys])]:
    if not ims: continue
    rows = (len(ims) + 3) // 4; S = Image.new('RGB', (4 * 480, rows * 270))
    for i, im in enumerate(ims): S.paste(im, ((i % 4) * 480, (i // 4) * 270))
    S.save(out / name, quality=85)
print('done ->', out)
