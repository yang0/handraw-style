#!/usr/bin/env python3
"""Tweet contact-sheet registry for the 201+ hand-drawn style gallery.

G-category sheets are 4x4 (CAPACITY=16) contact sheets named
``G_{start:03}-{end:03}.png`` under ``images/``; the final sheet may be
incomplete. The active-sheet bookkeeping lives in
``handdraw-style-prompter/references/contact_sheet_state.json``.

This module was previously missing from the published repository. The
implementation is reconstructed from the contracts enforced by
``handdraw-style-prompter/scripts/validate_library.py``.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "images"
STATE_FILE = ROOT / "handdraw-style-prompter" / "references" / "contact_sheet_state.json"

# 4x4 tile grid per contact sheet.
CAPACITY = 16

SHEET = re.compile(r"^G_(\d{3})(?:-(\d{3}))?\.png$")


def parse_sheet(path: Path) -> tuple[int, int] | None:
    """Return (start, end) style numbers encoded in a G-sheet filename.

    A bare ``G_201.png`` counts as a single-style sheet (start == end).
    Non-matching names return ``None`` so callers can skip them.
    """
    match = SHEET.match(Path(path).name)
    if not match:
        return None
    start = int(match.group(1))
    end = int(match.group(2)) if match.group(2) else start
    if end < start:
        return None
    return start, end


def sheet_path(start: int, end: int) -> Path:
    """Canonical path for the sheet covering styles ``start``–``end``."""
    if start == end:
        return IMAGES / f"G_{start:03}.png"
    return IMAGES / f"G_{start:03}-{end:03}.png"
