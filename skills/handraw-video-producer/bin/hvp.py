#!/usr/bin/env python3
"""Handraw Video Producer (hvp) · 手绘视频制作师命令行工具。
用法：
  python hvp.py new "<标题>" [--mode comic|whiteboard|story|scroll]
  python hvp.py tts "<标题>"
  python hvp.py render "<标题>"
  python hvp.py mix "<标题>"
  python hvp.py covers "<标题>"
  python hvp.py build "<标题>"
"""
import argparse
import asyncio
import base64
from datetime import datetime
import json
from pathlib import Path
import subprocess
import sys

# 注入 lib 目录
SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent

def find_project_root() -> Path:
    cur = Path(__file__).resolve()
    for p in cur.parents:
        if (p / "styles_200_reorganized.md").exists() or (p / "version.json").exists():
            return p
    return Path("e:/handraw-style")

PROJECT_ROOT = find_project_root()
LIB_DIR = SKILL_ROOT / "lib"
sys.path.insert(0, str(LIB_DIR))

from tts_engine import process_text_and_synthesize, synthesize, generate_srt
from render_engine import render_html_to_video
from mixer import mix_video, extract_cover
from frame_layout import resolve_frame
from whiteboard import validate_board, prepare_whiteboard
from subtitles import SUBTITLE_MODES, resolve_subtitle_mode, export_subtitles

EPISODES_DIR = PROJECT_ROOT / "videos" / "episodes"

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def resolve_episode(keyword: str) -> Path:
    """根据关键词模糊匹配期目录"""
    if not EPISODES_DIR.exists():
        EPISODES_DIR.mkdir(parents=True, exist_ok=True)
    cands = [p for p in EPISODES_DIR.iterdir() if p.is_dir() and keyword.lower() in p.name.lower()]
    if not cands:
        raise FileNotFoundError(f"未找到包含 '{keyword}' 的期目录 (在 {EPISODES_DIR})")
    return sorted(cands, key=lambda p: p.stat().st_mtime, reverse=True)[0]

def _generic_subtitle_mode(meta):
    subtitle_mode=resolve_subtitle_mode(meta)
    if subtitle_mode!="burn-in" and meta.get("mode") not in ("whiteboard","sketch"):
        raise ValueError("通用字幕开关目前接入whiteboard/sketch；其他模态需核对并适配期内渲染器，不能只写字段")
    return subtitle_mode


