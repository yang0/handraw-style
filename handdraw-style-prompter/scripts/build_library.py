#!/usr/bin/env python3
"""Build derived style JSON and an offline number-searchable gallery."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILL = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "styles_200_reorganized.md"
STYLE_JSON = SKILL / "references" / "styles.json"
GALLERY = SKILL / "gallery" / "index.html"
ROW = re.compile(r"^\|\s*(\d{3})\s*·\s*([^|]+)\|\s*([^|]+)\|\s*(.*)\|\s*$")
HEADING = re.compile(r"^##\s+([A-G])\s+(.+)$")
IMAGE = re.compile(r"^([A-G])_(\d{3})(?:-(\d{3}))?\.png$")


def parse_styles() -> list[dict[str, str]]:
    group = ""
    items: list[dict[str, str]] = []
    for line in SOURCE.read_text(encoding="utf-8").splitlines():
        heading = HEADING.match(line)
        if heading:
            group = f"{heading.group(1)} {heading.group(2)}"
            continue
        match = ROW.match(line)
        if match:
            number, reference, generation_name, traits = (part.strip() for part in match.groups())
            items.append({"number": number, "group": group, "reference": reference,
                          "generation_name": generation_name, "traits": traits})
    return items


def contact_sheets() -> list[dict[str, str]]:
    sheets = []
    for path in sorted((ROOT / "images").glob("*.png")):
        match = IMAGE.match(path.name)
        if match:
            group = match.group(1)
            start = match.group(2)
            end = match.group(3) or start
            sheets.append({"group": group, "start": start, "end": end,
                           "path": f"../../images/{path.name}"})
    return sheets


def gallery_html(styles: list[dict[str, str]], sheets: list[dict[str, str]]) -> str:
    total_count = len(styles)
    max_num = f"{total_count:03}"
    style_cards = "\n".join(
        f'<article class="style" data-number="{s["number"]}" data-group="{s["group"][0]}"><b>#{s["number"]}</b> '
        f'<span>{html.escape(s["generation_name"])}</span><small>{html.escape(s["reference"])}</small>'
        f'<p>{html.escape(s["traits"])}</p></article>' for s in styles)
    
    sheet_card_list = []
    for s in sheets:
        if s["start"] == s["end"]:
            label = f'{s["group"]} · #{s["start"]}'
            aria = f'放大查看 {s["group"]} #{s["start"]}'
            alt = f'Style {s["start"]}'
            caption = f'{s["group"]} · #{s["start"]} · 点击放大'
            badge = f'#{s["start"]}'
        else:
            label = f'{s["group"]} · #{s["start"]}–#{s["end"]}'
            aria = f'放大查看 {s["group"]} #{s["start"]} 到 #{s["end"]}'
            alt = f'Styles {s["start"]} to {s["end"]}'
            caption = f'{s["group"]} · #{s["start"]}–#{s["end"]} · 点击放大'
            badge = f'#{s["start"]}–#{s["end"]}'
        
        sheet_card_list.append(
            f'<figure data-group="{s["group"]}"><span class="sheet-badge">{badge}</span><button class="sheet" type="button" data-src="{s["path"]}" '
            f'data-label="{label}" aria-label="{aria}">'
            f'<img src="{s["path"]}" alt="{alt}"></button>'
            f'<figcaption>{caption}</figcaption></figure>'
        )
    sheet_cards = "\n".join(sheet_card_list)

    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>手绘风格编号画廊</title><style>
body{{margin:0;background:#f7f5f0;color:#24211e;font:16px/1.5 system-ui,"Microsoft YaHei",sans-serif}} main{{max-width:1440px;margin:auto;padding:30px}} h1{{margin:0}} .lead{{color:#665f57}} input{{width:min(520px,100%);box-sizing:border-box;padding:12px;border:1px solid #bdb5aa;border-radius:10px;font-size:16px}} .sheets{{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px;margin:24px 0 36px}} figure{{position:relative;margin:0;background:#fff;padding:10px;border-radius:12px;box-shadow:0 1px 5px #0002}} .sheet-badge{{position:absolute;top:16px;left:16px;background:rgba(36,33,30,0.85);color:#fff;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.5px;pointer-events:none;z-index:2;box-shadow:0 1px 3px rgba(0,0,0,0.3)}} .sheet{{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in}} .sheet:focus-visible{{outline:3px solid #d67d4d;outline-offset:4px;border-radius:8px}} img{{display:block;width:100%;border-radius:7px}} figcaption{{padding:8px 2px 0;font-weight:700}} .styles{{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:10px}} .style{{background:#fff;border-radius:10px;padding:12px;border-left:4px solid #d67d4d}} .style b{{font-variant-numeric:tabular-nums}} .style small{{display:block;color:#71685e;margin-top:2px}} .style p{{margin:7px 0 0;font-size:14px;color:#4b4540}} dialog{{width:min(94vw,1300px);max-width:none;padding:12px;border:0;border-radius:14px;background:#171513;color:#fff;box-shadow:0 20px 70px #0008}} dialog::backdrop{{background:#000b}} dialog img{{max-height:82vh;object-fit:contain}} .close{{float:right;border:0;border-radius:7px;padding:7px 10px;background:#fff;color:#24211e;cursor:pointer;font:inherit}} .dialog-label{{margin:8px 0 0;clear:both}} [hidden]{{display:none!important}}</style></head>
<body><main><h1>手绘风格编号画廊</h1><p class="lead">输入 001–{max_num}、风格名或原参考名筛选；图片为原有编号拼图，仅供选择风格。</p><input id="search" type="search" placeholder="例如：018、{max_num}、Minimal Deadpan、秋天">
<h2>风格拼图</h2><section class="sheets">{sheet_cards}</section><h2>风格索引（{total_count}）</h2><section class="styles" id="styles">{style_cards}</section></main>
<dialog id="preview" aria-labelledby="dialog-label"><button class="close" type="button" aria-label="关闭放大预览">关闭 ×</button><img id="preview-image" alt=""><p class="dialog-label" id="dialog-label"></p></dialog>
<script>const q=document.querySelector('#search'),cards=[...document.querySelectorAll('.style')],dialog=document.querySelector('#preview'),preview=document.querySelector('#preview-image'),label=document.querySelector('#dialog-label');q.addEventListener('input',()=>{{const v=q.value.trim().toLowerCase();cards.forEach(c=>c.hidden=!!v&&!c.textContent.toLowerCase().includes(v))}});document.querySelectorAll('.sheet').forEach(button=>button.addEventListener('click',()=>{{preview.src=button.dataset.src;preview.alt=button.querySelector('img').alt;label.textContent=button.dataset.label;dialog.showModal()}}));dialog.querySelector('.close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{{if(event.target===dialog)dialog.close()}});</script></body></html>'''


def main() -> None:
    styles = parse_styles()
    sheets = contact_sheets()
    numbers = [item["number"] for item in styles]
    expected = [f"{number:03}" for number in range(1, len(styles) + 1)]
    if numbers != expected:
        raise SystemExit(f"Style source must contain exactly continuous 001–{len(styles):03} entries.")
    STYLE_JSON.parent.mkdir(parents=True, exist_ok=True)
    GALLERY.parent.mkdir(parents=True, exist_ok=True)
    STYLE_JSON.write_text(json.dumps(styles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    GALLERY.write_text(gallery_html(styles, sheets), encoding="utf-8")
    print(f"Built {len(styles)} styles and {len(sheets)} contact sheets.")


if __name__ == "__main__":
    main()
