#!/usr/bin/env python3
"""Split every numbered 4x4 contact sheet into individual numbered PNGs."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SHEET = re.compile(r"^[A-G]_(\d{3})-(\d{3})\.png$")


def split_sheet(path: Path, output: Path) -> int:
    match = SHEET.match(path.name)
    if not match:
        return 0
    start, end = (int(value) for value in match.groups())
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
            image.crop((x0, y0, x1, y1)).save(output / f"{start + offset:03}.png")
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "images" / "individual")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    total = sum(split_sheet(path, args.output) for path in sorted((ROOT / "images").glob("[A-G]_*.png")))
    if total != 216:
        raise SystemExit(f"Expected 216 numbered tiles, wrote {total}.")
    print(f"Split {total} numbered tiles into {args.output}")


if __name__ == "__main__":
    main()
