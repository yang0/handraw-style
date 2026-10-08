#!/usr/bin/env python3
"""Edge-TTS 配音与毫秒级时间戳生成引擎。
采用 edge-tts 免费语音接口，流式提取 SentenceBoundary，生成对齐音频、timing.json 与 subtitles.srt。
"""
import argparse
import asyncio
import json
from pathlib import Path
import re
import sys
import os
import shutil
import subprocess
import edge_tts

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


DEFAULT_VOICE = "zh-CN-YunxiNeural"

def format_timestamp(seconds: float) -> str:
    """将秒数转为 SRT 时间戳格式 00:00:00,000"""
    ms = int(round(seconds * 1000))
    hours = ms // 3600000
    minutes = (ms % 3600000) // 60000
    secs = (ms % 60000) // 1000
    milli = ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milli:03d}"

async def synthesize(text: str, out_audio: Path, voice: str = DEFAULT_VOICE, rate: str = "+0%"):
    out_audio.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, voice, rate=rate)

    segments = []
    with open(out_audio, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] in ("SentenceBoundary", "WordBoundary"):
                # offset 和 duration 的单位是 100ns (即 1/10,000,000 秒)
                start_sec = chunk["offset"] / 10_000_000.0
                dur_sec = chunk["duration"] / 10_000_000.0
                end_sec = start_sec + dur_sec
                content = chunk.get("text", "").strip()
                if content:
                    segments.append({
                        "start": round(start_sec, 3),
                        "end": round(end_sec, 3),
                        "duration": round(dur_sec, 3),
                        "text": content
                    })

    # A speech boundary excludes trailing silence; it is not file duration.
    ffprobe = os.environ.get("HVP_FFPROBE") or shutil.which("ffprobe")
    if not ffprobe:
        raise RuntimeError("需要ffprobe测量实际配音时长；可设置HVP_FFPROBE，不能用最后一句结束点代替文件实长")
    result=subprocess.run([ffprobe,"-v","error","-show_entries","format=duration","-of","json",str(out_audio)],capture_output=True,text=True,check=True)
    total_dur=float(json.loads(result.stdout)["format"]["duration"])
    if total_dur<=0 or not segments:
        raise RuntimeError("配音或真实语音边界为空，不能继续生成时间线")
    return {
        "voice": voice,
        "rate": rate,
        "duration": total_dur,
        "duration_source": "ffprobe measured audio file",
        "boundary_source": "Edge service returned boundaries; inspect actual granularity",
        "segments": segments
    }

def generate_srt(segments: list) -> str:
    srt_blocks = []
    for idx, seg in enumerate(segments, 1):
        start_str = format_timestamp(seg["start"])
        end_str = format_timestamp(seg["end"])
        srt_blocks.append(f"{idx}\n{start_str} --> {end_str}\n{seg['text']}")
    return "\n\n".join(srt_blocks) + "\n"

def process_text_and_synthesize(text: str, out_dir: Path, voice: str = DEFAULT_VOICE, rate: str = "+0%"):
    out_dir.mkdir(parents=True, exist_ok=True)
    audio_path = out_dir / "narration.mp3"

    timing_data = asyncio.run(synthesize(text, audio_path, voice, rate))

    # 写入 timing.json
    timing_file = out_dir / "timing.json"
    timing_file.write_text(json.dumps(timing_data, ensure_ascii=False, indent=2), encoding="utf-8")

    # 写入 subtitles.srt
    srt_content = generate_srt(timing_data["segments"])
    srt_file = out_dir / "subtitles.srt"
    srt_file.write_text(srt_content, encoding="utf-8")

    print(f"[OK] 配音完成：{audio_path}（时长: {timing_data['duration']}秒，共 {len(timing_data['segments'])} 段）")
    return timing_data

def main():
    parser = argparse.ArgumentParser(description="Edge-TTS 音画对齐生成器")
    parser.add_argument("--text", help="口播台词文本，或指向文本文件的路径", required=True)
    parser.add_argument("--out-dir", default=".", help="输出目录")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="TTS 音色，默认 zh-CN-YunxiNeural")
    parser.add_argument("--rate", default="+10%", help="语速微调，例如 +10% 或 +20%")
    args = parser.parse_args()

    content = args.text
    text_path = Path(args.text)
    if text_path.exists() and text_path.is_file():
        content = text_path.read_text(encoding="utf-8").strip()

    process_text_and_synthesize(content, Path(args.out_dir), args.voice, args.rate)

if __name__ == "__main__":
    main()
