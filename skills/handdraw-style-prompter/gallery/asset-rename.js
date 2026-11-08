"use strict";
// Offline custom-library rename: only user-owned cards are editable.
// The File System Access picker writes the user-selected library.json; no remote upload.
(() => {
  const cards = [...document.querySelectorAll(".char-card")].filter(card => card.querySelector(".custom-badge"));
  if (!cards.length) return;

  const categories = { "panel-characters": "characters", "panel-props": "props", "panel-scenes": "scenes" };
  const storageKey = "handraw-custom-asset-renames-v1";
  const baseNames = new Map();
  function key(category, id) { return category + ":" + id; }
  function english() { return document.documentElement.lang === "en"; }
  function label(zh, en) { return english() ? en : zh; }
  function readOverrides() {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch { return {}; }
  }
  function writeOverrides(data) {
    try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch { /* file: storage may be disabled */ }
  }
  function assetFor(category, id) {
    const items = window.CUSTOM_ASSETS_DATA && window.CUSTOM_ASSETS_DATA[category];
    return Array.isArray(items) ? items.find(item => item && item.id === id) : undefined;
  }
  function displayName(card, name, nameEn) {
    card.dataset.nameZh = name;
    card.dataset.nameEn = nameEn;
    const title = card.querySelector(".char-name");
    if (title) {
      title.dataset.zh = name;
      title.dataset.en = nameEn;
      title.textContent = english() ? nameEn : name;
    }
    const thumb = card.querySelector(".char-thumb-wrap");
    if (thumb) thumb.setAttribute("aria-label", label("查看 " + name + " 基准图详情", "Preview " + nameEn));
    const img = card.querySelector(".char-thumb-wrap img");
    if (img) img.alt = name;
  }

  const overrides = readOverrides();
  for (const card of cards) {
    const category = categories[card.closest(".asset-panel")?.id];
    const id = card.dataset.id;
    if (!category || !id) continue;
    const asset = assetFor(category, id);
    if (!asset) continue;
    const assetKey = key(category, id);
    baseNames.set(assetKey, String(asset.name || id));
    const override = overrides[assetKey];
    if (override && asset.name === override.previous && typeof override.name === "string") {
      displayName(card, override.name, override.nameEn || override.name);
      asset.name = override.name;
      asset.name_en = override.nameEn || override.name;
    } else if (override) {
      delete overrides[assetKey]; // The regenerated index (or another editor) has won.
    }
  }
  writeOverrides(overrides);

  const style = document.createElement("style");
  style.textContent = `
    .char-card-actions { flex-wrap: wrap; }
    .char-card-actions .rename-asset-btn { flex: 0 0 auto; }
    #asset-rename-dialog { width: min(92vw, 440px); max-width: 440px; padding: 24px;
      border: 0; border-radius: 14px; background: #fff; color: #24211e;
      box-shadow: 0 22px 75px #0004; }
    #asset-rename-dialog::backdrop { background: #0008; }
    #asset-rename-dialog h2 { font-size: 19px; margin: 0 0 8px; }
    #asset-rename-dialog p { font-size: 13px; color: #665f57; line-height: 1.6; }
    #asset-rename-dialog label { display: block; font-size: 13px; font-weight: 700; margin: 15px 0 5px; }
    #asset-rename-dialog input { box-sizing: border-box; width: 100%; border: 1px solid #c9c1b6;
      border-radius: 8px; padding: 10px; font: inherit; }
    #asset-rename-dialog input:focus { outline: 2px solid #b74227; outline-offset: 2px; }
    #asset-rename-dialog .rename-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 16px; }
    #asset-rename-dialog button { cursor: pointer; border-radius: 7px; padding: 9px 12px;
      border: 1px solid #c9c1b6; background: #fff; color: #403a34; font: 700 13px system-ui; }
    #asset-rename-dialog .rename-save { background: #b74227; border-color: #b74227; color: #fff; }
    #asset-rename-dialog button:disabled { opacity: .5; cursor: wait; }
    #asset-rename-status { min-height: 20px; white-space: pre-wrap; overflow-wrap: anywhere; }
  `;
  document.head.appendChild(style);

  const dialog = document.createElement("dialog");
  dialog.id = "asset-rename-dialog";
  dialog.setAttribute("aria-labelledby", "asset-rename-title");
  dialog.innerHTML = `
    <h2 id="asset-rename-title">修改图片名称</h2>
    <p id="asset-rename-help">仅修改显示名称；图片文件、编号和引用保持不变。保存时请选择当前自建图库目录下的 library.json 文件。</p>
    <label for="asset-rename-input">图片名称</label>
    <input id="asset-rename-input" type="text" maxlength="80" autocomplete="off" required>
    <p id="asset-rename-status" role="status" aria-live="polite"></p>
    <div class="rename-actions">
      <button type="button" class="rename-save" id="asset-rename-save">选择 library.json 并保存</button>
      <button type="button" id="asset-rename-copy">复制 AI 修改指令</button>
      <button type="button" id="asset-rename-cancel">关闭</button>
    </div>`;
  document.body.appendChild(dialog);
  const title = dialog.querySelector("#asset-rename-title");
  const help = dialog.querySelector("#asset-rename-help");
  const input = dialog.querySelector("#asset-rename-input");
  const status = dialog.querySelector("#asset-rename-status");
  const save = dialog.querySelector("#asset-rename-save");
  const copy = dialog.querySelector("#asset-rename-copy");
  const cancel = dialog.querySelector("#asset-rename-cancel");
  let selected = null;

  function statusText(zh, en) { status.textContent = label(zh, en); }
  function refreshLabels() {
    cards.forEach(card => {
      const button = card.querySelector(".rename-asset-btn");
      if (button) button.textContent = label("修改名称", "Rename");
    });
    title.textContent = label("修改图片名称", "Rename custom asset");
    help.textContent = label("仅修改显示名称；编号、图片文件和引用不变。保存时选择图库目录中的 library.json。",
      "Changes the display name only. Select library.json in your library folder to save.");
    dialog.querySelector('label[for="asset-rename-input"]').textContent = label("图片名称", "Display name");
    save.textContent = label("选择 library.json 并保存", "Choose library.json and save");
    copy.textContent = label("复制 AI 修改指令", "Copy AI command");
    cancel.textContent = label("关闭", "Close");
  }
  cards.forEach(card => {
    const category = categories[card.closest(".asset-panel")?.id];
    const id = card.dataset.id;
    const actions = card.querySelector(".char-card-actions");
    if (!category || !id || !actions || !assetFor(category, id)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-action rename-asset-btn";
    button.addEventListener("click", () => {
      selected = { card, category, id };
      input.value = card.dataset.nameZh || "";
      status.textContent = "";
      refreshLabels();
      dialog.showModal();
      input.focus();
      input.select();
    });
    actions.insertBefore(button, actions.lastElementChild);
  });
  refreshLabels();
  document.getElementById("lang-btn")?.addEventListener("click", refreshLabels);
  cancel.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); save.click(); }
  });

  function validatedName() {
    const name = input.value.trim();
    if (!name || name.length > 80 || /[\x00-\x1f\x7f]/.test(name)) {
      statusText("请输入 1–80 个字符的有效名称。", "Enter a valid name (1–80 characters).");
      input.focus();
      return null;
    }
    return name;
  }

  copy.addEventListener("click", async () => {
    const name = validatedName();
    if (!name || !selected) return;
    const command = `把自建图库中的 ${selected.id} 名称修改为：${name}`;
    try {
      await navigator.clipboard.writeText(command);
      statusText("已复制。可粘贴到 Codex / AI 客户端，由 custom-asset-manager 保存并刷新图库。",
        "Copied. Paste into your AI coding assistant to save and refresh the gallery.");
    } catch {
      status.textContent = command;
    }
  });

  save.addEventListener("click", async () => {
    if (!selected) return;
    const name = validatedName();
    if (!name) return;
    if (typeof window.showOpenFilePicker !== "function") {
      statusText("此浏览器不支持直接写入本地文件。请使用“复制 AI 修改指令”，或运行 custom_library_manager.py rename。",
        "File editing is unavailable in this browser. Use Copy AI command or the Python rename CLI.");
      return;
    }
    save.disabled = true;
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "HandRaw library.json", accept: { "application/json": [".json"] } }]
      });
      if (!handle || handle.name !== "library.json") {
        throw new Error(label("请选择自建图库根目录中的 library.json。", "Choose your library's library.json."));
      }
      const manifest = JSON.parse(await (await handle.getFile()).text());
      const entries = manifest?.[selected.category];
      if (!Array.isArray(entries)) throw new Error(label("所选文件不是有效的图库清单。", "Invalid library manifest."));
      const entry = entries.find(item => item && String(item.id).toUpperCase() === selected.id.toUpperCase());
      if (!entry) throw new Error(label("所选图库未包含该资产，请检查目录。", "Asset not found in the selected library."));
      if (entry.name !== selected.card.dataset.nameZh) {
        throw new Error(label("图库名称已被其他操作更新，请刷新图库索引后再编辑。",
          "This name was changed elsewhere. Refresh the gallery index first."));
      }
      const old = entry.name;
      entry.name = name;
      if (!entry.name_en || entry.name_en === old) entry.name_en = name;
      entry.updated_at = new Date().toISOString().slice(0, 10);
      const writer = await handle.createWritable();
      try {
        await writer.write(JSON.stringify(manifest, null, 2) + "\n");
        await writer.close();
      } catch (error) {
        try { await writer.abort(); } catch { /* ignored */ }
        throw error;
      }
      const assetKey = key(selected.category, selected.id);
      const asset = assetFor(selected.category, selected.id);
      if (asset) { asset.name = name; asset.name_en = entry.name_en; }
      displayName(selected.card, name, entry.name_en);
      const cache = readOverrides();
      cache[assetKey] = { previous: baseNames.get(assetKey), name, nameEn: entry.name_en };
      writeOverrides(cache);
      input.value = name;
      statusText("已保存到 library.json，当前卡片已更新。下次 Skill 刷新图库索引后会永久同步到离线页面。",
        "Saved to library.json and updated this card. The next Skill gallery sync will refresh the offline index.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        status.textContent = label("保存失败：", "Save failed: ") + (error?.message || String(error));
      }
    } finally {
      save.disabled = false;
    }
  });
})();