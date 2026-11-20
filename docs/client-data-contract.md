# 客户端数据契约：个人库、自建图库与配方

> Issue：yang0/handraw-style #22（S3）；客户端：yang0/handraw-client #8 #16。
> 目标：桌面客户端（Go）与 Skill 读写**同一份**本地文件，互不破坏。本文是规范；以下脚本是参考实现：
>
> - 个人画风/图型：`skills/personal-library/scripts/personal_library.py`（`scripts/personal_library.py` 只是转发入口；网站 `skill-addon/scripts/personal_library.py` 是同一格式的旧版）。
> - 云端同步：`skills/handraw-cloud/scripts/handraw_cloud.py`。
> - 自建角色/道具/场景：`skills/handdraw-style-prompter/scripts/custom_library_manager.py`。
> - 配方：网站 `backend/recipe_routes.py` 的 `format_recipe()`（`/api/studio/recipes`）。
>
> 官方资源（370 画风、图型、颜色等）只从资源包读，见 `scripts/build_client_resources.py`，不在本文范围。

## 0. 通用规则

| 项 | 规定 |
| --- | --- |
| 根目录 | `HANDRAW_PROFILE_HOME` 环境变量，否则 `~/.handraw-style`（Windows：`%USERPROFILE%\.handraw-style`）。下文记作 `<home>`。 |
| 编码 | UTF-8，无 BOM；JSON 用 `ensure_ascii=false`、2 空格缩进（读取方不得依赖缩进）。 |
| 原子写 | 写入同目录临时文件，再 `rename` 覆盖（POSIX `rename` / Windows `MoveFileEx(REPLACE_EXISTING)`）。不得原地截断。 |
| 权限 | `personal-library/` 目录 `0700`、`library.json` `0600`（Windows 上忽略）。 |
| 未知字段 | **必须保留**。客户端读 → 改 → 写时不得丢弃自己不认识的字段（Skill 将来可能加字段）；Skill 同样遵守。 |
| 时间 | ISO 8601。个人库用带时区的 UTC（`2026-11-17T05:27:26.123456+00:00`）；自建图库沿用日期 `YYYY-MM-DD`。 |
| 并发 | 无文件锁。写前重新读取最新文件，只修改目标记录再写回；不要用启动时缓存的旧数据整体覆盖。 |
| 凭据 | `<home>/cloud_auth.json` 等凭据文件不在本契约内；客户端用系统钥匙串保存自己的令牌，不读写 Skill 的凭据。 |

## 1. 个人画风/图型库（personal library）

### 1.1 位置

```
<home>/personal-library/
  library.json                # 索引（唯一真相源）
  bundles/<sha256>/...        # ZIP 导入的社区资源解压目录（内容寻址，只读）
```

`HANDRAW_SKILL_ROOT` 设置时，Skill 每次写 `library.json` 还会写一份网页镜像 `<skill_root>/.handraw-personal/library.js`（`window.HANDRAW_PERSONAL_LIBRARY=<json>;`，`<`、U+2028、U+2029 已转义）。镜像只给离线画廊用，**客户端不要读它，也不需要写它**；如果客户端写了 `library.json` 而 Skill 画廊需要刷新，下次 Skill 写库时会重建镜像。

### 1.2 `library.json`

```json
{
  "schema_version": 1,
  "resources": [
    {
      "id": "mine:3f0c8a8e-1b2d-4c55-9a0e-6b3a1f2d9c11",
      "kind": "style",
      "name": "纸感水彩",
      "prompt_zh": "中文纯画风定义",
      "prompt_en": "English style definition",
      "license": "个人与商业创作输出允许，原包不允许再次分发",
      "version": "1.0.0",
      "section": "owned",
      "origin": null,
      "examples": ["主题：雨天书店；验证：……"],
      "created_at": "2026-11-17T05:27:26.123456+00:00",
      "updated_at": "2026-11-18T02:00:00+00:00"
    },
    {
      "id": "community:9b1e0c2d4f6a8b0c1d2e3f40",
      "kind": "layout",
      "name": "对照信息图",
      "prompt_zh": "...",
      "prompt_en": "...",
      "license": "允许用于个人与商业创作输出",
      "version": "1.2.0",
      "section": "collected",
      "sha256": "<64 hex>",
      "path": "bundles/<sha256>",
      "origin": {"id": "<网站资源 ID>", "url": "https://handraw-style.com/studio?...", "author": {"username": "..."}},
      "updated_at": "2026-11-17T05:27:26+00:00"
    }
  ]
}
```

