#!/usr/bin/env python3
"""Create a deterministic bilingual prompt draft from a validated style number."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from layout_library import detect_language, resolve_layout
from resolve_reference import resolve
from style_asset_paths import ROOT as ASSET_ROOT

SKILL = Path(__file__).resolve().parents[1]

# ---------------------------------------------------------------------------
# Prompt assembly data. scripts/build_client_resources.py exports these values
# as prompt_rules.json so the desktop client assembles identical prompts.
# ---------------------------------------------------------------------------
REFERENCE_ISOLATION_ZH = (
    "所附图片仅用于参考画风。只提取参考图的风格特征，例如线条、笔触、媒介、材质、色彩倾向和整体视觉语言；"
    "不要使用、复制或延续参考图中的任何主体、人物、动物、服装、道具、动作、姿态、场景、背景、构图、布局、文字或故事。"
    "最终画面内容完全以用户提供的主题为准。"
)
REFERENCE_ISOLATION_EN = (
    "Use the attached image only as a style reference. Extract only its stylistic qualities, such as linework, brushwork, medium, "
    "material texture, color tendencies, and overall visual language. Do not use, copy, or carry over any subject, person, animal, "
    "clothing, prop, action, pose, setting, background, composition, layout, text, or story from the reference image. "
    "The user's written theme is the sole source for the image content."
)
GRAPHIC_TEXT_SUFFIX = "【如果主题直白包含画面元素那就按主题出图，文案由你来升华，但是不要直接描述画面。 如果主题比较概念化，那么文案和主题尽量保持一致，如果文案较长由你提炼，由你先设计画面隐喻（人类和非人类都行）再出图   。    文字参与构图，图文一体】"
REDRAW_INSTRUCTION_ZH = "【请只提取人物的五官特征和姿态，场景轮廓，在画风上严格按 选择的风格重新画，不要在原照片上加质感。】"
REDRAW_INSTRUCTION_EN = "[Extract only the character's facial features and posture, and the scene contours. Strictly redraw from scratch according to the selected style; do not add texture or filters onto the original photo.]"

THEME_PLACEHOLDER_ZH = "【请在此输入画面主题，或在生图模型中垫入你的照片】"
THEME_PLACEHOLDER_EN = "[Enter theme here, or attach your photo in the image AI]"

COLOR_SPLIT_PATTERN = r"[,+、/]+"
COLOR_TEMPLATES = {
    "free_zh": "主题色：{name}。",
    "free_en": "Theme color: {name}.",
    "pair_zh": "主题色：主色为{primary_zh}（{primary_en}），点缀色为{accent_zh}（{accent_en}）。",
    "pair_en": "Theme color: {primary_en} as primary tone, accented with {accent_en}.",
    "multi_zh": "主题色：{names}。",
    "multi_en": "Theme color: {names}.",
    "multi_item_zh": "{name_zh}（{name_en}）",
    "multi_joiner_zh": " 搭配 ",
    "multi_joiner_en": " paired with ",
    "id_joiner": " + ",
    "name_joiner_zh": " 搭配 ",
    "name_joiner_en": " + ",
}

# Fragments; empty values are skipped. See prompt_rules.json "assembly" for order.
TEMPLATES = {
    "zh": {
        "style_name": "风格名称：{name}。",
        "theme": "主题：{theme}。",
        "reference_author": "参考作者/风格名称：{reference}。",
        "traits": "核心风格特征：{traits}。",
        "reference_image_path": "参考图：请上传本地参考图 {path}。{isolation}",
        "reference_image": "参考图：{isolation}",
        "extra_ratio": "画幅：{ratio}",
        "extra_subject": "主体限制：{subject}",
        "extra_text": "文字要求：{text}",
        "extra_joiner": "；",
        "extra": "；{extra}",
        "layout_name": "图型：{name}。",
        "layout_theme": "主题：{theme}。",
        "layout_instructions": "排版要求：{prompt}",
        "layout_style": "风格名称：{name}。参考作者/风格名称：{reference}。",
        "layout_traits": "核心风格特征：{traits}。",
        "layout_extra": "；{extra}",
        "layout_part_joiner": "",
    },
    "en": {
        "style_name": "Style name: {name}.",
        "theme": " Theme: {theme}.",
        "reference_author": " Reference author/style name: {reference}.",
        "traits": " Core style traits: {traits}.",
        "reference_image_path": " Reference image: upload local reference image {path}. {isolation}",
        "reference_image": " Reference image: {isolation}",
        "extra_ratio": "aspect ratio: {ratio}",
        "extra_subject": "subject constraints: {subject}",
        "extra_text": "text requirement: {text}",
        "extra_joiner": "; ",
        "extra": " {extra}.",
        "layout_name": "Layout: {name}.",
        "layout_theme": "Theme: {theme}.",
        "layout_instructions": "Layout instructions: {prompt}",
        "layout_style": "Style name: {name}. Reference author/style name: {reference}.",
        "layout_traits": "Core style traits: {traits}.",
        "layout_extra": "{extra}.",
        "layout_part_joiner": " ",
    },
}
# A color prompt is prefixed with a space in English style/color-only prompts.
COLOR_PREFIX = {"zh": "", "en": " "}
REDRAW_PREFIX = {"zh": "", "en": " "}


def resolve_single_color(query_str: str, colors_list: list[dict]) -> dict[str, str]:
    q = query_str.strip().lower()
    is_id_pattern = q.startswith("c-")
    q_num = q.replace("c-", "").lstrip("0") if is_id_pattern else ""
    for c in colors_list:
        cid = c["id"].lower()
        c_num = cid.replace("c-", "").lstrip("0")
        if q == cid or (q_num and q_num == c_num) or q in c["name_zh"].lower() or q in c["name_en"].lower():
            return c
    if is_id_pattern:
        raise ValueError(f"Unknown color ID: {query_str}. Use a listed C-01 to C-36 identifier or color name.")
    name = query_str.strip()
    return {
        "id": "",
        "name_zh": name,
        "name_en": name,
        "prompt_zh": COLOR_TEMPLATES["free_zh"].format(name=name),
        "prompt_en": COLOR_TEMPLATES["free_en"].format(name=name)
    }


def resolve_color(query_str: str) -> dict[str, str]:
    colors_file = SKILL / "references" / "colors.json"
    colors_list = json.loads(colors_file.read_text(encoding="utf-8")) if colors_file.exists() else []
    import re
    tokens = [t.strip() for t in re.split(COLOR_SPLIT_PATTERN, query_str) if t.strip()]
    if len(tokens) <= 1:
        return resolve_single_color(query_str, colors_list)

    resolved = [resolve_single_color(t, colors_list) for t in tokens]
    c_ids = [r["id"] for r in resolved if r.get("id")]
    id_str = COLOR_TEMPLATES["id_joiner"].join(c_ids) if c_ids else ""
    zh_names = [COLOR_TEMPLATES["multi_item_zh"].format(name_zh=r['name_zh'], name_en=r['name_en']) if r.get('name_en') else r['name_zh'] for r in resolved]
    en_names = [r['name_en'] for r in resolved]

    if len(resolved) == 2:
        prompt_zh = COLOR_TEMPLATES["pair_zh"].format(primary_zh=resolved[0]['name_zh'], primary_en=resolved[0]['name_en'],
                                                      accent_zh=resolved[1]['name_zh'], accent_en=resolved[1]['name_en'])
        prompt_en = COLOR_TEMPLATES["pair_en"].format(primary_en=resolved[0]['name_en'], accent_en=resolved[1]['name_en'])
    else:
        prompt_zh = COLOR_TEMPLATES["multi_zh"].format(names=COLOR_TEMPLATES["multi_joiner_zh"].join(zh_names))
        prompt_en = COLOR_TEMPLATES["multi_en"].format(names=COLOR_TEMPLATES["multi_joiner_en"].join(en_names))

    return {
        "id": id_str,
        "name_zh": COLOR_TEMPLATES["name_joiner_zh"].join(r["name_zh"] for r in resolved),
        "name_en": COLOR_TEMPLATES["name_joiner_en"].join(en_names),
        "prompt_zh": prompt_zh,
        "prompt_en": prompt_en,
    }


def resolve_style_entry(style_input: str, styles: list[dict]) -> tuple[dict, str]:
    import re
    alias_file = SKILL / "references" / "style_alias_map.json"
    alias_map = json.loads(alias_file.read_text(encoding="utf-8")) if alias_file.exists() else {}
    legacy_to_new = alias_map.get("legacy_to_new", {})

    style_clean = str(style_input).strip()
    if style_clean.isdigit():
        num_str = f"{int(style_clean):03}"
        canonical = legacy_to_new.get(num_str, num_str)
    else:
        m = re.match(r"^([A-Za-z]{2})[-_]?(\d+)$", style_clean)
        if m:
            canonical = f"{m.group(1).upper()}-{int(m.group(2)):03}"
        else:
            canonical = style_clean.upper()

    s_obj = next((s for s in styles if s["number"] == canonical), None)
    if not s_obj and canonical in legacy_to_new:
        canonical = legacy_to_new[canonical]
        s_obj = next((s for s in styles if s["number"] == canonical), None)

    if not s_obj:
        raise ValueError(f"Style '{style_input}' not found. Use a valid ID like FA-001 or legacy number 001-365.")
    return s_obj, canonical


def recommend_combination(theme: str, user_style: str | None, user_color: str | None) -> tuple[str, str, str]:
    """
    Dynamic whole-library recommendation engine across all 370 styles and 36 theme colors.
    Note: In AI agent workflows (Codex, Antigravity, Claude Code), the LLM dynamically reasons
    and evaluates styles and colors at runtime. This function provides a robust, non-hardcoded
    heuristic scoring fallback for offline and CLI usage.
    """
    import re
    t = theme.lower().strip()
    styles_file = SKILL / "references" / "styles.json"
    styles = json.loads(styles_file.read_text(encoding="utf-8")) if styles_file.exists() else []
    colors_file = SKILL / "references" / "colors.json"
    colors = json.loads(colors_file.read_text(encoding="utf-8")) if colors_file.exists() else []

    ngrams = [t[i:i+n] for n in (2, 3, 4) for i in range(len(t)-n+1)]
    words = re.findall(r'[a-zA-Z0-9]+|[\u4e00-\u9fa5]', t)

    # 1. Dynamically resolve style from full 370 styles library
    if user_style:
        try:
            s_obj, final_style = resolve_style_entry(user_style, styles)
        except ValueError:
            s_obj = styles[0]
            final_style = s_obj["number"]
    else:
        scored_styles = []
        for s in styles:
            score = 0
            text_name = (s["generation_name"] + " " + s["reference"]).lower()
            text_traits = s["traits"].lower()
            text_group = s.get("group", "").lower()
            if t in text_name or t in text_traits:
                score += 25
            for ng in ngrams:
                if ng in text_name:
                    score += 8
                if ng in text_traits:
                    score += 4
                if ng in text_group:
                    score += 2
            for w in words:
                if len(w) > 1:
                    if w in text_name:
                        score += 6
                    if w in text_traits:
                        score += 3
            scored_styles.append((score, s))
        scored_styles.sort(key=lambda x: x[0], reverse=True)
        if scored_styles and scored_styles[0][0] > 0:
            s_obj = scored_styles[0][1]
        else:
            idx = sum(ord(c) * (i + 1) for i, c in enumerate(t)) % len(styles) if styles else 0
            s_obj = styles[idx] if styles else {"number": "001", "generation_name": "Style", "reference": "Artist", "traits": ""}
        final_style = s_obj["number"]

    # 2. Dynamically resolve color from full 36 colors library
    if user_color:
        final_color = user_color
        color_desc = user_color
    else:
        style_text = (s_obj["traits"] + " " + s_obj["generation_name"] + " " + s_obj.get("group", "")).lower()
        scored_colors = []
        for c in colors:
            c_score = 0
            c_haystack = (c["name_zh"] + " " + c["name_en"] + " " + c.get("category_zh", "") + " " + c.get("quote_zh", "")).lower()
            for ng in ngrams:
                if ng in c_haystack:
                    c_score += 10
            for w in words:
                if len(w) > 1 and w in c_haystack:
                    c_score += 6
            for trait_word in ["蓝", "绿", "红", "橙", "黄", "紫", "粉", "黑", "白", "灰", "金", "墨", "暖", "冷", "自然", "科技", "幽默"]:
                if trait_word in style_text and trait_word in c_haystack:
                    c_score += 5
            scored_colors.append((c_score, c))
        scored_colors.sort(key=lambda x: x[0], reverse=True)
        primary = scored_colors[0][1] if (scored_colors and scored_colors[0][0] > 0) else (colors[sum(ord(c) for c in t) % len(colors)] if colors else {"id": "C-01", "name_zh": "克莱因蓝"})

        accent = None
        for sc, c in scored_colors[1:]:
            if c.get("category") != primary.get("category"):
                accent = c
                break
        if not accent and colors:
            accent = colors[(colors.index(primary) + 7) % len(colors)]

        if accent and accent["id"] != primary["id"]:
            final_color = f"{primary['id']} + {accent['id']}"
            color_desc = f"{primary['name_zh']} ({primary['id']}) + {accent['name_zh']} ({accent['id']})"
        else:
            final_color = primary["id"]
            color_desc = f"{primary['name_zh']} ({primary['id']})"

    s_name = s_obj.get("generation_name", "")
    s_ref = s_obj.get("reference", "")
    first_trait = s_obj.get("traits", "").split("；")[0].split("。")[0]

    if user_style and user_color:
        rationale = f"已采用您指定的手绘风格 #{user_style} 与主题色 {user_color}。"
    elif user_style:
        rationale = f"已采用您指定的手绘风格 #{user_style}（{s_ref} · {s_name}），基于主题意境为您全库动态匹配推荐主题色 {color_desc}。"
    elif user_color:
        rationale = f"已采用您指定的主题色 {user_color}，基于主题意境为您全库动态匹配推荐手绘风格 #{final_style}（{s_ref} · {s_name}）。"
    else:
        rationale = f"基于「{theme}」的主题意境，全库动态匹配手绘风格 #{final_style}（{s_ref} · {s_name}），搭配主题色 {color_desc}。以{first_trait}契合画面的视觉与情绪诉求。"

    return final_style, final_color, rationale


def _reference_path(path: str | None, path_base: str | None) -> str | None:
    """Return the reference path as an absolute OS path, or pack-relative when path_base is given."""
    if not path or path_base is None:
        return path
    try:
        relative = Path(path).resolve().relative_to(ASSET_ROOT.resolve()).as_posix()
    except ValueError:
        relative = Path(path).as_posix()
    return f"{path_base}{relative}"


def _fill(template: str, **values: str) -> str:
    return template.format(**values)


def build_prompt(style: str | None = None, layout: str | None = None, color: str | None = None,
                 theme: str = "", ratio: str | None = None, subject: str | None = None, text: str | None = None,
                 model: str = "gpt-image-2", mode: str = "pure-image", redraw: bool = False,
                 language: str = "auto", auto: bool = False, path_base: str | None = None) -> dict:
    """Assemble bilingual prompts without printing.

    Returns a dict with "zh" and "en" prompts plus selection metadata. For layout prompts the CLI prints
    only result[result["language"]]; both languages are still assembled so other clients can compare.
    ``path_base`` makes reference-image paths machine independent: ``""`` yields
    ``images/individual/FH/FH-039_grid.webp``; ``None`` keeps the local absolute path.
    Raises ValueError for unknown identifiers or missing selections.
    """
    if mode not in ("pure-image", "graphic-text"):
        raise ValueError(f"Unknown mode: {mode}")
    if language not in ("auto", "zh", "en"):
        raise ValueError(f"Unknown language: {language}")
    styles = json.loads((SKILL / "references" / "styles.json").read_text(encoding="utf-8"))
    if not theme:
        theme = THEME_PLACEHOLDER_ZH if language != "en" else THEME_PLACEHOLDER_EN

    recommendation = None
    if auto:
        rec_s, rec_c, recommendation = recommend_combination(theme, style, color)
        style = style or rec_s
        color = color or rec_c
    elif not style and not layout and not color:
        raise ValueError("Provide --style, --layout, or both (or --color, or use --auto).")

    color_info = resolve_color(color) if color else None
    selected = None
    number = None
    if style:
        selected, number = resolve_style_entry(style, styles)

    result: dict = {
        "zh": "", "en": "", "language": None, "kind": None,
        "style": number, "style_name": selected["generation_name"] if selected else None,
        "color": color_info, "layout": None, "is_ecommerce": False,
        "use_reference_image": False, "reference_path": None,
        "recommendation": recommendation, "mode": mode,
    }

    def extras(lang: str) -> str:
        t = TEMPLATES[lang]
        return t["extra_joiner"].join(filter(None, [
            _fill(t["extra_ratio"], ratio=ratio) if ratio else "",
            _fill(t["extra_subject"], subject=subject) if subject else "",
            _fill(t["extra_text"], text=text) if text else "",
        ]))

    if layout:
        layout_obj = resolve_layout(layout)
        is_ecommerce = layout_obj.get("category") == "ecommerce" or layout_obj["id"].startswith("EC-")
        include_style = bool(selected and number and (not is_ecommerce or style))
        decision = resolve(model, number) if include_style else None
        for lang in ("zh", "en"):
            t = TEMPLATES[lang]
            layout_name = layout_obj["name"] if lang == "zh" else (layout_obj.get("name_en") or layout_obj["name"])
            parts = [
                _fill(t["layout_name"], name=layout_name),
                _fill(t["layout_theme"], theme=theme),
                _fill(t["layout_instructions"], prompt=layout_obj["prompts"][lang]),
            ]
            if color_info:
                parts.insert(1, color_info["prompt_zh"] if lang == "zh" else color_info["prompt_en"])
            if include_style and decision is not None:
                parts.append(_fill(t["layout_style"], name=selected["generation_name"], reference=selected["reference"]))
                if decision["prompt_traits"]:
                    parts.append(_fill(t["layout_traits"], traits=decision["prompt_traits"]))
            if redraw:
                parts.append(REDRAW_INSTRUCTION_ZH if lang == "zh" else REDRAW_INSTRUCTION_EN)
            extra = extras(lang)
            if extra:
                parts.append(_fill(t["layout_extra"], extra=extra))
            if not is_ecommerce:
                parts.append(GRAPHIC_TEXT_SUFFIX)
            result[lang] = t["layout_part_joiner"].join(parts)
        result.update(
            kind="layout",
            language=detect_language(theme) if language == "auto" else language,
            layout={"id": layout_obj["id"], "name": layout_obj["name"], "name_en": layout_obj.get("name_en")},
            is_ecommerce=is_ecommerce,
            style=number if include_style else None,
            style_name=selected["generation_name"] if include_style else None,
        )
        return result

    graphic_text_suffix = GRAPHIC_TEXT_SUFFIX if mode == "graphic-text" else ""
    extra_zh, extra_en = extras("zh"), extras("en")
    zh_extra = _fill(TEMPLATES["zh"]["extra"], extra=extra_zh) if extra_zh else ""
    en_extra = _fill(TEMPLATES["en"]["extra"], extra=extra_en) if extra_en else ""
    redraw_zh = REDRAW_PREFIX["zh"] + REDRAW_INSTRUCTION_ZH if redraw else ""
    redraw_en = REDRAW_PREFIX["en"] + REDRAW_INSTRUCTION_EN if redraw else ""

    if not selected and color_info:
        result.update(
            kind="color",
            zh=f"{color_info['prompt_zh']}{_fill(TEMPLATES['zh']['theme'], theme=theme)}{zh_extra}{redraw_zh}{graphic_text_suffix}",
            en=f"{color_info['prompt_en']}{_fill(TEMPLATES['en']['theme'], theme=theme)}{en_extra}{redraw_en}{graphic_text_suffix}",
        )
        return result

    assert selected is not None and number is not None
    decision = resolve(model, number)
    traits = decision["prompt_traits"]
    reference_path = None
    pieces: dict[str, str] = {}
    for lang in ("zh", "en"):
        t = TEMPLATES[lang]
        isolation = REFERENCE_ISOLATION_ZH if lang == "zh" else REFERENCE_ISOLATION_EN
        reference_image = ""
        if decision["use_reference_image"] and mode == "pure-image":
            reference_path = _reference_path(decision.get("reference_path"), path_base)
            if reference_path:
                reference_image = _fill(t["reference_image_path"], path=reference_path, isolation=isolation)
            else:
                reference_image = _fill(t["reference_image"], isolation=isolation)
        color_text = COLOR_PREFIX[lang] + color_info[f"prompt_{lang}"] if color_info else ""
        pieces[lang] = "".join([
            _fill(t["style_name"], name=selected["generation_name"]),
            color_text,
            _fill(t["theme"], theme=theme),
            _fill(t["reference_author"], reference=selected["reference"]),
            _fill(t["traits"], traits=traits) if traits else "",
            reference_image,
            zh_extra if lang == "zh" else en_extra,
            redraw_zh if lang == "zh" else redraw_en,
            graphic_text_suffix,
        ])
    result.update(kind="style", zh=pieces["zh"], en=pieces["en"],
                  use_reference_image=bool(decision["use_reference_image"] and mode == "pure-image"),
                  reference_path=reference_path, activation_source=decision["activation_source"])
    return result


def _color_line(color_info: dict) -> str:
    c_label = f"{color_info['id']} · " if color_info.get("id") else ""
    return f"Selected color: {c_label}{color_info['name_zh']} ({color_info['name_en']})"


def main() -> None:
    styles = json.loads((SKILL / "references" / "styles.json").read_text(encoding="utf-8"))
    max_num = len(styles)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--style", help=f"Optional style number from 001 to {max_num:03}")
    parser.add_argument("--layout", help="Optional layout ID")
    parser.add_argument("--color", help="Optional color ID  or color name.")
    parser.add_argument("--auto", "--recommend", action="store_true", help="Automatically recommend an optimal style and theme color combination based on theme semantics.")
    parser.add_argument("--theme", default="", help="Optional theme description; defaults to placeholder if omitted.")
    parser.add_argument("--ratio")
    parser.add_argument("--subject")
    parser.add_argument("--text")
    parser.add_argument("--model", default="gpt-image-2", help="Model capability profile; defaults to gpt-image-2.")
    parser.add_argument("--mode", choices=("pure-image", "graphic-text"), default="pure-image")
    parser.add_argument("--redraw", action="store_true", help="Append photo-to-art redraw instruction to prevent photo filters.")
    parser.add_argument("--language", choices=("auto", "zh", "en"), default="auto")
    args = parser.parse_args()

    try:
        result = build_prompt(style=args.style, layout=args.layout, color=args.color, theme=args.theme,
                              ratio=args.ratio, subject=args.subject, text=args.text, model=args.model,
                              mode=args.mode, redraw=args.redraw, language=args.language, auto=args.auto)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    color_info = result["color"]
    if result["kind"] == "layout":
        language = result["language"]
        if result["recommendation"]:
            print(f"💡 推荐理由：{result['recommendation']}")
        print(f"Selected layout: {result['layout']['id']} · {result['layout']['name']}")
        if color_info:
            print(_color_line(color_info))
        if result["style"]:
            print(f"Selected style: #{result['style']} · {result['style_name']}")
        print("\nPrompt:")
        print(result[language])
        if not result["is_ecommerce"]:
            print("\n已自动使用图文模式。" if language == "zh" else "\nThe selected layout automatically uses graphic-text mode.")
        return

    if result["kind"] == "color":
        print(_color_line(color_info))
    else:
        if result["recommendation"]:
            print(f"💡 推荐理由：{result['recommendation']}")
        print(f"Selected style: #{result['style']} · {result['style_name']}")
        if color_info:
            print(_color_line(color_info))
    print("\n中文提示词：")
    print(result["zh"])
    print("\nEnglish prompt:")
    print(result["en"])
    print("\nPaste either prompt into an image AI; this skill does not generate an image.")
    if args.mode == "pure-image":
        print("当前处于纯图模式，可切换为图文模式。")


if __name__ == "__main__":
    main()
