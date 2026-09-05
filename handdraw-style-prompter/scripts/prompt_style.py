#!/usr/bin/env python3
"""Create a deterministic bilingual prompt draft from a validated style number."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--style", required=True, help="Style number from 001 to 216")
    parser.add_argument("--theme", required=True)
    parser.add_argument("--ratio")
    parser.add_argument("--subject")
    parser.add_argument("--text")
    args = parser.parse_args()
    try:
        number = f"{int(args.style):03}"
    except ValueError as exc:
        raise SystemExit("Style must be a number from 001 to 216.") from exc
    styles = json.loads((SKILL / "references" / "styles.json").read_text(encoding="utf-8"))
    selected = next((item for item in styles if item["number"] == number), None)
    if selected is None:
        raise SystemExit("Style must be a number from 001 to 216.")
    extra_zh = "；".join(filter(None, [f"画幅：{args.ratio}" if args.ratio else "", f"主体限制：{args.subject}" if args.subject else "", f"文字要求：{args.text}" if args.text else ""]))
    extra_en = "; ".join(filter(None, [f"aspect ratio: {args.ratio}" if args.ratio else "", f"subject constraints: {args.subject}" if args.subject else "", f"text requirement: {args.text}" if args.text else ""]))
    print(f"Selected style: #{number} · {selected['generation_name']}")
    print("\n中文提示词：")
    reference_zh = f"参考作者/风格名称：{selected['reference']}。"
    reference_en = f" Reference author/style name: {selected['reference']}."
    print(f"风格名称：#{number} · {selected['generation_name']}。主题：{args.theme}。{reference_zh}" + (f"；{extra_zh}" if extra_zh else ""))
    print("\nEnglish prompt:")
    print(f"Style name: #{number} · {selected['generation_name']}. Theme: {args.theme}.{reference_en}" + (f" {extra_en}." if extra_en else ""))
    print("\nPaste either prompt into an image AI; this skill does not generate an image.")


if __name__ == "__main__":
    main()