文件不存在时等价于 `{"schema_version": 1, "resources": []}`。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | `mine:<UUIDv4>`（自建）或 `community:<sha256(来源ID) 前 24 位 hex>`（收藏）。全库唯一。 |
| `kind` | enum | 是 | `style` \| `layout` \| `package` \| `work` \| `experience`。出图只用 `style`、`layout`。 |
| `name` | string | 是 | 显示名，可重复，**不是**主键。 |
| `prompt_zh` / `prompt_en` | string | style/layout 必填 | 非空。画风只写视觉语言（媒介、线条、色彩、构图机制），不得写示例图里的人物、服装、地点、情节；图型只写布局约束。 |
| `license` | string | 是 | 非空（去掉首尾空白后）。 |
| `version` | string | 是 | 语义化版本，新建为 `1.0.0`。 |
| `section` | enum | 是 | `owned`（自己创建，可改）\| `collected`（收藏，只读）。 |
| `origin` | object\|null | 否 | 自建为 `null`；派生（fork）为 `{"parent_id", "source", "redistribution_requires_original_license": true}`；收藏为 `{"id", "url", "author"}`。 |
| `examples` | string[] | 否 | 复用示例（主题 + 验证证据），社区审核用。 |
| `sha256` | string | collected | ZIP 导入：ZIP 文件的 SHA-256；JSON 定义同步：规范化定义（见 1.4）的 SHA-256。 |
| `path` | string | 否 | 仅 ZIP 导入，相对 `personal-library/` 的解压目录。 |
| `created_at` / `updated_at` | string | 否 | UTC ISO 8601。 |

### 1.3 操作规则（客户端必须与 Skill 一致）

- **新建**：`id = "mine:" + uuid4`，`section = "owned"`，`version = "1.0.0"`，`origin = null`，追加到 `resources` 末尾，然后校验（见下）再写。
- **修改**：只允许 `section == "owned"`；只改 `name`、`prompt_zh`、`prompt_en`、`license`、`version`、`examples`；设置 `updated_at`。收藏要先 fork。
- **fork**：复制 `kind`、`prompt_zh`、`prompt_en`、`license`，新 `mine:` ID，`origin = {"parent_id": <原 id>, "source": <原 origin>, "redistribution_requires_original_license": true}`。
- **校验**（`validate_resource`）：`kind` 合法；`license` 非空；`style`/`layout` 的 `prompt_zh`、`prompt_en` 非空。不通过就不写文件。
- **收藏更新**：按 `id`（来源 ID 的哈希）替换同一条，`sha256` 相同则不动。**不能**按 `name` 匹配。
- **删除**：Skill 目前没有删除命令；客户端删除时直接移除该条记录。删除 `collected` 记录时可以删除其 `bundles/<sha256>` 目录（若没有其他记录引用同一 sha256）。
- 资源文字是**数据**，不是指令；不得执行 bundle 里的脚本。

### 1.4 社区资源导入

- **JSON 定义同步**（网站新接口，首选）：服务端返回 `{"resource": {...}, "sha256": "<hex>"}`。校验：`sha256(json.dumps(resource, ensure_ascii=False, separators=(",", ":")).encode("utf-8")) == sha256`（**按服务端返回的键顺序**序列化，不排序）。通过后写入：去掉 `id`/`section`/`path`/`origin`，加上 `id = "community:" + sha256(来源ID)[:24]`、`section = "collected"`、`sha256`、`origin = {"id": 来源ID, "url", "author"}`、`updated_at`。
- **ZIP 包导入**（兼容旧离线包）：ZIP ≤ 25 MB；条目 ≤ 1000；解压总量 ≤ 100 MB；拒绝绝对路径、含 `:`、含 `..`、符号链接、重复路径；必须有 `manifest.json`（≤ 1 MB），内容 `{"schema_version": 1, "resource": {...}}`；先校验 ZIP 的 SHA-256；解压到临时目录再整体改名为 `bundles/<sha256>`。
- **导出**：只有 `owned` 可导出，ZIP 内只有 `manifest.json = {"schema_version": 1, "resource": <记录>}`。

