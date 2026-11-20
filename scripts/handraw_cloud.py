"""Portable CLI launcher for the Handraw Skill/Web cloud bridge."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).resolve().parents[1] / "skills/handraw-cloud/scripts/handraw_cloud.py"), run_name="__main__")
