#!/usr/bin/env python3
"""Create a deterministic bilingual prompt draft from a validated style number."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from resolve_reference import resolve

SKILL = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = "gpt-image-2"
GRAPHIC_TEXT_SUFFIX = "【如果主题直白包含画面元素那就按主题出图，文案由你来升华，但是不要直接描述画面。 如果主题比较概念化，那么文案和主题尽量保持一致，如果文案较长由你提炼，由你先设计画面隐喻（人类和非人类都行）再出图   。    文字参与构图，图文一体】"
PURE_IMAGE_NOTE = "当前处于纯图模式，可切换为图文模式。"
ISOLATION_ZH = (
    "所附图片仅用于参考画风。只提取参考图的风格特征，例如线条、笔触、媒介、材质、色彩倾向和整体视觉语言；"
    "不要使用、复制或延续参考图中的任何主体、人物、动物、服装、道具、动作、姿态、场景、背景、构图、布局、文字或故事。"
    "最终画面内容完全以用户提供的主题为准。"
)
ISOLATION_EN = (
    "Use the attached image only as a style reference. Extract only its stylistic qualities, such as linework, "
    "brushwork, medium, material texture, color tendencies, and overall visual language. Do not use, copy, or carry "
    "over any subject, person, animal, clothing, prop, action, pose, setting, background, composition, layout, text, "
    "or story from the reference image. The user's written theme is the sole source for the image content."
)


def main() -> None:
    styles = json.loads((SKILL / "references" / "styles.json").read_text(encoding="utf-8"))
    max_num = len(styles)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--style", required=True, help=f"Style number from 001 to {max_num:03}")
    parser.add_argument("--theme", required=True)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--mode", choices=("pure-image", "graphic-text"), default="pure-image")
    parser.add_argument("--ratio")
    parser.add_argument("--subject")
    parser.add_argument("--text")
    args = parser.parse_args()
    try:
        val = int(args.style)
        if not 1 <= val <= max_num:
            raise ValueError()
        number = f"{val:03}"
    except (ValueError, TypeError) as exc:
        raise SystemExit(f"Style must be a number from 001 to {max_num:03}.") from exc
    selected = next((item for item in styles if item["number"] == number), None)
    if selected is None:
        raise SystemExit(f"Style must be a number from 001 to {max_num:03}.")

    decision = resolve(args.model, number)
    traits = decision["prompt_traits"]
    reference_path = decision["reference_path"]
    graphic_text = args.mode == "graphic-text"

    extra_zh = "；".join(filter(None, [f"画幅：{args.ratio}" if args.ratio else "", f"主体限制：{args.subject}" if args.subject else "", f"文字要求：{args.text}" if args.text else ""]))
    extra_en = "; ".join(filter(None, [f"aspect ratio: {args.ratio}" if args.ratio else "", f"subject constraints: {args.subject}" if args.subject else "", f"text requirement: {args.text}" if args.text else ""]))

    zh_prompt = f"风格名称：#{number} · {selected['generation_name']}。主题：{args.theme}。参考作者/风格名称：{selected['reference']}。"
    en_prompt = f"Style name: #{number} · {selected['generation_name']}. Theme: {args.theme}. Reference author/style name: {selected['reference']}."
    if extra_zh:
        zh_prompt += f"；{extra_zh}"
    if extra_en:
        en_prompt += f" {extra_en}."
    if traits:
        zh_prompt += f"核心风格特征：{traits}。"
        en_prompt += f" Core style traits: {traits}."

    if reference_path and not graphic_text:
        zh_prompt += f"参考图：请上传本地参考图 {reference_path}。{ISOLATION_ZH}"
        en_prompt += f" Reference image: upload local reference image {reference_path}. {ISOLATION_EN}"

    if graphic_text:
        zh_prompt += GRAPHIC_TEXT_SUFFIX
        en_prompt += GRAPHIC_TEXT_SUFFIX

    print(f"Selected style: #{number} · {selected['generation_name']}")
    if graphic_text and reference_path:
        print(f"（图文模式：编号 #{number} 需要参考图，请在生图时随提示词一并附上对应编号的四宫格参考图，并把图片本身展示给用户，不要写进提示词。）")
    print("\n中文提示词：")
    print(zh_prompt)
    print("\nEnglish prompt:")
    print(en_prompt)
    print("\nPaste either prompt into an image AI; this skill does not generate an image.")
    if not graphic_text:
        print(PURE_IMAGE_NOTE)


if __name__ == "__main__":
    main()
