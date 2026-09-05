#!/usr/bin/env python3
"""Validate source parsing, generated assets, and the deterministic prompt contract."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from resolve_reference import resolve

SKILL = Path(__file__).resolve().parents[1]
ROOT = SKILL.parent


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def main() -> None:
    python = [sys.executable, "-X", "utf8"]
    subprocess.run(python + [str(SKILL / "scripts" / "build_library.py")], check=True)
    styles = json.loads((SKILL / "references" / "styles.json").read_text(encoding="utf-8"))
    attribution = json.loads((SKILL / "references" / "attribution.json").read_text(encoding="utf-8"))
    model_capabilities = json.loads((SKILL / "references" / "model_capabilities.json").read_text(encoding="utf-8"))
    expected = [f"{n:03}" for n in range(1, 217)]
    if [item["number"] for item in styles] != expected:
        fail("style numbering is not continuous 001–216")
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
    if any(item["traits"] for item in styles[200:]):
        fail("201–216 core visual traits must remain blank")
    individual = ROOT / "images" / "individual"
    expected_individual = [individual / f"{number:03}.png" for number in range(1, 217)]
    if [path.name for path in sorted(individual.glob("*.png"))] != [path.name for path in expected_individual]:
        fail("individual images must cover exactly 001.png–216.png")
    gallery = (SKILL / "gallery" / "index.html").read_text(encoding="utf-8")
    if "A_001-016.png" not in gallery or "F_187-200.png" not in gallery or "G_201-216.png" not in gallery or "#018" not in gallery:
        fail("gallery does not cover the expected sheets and style 018")
    if "风格索引（216）" not in gallery or "输入 001–216" not in gallery:
        fail("gallery count or range is stale")
    skill_text = (SKILL / "SKILL.md").read_text(encoding="utf-8")
    for token in ["Explicit image-generation mode", "name_activation=strong", "model_capabilities.json", "referenced_image_paths", "style reference only", "ignore the reference image's subjects", "images\\individual\\{number}.png"]:
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
    invalid = subprocess.run(python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", "217", "--theme", "x"], capture_output=True, text=True, encoding="utf-8")
    if invalid.returncode == 0 or "001 to 216" not in (invalid.stderr + invalid.stdout):
        fail("out-of-range style does not fail clearly")
    blank_traits = subprocess.run(python + [str(SKILL / "scripts" / "prompt_style.py"), "--style", "214", "--theme", "都市大妖"], capture_output=True, text=True, encoding="utf-8", check=True)
    if "参考作者/风格名称：天翊羽。" not in blank_traits.stdout or "Reference author/style name: 天翊羽." not in blank_traits.stdout:
        fail("blank-trait author/style anchor is missing")
    if "采用该风格的视觉方向" in blank_traits.stdout or "Faithfully render these visual traits" in blank_traits.stdout:
        fail("blank traits were turned into prompt constraints")
    print("PASS: 216 styles, gallery coverage, prompt contract, and invalid-number guard.")


if __name__ == "__main__":
    main()
