#!/usr/bin/env python3
"""Build the visual Inspirations Vault showcase gallery page for the offline Skill."""
from __future__ import annotations

from pathlib import Path

from brand_assets import BRAND_HEAD_TAGS, BRAND_NAV_CSS, BRAND_NAV_HTML

SKILL = Path(__file__).resolve().parents[1]
GALLERY = SKILL / "gallery" / "inspirations.html"


def inspirations_html() -> str:
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>灵感库画廊 - 手绘风</title>
{BRAND_HEAD_TAGS}
<style>
:root{{color:#24211e;background:#f7f5f0;font:16px/1.5 system-ui,"Microsoft YaHei",sans-serif}}
body{{margin:0}}
main{{max-width:1440px;margin:auto;padding:18px 30px 42px}}
.sticky-header{{position:sticky;top:0;z-index:100}}
.site-nav{{display:flex;align-items:center;gap:10px;margin:0;padding:12px 30px;border-bottom:1px solid #ded8cf;background:#fffdf9}}
{BRAND_NAV_CSS}
.site-nav a{{border:1px solid #9e9185;border-radius:8px;background:#fff;color:#403a34;padding:7px 13px;text-decoration:none;font-weight:800;line-height:1.2;transition:background .15s,color .15s,border-color .15s}}
.site-nav a:hover{{border-color:#b74227;background:#fff0eb;color:#9f351f}}
.site-nav a[aria-current="page"]{{border-color:#b74227;background:#b74227;color:#fff;box-shadow:0 1px 3px #b7422744}}
.nav-right{{margin-left:auto;display:flex;align-items:center;gap:8px}}
.nav-ext{{display:inline-flex;align-items:center;font-weight:700}}
.nav-cta{{border-color:#b74227!important;background:#fff4ef!important;color:#9f351f!important}}
.nav-cta:hover{{background:#b74227!important;color:#fff!important}}
.nav-btn{{border:1px solid #9e9185;border-radius:8px;background:#fff;color:#403a34;padding:7px 13px;font:inherit;font-weight:700;line-height:1.2;cursor:pointer;transition:background .15s,color .15s,border-color .15s}}
.nav-btn:hover{{border-color:#b74227;background:#fff0eb;color:#9f351f}}
.nav-btn:focus-visible,.site-nav a:focus-visible{{outline:3px solid #d67d4d;outline-offset:3px}}
.sub-nav{{display:flex;gap:8px;align-items:center;padding:9px 30px;background:#faf7f2;border-bottom:1px solid #ded8cf;overflow-x:auto}}
.filter{{display:inline-flex;align-items:center;gap:6px;border:1px solid #c9c1b6;border-radius:6px;background:#fff;color:#514a43;padding:5px 12px;font:inherit;font-size:13.5px;font-weight:600;line-height:1.4;cursor:pointer;white-space:nowrap;transition:all .15s}}
.filter:hover{{border-color:#b74227;color:#b74227;background:#fff8f5}}
.filter.is-active{{border-color:#b74227;background:#b74227;color:#fff;box-shadow:0 1px 3px rgba(183,66,39,0.3)}}
.gallery-title-bar{{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:0 0 14px}}
.gallery-title-bar h1{{margin:0;font-size:26px;font-weight:800;color:#24211e;line-height:1.2}}
.gallery-actions{{display:flex;align-items:center;gap:10px;flex-wrap:wrap}}
.pill-link{{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:999px;border:1px solid #b74227;background:#b74227;color:#fff;font-size:13px;font-weight:700;text-decoration:none;transition:background .15s}}
.pill-link:hover{{background:#9f351f}}
.pill-link.secondary{{background:#fffdf9;color:#403a34;border-color:#c9c1b6}}
.pill-link.secondary:hover{{border-color:#b74227;color:#9f351f;background:#fff4ef}}
.insp-masonry{{--columns:5;--gap:14px;display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:var(--gap);align-items:start}}
.masonry-column{{display:flex;flex-direction:column;gap:var(--gap);min-width:0}}
.insp-card{{display:block;width:100%;margin:0;padding:0;border:1px solid #e3dcd0;border-radius:12px;background:#fffdf9;overflow:hidden;cursor:zoom-in;text-align:left;box-shadow:0 1px 6px rgba(34,27,20,0.06);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}}
.insp-card:hover{{transform:translateY(-2px);border-color:#d98e7a;box-shadow:0 8px 22px rgba(183,66,39,0.12)}}
.insp-media{{position:relative;width:100%;background:#efeae0;overflow:hidden}}
.insp-media img{{display:block;width:100%;height:auto}}
.insp-price-pill{{position:absolute;top:8px;left:8px;padding:2px 8px;border-radius:999px;background:rgba(23,21,19,0.78);color:#fffdf9;font-size:11px;font-weight:700;backdrop-filter:blur(4px)}}
.insp-price-pill.is-free{{background:rgba(47,93,80,0.88)}}
.insp-meta{{padding:9px 11px 10px;display:flex;flex-direction:column;gap:3px}}
.insp-title{{font-size:13.5px;font-weight:750;color:#24211e;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
.insp-sub{{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11.5px;color:#7a7268}}
.insp-state{{margin:36px auto;max-width:520px;padding:28px 24px;border:1px solid #ded8cf;border-radius:14px;background:#fffdf9;text-align:center;color:#514a43}}
.insp-state h2{{margin:0 0 8px;font-size:18px;color:#24211e}}
.insp-state p{{margin:0 0 16px;font-size:13.5px;line-height:1.6}}
dialog#preview{{width:min(94vw,960px);max-height:94vh;padding:18px;border:0;border-radius:14px;background:#171513;color:#fff;box-shadow:0 20px 70px #0008;box-sizing:border-box}}
dialog::backdrop{{background:#000b}}
.dialog-content{{display:flex;flex-direction:column;max-height:86vh}}
.dialog-image-box{{display:flex;align-items:center;justify-content:center;min-height:0;flex:1 1 auto;overflow:hidden}}
dialog img{{display:block;max-width:100%;max-height:66vh;margin:auto;object-fit:contain;border-radius:8px}}
.dialog-body{{margin-top:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0}}
.dialog-title-row{{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}}
.dialog-title{{margin:0;font-size:17px;font-weight:750;color:#fff}}
.dialog-sub{{font-size:13px;color:#c4bbb0}}
.dialog-actions{{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}}
.action-link,.close{{border:0;border-radius:7px;padding:8px 14px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px;line-height:1.25;transition:background .15s,border-color .15s}}
.action-link-primary{{background:#b74227;color:#fff}}
.action-link-primary:hover{{background:#cf4f33}}
.action-link-secondary{{background:#38332c;color:#ded8cf;border:1px solid #544d44}}
.action-link-secondary:hover{{background:#4a443b;color:#fff}}
.close{{background:#332f2b;color:#ded8cf;margin-left:auto}}
.close:hover{{background:#47423d;color:#fff}}
[hidden]{{display:none!important}}
@media(max-width:1280px){{.insp-masonry{{--columns:4}}}}
@media(max-width:960px){{.insp-masonry{{--columns:3}}}}
@media(max-width:720px){{main{{padding:14px 16px 28px}} .site-nav{{padding:10px 16px;flex-wrap:wrap;gap:8px}} .nav-right{{width:100%;justify-content:flex-start;gap:6px;margin-left:0}} .site-nav a,.nav-btn{{padding:6px 10px;font-size:13px}} .sub-nav{{padding:8px 16px}} .insp-masonry{{--columns:2;--gap:10px}}}}
@media(max-width:420px){{.insp-masonry{{--columns:2;--gap:8px}}}}
</style>
<script src="showcase-cache.js"></script>
</head><body>
<header class="sticky-header">
<nav class="site-nav" aria-label="画廊导航">{BRAND_NAV_HTML}<a href="index.html" data-i18n="stylesNav">风格画廊</a><a href="layouts.html" data-i18n="layoutsNav">图型画廊</a><a href="colors.html" data-i18n="colorsNav">色彩画廊</a><a href="inspirations.html" aria-current="page" data-i18n="inspirationsNav">灵感库</a><a href="assets.html" data-i18n="assetsNav">自建图库</a><a href="tutorials.html" data-i18n="tutorialsNav">提示词</a><div class="nav-right"><a class="nav-ext nav-cta" href="https://studio.handraw-style.com/?entry=quick&amp;utm_source=skill_gallery_nav" target="_blank" rel="noopener noreferrer" data-i18n="webStudioNav">✨ 在线生图</a><a class="nav-ext" href="https://handraw-style.com/?view=download&amp;utm_source=skill_gallery_nav" target="_blank" rel="noopener noreferrer" data-i18n="desktopAppNav">💻 桌面客户端</a><a class="nav-ext" href="https://github.com/yang0/handraw-style" target="_blank" rel="noopener noreferrer" title="GitHub 仓库"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:-2px;margin-right:4px" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a><button class="nav-btn" id="lang-btn" type="button" aria-label="Switch Language">🌐 EN / 中</button></div></nav>
<nav class="sub-nav" id="tag-filters" aria-label="灵感标签" hidden></nav>
</header>
<main>
<div class="gallery-title-bar">
<h1 data-i18n="title">灵感库</h1>
<div class="gallery-actions">
<a class="pill-link" href="https://handraw-style.com/?view=inspirations&amp;utm_source=skill_inspirations_top" target="_blank" rel="noopener noreferrer" data-i18n="openWebAll">去官网逛完整灵感库 ↗</a>
<a class="pill-link secondary" href="https://handraw-style.com/?view=download&amp;utm_source=skill_inspirations_top" target="_blank" rel="noopener noreferrer" data-i18n="getDesktop">下载电脑版同步收藏 ↗</a>
</div>
</div>
<section id="insp-state" class="insp-state" role="status">
<h2 data-i18n="loadingTitle">正在载入精选灵感图…</h2>
<p data-i18n="loadingSub">联网后会自动同步最新社区灵感图并缓存到本地。</p>
</section>
<section id="insp-grid" class="insp-masonry" hidden></section>
</main>
<dialog id="preview" aria-labelledby="dialog-title">
<div class="dialog-content">
<div class="dialog-image-box"><img id="preview-image" referrerpolicy="no-referrer" alt=""></div>
<div class="dialog-body">
<div class="dialog-title-row"><h3 class="dialog-title" id="dialog-title"></h3><span class="dialog-sub" id="dialog-sub"></span></div>
<div class="dialog-actions">
<a class="action-link action-link-primary" id="dialog-unlock-link" href="https://handraw-style.com/?view=inspirations&amp;utm_source=skill_inspirations" target="_blank" rel="noopener noreferrer" data-i18n="unlockBtn">🔓 去官网解锁提示词（新号送积分）↗</a>
<a class="action-link action-link-secondary" id="dialog-client-dl" href="https://handraw-style.com/?view=download&amp;utm_source=skill_inspirations" target="_blank" rel="noopener noreferrer" data-i18n="desktopBtn">💻 下载电脑版</a>
<button class="close" type="button" data-i18n="closeBtn">关闭 ×</button>
</div>
</div>
</div>
</dialog>
<script>
const grid = document.querySelector('#insp-grid');
const stateBox = document.querySelector('#insp-state');
const tagNav = document.querySelector('#tag-filters');
const dialog = document.querySelector('#preview');
const previewImg = document.querySelector('#preview-image');
const dialogTitle = document.querySelector('#dialog-title');
const dialogSub = document.querySelector('#dialog-sub');
const unlockLink = document.querySelector('#dialog-unlock-link');
const langBtn = document.querySelector('#lang-btn');

const I18N = {{
  zh: {{
    pageTitle: "灵感库画廊 - 手绘风",
    stylesNav: "风格画廊",
    layoutsNav: "图型画廊",
    colorsNav: "色彩画廊",
    inspirationsNav: "灵感库",
    assetsNav: "自建图库",
    tutorialsNav: "提示词",
    webStudioNav: "✨ 在线生图",
    desktopAppNav: "💻 桌面客户端",
    title: "灵感库",
    openWebAll: "去官网逛完整灵感库 ↗",
    getDesktop: "下载电脑版同步收藏 ↗",
    allTag: "全部",
    loadingTitle: "正在载入精选灵感图…",
    loadingSub: "联网后会自动同步最新社区灵感图并缓存到本地。",
    offlineTitle: "当前离线且尚无本地缓存",
    offlineSub: "联网打开一次后会自动缓存缩略图到本地，之后离线也能随时浏览。",
    unlockBtn: "🔓 去官网解锁提示词（新号送积分）↗",
    desktopBtn: "💻 下载电脑版",
    closeBtn: "关闭 ×",
    langBtn: "🌐 English"
  }},
  en: {{
    pageTitle: "Inspirations Gallery - Handraw",
    stylesNav: "Styles",
    layoutsNav: "Layouts",
    colorsNav: "Colors",
    inspirationsNav: "Inspirations",
    assetsNav: "Custom Library",
    tutorialsNav: "Prompts",
    webStudioNav: "✨ Web Studio",
    desktopAppNav: "💻 Desktop App",
    title: "Inspirations Vault",
    openWebAll: "Open Full Vault on Web ↗",
    getDesktop: "Get Desktop Client ↗",
    allTag: "All",
    loadingTitle: "Loading curated inspirations…",
    loadingSub: "Latest community inspirations sync silently and cache locally.",
    offlineTitle: "Offline with no local cache yet",
    offlineSub: "Open once while online to cache thumbnails locally for offline browsing.",
    unlockBtn: "🔓 Unlock Prompt on Web ↗",
    desktopBtn: "💻 Desktop Client",
    closeBtn: "Close ×",
    langBtn: "🌐 中文"
  }}
}};

let currentLang = localStorage.getItem('handdraw_lang') || ((navigator.language && navigator.language.startsWith('zh')) ? 'zh' : 'en');
let allItems = [];
let activeTag = 'all';
let activeItem = null;
let layoutFrame = 0;

function applyLang(lang) {{
  currentLang = lang;
  localStorage.setItem('handdraw_lang', lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = I18N[lang].pageTitle;
  document.querySelectorAll('[data-i18n]').forEach(el => {{
    const k = el.dataset.i18n;
    if (I18N[lang][k]) el.textContent = I18N[lang][k];
  }});
  if (langBtn) langBtn.textContent = I18N[lang].langBtn;
  renderTags();
  renderGrid();
  if (activeItem) updateDialog(activeItem);
}}
if (langBtn) langBtn.addEventListener('click', () => applyLang(currentLang === 'zh' ? 'en' : 'zh'));

function updateDialog(item) {{
  const t = I18N[currentLang] || I18N.zh;
  dialogTitle.textContent = item.title || '';
  const priceText = currentLang === 'en' ? (item.priceLabelEn || '') : (item.priceLabel || '');
  dialogSub.textContent = [priceText, item.authorName || ''].filter(Boolean).join(' · ');
  if (unlockLink) {{
    unlockLink.href = window.HandrawShowcaseCache.safeHref(item.unlockUrl, 'https://handraw-style.com/?view=inspirations&utm_source=skill_inspirations');
    unlockLink.textContent = t.unlockBtn;
  }}
}}

function openItem(item) {{
  activeItem = item;
  previewImg.referrerPolicy = 'no-referrer';
  previewImg.src = window.HandrawShowcaseCache.safeHref(item.image || item.thumbImage, '');
  previewImg.alt = item.title || '';
  updateDialog(item);
  dialog.showModal();
}}

function renderTags() {{
  if (!allItems.length) {{ tagNav.hidden = true; return; }}
  const counts = new Map();
  allItems.forEach(it => (it.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  const topTags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
  if (!topTags.length) {{ tagNav.hidden = true; return; }}
  tagNav.replaceChildren();
  const makeBtn = (key, label) => {{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter' + (activeTag === key ? ' is-active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {{ activeTag = key; renderTags(); renderGrid(); }});
    return btn;
  }};
  tagNav.append(makeBtn('all', `${{(I18N[currentLang] || I18N.zh).allTag}} (${{allItems.length}})`));
  topTags.forEach(tag => tagNav.append(makeBtn(tag, `#${{tag}}`)));
  tagNav.hidden = false;
}}

let cardNodes = [];
function scheduleMasonry() {{
  if (!layoutFrame) layoutFrame = requestAnimationFrame(layoutMasonry);
}}
function layoutMasonry() {{
  layoutFrame = 0;
  if (!cardNodes.length) return;
  const count = Number(getComputedStyle(grid).getPropertyValue('--columns')) || 2;
  const gap = parseFloat(getComputedStyle(grid).getPropertyValue('--gap')) || 12;
  const cols = Array.from({{ length: count }}, () => {{
    const c = document.createElement('div');
    c.className = 'masonry-column';
    return c;
  }});
  grid.replaceChildren(...cols);
  const heights = Array(count).fill(0);
  cardNodes.forEach(card => {{
    const idx = heights.indexOf(Math.min(...heights));
    cols[idx].append(card);
    heights[idx] += card.getBoundingClientRect().height + gap;
  }});
}}

function renderGrid() {{
  const visible = activeTag === 'all' ? allItems : allItems.filter(it => (it.tags || []).includes(activeTag));
  if (!visible.length) return;
  stateBox.hidden = true;
  grid.hidden = false;
  cardNodes = visible.map(item => {{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'insp-card';
    btn.setAttribute('aria-label', item.title || 'Inspiration');

    const media = document.createElement('div');
    media.className = 'insp-media';
    const img = document.createElement('img');
    img.alt = item.title || '';
    img.loading = 'lazy';
    img.addEventListener('load', scheduleMasonry);
    window.HandrawShowcaseCache.attachImage(img, item.thumbImage, item.image);
    const pill = document.createElement('span');
    pill.className = 'insp-price-pill' + (item.price > 0 ? '' : ' is-free');
    pill.textContent = item.price > 0
      ? (currentLang === 'en' ? `🔒 ${{item.price}} pts` : `🔒 ${{item.price}} 积分`)
      : (currentLang === 'en' ? '✨ Free' : '✨ 免费');
    media.append(img, pill);

    const meta = document.createElement('div');
    meta.className = 'insp-meta';
    const titleEl = document.createElement('div');
    titleEl.className = 'insp-title';
    titleEl.textContent = item.title || '';
    const sub = document.createElement('div');
    sub.className = 'insp-sub';
    const auth = document.createElement('span');
    auth.textContent = item.authorName || '';
    const hint = document.createElement('span');
    hint.textContent = currentLang === 'en' ? 'Unlock →' : '解锁提示词 →';
    sub.append(auth, hint);
    meta.append(titleEl, sub);

    btn.append(media, meta);
    btn.addEventListener('click', () => openItem(item));
    return btn;
  }});
  scheduleMasonry();
}}

dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => {{ if (e.target === dialog) dialog.close(); }});
window.addEventListener('resize', scheduleMasonry);
applyLang(currentLang);

window.HandrawShowcaseCache.load({{ kind: 'style', exclusiveLimit: 18, inspirationLimit: 36 }}, (data, meta) => {{
  if (data && Array.isArray(data.inspirations) && data.inspirations.length) {{
    allItems = data.inspirations;
    renderTags();
    renderGrid();
  }} else if (meta && meta.offline && !allItems.length) {{
    const t = I18N[currentLang] || I18N.zh;
    stateBox.hidden = false;
    stateBox.querySelector('h2').textContent = t.offlineTitle;
    stateBox.querySelector('p').textContent = t.offlineSub;
  }}
}});
</script>
<script src="local-navigation.js" defer></script>
</body></html>'''


def main() -> None:
    GALLERY.parent.mkdir(parents=True, exist_ok=True)
    GALLERY.write_text(inspirations_html(), encoding="utf-8")
    print(f"Built inspirations gallery: {GALLERY}")


if __name__ == "__main__":
    main()