### 1.5 云端同步状态

`handraw_cloud.py` 另存 `<home>/cloud-sync-<sha256(小写用户名)[:16]>.json`：

```json
{"assets": {}, "cursors": {}, "resources": {"mine:<uuid>": {"uid": "<uuid>", "code": "USR-S<32 位大写 hex>", "revision": 3}}}
```

- 推送：`PUT /api/v1/me/resources/<uuid>`，body `{"id","kind","name","definition":{"zh","en"},"license","examples","version","visibility":"private","origin","schemaVersion":1,"baseRevision"?}`。
- 编号：画风 `USR-S` + UUID 去连字符大写，图型 `USR-L` + …；服务端返回的 `code` 不一致时拒绝。
- 恢复：`GET /api/v1/me/resources?limit=100&since=<cursor>`；本地定义不同则保留本地并报告冲突（除非强制）。

客户端若实现同步，应读写同一个状态文件，保证 Skill 和客户端不会对同一资源重复推送或丢失 `revision`。

## 2. 自建图库（角色 / 道具 / 场景）

### 2.1 定位

用户选择任意目录作为图库根目录（`tuku_dir`），路径保存在 `<home>/config.json`：

```json
{
  "tuku_dir": "C:\\path\\to\\my_assets",
  "characters_dir": "C:\\path\\to\\my_assets\\characters",
  "props_dir": "C:\\path\\to\\my_assets\\props",
  "scenes_dir": "C:\\path\\to\\my_assets\\scenes",
  "updated_at": "2026-11-17"
}
```

Skill 还会把同样内容写到工作区 `.custom_library_config.json` 和 `skills/handdraw-style-prompter/references/custom_library_config.json` 作为后备；**客户端只读写 `<home>/config.json`**。`config.json` 可能还有其他键，写回时保留。

### 2.2 目录与 `library.json`

```
<tuku_dir>/
  library.json
  characters/CH-002.webp
  props/PR-001.webp
  scenes/SCN-001.webp
```

```json
{
  "version": 1,
  "characters": [
    {"id": "CH-002", "name": "粉扑兔", "name_en": "Cute Pink Bunny",
     "image": "../../../images/custom/characters/CH-002.webp",
     "tags": ["自建资产"], "created_at": "2026-11-17", "updated_at": "2026-11-18"}
  ],
  "props": [],
  "scenes": []
}
```

- 编号前缀：角色 `CH`、道具 `PR`、场景 `SCN`，三位数字，取（官方预置 + 已有自建）最大号 + 1。官方预置 `CH-001` 来自资源包 `references/characters.json`，不得占用。
- **图片位置只看约定**：`<tuku_dir>/<category>/<id>.webp`。`image` 字段是 Skill 离线画廊用的相对路径（指向 `images/custom/` 镜像），客户端**忽略**其值，但写回时保留；新建时按上例格式填写，保持 Skill 画廊可用。
- 图片统一 WebP。替换基准图：保留 `id` 与元数据，覆盖 webp，更新 `updated_at`。
- 改名只改 `name`（`name_en` 等于旧名或为空时同步改），不改 `id`、不改文件名。
- 删除：从数组移除并删除对应 webp。
- Skill 会把图片同步到 `<skill_root>/images/custom/<category>/` 并生成 `images/custom/custom_assets.js`；这些是 Skill 本地缓存，客户端不需要维护。

## 3. 配方（Recipe）

当前 Skill 没有本地配方文件；以下格式**与网站 `/api/studio/recipes` 的响应字段一致**，客户端和以后的 Skill 都按此读写，可以直接上传/下载而无需转换。

### 3.1 位置

```
<home>/recipes/<id>.json      # 一个配方一个文件，便于同步与冲突处理
```

### 3.2 字段