def cmd_new(title: str, mode: str = "comic", aspect=None, width=None, height=None, fps=30, subtitle_mode="burn-in"):
    _generic_subtitle_mode({"mode":mode,"subtitle_mode":subtitle_mode})
    frame = resolve_frame(aspect, width, height, fps, default_aspect="16:9" if mode=="scroll" else "9:16")
    EPISODES_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    folder_name = f"{today} {title}"
    ep_dir = EPISODES_DIR / folder_name
    if ep_dir.exists():
        print(f"[ERR] 目录已存在: {ep_dir}")
        return

    ep_dir.mkdir(parents=True)
    (ep_dir / "assets").mkdir()
    (ep_dir / "work").mkdir()
    (ep_dir / "outputs").mkdir()

    if mode in ["story", "watercolor", "picturebook"]:
        meta = {
            "title": title,
            "mode": mode,
            "created_at": datetime.now().isoformat(),
            "width": 1080,
            "height": 1920,
            "fps": 30,
            "voice": "zh-CN-XiaoxiaoNeural",
            "rate": "+0%",
            "style_code": "FB-001",
            "layout_code": "SC-001",
            "theme_color": "#c27d53"
        }
        default_script = (
            "风吹过麦田的时候，世界忽然安静了下来。|\n"
            "去晒晒温暖的阳光吧，把烦恼都交给落日的余温。|\n"
            "今天也辛苦了，愿你今晚有一个香甜的好梦。\n"
        )
        publish_md = (
            f"# 《{title}》发布文案\n\n"
            "## 标题备选\n"
            f"1. 晚安治愈小诗：世界很吵，但这里很安静\n"
            f"2. 累的时候，就来看看这篇手绘水彩绘本吧\n\n"
            "## 视频号 / 抖音 / 小红书正文\n"
            f"“风吹过麦田的时候，世界忽然安静了下来。”\n"
            f"326 种手绘艺术风格 × 治愈系动态绘本《{title}》。\n"
            "#治愈系 #绘本 #晚安故事 #手绘插画 #心灵疗愈\n"
        )
    elif mode == "comic":
        meta = {
            "title": title,
            "mode": mode,
            "submode": "parallax_theater",
            "created_at": datetime.now().isoformat(),
            "width": 1080,
            "height": 1920,
            "fps": 30,
            "voice": "zh-CN-XiaoxiaoNeural",
            "rate": "+6%",
            "style_code": "FD-020",
            "layout_code": "SB-001",
            "theme_color": "C-09",
            "architecture": "2.5D Parallax Stage + 3x2 Sprite Atlas + Spring Pop Bubbles"
        }
        default_script = (
            "等会儿，我手机找不着了！|\n"
            "沙发没有，包里也没有……|\n"
            "那你现在，拿什么跟我说话？|\n"
            "找到了，在我耳朵上。\n"
        )
        publish_md = (
            f"# 《{title}》发布文案\n\n"
            "## 标题备选\n"
            f"1. {title}：这犯傻操作太真实了！\n"
            f"2. 找手机找了个寂寞，结局笑死\n\n"
            "## 视频号 / 抖音 / 小红书正文\n"
            f"找东西很认真，直到被朋友一语点醒……\n"
            f"《{title}》手绘 2.5D 动态漫，纯正生活松弛感。\n"
            "#搞笑日常 #动态漫画 #生活迷惑行为 #原创短漫\n"
        )
        # 写入导演设计参考
        design_guide = (
            f"# 《{title}》导演设计参考\n\n"
            "详见导演手册: `skills/handraw-video-producer/references/motion_comic_director_guide.md`\n\n"
            "## 必备资产规范 (放入 assets/ 目录)：\n"
            f"1. `assets/background.png`：纯净 {frame['aspect_ratio']} 场景背景（无角色、无文字、留出表演与气泡区域）。\n"
            "2. `assets/sprites.png`：3:2 画幅、3列2行共6格透明 Sprite Atlas：\n"
            "   - 格0 (上左): 姿态 1 (基础搜寻/站姿)\n"
            "   - 格1 (上中): 姿态 2 (弯腰搜寻/动作变化)\n"
            "   - 格2 (上右): 姿态 3 (呆滞停顿/惊讶石化)\n"
            "   - 格3 (下左): 姿态 4 (心虚尴尬/反转收尾)\n"
            "   - 格4 (下中): 独立道具 A (如抱枕、外卖、杯子)\n"
            "   - 格5 (下右): 独立道具 B (如帆布包、钥匙串、手机)\n"
        )
        (ep_dir / "design.md").write_text(design_guide, encoding="utf-8")
    elif mode in ["knowledge", "abroll"]:
        meta = {
            "title": title,
            "mode": "knowledge",
            "narrative_model": "A/B-Roll (White IP Stage ⇄ Dark Screencast/Infographic)",
            "created_at": datetime.now().isoformat(),
            "width": 1080,
            "height": 1920,
            "fps": 30,
            "voice": "zh-CN-YunxiNeural",
            "rate": "+10%",
            "style_code": "IG-001",
            "layout_code": "SC-023",
            "theme_color": "#00d26a"
        }
        default_script = (
            "很多朋友问我，怎么用 AI 自动化制作爆款短视频？|\n"
            "核心秘密就四个字：双轨轮替！白底讲情绪，黑底讲知识。|\n"
            "其实全流程只需要三步：脚本切分、声学对齐和无头渲染。|\n"
            "学会这套工业级管线，你也能轻松实现零成本批量出片！\n"
        )
        publish_md = (
            f"# 《{title}》发布文案\n\n"
            "## 标题备选\n"
            f"1. AI 视频爆款拆解：为什么你要学会 A/B-roll 剪辑？\n"
            f"2. 零成本全自动出片！教你搭建工业级视频制作管线\n\n"
            "## 视频号 / 抖音 / B站 / 小红书正文\n"
            "干货预警！为什么顶流知识博主都在用 A/B-roll 双轨交替剪辑？\n"
            "本期带你深度拆解从脚本切分到自动渲染的全流程。\n"
            "#AI短视频 #知识科普 #干货分享 #全自动剪辑 #生产力工具\n"
        )
        design_guide = (
            f"# 《{title}》知识双轨导演设计参考\n\n"
            "详见导演手册: `skills/handraw-video-producer/references/knowledge_abroll_director_guide.md`\n\n"
            "## 必备资产规范 (放入 assets/ 目录)：\n"
            "1. `assets/ip.png` (或 ip.webp)：白底 IP 形象图（主持人视角，面对镜头，手势讲解）。\n"
            "2. `assets/broll_1.png`、`assets/broll_2.png` 等：深底信息图/实操卡片（如 SC-023 痛点卡、IG-001 步骤图、软件操作截图）。\n"
        )
        (ep_dir / "design.md").write_text(design_guide, encoding="utf-8")
    elif mode in ["sketch", "whiteboard"]:
        meta = {
            "title": title,
            "mode": "sketch",
            "narrative_model": "Vector Hand-drawn Sketch & Mindmap (Rough Dual-Stroke + Brush Wipe)",
            "created_at": datetime.now().isoformat(),
            "width": 1080,
            "height": 1920,
            "fps": 30,
            "voice": "zh-CN-YunxiNeural",
            "rate": "+12%",
            "style_code": None,
            "layout_code": None,
            "palette": {"paper":"#fcf7ea","ink":"#242b38","primary":"#194ac8","accent":"#f6762b"},
            "status": "draft_needs_storyboard"
        }
        default_script = ""  # Do not substitute an unrelated business topic for the requested title.
        publish_md = (
            f"# 《{title}》发布文案\n\n"
            "## 标题备选\n"
            f"1. {title}\n\n"
            "## 视频号 / 抖音 / B站 / 小红书正文\n"
            "根据已确认的剧本补充摘要与内容依据。\n\n"
            "手绘知识、科普视频\n"
        )
        design_guide = (
            f"# 《{title}》手绘思维导图导演设计参考\n\n"
            "详见导演手册: `skills/handraw-video-producer/references/sketch_whiteboard_director_guide.md`\n\n"
            "先选择当前风格库、图型库和配色，再写全片视觉/运动方案。\n"
            "创建storyboard.json：每幕明确hero/steps/compare/diagram、简短标题、真实图像路径及segment_indices。\n"
            "素材保存到assets；图集以source_rect像素采样。默认模板横竖重排，不自动读取图型编号。\n"
            "具体契约见references/frame_and_asset_contract.md；空草稿不能build。\n"
        )
        (ep_dir / "design.md").write_text(design_guide, encoding="utf-8")
        (ep_dir / "storyboard.json").write_text(json.dumps({"version":1,"scenes":[]},ensure_ascii=False,indent=2),encoding="utf-8")
    else:
        meta = {
            "title": title,
            "mode": mode,
            "created_at": datetime.now().isoformat(),
            "width": 1920,
            "height": 1080,
            "fps": 30,
            "voice": "zh-CN-YunxiNeural",
            "rate": "+10%",
            "style_code": "IG-001",
            "layout_code": "SC-023",
            "theme_color": "C-34"
        }
        default_script = (
            "第一段台词，开场引入。|\n"
            "第二段台词，反转与高潮！\n"
        )
        publish_md = (
            f"# 《{title}》发布文案\n\n"
            "## 标题备选\n"
            f"1. {title}：这手绘效果绝了！\n"
            f"2. 怎么用手绘风格做视频？看完这篇就懂了\n\n"
            "## 视频号 / 抖音 / 小红书正文\n"
            f"{title}。全流程 handraw-style 手绘出片，包含 326 种风格与 165 款排版图型。\n"
            "#AI视频 #手绘风格 #动态漫画 #手绘插画\n"
        )

    meta.update(frame)
    meta["subtitle_mode"]=subtitle_mode
    (ep_dir / "episode.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    (ep_dir / "script.txt").write_text(default_script, encoding="utf-8")
    (ep_dir / "publish.md").write_text(publish_md, encoding="utf-8")

    print(f"[OK] 已成功创建期工程: {ep_dir}")
    print(f"👉 下一步: 编辑 {ep_dir / 'script.txt'} -> 准备素材 -> python hvp.py build \"{title}\"")

def _delegate_if_has_produce(ep_dir: Path, subcmd: str) -> bool:
    produce_script = ep_dir / "produce.py"
    if produce_script.exists():
        print(f"[HVP] 检测到期内专属制作脚本: {produce_script.name}，优先执行专属导演逻辑...")
        res = subprocess.run([sys.executable, str(produce_script), subcmd], cwd=str(ep_dir))
        if res.returncode != 0:
            raise RuntimeError(f"专属导演脚本执行失败 ({subcmd}), 错误码: {res.returncode}")
        return True
    return False

def cmd_tts(ep_dir: Path):
    if _delegate_if_has_produce(ep_dir, "tts"):
        return

    script_file = ep_dir / "script.txt"
    if not script_file.exists():
        raise FileNotFoundError(f"缺少 {script_file}")
    text = script_file.read_text(encoding="utf-8").strip()
    meta = json.loads((ep_dir / "episode.json").read_text(encoding="utf-8"))
    _generic_subtitle_mode(meta)
    if meta.get("mode") in ("sketch","whiteboard"):
        validate_board(ep_dir)
    if not text:
        raise ValueError("script.txt为空；先完成本期剧本，不使用模板题材代替")
    if meta.get("tts_provider","edge").lower() not in ("edge","edge-tts"):
        raise ValueError("通用TTS仅支持Edge；指定其他服务须使用其可用工具或期内适配，不能静默回退")

    work_dir = ep_dir / "work"
    timing = process_text_and_synthesize(
        text=text,
        out_dir=work_dir,
        voice=meta.get("voice", "zh-CN-XiaoxiaoNeural" if meta.get("mode") == "comic" else "zh-CN-YunxiNeural"),
        rate=meta.get("rate", "+8%")
    )
    return timing

def cmd_render(ep_dir: Path):
    if _delegate_if_has_produce(ep_dir, "render"):
        return

    meta = json.loads((ep_dir / "episode.json").read_text(encoding="utf-8"))
    _generic_subtitle_mode(meta)
    work_dir = ep_dir / "work"
    if meta.get("mode") in ("sketch","whiteboard"):
        validate_board(ep_dir)
    timing_file = work_dir / "timing.json"
    if not timing_file.exists():
        cmd_tts(ep_dir)
    timing = json.loads(timing_file.read_text(encoding="utf-8"))

    mode = meta.get("mode", "comic")
    raw_video = work_dir / "raw_video.mp4"

    if mode == "comic":
        assets_dir = ep_dir / "assets"
        bg_cands = list(assets_dir.glob("background.*"))
        sp_cands = list(assets_dir.glob("sprites.*"))

        # 判断是否具备 2.5D 视差剧场素材 (Background + 3x2 Sprites Atlas)
        if bg_cands and sp_cands:
            print("[HVP] 检测到 2.5D 视差剧场素材 (背景 + 3x2 Sprite 图集)，启动 Parallax Theater 渲染...")
            bg_path = bg_cands[0]
            sp_path = sp_cands[0]

            bg_b64 = "data:image/png;base64," + base64.b64encode(bg_path.read_bytes()).decode("utf-8")
            sp_b64 = "data:image/png;base64," + base64.b64encode(sp_path.read_bytes()).decode("utf-8")

            segs = timing.get("segments", [])
            cues = []
            starts = [0.0]
            for i, seg in enumerate(segs):
                cues.append({
                    "key": f"clip_{i}",
                    "text": seg["text"],
                    "speaker": "friend" if "说话" in seg["text"] or i % 3 == 2 else "character",
                    "start": seg["start"],
                    "end": seg["end"]
                })
                if i > 0 and i < 4:
                    starts.append(seg["start"])
            while len(starts) < 4:
                starts.append(timing["duration"] * (len(starts) / 4.0))

            config = {
                "title": meta.get("title", "动态漫"),
                "duration": timing["duration"],
                "background": bg_b64,
                "sprites": sp_b64,
                "starts": starts,
                "cues": cues,
                "sfx": [[1.0, "cloth", "沙沙"], [starts[2] + 0.2, "hint", "叮"]]
            }

            theater_html = (SKILL_ROOT / "lib/modes/motion_comic_theater.html").read_text(encoding="utf-8")
            injected = theater_html.replace(
                "/*THEATER_CONFIG*/",
                f"window.CONFIG = {json.dumps(config, ensure_ascii=False)};"
            )
            scene_html = work_dir / "scene.html"
            scene_html.write_text(injected, encoding="utf-8")
        else:
            # 基础降级：单图分镜运镜模式
            cands = list(assets_dir.glob("*.webp")) + list(assets_dir.glob("*.png")) + list(assets_dir.glob("*.jpg"))
            if cands:
                comic_path = cands[0]
            else:
                comic_path = PROJECT_ROOT / "images/layouts/comic-storyboards/SB-069.webp"

            comic_b64 = "data:image/webp;base64," + base64.b64encode(comic_path.read_bytes()).decode("utf-8")
            segs = timing["segments"]
            p1_end = segs[0]["end"] if len(segs) > 1 else timing["duration"] / 2

            panels = [
                {"id": 1, "rect": [0.0, 0.0, 1.0, 0.5], "start": 0.0, "end": p1_end, "caption": segs[0]["text"] if segs else ""},
                {"id": 2, "rect": [0.0, 0.5, 1.0, 0.5], "start": p1_end, "end": timing["duration"], "caption": segs[1]["text"] if len(segs) > 1 else ""}
            ]

            config = {"imageUrl": comic_b64, "duration": timing["duration"], "panels": panels}
            template_html = (SKILL_ROOT / "lib/modes/comic_template.html").read_text(encoding="utf-8")
            injected = template_html.replace("</body>", f"<script>window.initComic({json.dumps(config, ensure_ascii=False)});</script></body>")
            scene_html = work_dir / "scene.html"
            scene_html.write_text(injected, encoding="utf-8")

        render_html_to_video(
            html_path=scene_html,
            out_video=raw_video,
            duration=timing["duration"],
            fps=meta.get("fps", 30),
            width=meta.get("width", 1080),
            height=meta.get("height", 1920)
        )
    elif mode in ["story", "watercolor", "picturebook"]:
        cands = list((ep_dir / "assets").glob("*.webp")) + list((ep_dir / "assets").glob("*.png")) + list((ep_dir / "assets").glob("*.jpg"))
        if not cands:
            default_fbs = ["FB-001.webp", "FB-003.webp", "FB-005.webp"]
            cands = [PROJECT_ROOT / "images/individual/FB" / f for f in default_fbs if (PROJECT_ROOT / "images/individual/FB" / f).exists()]
            if not cands:
                cands = [PROJECT_ROOT / "images/individual/FB/FB-001.webp"]

        segs = timing["segments"]
        scenes_config = []
        for i, seg in enumerate(segs):
            img_path = cands[i % len(cands)]
            img_b64 = "data:image/webp;base64," + base64.b64encode(img_path.read_bytes()).decode("utf-8")
            parts = [p.strip() for p in seg["text"].replace("，", "|").replace("。", "|").replace("！", "|").split("|") if p.strip()]
            main_cap = parts[0] if parts else seg["text"]
            sub_cap = parts[1] if len(parts) > 1 else ""
            scenes_config.append({
                "id": i + 1,
                "imageUrl": img_b64,
                "start": seg["start"],
                "end": seg["end"],
                "caption": main_cap,
                "subCaption": sub_cap,
                "zoomDirection": "in" if i % 2 == 0 else "out"
            })

        config = {
            "duration": timing["duration"],
            "themeColor": meta.get("theme_color", "#c27d53"),
            "scenes": scenes_config
        }

        template_html = (SKILL_ROOT / "lib/modes/story_template.html").read_text(encoding="utf-8")
        injected = template_html.replace(
            "</body>",
            f"<script>window.initStory({json.dumps(config, ensure_ascii=False)});\nwindow.addEventListener('load', () => window.renderFrame(0));</script></body>"
        )
        scene_html = work_dir / "scene.html"
        scene_html.write_text(injected, encoding="utf-8")

        render_html_to_video(
            html_path=scene_html,
            out_video=raw_video,
            duration=timing["duration"],
            fps=meta.get("fps", 30),
            width=meta.get("width", 1080),
            height=meta.get("height", 1920)
        )
    elif mode in ["knowledge", "abroll"]:
        print("[HVP] 启动知识双轨 A/B-Roll 模式渲染...")
        assets_dir = ep_dir / "assets"
        ip_poses = sorted(list(assets_dir.glob("ip_*.*")))
        ip_cands = ip_poses if ip_poses else (list(assets_dir.glob("ip.*")) + list(assets_dir.glob("avatar.*")))

        all_ip_b64s = []
        for p in ip_cands:
            ext = p.suffix.lower()
            mime = "image/png" if ext == ".png" else ("image/jpeg" if ext in [".jpg", ".jpeg"] else "image/webp")
            all_ip_b64s.append(f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode("utf-8"))

        bg_cands = list(assets_dir.glob("bg.*")) + list(assets_dir.glob("background.*")) + list(assets_dir.glob("stage.*"))
        bg_b64 = ""
        if bg_cands:
            b_path = bg_cands[0]
            ext = b_path.suffix.lower()
            mime = "image/png" if ext == ".png" else "image/jpeg"
            bg_b64 = f"data:{mime};base64," + base64.b64encode(b_path.read_bytes()).decode("utf-8")

        broll_cands = [p for p in sorted(assets_dir.glob("broll_*.*")) if p.is_file()]
        if not broll_cands:
            broll_cands = [p for p in sorted(assets_dir.glob("*.webp")) + sorted(assets_dir.glob("*.png")) if not p.name.startswith("ip") and not p.name.startswith("avatar") and not p.name.startswith("bg")]
        if not broll_cands:
            fallback_broll = [PROJECT_ROOT / "images/layouts/social-cards/SC-023.webp", PROJECT_ROOT / "images/layouts/infographics/IG-001.webp"]
            broll_cands = [p for p in fallback_broll if p.exists()]

        segs = timing.get("segments", [])
        segments_config = []
        for i, seg in enumerate(segs):
            is_b = (i % 2 == 1)
            img_data = ""
            seg_poses = []
            if is_b and broll_cands:
                b_path = broll_cands[(i // 2) % len(broll_cands)]
                ext = b_path.suffix.lower()
                mime = "image/png" if ext == ".png" else ("image/jpeg" if ext in [".jpg", ".jpeg"] else "image/webp")
                img_data = f"data:{mime};base64," + base64.b64encode(b_path.read_bytes()).decode("utf-8")
            elif not is_b:
                custom_seg_poses = meta.get("segment_poses", {}).get(str(i + 1))
                if custom_seg_poses:
                    for p_name in custom_seg_poses:
                        p_path = assets_dir / p_name
                        if p_path.exists():
                            ext = p_path.suffix.lower()
                            mime = "image/png" if ext == ".png" else "image/jpeg"
                            seg_poses.append(f"data:{mime};base64," + base64.b64encode(p_path.read_bytes()).decode("utf-8"))
                elif len(all_ip_b64s) >= 2:
                    base_idx = (i // 2) % len(all_ip_b64s)
                    next_idx = (base_idx + 1) % len(all_ip_b64s)
                    seg_poses = [all_ip_b64s[base_idx], all_ip_b64s[next_idx]]

                if ip_cands:
                    ip_p = ip_cands[(i // 2) % len(ip_cands)]
                    ext = ip_p.suffix.lower()
                    mime = "image/png" if ext == ".png" else ("image/jpeg" if ext in [".jpg", ".jpeg"] else "image/webp")
                    img_data = f"data:{mime};base64," + base64.b64encode(ip_p.read_bytes()).decode("utf-8")
                else:
                    default_ip = PROJECT_ROOT / "skills/handdraw-style-prompter/gallery/images/contact_sheets/001.jpg"
                    if default_ip.exists():
                        img_data = "data:image/jpeg;base64," + base64.b64encode(default_ip.read_bytes()).decode("utf-8")

            parts = [p.strip() for p in seg["text"].replace("，", "|").replace("。", "|").replace("！", "|").replace("？", "|").split("|") if p.strip()]
            main_cap = parts[0] if parts else seg["text"]
            sub_cap = parts[1] if len(parts) > 1 else ("知识要点分析" if is_b else "核心逻辑讲解")

            # 检测显式或隐式 LiveCanvas 数据看板
            data_board = None
            custom_boards = meta.get("data_boards", {})
            if str(i + 1) in custom_boards:
                data_board = custom_boards[str(i + 1)]
            elif is_b and not img_data:
                digits = [w for w in main_cap.split() if any(c.isdigit() for c in w)]
                hero_val = digits[0] if digits else None
                data_board = {
                    "kind": "versus",
                    "title": main_cap,
                    "subtitle": sub_cap,
                    "hero": hero_val,
                    "source": "数据来源：权威评测基准与事实核查"
                }

            segments_config.append({
                "id": i + 1,
                "type": "B" if is_b else "A",
                "start": seg["start"],
                "end": seg["end"],
                "imageUrl": img_data if not data_board else "",
                "poses": seg_poses,
                "dataBoard": data_board,
                "caption": main_cap,
                "subCaption": sub_cap,
                "viewpoint": "infographic" if is_b else "host"
            })

        config = {
            "duration": timing["duration"],
            "themeColor": meta.get("theme_color", "#00d26a"),
            "title": meta.get("title", "知识教程"),
            "bgUrl": bg_b64,
            "segments": segments_config
        }

        template_html = (SKILL_ROOT / "lib/modes/abroll_template.html").read_text(encoding="utf-8")
        injected = template_html.replace(
            "/*ABROLL_CONFIG*/",
            f"window.CONFIG = {json.dumps(config, ensure_ascii=False)};"
        )
        scene_html = work_dir / "scene.html"
        scene_html.write_text(injected, encoding="utf-8")

        render_html_to_video(
            html_path=scene_html,
            out_video=raw_video,
            duration=timing["duration"],
            fps=meta.get("fps", 30),
            width=meta.get("width", 1080),
            height=meta.get("height", 1920)
        )
    elif mode in ["sketch", "whiteboard"]:
        print("[HVP] 启动插画白板：显式分镜、完整段落、横竖屏独立重排...")
        scene_html = prepare_whiteboard(ep_dir,meta,timing,SKILL_ROOT / "lib/modes/whiteboard_template.html")
        render_html_to_video(
            html_path=scene_html,
            out_video=raw_video,
            duration=timing["duration"],
            fps=meta.get("fps", 30),
            width=meta.get("width", 1080),
            height=meta.get("height", 1920)
        )
    elif mode in ["scroll", "wander"]:
        print("[HVP] 启动无界漫步长卷：一镜到底连续运镜、多画风羽化接缝、2.5D三层视差...")
        assets_dir = ep_dir / "assets"
        cands = list(assets_dir.glob("*.webp")) + list(assets_dir.glob("*.png")) + list(assets_dir.glob("*.jpg"))

        # 排除角色贴纸
        scene_files = [f for f in cands if not any(k in f.name.lower() for k in ["character", "avatar", "ip", "stroller"])]
        if not scene_files:
            # 选用库中代表性画风大图 (从古典素描、水墨、水彩到重彩)
            default_samples = [
                PROJECT_ROOT / "images/individual/FA/FA-001.webp",
                PROJECT_ROOT / "images/individual/FB/FB-001.webp",
                PROJECT_ROOT / "images/individual/FB/FB-003.webp",
                PROJECT_ROOT / "images/individual/FB/FB-005.webp"
            ]
            scene_files = [f for f in default_samples if f.exists()]
            if not scene_files:
                scene_files = list((PROJECT_ROOT / "images/individual/FB").glob("*.webp"))[:4]

        # 转换场景图片为 Base64
        scenes_config = []
        for i, sf in enumerate(scene_files):
            mime = "image/png" if sf.suffix.lower() == ".png" else "image/webp"
            b64 = f"data:{mime};base64," + base64.b64encode(sf.read_bytes()).decode("utf-8")
            scenes_config.append({
                "id": f"scene_{i+1}",
                "url": b64,
                "name": sf.stem
            })

        # 角色贴纸检测 (仅当 assets 明确提供透明人物时挂载，否则使用手绘行者剪影)
        char_cands = [f for f in cands if any(k in f.name.lower() for k in ["character", "avatar", "ip", "stroller"])]
        char_b64 = None
        if char_cands:
            mime = "image/png" if char_cands[0].suffix.lower() == ".png" else "image/webp"
            char_b64 = f"data:{mime};base64," + base64.b64encode(char_cands[0].read_bytes()).decode("utf-8")

        # 沿途章节里程碑
        segs = timing.get("segments", [])
        milestones = []
        default_badges = ["墨韵", "芳华", "浮世", "天工", "归途"]
        for i, seg in enumerate(segs):
            if i % 2 == 0 or len(segs) <= 3:
                badge = default_badges[len(milestones) % len(default_badges)]
                clean_title = seg["text"].split("，")[0].split("。")[0]
                milestones.append({
                    "time": seg["start"],
                    "badge": badge,
                    "title": f"第{len(milestones)+1}卷 · {clean_title[:8]}",
                    "color": meta.get("theme_color", "#c27d53")
                })

        config = {
            "title": meta.get("title", "无界漫步长卷"),
            "duration": timing["duration"],
            "width": meta.get("width", 1080),
            "height": meta.get("height", 1920),
            "themeColor": meta.get("theme_color", "#00d26a"),
            "characterUrl": char_b64,
            "scenes": scenes_config,
            "milestones": milestones,
            "cues": [{"text": s["text"], "start": s["start"], "end": s["end"]} for s in segs]
        }

        template_html = (SKILL_ROOT / "lib/modes/scroll_template.html").read_text(encoding="utf-8")
        injected = template_html.replace(
            "/*SCROLL_CONFIG*/",
            f"window.CONFIG = {json.dumps(config, ensure_ascii=False)};"
        )
        scene_html = work_dir / "scene.html"
        scene_html.write_text(injected, encoding="utf-8")

        render_html_to_video(
            html_path=scene_html,
            out_video=raw_video,
            duration=timing["duration"],
            fps=meta.get("fps", 30),
            width=meta.get("width", 1080),
            height=meta.get("height", 1920)
        )
    else:
        raise NotImplementedError(f"模式 {mode} 正在逐步接入中")

def cmd_mix(ep_dir: Path):
    if _delegate_if_has_produce(ep_dir, "mix"):
        return

    work_dir = ep_dir / "work"
    meta = json.loads((ep_dir / "episode.json").read_text(encoding="utf-8"))
    subtitle_mode = _generic_subtitle_mode(meta)
    outputs_dir = ep_dir / "outputs"
    final_video = outputs_dir / "final.mp4"
    raw_video = work_dir / "raw_video.mp4"
    narration_audio = work_dir / "dialogue_mix.wav" if (work_dir / "dialogue_mix.wav").exists() else (work_dir / "narration.mp3")

    if not raw_video.exists():
        raise FileNotFoundError(f"缺少 {raw_video}，请先执行 render")

    mix_video(
        video_path=raw_video,
        narration_path=narration_audio,
        out_final=final_video
    )
    timing = json.loads((work_dir / "timing.json").read_text(encoding="utf-8")) if subtitle_mode!="none" else {}
    meta["subtitles"] = export_subtitles(ep_dir,meta,timing)
    (ep_dir / "episode.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"\n🎉 [COMPLETE] 成片已交付至: {final_video}")

def cmd_covers(ep_dir: Path):
    if _delegate_if_has_produce(ep_dir, "covers"):
        return

    work_dir = ep_dir / "work"
    outputs_dir = ep_dir / "outputs"
    scene_html = work_dir / "scene.html"

    if scene_html.exists():
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(channel="msedge")
                page = browser.new_page()
                page.goto(scene_html.as_uri())
                has_cover = page.evaluate("typeof window.renderCover === 'function'")
                if has_cover:
                    for name, w, h in [("cover_4x3.png", 1200, 900), ("cover_3x4.png", 900, 1200)]:
                        data = page.evaluate("([w,h]) => window.renderCover(w,h)", [w, h])
                        (outputs_dir / name).write_bytes(base64.b64decode(data))
                    browser.close()
                    print("[COVER] 4:3 与 3:4 独立艺术封面生成完成")
                    return
                browser.close()
        except Exception as e:
            print(f"[COVER] 动态封面渲染遇到异常 ({e})，降级为关键帧截取...")

    final_video = outputs_dir / "final.mp4"
    if final_video.exists():
        extract_cover(final_video, outputs_dir / "cover_4x3.png", timestamp=1.0, aspect_ratio="4:3")
        extract_cover(final_video, outputs_dir / "cover_3x4.png", timestamp=1.0, aspect_ratio="3:4")
        print("[COVER] 已从成片提取 4:3 与 3:4 封面")

def cmd_build(ep_dir: Path):
    print(f"=== 开始全流程制作: {ep_dir.name} ===")
    cmd_tts(ep_dir)
    cmd_render(ep_dir)
    cmd_mix(ep_dir)
    cmd_covers(ep_dir)

def main():
    if len(sys.argv)>1 and sys.argv[1]=='art-motion':
        from art_motion import main as art_motion_main
        art_motion_main(sys.argv[2:])
        return
    parser = argparse.ArgumentParser(description="Handraw Video Producer CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser('art-motion',help='综合艺术动画：语法、手绘素材适配、拆解、渲染、配乐与QA（详见 art-motion --help）')

    p_new = sub.add_parser("new", help="新建一期工程")
    p_new.add_argument("title", help="本期标题")
    p_new.add_argument("--mode", default="comic", choices=["comic", "parallax", "cinematic", "knowledge", "abroll", "whiteboard", "sketch", "story", "watercolor", "picturebook", "scroll"], help="叙事模式")
    p_new.add_argument("--aspect", help="画幅比例，例如16:9横屏或9:16竖屏")
    p_new.add_argument("--width",type=int,help="自定义偶数宽度，须与height成对")
    p_new.add_argument("--height",type=int,help="自定义偶数高度，须与width成对")
    p_new.add_argument("--fps",type=int,default=30,help="帧率")
    p_new.add_argument("--subtitle-mode",choices=SUBTITLE_MODES,default="burn-in",help="白板解说字幕：burn-in画内、sidecar仅SRT、none不交付；省略保留旧行为")

    p_tts = sub.add_parser("tts", help="配音与时间戳生成")
    p_tts.add_argument("keyword", help="期目录子串或标题")

    p_render = sub.add_parser("render", help="画面渲染")
    p_render.add_argument("keyword", help="期目录子串或标题")

    p_mix = sub.add_parser("mix", help="混流合成")
    p_mix.add_argument("keyword", help="期目录子串或标题")

    p_covers = sub.add_parser("covers", help="双封面生成 (4:3 与 3:4)")
    p_covers.add_argument("keyword", help="期目录子串或标题")

    p_build = sub.add_parser("build", help="一键全流程出片")
    p_build.add_argument("keyword", help="期目录子串或标题")

    args = parser.parse_args()

    if args.cmd == "new":
        cmd_new(args.title,args.mode,args.aspect,args.width,args.height,args.fps,args.subtitle_mode)
    else:
        ep_dir = resolve_episode(args.keyword)
        if args.cmd == "tts":
            cmd_tts(ep_dir)
        elif args.cmd == "render":
            cmd_render(ep_dir)
        elif args.cmd == "mix":
            cmd_mix(ep_dir)
        elif args.cmd == "covers":
            cmd_covers(ep_dir)
        elif args.cmd == "build":
            cmd_build(ep_dir)

if __name__ == "__main__":
    main()
