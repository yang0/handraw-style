"""Regression tests for custom-library display-name edits (Issue #14).

Run with:
  python -m unittest discover -s skills/handdraw-style-prompter/scripts -p 'test_custom_library_rename.py'
"""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import custom_library_manager as manager


class CustomLibraryRenameTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest_file = self.root / "library.json"
        self.img_file = self.root / "characters" / "CH-002.webp"
        self.img_file.parent.mkdir(parents=True)
        self.img_file.write_bytes(b"original image remains untouched")
        self.original_bytes = self.img_file.read_bytes()
        self.original = {
            "version": 1,
            "characters": [
                {"id": "CH-002", "name": "旧名称", "name_en": "旧名称",
                 "image": "../../../images/custom/characters/CH-002.webp"}
            ],
            "props": [{"id": "PR-001", "name": "道具", "name_en": "Prop"}],
            "scenes": [{"id": "SCN-001", "name": "场景", "name_en": "场景"}],
        }
        self.manifest_file.write_text(json.dumps(self.original, ensure_ascii=False), encoding="utf-8")
        self.get_dir = patch.object(manager, "get_custom_library_dir", return_value=self.root)
        self.rebuild = patch.object(manager, "_trigger_rebuild")
        self.get_dir.start()
        self.rebuild_mock = self.rebuild.start()
        self.addCleanup(self.get_dir.stop)
        self.addCleanup(self.rebuild.stop)

    def read_manifest(self):
        return json.loads(self.manifest_file.read_text(encoding="utf-8"))

    def test_rename_updates_display_names_without_touching_ids_or_files(self):
        entry = manager.update_asset_metadata("ch-002", name="新名字")
        self.assertEqual(entry["name"], "新名字")
        self.assertEqual(entry["name_en"], "新名字")
        self.assertEqual(self.read_manifest()["characters"][0]["id"], "CH-002")
        self.assertEqual(self.read_manifest()["characters"][0]["image"], self.original["characters"][0]["image"])
        self.assertEqual(self.img_file.read_bytes(), self.original_bytes)
        self.rebuild_mock.assert_called_once()

    def test_independent_english_translation_is_preserved(self):
        entry = manager.update_asset_metadata("pr-001", name="新道具")
        self.assertEqual(entry["name_en"], "Prop")
        self.assertEqual(entry["name"], "新道具")

    def test_explicit_english_name_can_be_renamed(self):
        entry = manager.update_asset_metadata("PR-001", name_en="New prop")
        self.assertEqual(entry["name"], "道具")
        self.assertEqual(entry["name_en"], "New prop")

    def test_scene_category_is_supported(self):
        entry = manager.update_asset_metadata("scn-001", name="城市夜景")
        self.assertEqual(entry["name"], "城市夜景")
        self.assertEqual(self.read_manifest()["scenes"][0]["name_en"], "城市夜景")

    def test_rejects_blank_long_and_control_names_without_changes(self):
        original_text = self.manifest_file.read_text(encoding="utf-8")
        for name in ("", "   ", "x" * 81, "bad\nname"):
            with self.subTest(name=repr(name)):
                with self.assertRaises(ValueError):
                    manager.update_asset_metadata("CH-002", name=name)
                self.assertEqual(self.manifest_file.read_text(encoding="utf-8"), original_text)
        self.rebuild_mock.assert_not_called()

    def test_official_presets_cannot_be_renamed(self):
        with self.assertRaises(KeyError):
            manager.update_asset_metadata("CH-001", name="错误覆盖")
        self.assertEqual(self.read_manifest(), self.original)
        self.rebuild_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
