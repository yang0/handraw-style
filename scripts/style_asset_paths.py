#!/usr/bin/env python3
"""Numbered style asset path helpers (single source of truth for layout).

Assets live in 200-number buckets under ``images/individual/``:

- ``001-200/001.png`` … ``401-600/xxx.png``  — per-style single images
- ``001-200/048_grid.jpg``                   — optional four-panel grid,
  same bucket as the matching single image; takes priority as a
  generation reference when present.

This module was previously missing from the published repository. The
implementation is reconstructed from the contracts enforced by
``handdraw-style-prompter/scripts/validate_library.py``.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDIVIDUAL = ROOT / "images" / "individual"
BUCKET_SIZE = 200


def _number(value: int | str) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"Style number must be an integer, got {value!r}")
    if number < 1:
        raise ValueError(f"Style number must be >= 1, got {number}")
    return number


def bucket_name(value: int | str) -> str:
    """Return the 200-style bucket directory name, e.g. 1 -> '001-200'."""
    number = _number(value)
    start = (number - 1) // BUCKET_SIZE * BUCKET_SIZE + 1
    return f"{start:03}-{start + BUCKET_SIZE - 1:03}"


def bucket_dir(value: int | str) -> Path:
    return INDIVIDUAL / bucket_name(value)


def single_path(value: int | str) -> Path:
    """Path to the numbered single image, e.g. 48 -> .../001-200/048.png."""
    number = _number(value)
    return bucket_dir(number) / f"{number:03}.png"


def grid_path(value: int | str) -> Path:
    """Path to the four-panel grid image, e.g. 217 -> .../201-400/217_grid.jpg."""
    number = _number(value)
    return bucket_dir(number) / f"{number:03}_grid.jpg"
