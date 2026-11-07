---
name: handraw-cloud
description: 手绘风网站账号绑定、自建图库私有同步、个人画风图型同步、授权收藏下载、私有生成历史、作品发布和跨端互动。仅在用户明确操作时上传和发布。
---

# Handraw 统一账号与个人云空间（Skill 客户端）

仓库：**https://github.com/yang0/handraw-style**（本仓库，开发分支 `feature/skill-web-unification-v1-20261107`）  
服务端仓库：**https://github.com/yang0/handraw-web**（主分支 `main`，私有）  
跨仓库规划：https://github.com/yang0/handraw-web/blob/main/docs/skill-web-unification-v1.md

从 **handraw-style 项目根目录** 执行以下命令。Skill 只管理本地数据和与官网的明确交互，不自行决定云端授权、资源版权或公开状态。

## P0 网站账号绑定（已有服务端接口）

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
```

- `list/pull` 使用网站已有 `/api/skill/library` 和受控资源内容接口，**只拉取已获得完整内容访问权**的资源；本地收藏保留原作者与授权信息。
- `push` 适配规划中的 `PUT /api/v1/me/resources/{id}`，只允许 owned 资源、强制 visibility=private、携带 baseRevision。**网站部署该 API 和 library scope 权限前会拒绝，不能称其已经上线。**
- 新建画风仅描述视觉语言（媒介、线条、材质、色彩、光影），不提取参考图人物、服饰或场景。图型只保存布局约束。
- 私人画风不会因为同步到账号自动公开；社区资源不能作为个人原创再次上传。

## P2 生成历史（私有）与主动发布

```sh
python scripts/handraw_cloud.py history record --original-request-file /path/original-request.txt --image /path/01.png --image /path/02.png
python scripts/handraw_cloud.py history list
python scripts/handraw_cloud.py history upload --run-id <本地runId>
```

`record` 仅在本地保存原始指令及图片副本；`upload` 需要网站端实现规划中的 `POST /api/v1/me/generations` 私有历史 API，接口未上线时不伪装同步成功，也不向公开作品接口传递私人历史。

作品发布复用已有 `community-share` 草稿与预览；只有用户明确点击分享/回复分享到网站时：

```sh
python scripts/handraw_cloud.py publish --draft /path/.handraw-share.json
```

使用设备令牌和现有 `/api/uploads`、`/api/entries` 发布。先审阅公开标题、图片、原始创作指令和关联的资源。超时结果未确认时停止重复发布以避免双发。成功回执是网站作品链接，非论坛替代帖子。由于现有 publish 令牌没有公开作品详情读取 scope，发布后的回读验证可能显示 `verified=false`，不能宣称关联已核验。

## P3 网站互动（客户端已实现待服务端授权）

```sh
python scripts/handraw_cloud.py social notifications
python scripts/handraw_cloud.py social comments --id <作品UUID>
python scripts/handraw_cloud.py social like --id <作品UUID>
python scripts/handraw_cloud.py social like --id <作品UUID> --remove
```

这些命令调用规划中的 `/api/v1` 统一业务接口；服务端未部署对应 API 和设备权限时，返回明确错误。**不得调用论坛管理员 API 或绕过授权模拟用户互动。**

## 失败恢复与安全

- 失败时保留本地图库、草稿和生成历史，服务器 409 冲突不自动强制覆盖；`assets pull --force` 是用户明确要求覆盖本地对应文件才使用。
- 新接口 404 可能表示尚未部署；403 可能意味着 token scope 未扩展。需要在 handraw-web 完成对应服务端工作。
- 数据文件、用户密钥和本地图像不可纳入 Git；使用本地 `~/.handraw-style/` 与用户明确指定的外部图库路径。
- 两端功能以测试、在线鉴权、权限、跨设备同步、幂等发布和异常恢复的 E2E 结果作为最终验收，而不是仅凭 CLI 命令存在。
