#!/usr/bin/env python3
"""Build the desktop-client resource pack (yang0/handraw-style #20, #21, #23).

Output (default ``dist/client-resources/``, gitignored)::

    manifest.json          version, generated_at, files[{path,size,sha256}] (manifest itself excluded)
    prompt_rules.json      data-driven prompt assembly rules (S2)
    similarity.json        top-12 similar styles per style (S4)
    references/*.json      styles, layouts (prompts inlined), colors, tones, characters, props,
                           scenes, model_capabilities, style_alias_map, attribution
    images/...             individual/, layouts/, colors/, tones/ and any other referenced image

Every image path inside the pack is pack-relative POSIX (``images/individual/FA/FA-001.webp``).
The output is deterministic: identical sources and version produce byte-identical files.
``version`` / ``generated_at`` default to the HEAD commit date so rebuilding the same commit
does not change them; pass ``--version`` for a release build.

Standard library only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "handdraw-style-prompter"
REFERENCES = SKILL / "references"
SCRIPTS = SKILL / "scripts"
IMAGES = ROOT / "images"
SCHEMA_VERSION = 1
FULL_IMAGE_DIRS = ("individual", "layouts", "colors", "tones")
REFERENCE_FILES = (
    "styles.json", "layouts.json", "colors.json", "tones.json", "characters.json", "props.json",
    "scenes.json", "model_capabilities.json", "style_alias_map.json", "attribution.json",
)
SIMILAR_COUNT = 12
ZIP_EPOCH = (2020, 1, 1, 0, 0, 0)

sys.path.insert(0, str(SCRIPTS))
import layout_library  # noqa: E402
import prompt_style  # noqa: E402
import resolve_reference  # noqa: E402


def dump_json(data: object) -> bytes:
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def load(name: str) -> object:
    return json.loads((REFERENCES / name).read_text(encoding="utf-8"))


def pack_image_path(raw: str | None) -> str | None:
    """Map '../../../images/x/y.webp' style paths to 'images/x/y.webp'."""
    if not raw:
        return raw
    text = str(raw).replace("\\", "/")
    index = text.find("images/")
    if index < 0:
        raise ValueError(f"Image path outside images/: {raw}")
    relative = text[index:]
    if not (ROOT / relative).is_file():
        raise ValueError(f"Referenced image is missing: {raw}")
    return relative


def normalize_images(items: list[dict], keys: tuple[str, ...]) -> list[dict]:
    result = []
    for item in items:
        item = dict(item)
        for key in keys:
            if item.get(key):
                item[key] = pack_image_path(item[key])
        result.append(item)
    return result


def build_styles(styles: list[dict]) -> list[dict]:
    result = []
    for style in styles:
        item = dict(style)
        number = style["number"]
        category = number.split("-")[0]
        single = IMAGES / "individual" / category / f"{number}.webp"
        grid = IMAGES / "individual" / category / f"{number}_grid.webp"
        item["image"] = f"images/individual/{category}/{number}.webp" if single.is_file() else None
        if grid.is_file():
            item["grid"] = f"images/individual/{category}/{number}_grid.webp"
        result.append(item)
    return result


def build_layouts() -> list[dict]:
    raw = load("layouts.json")
    resolved = {item["id"]: item for item in layout_library.load_layouts()}
    result = []
    for item in raw:
        layout = {key: value for key, value in item.items() if key != "prompt_file"}
        layout["id"] = str(item["id"]).upper()
        layout["image"] = pack_image_path(item["image"])
        prompts = resolved[layout["id"]]["prompts"]
        layout["prompt_zh"] = prompts["zh"]
        layout["prompt_en"] = prompts["en"]
        result.append(layout)
    return result


def build_prompt_rules() -> dict:
    ps, rr = prompt_style, resolve_reference
    return {
        "schema_version": SCHEMA_VERSION,
        "source": "skills/handdraw-style-prompter/scripts/prompt_style.py + resolve_reference.py",
        "reference_isolation": {"zh": ps.REFERENCE_ISOLATION_ZH, "en": ps.REFERENCE_ISOLATION_EN},
        "graphic_text_suffix": ps.GRAPHIC_TEXT_SUFFIX,
        "redraw_instruction": {"zh": ps.REDRAW_INSTRUCTION_ZH, "en": ps.REDRAW_INSTRUCTION_EN},
        "theme_placeholder": {"zh": ps.THEME_PLACEHOLDER_ZH, "en": ps.THEME_PLACEHOLDER_EN},
        "defaults": {"model": "gpt-image-2", "mode": "pure-image", "language": "auto"},
        "modes": ["pure-image", "graphic-text"],
        "language_detection": {
            "cjk_regex": layout_library.CJK.pattern,
            "rule": "auto: zh when the theme contains any CJK character, else en. Only layout prompts use one language; style/color prompts always produce both.",
        },
        "style_id": {
            "canonical_regex": r"^F[A-I]-\d{3}$",
            "rules": [
                "digits only: zero-pad to 3 and map through style_alias_map.legacy_to_new",
                "^([A-Za-z]{2})[-_]?(\\d+)$: upper-case prefix + '-' + zero-padded number",
                "otherwise upper-case; if not found, try legacy_to_new once more",
            ],
        },
        "traits_filter": {
            "split_regex": rr.TRAIT_SPLIT_PATTERN,
            "strip_chars": rr.TRAIT_STRIP_CHARS,
            "negative_words": list(rr.NEGATIVE_TRAIT_WORDS),
            "negative_regex": rr.NEGATIVE_TRAIT_PATTERN,
            "joiner": rr.TRAIT_JOINER,
            "keep_raw_styles": list(rr.KEEP_RAW_STYLES),
            "keep_raw_legacy": list(rr.KEEP_RAW_LEGACY),
            "rule": "Split traits, strip each part, drop empty parts, parts containing any negative word, or matching negative_regex; join the rest. keep_raw styles use traits verbatim.",
        },
        "activation": {
            "policy_file": "references/model_capabilities.json",
            "allowed": sorted(rr.ALLOWED),
            "merge": "entry = default; if model profile exists: update with profile (minus 'styles'), then with profile.styles[canonical] or profile.styles[legacy number]",
            "decision": [
                {"when": "name_activation == strong", "use_reference_image": False, "prompt_traits": "", "activation_source": "name+style"},
                {"when": "traits_activation == strong and filtered traits non-empty", "use_reference_image": False, "prompt_traits": "filtered", "activation_source": "name+style+traits"},
                {"when": "otherwise", "use_reference_image": True, "prompt_traits": "filtered (may be empty)", "activation_source": "name+style+traits+reference-image | name+style+reference-image"},
            ],
            "reference_image_order": ["grid", "image"],
            "reference_image_only_in_mode": "pure-image",
        },
        "color": {
            "split_regex": ps.COLOR_SPLIT_PATTERN,
            "match": "case-insensitive: exact id, same number after 'c-' with leading zeros stripped, or substring of name_zh/name_en; first match in colors.json order wins",
            "unknown_id_error": "a token starting with 'C-' that matches nothing is an error; other unmatched tokens become free-text colors",
            "templates": ps.COLOR_TEMPLATES,
            "single": "matched color uses its own prompt_zh/prompt_en; free text uses free_zh/free_en",
            "two": "pair_zh/pair_en",
            "three_or_more": "multi_zh/multi_en, items formatted with multi_item_zh (falls back to name_zh when name_en is empty)",
        },
        "layout": {
            "aliases": dict(layout_library.LAYOUT_ALIASES),
            "language": "single language from language_detection (or explicit)",
            "ecommerce": {
                "detect": "category == 'ecommerce' or id starts with 'EC-'",
                "style_included_only_when_explicit": True,
                "graphic_text_suffix": False,
                "note": "the style is included only when the user explicitly chose one (an --auto recommendation does not count)",
            },
            "non_ecommerce_always_graphic_text": True,
        },
        "templates": ps.TEMPLATES,
        "color_prefix": ps.COLOR_PREFIX,
        "redraw_prefix": ps.REDRAW_PREFIX,
        "assembly": {
            "style": {
                "zh": ["style_name", "color", "theme", "reference_author", "traits?", "reference_image?", "extra?", "redraw?", "graphic_text_suffix?"],
                "en": ["style_name", "color_prefix+color", "theme", "reference_author", "traits?", "reference_image?", "extra?", "redraw_prefix+redraw?", "graphic_text_suffix?"],
                "joiner": "",
                "graphic_text_suffix_when": "mode == graphic-text",
            },
            "color_only": {
                "parts": ["color.prompt", "theme", "extra?", "redraw?", "graphic_text_suffix?"],
                "joiner": "",
            },
            "layout": {
                "parts": ["layout_name", "color?", "layout_theme", "layout_instructions", "layout_style?", "layout_traits?", "redraw?", "layout_extra?", "graphic_text_suffix (non-ecommerce)"],
                "joiner": "templates.<lang>.layout_part_joiner",
            },
            "extra": "join non-empty [extra_ratio, extra_subject, extra_text] with extra_joiner, then wrap with 'extra' (style/color) or 'layout_extra' (layout)",
        },
        "golden_fixture": "tests/fixtures/prompt_golden.json (reference paths are pack-relative)",
    }


def ngrams(text: str) -> Counter:
    text = re.sub(r"\s+", " ", text.lower()).strip()
    grams: Counter = Counter()
    for size in (2, 3):
        for index in range(len(text) - size + 1):
            gram = text[index:index + size]
            if gram.strip():
                grams[gram] += 1
    return grams


def build_similarity(styles: list[dict]) -> dict:
    documents = {}
    for style in styles:
        text = " ".join([style.get("traits", ""), style.get("generation_name", ""), style.get("group", "")])
        documents[style["number"]] = ngrams(text)
    count = len(documents)
    frequency: Counter = Counter()
    for grams in documents.values():
        frequency.update(grams.keys())
    idf = {gram: math.log((1 + count) / (1 + df)) + 1.0 for gram, df in frequency.items()}
    vectors = {}
    for number, grams in documents.items():
        weights = {gram: (1 + math.log(tf)) * idf[gram] for gram, tf in grams.items()}
        norm = math.sqrt(sum(value * value for value in weights.values())) or 1.0
        vectors[number] = {gram: value / norm for gram, value in weights.items()}
    numbers = sorted(vectors)
    similar = {}
    for number in numbers:
        vector = vectors[number]
        scores = []
        for other in numbers:
            if other == number:
                continue
            other_vector = vectors[other]
            small, large = (vector, other_vector) if len(vector) < len(other_vector) else (other_vector, vector)
            score = sum(value * large.get(gram, 0.0) for gram, value in small.items())
            scores.append((-round(score, 6), other))
        scores.sort()
        similar[number] = [{"number": other, "score": -score} for score, other in scores[:SIMILAR_COUNT]]
    return {
        "schema_version": SCHEMA_VERSION,
        "method": "character 2-3 gram TF-IDF (sublinear tf, smoothed idf) cosine over traits + generation_name + group",
        "top_k": SIMILAR_COUNT,
        "styles": similar,
    }


def git_commit_time() -> datetime:
    try:
        output = subprocess.run(["git", "log", "-1", "--format=%cI"], cwd=ROOT, capture_output=True,
                                text=True, check=True).stdout.strip()
        return datetime.fromisoformat(output).astimezone(timezone.utc)
    except (OSError, subprocess.CalledProcessError, ValueError):
        return datetime(2020, 1, 1, tzinfo=timezone.utc)


def collect_images(json_payloads: list[object]) -> list[str]:
    paths: set[str] = set()
    for folder in FULL_IMAGE_DIRS:
        for file in (IMAGES / folder).rglob("*"):
            if file.is_file():
                paths.add(file.relative_to(ROOT).as_posix())

    def walk(value: object) -> None:
        if isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, str) and value.startswith("images/") and (ROOT / value).is_file():
            paths.add(value)

    for payload in json_payloads:
        walk(payload)
    return sorted(paths)


def build(output: Path, version: str | None, make_zip: bool) -> dict:
    commit_time = git_commit_time()
    version = version or commit_time.strftime("%Y.%m.%d") + ".1"
    if not re.fullmatch(r"[0-9A-Za-z.\-]+", version):
        raise ValueError(f"Invalid version: {version}")
    skill_version = json.loads((ROOT / "version.json").read_text(encoding="utf-8")).get("version", "")

    styles_raw = load("styles.json")
    references: dict[str, object] = {
        "styles.json": build_styles(styles_raw),
        "layouts.json": build_layouts(),
        "colors.json": normalize_images(load("colors.json"), ("image", "sheet_image")),
        "tones.json": normalize_images(load("tones.json"), ("image",)),
        "characters.json": normalize_images(load("characters.json"), ("image",)),
        "props.json": normalize_images(load("props.json"), ("image",)),
        "scenes.json": normalize_images(load("scenes.json"), ("image",)),
        "model_capabilities.json": load("model_capabilities.json"),
        "style_alias_map.json": load("style_alias_map.json"),
        "attribution.json": load("attribution.json"),
    }
    assert set(references) == set(REFERENCE_FILES)
    files: dict[str, bytes] = {f"references/{name}": dump_json(data) for name, data in references.items()}
    files["prompt_rules.json"] = dump_json(build_prompt_rules())
    files["similarity.json"] = dump_json(build_similarity(styles_raw))

    output = output.resolve()
    if output.exists():
        if not (output / "manifest.json").exists() and any(output.iterdir()):
            raise SystemExit(f"Refusing to clear non-pack directory: {output}")
        shutil.rmtree(output)
    output.mkdir(parents=True)
    for relative, content in files.items():
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    for relative in collect_images(list(references.values())):
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)

    entries = []
    for file in sorted(output.rglob("*"), key=lambda item: item.relative_to(output).as_posix()):
        if file.is_file() and file.name != "manifest.json":
            data = file.read_bytes()
            entries.append({"path": file.relative_to(output).as_posix(), "size": len(data),
                            "sha256": hashlib.sha256(data).hexdigest()})
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "version": version,
        "skill_version": skill_version,
        "generated_at": commit_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": entries,
    }
    (output / "manifest.json").write_bytes(dump_json(manifest))

    summary = {"output": str(output), "version": version, "files": len(entries) + 1,
               "bytes": sum(entry["size"] for entry in entries) + (output / "manifest.json").stat().st_size}
    if make_zip:
        archive = output.parent / f"client-resources-{version}.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as handle:
            for relative in ["manifest.json"] + [entry["path"] for entry in entries]:
                info = zipfile.ZipInfo(relative, ZIP_EPOCH)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                handle.writestr(info, (output / relative).read_bytes())
        summary["zip"] = str(archive)
        summary["zip_bytes"] = archive.stat().st_size
        summary["zip_sha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, default=ROOT / "dist" / "client-resources")
    parser.add_argument("--version", help="Resource version, e.g. 2026.11.17.1 (default: HEAD commit date + .1)")
    parser.add_argument("--zip", action="store_true", help="Also write client-resources-<version>.zip next to the output dir")
    args = parser.parse_args()
    print(json.dumps(build(args.output, args.version, args.zip), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
