#!/usr/bin/env python3
"""Resolve whether a style reference image is needed for a model and style."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROOT_SCRIPTS = ROOT / "scripts"
if str(ROOT_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(ROOT_SCRIPTS))

from style_asset_paths import grid_path, single_path

SKILL = Path(__file__).resolve().parents[1]
POLICY = SKILL / "references" / "model_capabilities.json"
STYLES = SKILL / "references" / "styles.json"
ALLOWED = {"strong", "weak", "none", "unknown"}


def load_policy() -> dict:
    return json.loads(POLICY.read_text(encoding="utf-8"))


def load_style(number: str) -> dict:
    styles = json.loads(STYLES.read_text(encoding="utf-8"))
    return next(item for item in styles if item["number"] == number)


def positive_traits(traits: str) -> str:
    if not traits:
        return ""
    parts = [part.strip() for part in traits.replace("。", "；").split("；")]
    kept = [part for part in parts if part and not any(word in part for word in ("避免", "不要", "不准"))]
    return "；".join(kept)


def get_reference_path(number: str) -> str:
    reference_grid = grid_path(number)
    return str(reference_grid if reference_grid.exists() else single_path(number))


def resolve(model: str, style: str, policy: dict | None = None) -> dict:
    styles = json.loads(STYLES.read_text(encoding="utf-8"))
    max_num = len(styles)
    if not style.isdigit() or not 1 <= int(style) <= max_num:
        raise ValueError(f"Style must be a number from 001 to {max_num:03}.")
    number = f"{int(style):03}"
    policy = policy or load_policy()
    style_record = next(item for item in styles if item["number"] == number)
    fallback = dict(policy["default"])
    profile = policy.get("models", {}).get(model)
    entry = dict(fallback)
    if profile:
        entry.update({key: value for key, value in profile.items() if key != "styles"})
        entry.update(profile.get("styles", {}).get(number, {}))
    name_activation = entry.get("name_activation", "unknown")
    traits_activation = entry.get("traits_activation", "unknown")
    if name_activation not in ALLOWED or traits_activation not in ALLOWED:
        raise ValueError("Invalid name_activation or traits_activation")
    traits = positive_traits(style_record.get("traits", ""))
    if name_activation == "strong":
        activation_source = "name+style"
        use_reference_image = False
        prompt_traits = ""
    elif traits_activation == "strong" and traits:
        activation_source = "name+style+traits"
        use_reference_image = False
        prompt_traits = traits
    else:
        activation_source = "reference-image"
        use_reference_image = True
        prompt_traits = ""
    return {
        "model": model,
        "style": number,
        "name_activation": name_activation,
        "traits_activation": traits_activation,
        "activation_source": activation_source,
        "use_reference_image": use_reference_image,
        "include_prompt_traits": bool(prompt_traits),
        "prompt_traits": prompt_traits,
        "reference_path": get_reference_path(number) if use_reference_image else None,
        "note": entry.get("note", "")
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--style", required=True)
    args = parser.parse_args()
    print(json.dumps(resolve(args.model, args.style), ensure_ascii=False))


if __name__ == "__main__":
    main()
