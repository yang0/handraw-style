---
name: handraw-cloud
description: 用自然语言绑定或查看手绘风账号，显示回复末尾账号状态，处理私有图库和画风图型同步、授权收藏、作品分享及互动。仅在用户明确操作时上传。
---

# Handraw 统一账号与个人云空间（Skill 客户端）

## 自然语言账号与回复状态

遵循安装包根目录 `skills/handraw-cloud/references/conversation-account.md`：用户说“绑定手绘风账号”即可由 Agent 启动网页授权；每次回复最后附脚本返回的账号状态，未绑定时说明好处并引导自然语言绑定。用户无需操作终端，未绑定也可继续本地创作。

仓库：**https://github.com/yang0/handraw-style**（本仓库，完整联动测试分支 `claude`；原整合分支 `feature/skill-web-unification-v1-20261107` 已合入）
服务端仓库：**https://github.com/yang0/handraw-web**（主分支 `main`，私有）  
跨仓库规划：https://github.com/yang0/handraw-web/blob/main/docs/skill-web-unification-v1.md

从 **handraw-style 项目根目录** 执行以下命令。Skill 只管理本地数据和与官网的明确交互，不自行决定云端授权、资源版权或公开状态。

Windows 建议使用 `python -X utf8`，避免终端中文编码错误。完整测试顺序与通过边界见仓库根目录 `docs/claude-web-testing.md`。

## P0 网站账号绑定（已有服务端接口）

面向用户默认采用自然语言绑定；先按 [账号对话合同](references/conversation-account.md) 用 `bind --start --no-browser` 返回链接，用户说“我已授权”后用 `bind --check` 确认，不使用下方阻塞式命令等待用户。status 可返回不含密钥的状态和 footer。下方命令是兼容入口及 Agent 内部实现说明，正常用户不需要执行它们。

```sh
python scripts/handraw_cloud.py bind
python scripts/handraw_cloud.py whoami
python scripts/handraw_cloud.py unbind
```

- 绑定流程基于网站设备码授权；网页审批成功后使用 `hwt_` Bearer Token。
- 不索取或记录网站密码、Cookie、管理密钥；用户名与权限从 `/api/auth/me` 验证。
- 默认本机凭据：`~/.handraw-style/cloud_auth.json`，只允许当前 OS 用户读取。单机解绑仅删除本机凭据；若要立即撤销已发令牌，还需去网站账号设置撤销设备授权。
- 绑定过程中会展示官网授权 URL 与验证码；不输出设备密钥或访问令牌。

## P1 自建角色/道具/场景图库（已有服务端接口）

先使用 `custom-asset-manager` 初始化图库和保存资产，再执行：

```sh
python scripts/handraw_cloud.py assets push
python scripts/handraw_cloud.py assets push --id CH-002
python scripts/handraw_cloud.py assets pull
python scripts/handraw_cloud.py assets list
```

也可通过 `--library-dir <自建图库路径>` 指定现有图库。默认读取 `~/.handraw-style/config.json` 的 `tuku_dir`。显式执行 push 才上传；pull 不删除本地文件、检测未同步本地修改、保留图片冲突。内部维护 UUID、SHA256、revision、按账号隔离的本地同步状态。恢复到图库后通过 custom-asset-manager 的刷新流程更新离线画廊。不得直接覆盖官方预置图片。

**限制：** 当前网页图库 API 类别为 characters/props/scenes/other；通用参考图库的正式分类要由网站端升级，不应凭空提交新枚举。

## P1 我的画风/图型与授权收藏

```sh
python scripts/personal_library.py create --kind style --name "纸感水彩" --zh "中文纯画风定义" --en "English visual style definition" --license "个人使用"
python scripts/handraw_cloud.py resources list
python scripts/handraw_cloud.py resources pull --id <已解锁资源ID>
python scripts/handraw_cloud.py resources push --id mine:<个人资源UUID>
python scripts/handraw_cloud.py resources restore
```

