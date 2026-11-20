"""Golden prompt cases and client resource pack checks (#20, #21, #23)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests"))
sys.path.insert(0, str(ROOT / "skills" / "handdraw-style-prompter" / "scripts"))
import generate_prompt_golden  # noqa: E402
import prompt_style  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "prompt_golden.json"
SCRIPT = ROOT / "skills" / "handdraw-style-prompter" / "scripts" / "prompt_style.py"


class PromptGoldenTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.golden = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_fixture_is_up_to_date(self):
        self.assertEqual(FIXTURE.read_text(encoding="utf-8"), generate_prompt_golden.render(),
                         "Run python tests/generate_prompt_golden.py and review the diff")

    def test_each_case_matches_build_prompt(self):
        self.assertGreaterEqual(len(self.golden["cases"]), 40)
        for case in self.golden["cases"]:
            with self.subTest(case["name"]):
                result = prompt_style.build_prompt(**case["input"], path_base=self.golden["path_base"])
                self.assertEqual(result["zh"], case["expected"]["zh"])
                self.assertEqual(result["en"], case["expected"]["en"])

    def test_reference_paths_are_machine_independent(self):
        for case in self.golden["cases"]:
            path = case["expected"]["reference_path"]
            if path:
                self.assertTrue(path.startswith("images/individual/"), path)
                self.assertTrue((ROOT / path).is_file(), path)
                self.assertNotIn(str(ROOT), case["expected"]["zh"] + case["expected"]["en"])

    def test_cli_output_uses_build_prompt(self):
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        for case in self.golden["cases"]:
            if case["input"]["mode"] != "pure-image" or case["expected"]["kind"] == "layout":
                continue
            with self.subTest(case["name"]):
                args = [sys.executable, str(SCRIPT)]
                for key in ("style", "color", "theme", "ratio", "subject", "text", "model", "mode", "language"):
                    if case["input"][key]:
                        args += [f"--{key}", case["input"][key]]
                if case["input"]["redraw"]:
                    args.append("--redraw")
                output = subprocess.run(args, capture_output=True, encoding="utf-8", env=env, check=True).stdout
                zh, en = case["expected"]["zh"], case["expected"]["en"]
                if case["expected"]["reference_path"]:
                    absolute = str((ROOT / case["expected"]["reference_path"]).resolve())
                    zh = zh.replace(case["expected"]["reference_path"], absolute)
                    en = en.replace(case["expected"]["reference_path"], absolute)
                self.assertIn("\n中文提示词：\n" + zh + "\n", output)
                self.assertIn("\nEnglish prompt:\n" + en + "\n", output)

    def test_layout_cli_prints_selected_language(self):
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        case = next(item for item in self.golden["cases"] if item["name"] == "layout + style")
        output = subprocess.run([sys.executable, str(SCRIPT), "--layout", "IG-038", "--style", "FA-013", "--theme", "咖啡知识"],
                                capture_output=True, encoding="utf-8", env=env, check=True).stdout
        self.assertIn("\nPrompt:\n" + case["expected"]["zh"] + "\n", output)


class ClientResourcePackTest(unittest.TestCase):
    def test_build_is_deterministic_and_manifest_matches(self):
        sys.path.insert(0, str(ROOT / "scripts"))
        import build_client_resources as builder
        import hashlib
        with tempfile.TemporaryDirectory() as temporary:
            first = Path(temporary) / "pack"
            builder.build(first, "2026.1.1.1", make_zip=False)
            manifest_text = (first / "manifest.json").read_text(encoding="utf-8")
            manifest = json.loads(manifest_text)
            self.assertEqual(manifest["version"], "2026.1.1.1")
            paths = {entry["path"] for entry in manifest["files"]}
            for required in ("prompt_rules.json", "similarity.json", "references/styles.json", "references/layouts.json"):
                self.assertIn(required, paths)
            for entry in manifest["files"][:40]:
                data = (first / entry["path"]).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), entry["sha256"])
            styles = json.loads((first / "references" / "styles.json").read_text(encoding="utf-8"))
            for style in styles:
                for key in ("image", "grid"):
                    if style.get(key):
                        self.assertIn(style[key], paths)
            layouts = json.loads((first / "references" / "layouts.json").read_text(encoding="utf-8"))
            self.assertTrue(all(item["prompt_zh"] and item["prompt_en"] and item["image"] in paths for item in layouts))
            similarity = json.loads((first / "similarity.json").read_text(encoding="utf-8"))
            self.assertEqual(len(similarity["styles"]), len(styles))
            self.assertTrue(all(len(items) == 12 for items in similarity["styles"].values()))
            builder.build(first, "2026.1.1.1", make_zip=False)
            self.assertEqual((first / "manifest.json").read_text(encoding="utf-8"), manifest_text)


if __name__ == "__main__":
    unittest.main()