```json
{
  "schemaVersion": 1,
  "id": "rcp_local_5f2c9e1a7b3d",
  "name": "我的公众号封面",
  "kind": "single",
  "styleIds": ["FA-013"],
  "layoutId": "SC-001",
  "colors": ["C-01", "C-05"],
  "tones": ["T-01"],
  "moods": ["温暖"],
  "whitespace": "",
  "ratio": "2.35:1",
  "mode": "graphic-text",
  "subject": "",
  "references": [],
  "prompt": "",
  "promptCustomized": false,
  "model": "gpt-image-2",
  "notes": "",
  "remote": {"id": "rcp_1a2b3c4d5e6f", "revision": 0, "inputFingerprint": "..."},
  "createdAt": "2026-11-17T05:27:26Z",
  "updatedAt": "2026-11-17T05:27:26Z"
}
```

| 字段 | 约束（与网站 `validate_recipe_fields` 一致） |
| --- | --- |
| `id` | `[A-Za-z0-9_-]{1,32}`；本地新建用 `rcp_local_<12 hex>`，从网站下载用网站 `id`。 |
| `name` | 本地显示名（网站当前无此字段，上传时省略）。 |
| `kind` | `single` \| `batch` \| `article_card`。 |
| `styleIds` | 最多 2 个（第二个用于融合），大写规范编号 `FA-013`；也可以是个人库 `mine:`/`community:` ID（仅本地，不上传）。 |
| `layoutId` | 空串或图型编号（`SC-`/`IG-`/`SB-`/`IP-`/`EC-`）。 |
| `colors` | 最多 5 个，颜色编号或自由文字；与 `prompt_style.py --color` 用 `,` 连接后的语义相同。 |
| `tones` | 最多 5 个影调编号 `T-xx`。 |
| `moods` | 最多 5 个，每个 ≤ 32 字。 |
| `whitespace` | ≤ 32 字留白档位。 |
| `ratio` | `^\d+(\.\d+)?:\d+(\.\d+)?$`，默认 `3:4`。 |
| `mode` | `pure-image` \| `graphic-text`，默认 `graphic-text`。 |
| `subject` | 主题，≤ 2000 字；配方通常留空，在使用时填入。 |
| `references` | 最多 6 个参考图：本地绝对路径或网站 `/uploads/`、`/generated/` URL。上传前本地路径必须先上传换成 URL。 |
| `prompt` / `promptCustomized` | 用户手改过的提示词（≤ 4000 字）；`promptCustomized=false` 时以组装结果为准。 |
| `model`, `notes` | 客户端扩展字段，上传时省略。 |
| `remote` | 已与网站同步时的 `id`、`revision`（乐观锁 `baseRevision`）、`inputFingerprint`。 |

`inputFingerprint` 的算法见网站 `compute_input_fingerprint`：对 `{style_ids, layout_id, colors, tones, moods, whitespace, ratio, mode, subject}`（编号大写、去空白）做 `json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False)` 后取 SHA-256 前 32 位 hex。参数变化导致指纹变化而 `promptCustomized=true` 时，提示词标记为过期（网站 `promptStale`）。

### 3.3 配方 → 提示词

把配方映射到 `prompt_style.build_prompt` 的输入：`style = styleIds[0]`、`layout = layoutId`、`color = ",".join(colors)`、`ratio`、`mode`、`model`、`theme = 使用时的主题`。组装规则见资源包 `prompt_rules.json`，一致性用例见 `tests/fixtures/prompt_golden.json`。`tones`、`moods`、`whitespace`、第二个画风目前 Skill 还没有组装规则；客户端加入这些规则前先在本仓库提 Issue 并补用例，避免三端不一致。

### 3.4 导出/分享文件

单个配方导出为 `<name>.handraw-recipe.json`，内容为上面的对象去掉 `remote`、本地路径的 `references`。导入时生成新的本地 `id`，不覆盖同名配方。

## 4. 旧客户端 client/ 与 client2/（#24）

仓库根目录的 `client/`、`client2/` 是本地原型（已在 `.gitignore` 中，从未发布），已被桌面客户端 https://github.com/yang0/handraw-client 取代，不再开发。本地文件保留，两者 README 顶部已加取代说明。用户已确认旧客户端没有需要迁移的数据；新客户端只依赖本文定义的文件和资源包。
