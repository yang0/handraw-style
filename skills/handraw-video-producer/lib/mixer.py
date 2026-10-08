#!/usr/bin/env python3
"""FFmpeg 音视频混流与多媒体交付模块。
负责将视频轨、旁白语音、背景音乐（BGM 自动闪避）、软/硬字幕融合，并导出各平台封面。
"""
import argparse
from pathlib import Path
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def mix_video(
    video_path: Path,
    narration_path: Path,
    out_final: Path,
    bgm_path: Path = None,
    bgm_gain: float = 0.15,
    subtitles_path: Path = None,
    burn_subtitles: bool = False
):
    video_path = Path(video_path).resolve()
    narration_path = Path(narration_path).resolve()
    out_final = Path(out_final).resolve()
    out_final.parent.mkdir(parents=True, exist_ok=True)

    cmd = ["ffmpeg", "-y", "-i", str(video_path), "-i", str(narration_path)]

    filter_complex = []
    audio_map = "[1:a]"

    # 如果有背景音乐，开启循环并混音
    if bgm_path and Path(bgm_path).exists():
        cmd.extend(["-stream_loop", "-1", "-i", str(Path(bgm_path).resolve())])
        # [2:a] 背景音乐降音量，并与旁白 [1:a] 混合 (amix)
        filter_complex.append(f"[2:a]volume={bgm_gain}[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]")
        audio_map = "[aout]"

    cmd_extra = []

    # 如果指定硬烧录字幕
    video_filter = []
    if burn_subtitles and subtitles_path and Path(subtitles_path).exists():
        # 转义 Windows 路径中的冒号与反斜杠
        sub_escaped = str(Path(subtitles_path).resolve()).replace("\\", "/").replace(":", "\\:")
        video_filter.append(f"subtitles='{sub_escaped}':force_style='FontSize=24,FontName=Microsoft YaHei,MarginV=35,Outline=2,Shadow=0'")

    if filter_complex:
        cmd.extend(["-filter_complex", ";".join(filter_complex)])
        cmd.extend(["-map", "0:v", "-map", audio_map])
    else:
        cmd.extend(["-map", "0:v", "-map", "1:a"])

    if video_filter:
        cmd.extend(["-vf", ",".join(video_filter)])
        cmd.extend(["-c:v", "libx264", "-preset", "fast", "-crf", "18"])
    else:
        cmd.extend(["-c:v", "copy"])

    cmd.extend(["-c:a", "aac", "-b:a", "192k", "-shortest", str(out_final)])

    print(f"[MIX] 正在合成音频与视频...")
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        print(f"[ERR] FFmpeg 混流失败:\n{res.stderr.decode('utf-8', errors='ignore')}")
        sys.exit(1)

    print(f"[OK] 成片生成完毕: {out_final}")

def extract_cover(video_path: Path, out_cover: Path, timestamp: float = 1.0, aspect_ratio: str = "4:3"):
    """从成片中截取指定时间点的画面并裁切为指定比例封面"""
    out_cover = Path(out_cover).resolve()
    out_cover.parent.mkdir(parents=True, exist_ok=True)

    # 通用裁切并缩放滤镜，自适应横屏与竖屏
    if aspect_ratio == "4:3":
        vf = "scale=1200:900:force_original_aspect_ratio=increase,crop=1200:900"
    elif aspect_ratio == "3:4":
        vf = "scale=900:1200:force_original_aspect_ratio=increase,crop=900:1200"
    else:
        vf = ""

    cmd = [
        "ffmpeg", "-y", "-ss", str(timestamp),
        "-i", str(Path(video_path).resolve()),
        "-frames:v", "1"
    ]
    if vf:
        cmd.extend(["-vf", vf])
    cmd.append(str(out_cover))

    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"[COVER] 导出封面 ({aspect_ratio}): {out_cover.name}")

def main():
    parser = argparse.ArgumentParser(description="FFmpeg 混流与封面制作")
    parser.add_argument("--video", required=True, help="视频文件路径")
    parser.add_argument("--narration", required=True, help="旁白音频文件路径")
    parser.add_argument("--out", required=True, help="最终成片 MP4 输出路径")
    parser.add_argument("--bgm", help="BGM 音乐路径（可选）")
    parser.add_argument("--bgm-gain", type=float, default=0.15, help="BGM 音量比例，默认 0.15")
    parser.add_argument("--subtitles", help="SRT 字幕路径（可选）")
    parser.add_argument("--burn-subs", action="store_true", help="是否将字幕硬烧录至画面")
    parser.add_argument("--cover-time", type=float, default=1.0, help="截取封面的时间点秒数")
    args = parser.parse_args()

    mix_video(
        video_path=Path(args.video),
        narration_path=Path(args.narration),
        out_final=Path(args.out),
        bgm_path=Path(args.bgm) if args.bgm else None,
        bgm_gain=args.bgm_gain,
        subtitles_path=Path(args.subtitles) if args.subtitles else None,
        burn_subtitles=args.burn_subs
    )

    # 自动输出双画幅封面
    out_dir = Path(args.out).parent
    extract_cover(Path(args.out), out_dir / "cover_4x3.png", timestamp=args.cover_time, aspect_ratio="4:3")
    extract_cover(Path(args.out), out_dir / "cover_3x4.png", timestamp=args.cover_time, aspect_ratio="3:4")

if __name__ == "__main__":
    main()
