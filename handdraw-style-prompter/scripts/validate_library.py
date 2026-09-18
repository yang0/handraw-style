#!/usr/bin/env python3
"""Validate source parsing, generated assets, and the deterministic prompt contract."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
from resolve_reference import resolve
from contact_sheet_registry import CAPACITY, STATE_FILE, parse_sheet, sheet_path
from style_asset_paths import bucket_name, grid_path, single_path

SKILL = Path(__file__).resolve().parents[1]
GRAPHIC_TEXT_SUFFIX = "【如果主题直白包含画面元素那就按主题出图，文案由你来升华，但是不要直接描述画面。 如果主题比较概念化，那么文案和主题尽量保持一致，如果文案较长由你提炼，由你先设计画面隐喻（人类和非人类都行）再出图   。    文字参与构图，图文一体】"


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def main() -> None:
    python = [sys.executable, "-X", "utf8"]
    subprocess.run(python + [str(SKILL / "scripts" / "build_library.py")], check=True)
    styles = json.loads((SKILL / "references" / "styles.json").read_text(encoding="utf-8"))
    attribution = json.loads((SKILL / "references" / "attribution.json").read_text(encoding="utf-8"))
    model_capabilities = json.loads((SKILL / "references" / "model_capabilities.json").read_text(encoding="utf-8"))
    total_styles = len(styles)
    max_num = f"{total_styles:03}"
    expected = [f"{n:03}" for n in range(1, total_styles + 1)]
    if [item["number"] for item in styles] != expected:
        fail(f"style numbering is not continuous 001–{max_num}")
    eighteen = styles[17]
    if eighteen["generation_name"] != "Minimal Deadpan Dialogue Cartoon":
        fail("018 maps to the wrong generation name")
    if any(record.get("status") == "deceased" and not record.get("source") for record in attribution.values()):
        fail("a deceased attribution record has no verification source")
    if model_capabilities.get("default", {}).get("name_activation") != "unknown":
        fail("the model capability default must be unknown")
    if model_capabilities.get("default", {}).get("use_reference_image") is not True:
        fail("unknown model capability must use the image fallback")
    for model, profile in model_capabilities.get("models", {}).items():
        if profile.get("name_activation") not in {None, "strong", "weak", "none", "unknown"}:
            fail(f"invalid model capability for {model}")
        if profile.get("traits_activation") not in {None, "strong", "weak", "none", "unknown"}:
            fail(f"invalid traits capability for {model}")
        for number, entry in profile.get("styles", {}).items():
            if number not in expected:
                fail(f"model capability references invalid style {number}")
            if entry.get("name_activation") not in {"strong", "weak", "none", "unknown"}:
                fail(f"invalid style capability for {model}/{number}")
            if entry.get("traits_activation") not in {None, "strong", "weak", "none", "unknown"}:
                fail(f"invalid traits style capability for {model}/{number}")
    unknown = resolve("unregistered-model", "001")
    if unknown["name_activation"] != "unknown" or not unknown["use_reference_image"]:
        fail("unknown model must use reference image")
    if resolve("gpt-image-2", "001")["use_reference_image"] is not False:
        fail("gpt-image-2 style 001 should use name activation")
    manual_name = resolve("gpt-image-2", "262")
    if manual_name["activation_source"] != "name+style" or manual_name["use_reference_image"] or manual_name["prompt_traits"]:
        fail("text-defined name-only style must use name activation without an image or traits")
    if resolve("gpt-image-2", "155")["activation_source"] != "name+style+traits" or resolve("gpt-image-2", "155")["use_reference_image"] is not False:
        fail("gpt-image-2 style with positive traits should use name+traits activation")
    synthetic = {"default": model_capabilities["default"], "models": {
        "test-model": {"name_activation": "unknown", "traits_activation": "strong", "styles": {
            "201": {"name_activation": "none"},
            "002": {"name_activation": "strong"},
            "022": {"name_activation": "none", "traits_activation": "none"},
        }},
    }}
    if resolve("test-model", "201", synthetic)["use_reference_image"] is not True:
        fail("empty traits or insufficient capability must use reference image")
    if resolve("test-model", "002", synthetic)["use_reference_image"] is not False:
        fail("strong capability must not use reference image")
    reference_with_traits = resolve("test-model", "022", synthetic)
    if (reference_with_traits["activation_source"] != "name+style+traits+reference-image"
            or not reference_with_traits["use_reference_image"]
            or not reference_with_traits["prompt_traits"]):
        fail("reference fallback with traits must preserve traits and require the image")
    traits_case = resolve("gpt-image-2", "022")
    if traits_case["activation_source"] != "name+style+traits" or not traits_case["prompt_traits"] or "避免" in traits_case["prompt_traits"]:
        fail("gpt-image-2 traits activation did not produce filtered positive traits")
    if resolve("gpt-image-2", "201")["use_reference_image"] is not True:
        fail("empty-trait style must use reference image")
    if bucket_name(1) != "001-200" or bucket_name(217) != "201-400" or bucket_name(401) != "401-600":
        fail("style asset bucket calculation is incorrect")
    reference_217 = resolve("gpt-image-2", "217")
    if (reference_217["activation_source"] != "name+style+traits+reference-image"
            or not reference_217["prompt_traits"]
            or reference_217["reference_path"] != str(grid_path(217))):
        fail("style 217 must preserve traits and use its four-panel grid reference")
    if not grid_path(217).exists():
        fail("style 217 four-panel grid is missing")
    for number in range(262, total_styles + 1):
        reference = resolve("unregistered-model", f"{number:03}")
        if grid_path(number).exists() or reference["reference_path"] != str(single_path(number)):
            fail(f"single-image style {number:03} must not retain a redundant grid reference")
    if any(item["traits"] for item in styles[200:216] if item["number"] != "205"):
        fail("201–216 core visual traits may only be populated for style 205")
    style_205 = next(item for item in styles if item["number"] == "205")
    if not style_205["traits"] or "坚持伟大式轻幽默Q版漫画" not in style_205["traits"]:
        fail("style 205 core visual traits are missing")
    if any(item["group"] != "G 附件新增 / 中国当代插画补充" for item in styles[200:216]):
        fail("201–216 must remain in group G")
    if any(item["group"] != "H 其他" for item in styles[216:]):
        fail("217+ styles must belong to group H")
    individual = ROOT / "images" / "individual"
    expected_individual = [single_path(number) for number in range(1, total_styles + 1)]
    if not all(path.exists() for path in expected_individual):
        fail(f"numbered asset buckets must cover exactly 001.webp–{max_num}.webp")
    if list(individual.glob("[0-9][0-9][0-9].webp")) or list(individual.glob("[0-9][0-9][0-9]_grid.webp")):
        fail("flat individual assets must be migrated into numbered buckets")
    tweet_sheets = []
    for path in (ROOT / "images").glob("[GH]_*.webp"):
        parsed = parse_sheet(path)
        if parsed:
            start, end = parsed
            if path.name.startswith("G_") and (start, end) != (201, 216):
                fail("G contact sheets may only cover 201–216")
            if path.name.startswith("H_") and start < 217:
                fail("H contact sheets must start at 217 or later")
            tweet_sheets.append((*parsed, path))
    tweet_sheets.sort()
    expected_tweet_numbers = list(range(201, total_styles + 1))
    listed_tweet_numbers = [number for start, end, _ in tweet_sheets for number in range(start, end + 1)]
    if listed_tweet_numbers != expected_tweet_numbers:
        fail("Tweet contact sheets must cover each 201+ style exactly once")
    if any(end - start + 1 != CAPACITY for start, end, _ in tweet_sheets[:-1]):
        fail("only the final Tweet contact sheet may be incomplete")
    if not STATE_FILE.exists():
        fail("Tweet contact-sheet state is missing")
    sheet_state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    last_start, last_end, last_path = tweet_sheets[-1]
    last_filled = last_end - last_start + 1
    expected_next_cell = last_filled + 1 if last_filled < CAPACITY else 1
    if (sheet_state.get("capacity") != CAPACITY or sheet_state.get("active_start") != last_start
            or sheet_state.get("filled") != last_filled or sheet_state.get("next_cell") != expected_next_cell
            or last_path != sheet_path(last_start, last_end)):
        fail("Tweet contact-sheet state does not match the active sheet")
    gallery = (SKILL / "gallery" / "index.html").read_text(encoding="utf-8")
    for _, _, path in tweet_sheets:
        if path.name not in gallery:
            fail(f"gallery is missing contact sheet {path.name}")
    if 'data-number="217" data-group="H"' not in gallery or 'data-number="262" data-group="H"' not in gallery:
        fail("gallery does not classify 217+ style cards as H")
    if 'data-label="H · #217–#232"' not in gallery:
        fail("gallery does not classify the first H contact sheet as H")
    if "A_001-016.webp" not in gallery or "F_187-200.webp" not in gallery or "#018" not in gallery:
        fail("gallery does not cover the expected sheets and style 018")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for _, _, path in tweet_sheets:
        if f"images/{path.name}" not in readme:
            fail(f"README does not reference contact sheet {path.name}")
    if "### G · 附件新增 / 中国当代插画补充（201–216）" not in readme or f"### H · 其他（217–{max_num}）" not in readme:
        fail("README does not separate G and H contact-sheet groups")
    if f"风格索引（{total_styles}）" not in gallery or f"输入 001–{max_num}" not in gallery:
        fail("gallery count or range is stale")
    skill_text = (SKILL / "SKILL.md").read_text(encoding="utf-8")
    for token in ["Style activation policy", "name_activation=strong", "model_capabilities.json", "referenced_image_paths", "Use the attached image only as a style reference", "The user's written theme is the sole source for the image content", "images/individual/{bucket}/{number}.webp", "217_grid.webp"]:
        if token not in skill_text:
            fail(f"image-reference contract is missing {token}")
    for token in ["preserve the user's theme exactly", "Do not expand, paraphrase, interpret", "show the resolved reference image to the user outside the prompts", "Do not inject it into a `graphic-text` copyable prompt"]:
        if token not in skill_text:
            fail(f"graphic-text prompt contract is missing {token}")
    for token in ["Session initialization", "任何首次请求", "mcp__codex_app__open_in_codex", "target.type=\"browser\"", "file:///E:/handraw-style/handdraw-style-prompter/gallery/index.html", "Never open `gallery/index.html` as `target.type=\"file\"`", "当前处于纯图模式，可切换为图文模式。", "Do not repeat the browser call or this first-session status notice", "fallback link"]:
        if token not in skill_text:
            fail(f"session initialization contract is missing {token}")
    for token in ['id="preview"', 'class="sheet"', 'dialog.showModal()', 'event.target===dialog']:
        if token not in gallery:
            fail(f"gallery preview interaction is missing {token}")
    result = subprocess.run(python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", "18", "--theme", "秋天的第一杯奶茶"], capture_output=True, text=True, encoding="utf-8", check=True)
    for term in ["风格名称：#018 · Minimal Deadpan Dialogue Cartoon", "Style name: #018 · Minimal Deadpan Dialogue Cartoon", "秋天的第一杯奶茶"]:
        if term not in result.stdout:
            fail(f"prompt output is missing {term}")
    if "俏皮的手绘线条" in result.stdout or "playful hand-drawn linework" in result.stdout:
        fail("default prompt unexpectedly contains the fixed style anchor")
    if "参考作者/风格名称：Poorly Drawn Lines / Reza Farazmand。" not in result.stdout or "Reference author/style name: Poorly Drawn Lines / Reza Farazmand." not in result.stdout:
        fail("default prompt is missing the author/style name")
    if "当前处于纯图模式，可切换为图文模式。" not in result.stdout:
        fail("default prompt must identify pure-image mode and offer the graphic-text switch")
    graphic_theme = "世界就是个草台班子"
    graphic_text = subprocess.run(
        python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", "267", "--theme", graphic_theme, "--mode", "graphic-text"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    graphic_bytes = graphic_text.stdout.encode("utf-8")
    suffix_bytes = GRAPHIC_TEXT_SUFFIX.encode("utf-8")
    if graphic_bytes.count(suffix_bytes) != 2:
        fail("graphic-text prompt must preserve the exact suffix once in each language output")
    if "当前处于纯图模式，可切换为图文模式。" in graphic_text.stdout:
        fail("graphic-text prompt must not identify itself as pure-image mode")
    if graphic_text.stdout.count(graphic_theme) != 2:
        fail("graphic-text prompt must preserve the theme verbatim in both language outputs")
    if "临时拼装、摇摇欲坠" in graphic_text.stdout:
        fail("graphic-text prompt must not expand the theme into a scene description")
    graphic_reference = subprocess.run(
        python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", "217", "--theme", "动画人物", "--mode", "graphic-text"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    if str(grid_path(217)) in graphic_reference.stdout or "参考图：请上传本地参考图" in graphic_reference.stdout or "所附图片仅用于参考画风" in graphic_reference.stdout:
        fail("graphic-text prompt must not expose reference paths or isolation guidance")
    if "核心风格特征：奇想风格化3D卡通美学" not in graphic_reference.stdout:
        fail("graphic-text prompt must retain required positive style traits")
    style_267 = subprocess.run(python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", "267", "--theme", "很小的难过"], capture_output=True, text=True, encoding="utf-8", check=True)
    if "核心风格特征：白底中国式极简手绘漫画" not in style_267.stdout or "Core style traits: 白底中国式极简手绘漫画" not in style_267.stdout:
        fail("style 267 prompt must include its positive core traits")
    if "参考图：请上传本地参考图" in style_267.stdout or "Reference image: upload local reference image" in style_267.stdout:
        fail("style 267 must not require a reference image when traits activation is strong")
    style_217 = subprocess.run(python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", "217", "--theme", "动画人物"], capture_output=True, text=True, encoding="utf-8", check=True)
    if ("核心风格特征：奇想风格化3D卡通美学" not in style_217.stdout
            or "参考图：请上传本地参考图" not in style_217.stdout
            or "所附图片仅用于参考画风" not in style_217.stdout):
        fail("reference-required prompt must include traits, local reference path, and isolation guidance")
    invalid = subprocess.run(python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", f"{total_styles + 1}", "--theme", "x"], capture_output=True, text=True, encoding="utf-8")
    if invalid.returncode == 0 or f"001 to {max_num}" not in (invalid.stderr + invalid.stdout):
        fail("out-of-range style does not fail clearly")
    blank_traits = subprocess.run(python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", "214", "--theme", "都市大妖"], capture_output=True, text=True, encoding="utf-8", check=True)
    if "参考作者/风格名称：天翊羽。" not in blank_traits.stdout or "Reference author/style name: 天翊羽." not in blank_traits.stdout:
        fail("blank-trait author/style anchor is missing")
    if "采用该风格的视觉方向" in blank_traits.stdout or "Faithfully render these visual traits" in blank_traits.stdout:
        fail("blank traits were turned into prompt constraints")
    if "参考图：请上传本地参考图" not in blank_traits.stdout or "Reference image: upload local reference image" not in blank_traits.stdout:
        fail("blank-trait reference fallback must provide local reference paths")
    print(f"PASS: {total_styles} styles, gallery coverage, prompt contract, and invalid-number guard.")


if __name__ == "__main__":
    main()
