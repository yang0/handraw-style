#!/usr/bin/env python3
"""Split every numbered 4x4 contact sheet into individual numbered PNGs."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ROOT_SCRIPTS = ROOT / "scripts"
if str(ROOT_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(ROOT_SCRIPTS))

from style_asset_paths import single_path

SHEET = re.compile(r"^[A-G]_(\d{3})(?:-(\d{3}))?\.png$")


def split_sheet(path: Path) -> int:
    match = SHEET.match(path.name)
    if not match:
        return 0
    start = int(match.group(1))
    end = int(match.group(2)) if match.group(2) else start
    count = end - start + 1
    with Image.open(path) as image:
        image = image.convert("RGB")
        width, height = image.size
        for offset in range(count):
            row, column = divmod(offset, 4)
            x0 = round(column * width / 4)
            x1 = round((column + 1) * width / 4)
            y0 = round(row * height / 4)
            y1 = round((row + 1) * height / 4)
            target = single_path(start + offset)
            target.parent.mkdir(parents=True, exist_ok=True)
            image.crop((x0, y0, x1, y1)).save(target)
    return count


def main() -> None:
    total = sum(split_sheet(path) for path in sorted((ROOT / "images").glob("[A-G]_*.png")))
    expected = len(json.loads((ROOT / "handdraw-style-prompter" / "references" / "styles.json").read_text(encoding="utf-8")))
    if total != expected:
        raise SystemExit(f"Expected {expected} numbered tiles, wrote {total}.")
    print(f"Split {total} numbered tiles into numbered 200-style buckets.")


if __name__ == "__main__":
    main()
