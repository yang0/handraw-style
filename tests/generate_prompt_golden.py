#!/usr/bin/env python3
"""Regenerate tests/fixtures/prompt_golden.json from the real prompt_style.build_prompt (#21).

Run after an intentional prompt-rule change, review the diff, and commit it together with the change:

    python tests/generate_prompt_golden.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "handdraw-style-prompter" / "scripts"))
import prompt_style  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "prompt_golden.json"
# Pack-relative reference paths keep the fixture identical on every machine.
PATH_BASE = ""

DEFAULTS = {"style": None, "layout": None, "color": None, "theme": "", "ratio": None, "subject": None,
            "text": None, "model": "gpt-image-2", "mode": "pure-image", "redraw": False, "language": "auto"}

CASES: list[tuple[str, dict]] = [
    # style only: strong name activation / strong traits / reference-image fallback
    ("style only, strong name activation", {"style": "FA-001", "theme": "春天的咖啡馆"}),
    ("style only, legacy number", {"style": "001", "theme": "春天的咖啡馆"}),
    ("style only, lower-case id without dash", {"style": "fa2", "theme": "城市里的长颈鹿"}),
    ("style only, traits activation", {"style": "FC-031", "theme": "深夜便利店"}),
    ("style only, traits with negative clauses filtered", {"style": "FA-014", "theme": "办公室里的仙人掌"}),
    ("style only, traits with negative clauses filtered (FD-014)", {"style": "FD-014", "theme": "排队买咖啡"}),
    ("style only, reference image fallback", {"style": "FH-039", "theme": "雨中散步"}),
    ("style only, empty traits + reference image", {"style": "FC-001", "theme": "灯塔"}),
    ("style only, keep_raw traits", {"style": "FE-048", "theme": "山村集市"}),
    ("style only, keep_raw traits FD-042", {"style": "FD-042", "theme": "山村集市"}),
    ("style only, English theme", {"style": "FA-003", "theme": "a quiet bookstore at dusk"}),
    ("style only, English theme + reference image", {"style": "FH-039", "theme": "a rainy walk", "language": "en"}),
    ("style only, placeholder theme zh", {"style": "FA-001"}),
    ("style only, placeholder theme en", {"style": "FA-001", "language": "en"}),
    ("style only, unknown model falls back to reference image", {"style": "FA-001", "model": "unknown-model", "theme": "海边"}),
    ("style only, unknown model, empty-trait style", {"style": "FG-008", "model": "midjourney", "theme": "海边"}),
    ("style + ratio/subject/text", {"style": "FA-013", "theme": "周一早晨", "ratio": "3:4", "subject": "一只橘猫", "text": "又是周一"}),
    ("style + ratio only, English", {"style": "FA-013", "theme": "Monday morning", "ratio": "16:9"}),
    # graphic-text mode
    ("graphic-text mode, strong style", {"style": "FA-001", "theme": "拖延症", "mode": "graphic-text"}),
    ("graphic-text mode suppresses reference image", {"style": "FH-039", "theme": "拖延症", "mode": "graphic-text"}),
    ("graphic-text mode + color + text", {"style": "FC-031", "color": "C-05", "theme": "读书的意义", "mode": "graphic-text", "text": "读书使人自由"}),
    # colors
    ("style + color id", {"style": "FA-001", "color": "C-01", "theme": "猫"}),
    ("style + color number shorthand", {"style": "FA-001", "color": "c-1", "theme": "猫"}),
    ("style + color by Chinese name", {"style": "FB-020", "color": "克莱因蓝", "theme": "深海"}),
    ("style + free-text color", {"style": "FA-001", "color": "奶油黄", "theme": "早餐"}),
    ("style + two colors", {"style": "FC-031", "color": "C-01,C-05", "theme": "猫"}),
    ("style + three colors", {"style": "FC-031", "color": "C-01+C-05+C-09", "theme": "猫"}),
    ("style + two colors with free text", {"style": "FA-013", "color": "C-02/薄荷绿", "theme": "夏天"}),
    ("style + color + reference image", {"style": "FH-039", "color": "C-12", "theme": "森林"}),
    # color only
    ("color only", {"color": "C-03", "theme": "海边"}),
    ("color only, free text + graphic-text + redraw", {"color": "奶油黄", "theme": "海边", "mode": "graphic-text", "redraw": True}),
    ("color only, multi-color + ratio, English", {"color": "C-01/C-02", "theme": "sea", "ratio": "1:1"}),
    # redraw
    ("redraw, strong style", {"style": "FA-001", "theme": "我和朋友的合影", "redraw": True}),
    ("redraw, reference-image style", {"style": "FH-039", "theme": "家庭合影", "redraw": True, "ratio": "4:3"}),
    ("redraw, English", {"style": "FA-001", "theme": "my family photo", "redraw": True}),
    # layouts
    ("layout + style", {"layout": "IG-038", "style": "FA-013", "theme": "咖啡知识"}),
    ("layout + style + redraw + ratio, English", {"layout": "IG-038", "style": "FA-013", "theme": "coffee facts", "redraw": True, "ratio": "16:9"}),
    ("layout + traits style + color", {"layout": "SB-002", "style": "FC-031", "color": "C-07", "theme": "猫咪的一天"}),
    ("layout + reference-image style (traits only)", {"layout": "SC-001", "style": "FH-039", "theme": "旅行日记"}),
    ("layout without style", {"layout": "SB-001", "theme": "早高峰地铁"}),
    ("layout alias SC-023 -> IP-001", {"layout": "SC-023", "theme": "角色"}),
    ("layout, explicit language en with Chinese theme", {"layout": "IG-001", "theme": "睡眠科普", "language": "en"}),
    ("layout + subject/text", {"layout": "IP-002", "style": "FA-001", "theme": "黑猫侍者", "subject": "黑猫", "text": "欢迎光临"}),
    ("layout + two colors", {"layout": "IG-038", "color": "C-01,C-05", "theme": "时间管理"}),
    # ecommerce
    ("ecommerce layout without style", {"layout": "EC-001", "theme": "保温杯"}),
    ("ecommerce layout + explicit style + color", {"layout": "EC-001", "style": "FH-039", "color": "C-02", "theme": "thermos"}),
    ("ecommerce layout + ratio", {"layout": "EC-007", "theme": "折叠椅", "ratio": "1:1"}),
    ("ecommerce layout + strong style + redraw", {"layout": "EC-009", "style": "FA-001", "theme": "手冲咖啡壶", "redraw": True}),
]


def build_cases() -> list[dict]:
    cases = []
    for name, overrides in CASES:
        unknown = set(overrides) - set(DEFAULTS)
        if unknown:
            raise ValueError(f"{name}: unknown input keys {unknown}")
        inputs = {**DEFAULTS, **overrides}
        result = prompt_style.build_prompt(**inputs, path_base=PATH_BASE)
        expected = {"zh": result["zh"], "en": result["en"], "kind": result["kind"]}
        if result["kind"] == "layout":
            expected["language"] = result["language"]
        expected["style"] = result["style"]
        expected["use_reference_image"] = result["use_reference_image"]
        expected["reference_path"] = result["reference_path"]
        cases.append({"name": name, "input": inputs, "expected": expected})
    return cases


def document() -> dict:
    return {
        "schema_version": 1,
        "description": (
            "Input -> expected prompt cases generated by skills/handdraw-style-prompter/scripts/prompt_style.py "
            "build_prompt(). Skill, website and desktop client must all produce identical zh/en strings. "
            "Reference image paths are relative to the client resource pack root. For kind=layout the CLI "
            "prints only expected[language]; both languages are still asserted."
        ),
        "path_base": PATH_BASE,
        "cases": build_cases(),
    }


def render() -> str:
    return json.dumps(document(), ensure_ascii=False, indent=2) + "\n"


def main() -> None:
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(render(), encoding="utf-8", newline="\n")
    print(f"{FIXTURE} ({len(CASES)} cases)")


if __name__ == "__main__":
    main()
