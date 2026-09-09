#!/usr/bin/env python3
"""Validate source parsing, generated assets, and the deterministic prompt contract."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROOT_SCRIPTS = ROOT / "scripts"
if str(ROOT_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(ROOT_SCRIPTS))

from resolve_reference import resolve
from contact_sheet_registry import CAPACITY, STATE_FILE, parse_sheet, sheet_path
from style_asset_paths import bucket_name, grid_path, single_path

SKILL = Path(__file__).resolve().parents[1]


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
    if resolve("gpt-image-2", "155")["activation_source"] != "name+style+traits" or resolve("gpt-image-2", "155")["use_reference_image"] is not False:
        fail("gpt-image-2 style with positive traits should use name+traits activation")
    synthetic = {"default": model_capabilities["default"], "models": {
        "test-model": {"name_activation": "unknown", "traits_activation": "strong", "styles": {"201": {"name_activation": "none"}, "002": {"name_activation": "strong"}}},
    }}
    if resolve("test-model", "201", synthetic)["use_reference_image"] is not True:
        fail("empty traits or insufficient capability must use reference image")
    if resolve("test-model", "002", synthetic)["use_reference_image"] is not False:
        fail("strong capability must not use reference image")
    traits_case = resolve("gpt-image-2", "022")
    if traits_case["activation_source"] != "name+style+traits" or not traits_case["prompt_traits"] or "避免" in traits_case["prompt_traits"]:
        fail("gpt-image-2 traits activation did not produce filtered positive traits")
    if resolve("gpt-image-2", "201")["use_reference_image"] is not True:
        fail("empty-trait style must use reference image")
    if bucket_name(1) != "001-200" or bucket_name(217) != "201-400" or bucket_name(401) != "401-600":
        fail("style asset bucket calculation is incorrect")
    reference_217 = resolve("gpt-image-2", "217")
    if reference_217["activation_source"] != "reference-image" or reference_217["reference_path"] != str(grid_path(217)):
        fail("style 217 must use its four-panel grid reference")
    if not grid_path(217).exists():
        fail("style 217 four-panel grid is missing")
    if any(item["traits"] for item in styles[200:216]):
        fail("201–216 core visual traits must remain blank")
    individual = ROOT / "images" / "individual"
    expected_individual = [single_path(number) for number in range(1, total_styles + 1)]
    if not all(path.exists() for path in expected_individual):
        fail(f"numbered asset buckets must cover exactly 001.png–{max_num}.png")
    if list(individual.glob("[0-9][0-9][0-9].png")) or list(individual.glob("[0-9][0-9][0-9]_grid.jpg")):
        fail("flat individual assets must be migrated into numbered buckets")
    tweet_sheets = []
    for path in (ROOT / "images").glob("G_*.png"):
        parsed = parse_sheet(path)
        if parsed:
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
    if "A_001-016.png" not in gallery or "F_187-200.png" not in gallery or "#018" not in gallery:
        fail("gallery does not cover the expected sheets and style 018")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for _, _, path in tweet_sheets:
        if f"images/{path.name}" not in readme:
            fail(f"README does not reference contact sheet {path.name}")
    if f"风格索引（{total_styles}）" not in gallery or f"输入 001–{max_num}" not in gallery:
        fail("gallery count or range is stale")
    skill_text = (SKILL / "SKILL.md").read_text(encoding="utf-8")
    for token in ["Explicit image-generation mode", "name_activation=strong", "model_capabilities.json", "referenced_image_paths", "Use the attached image only as a style reference", "The user's written theme is the sole source for the image content", "images\\individual\\{bucket}\\{number}.png", "217_grid.jpg"]:
        if token not in skill_text:
            fail(f"image-reference contract is missing {token}")
    for token in ["Session initialization", "mcp__codex_app__open_in_codex", "file:///E:/handraw-style/handdraw-style-prompter/gallery/index.html", "Do not repeat the browser call", "fallback link"]:
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
    invalid = subprocess.run(python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", f"{total_styles + 1}", "--theme", "x"], capture_output=True, text=True, encoding="utf-8")
    if invalid.returncode == 0 or f"001 to {max_num}" not in (invalid.stderr + invalid.stdout):
        fail("out-of-range style does not fail clearly")
    blank_traits = subprocess.run(python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", "214", "--theme", "都市大妖"], capture_output=True, text=True, encoding="utf-8", check=True)
    if "参考作者/风格名称：天翊羽。" not in blank_traits.stdout or "Reference author/style name: 天翊羽." not in blank_traits.stdout:
        fail("blank-trait author/style anchor is missing")
    if "采用该风格的视觉方向" in blank_traits.stdout or "Faithfully render these visual traits" in blank_traits.stdout:
        fail("blank traits were turned into prompt constraints")
    print(f"PASS: {total_styles} styles, gallery coverage, prompt contract, and invalid-number guard.")


if __name__ == "__main__":
    main()