- `list/pull` 使用网站已有 `/api/skill/library` 和受控资源内容接口，**只拉取已获得完整内容访问权**的资源；本地收藏保留原作者与授权信息。
- `push` 使用 `PUT /api/v1/me/resources/{id}`，只允许 owned 资源、强制 visibility=private、携带 baseRevision。当前 Web 已有该接口；是否同步成功必须检查真实回执，不能只凭接口存在判断。
- 新建画风仅描述视觉语言（媒介、线条、材质、色彩、光影），不提取参考图人物、服饰或场景。图型只保存布局约束。
- 私人画风不会因为同步到账号自动公开；社区资源不能作为个人原创再次上传。

## P2 生成历史（本地记录）与自动公开作品

```sh
python scripts/handraw_cloud.py history record --original-request-file /path/original-request.txt --image /path/01.png --image /path/02.png
python scripts/handraw_cloud.py history list
python scripts/handraw_cloud.py history cloud-list
python scripts/handraw_cloud.py history upload --run-id <本地runId>
```

**公开规则：** `record` 只在本地保存原始创作指令和图片，不上传、不公开。**执行 `history upload` 就是公开提交**：图片和原始创作指令通过 `POST /api/v1/me/generations` 提交，服务端将同一任务的全部图片归为**一件公开多图作品**，仅在作品广场显示一张首图封面；作品详情展示全部图片，返回 `workId`、`workIds: [workId]` 与 `imageCount`。**不再有单独“发布到作品广场”步骤。** 上传前务必确认图片和完整原始指令可公开；请勿上传涉及私人信息、商业秘密或不具备公开权限的内容。失败时仍保留本地记录；重试同一 `runId` 不应重复创建作品。旧版已同步私有历史不会自动公开，也不能通过重试改为公开；须建立新的上传记录。

如果创作已通过 `community-share` 准备了作品草稿，也可以沿用已有直接发布命令（这不是二次发布生成历史）：

```sh
python scripts/handraw_cloud.py publish --draft /path/.handraw-share.json
```

使用设备令牌和现有 `/api/uploads`、`/api/entries` 发布。执行前先审阅公开标题、图片、原始创作指令和关联资源。超时结果未确认时停止重复发布以避免双发。成功回执是网站作品链接，非论坛替代帖子。分享客户端使用不带令牌的公开作品详情接口尝试回读验证；如果网站尚未返回一致的图片/关联信息、尚未传播或接口临时不可达，回执可能显示 `verified=false`，这不表示一定未发布，也不能声称关联已经核验。

## P3 网站互动

```sh
python scripts/handraw_cloud.py social notifications
python scripts/handraw_cloud.py social comments --id <作品UUID>
python scripts/handraw_cloud.py social like --id <作品UUID>
python scripts/handraw_cloud.py social like --id <作品ID> --remove
python scripts/handraw_cloud.py social comment --id <作品ID> --text "作品评论"
python scripts/handraw_cloud.py social collect --id <作品ID>
python scripts/handraw_cloud.py social collect --id <作品ID> --remove
python scripts/handraw_cloud.py works list --author <作者用户名>
python scripts/handraw_cloud.py works detail --id <作品ID>
```

作品浏览与评论读取通过公开 `/api/works` API，作品收藏直接复用 `/api/collections/toggle`。点赞、评论提交和通知使用 Web 已实现的 `/api/v1` 接口与设备令牌权限；账号绑定、读写和网页状态回读需要真实联测。服务端版本不兼容或权限不足时应报告明确错误。**不得调用论坛管理员 API 或绕过授权模拟用户互动。**

## 失败恢复与安全

- 失败时保留本地图库、草稿和生成历史，服务器 409 冲突不自动强制覆盖；`assets pull --force` 是用户明确要求覆盖本地对应文件才使用。
- 新接口 404 可能表示尚未部署；403 可能意味着 token scope 未扩展。需要在 handraw-web 完成对应服务端工作。
- 数据文件、用户密钥和本地图像不可纳入 Git；使用本地 `~/.handraw-style/` 与用户明确指定的外部图库路径。
- 两端功能以测试、在线鉴权、权限、跨设备同步、幂等发布和异常恢复的 E2E 结果作为最终验收，而不是仅凭 CLI 命令存在。
