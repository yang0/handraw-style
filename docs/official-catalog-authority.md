# 官方画风 / 图型目录权威与发布流程（Web #11 / Skill #17）

> 状态：**发布纪律**，不是宣布两仓已经完全一致。
> 权威：`https://github.com/yang0/handraw-web`（网站），当前功能开发分支 `studio2`。
> 消费方：`https://github.com/yang0/handraw-style`（Skill）。

## 不可跳过的规则

1. **网站分配、审核并发布官方编号；Skill 消费网站已审定的编号与描述。** 不允许在 Skill `references/styles.json`、`references/layouts.json` 直接新增 `FA/FG/IG/SB/...-NNN` 就当成网站已发布的官方资源。
2. 新官方画风/图型先在网站端管理员 API `POST /api/admin/catalog/official` 申请、校验和登记。Web 管理员明确审批、发布后，再通过 `handraw-web/ops/export_official_assets.py` 导出到经过审阅的 Skill 发布分支；导出器检测撞号并拒绝静默覆盖 Skill 已有条目。必须在最终包中核对授权、名称、图片、编号和收费定义不外泄。**不能用导出器处理未经审批的候选。**
3. 网站遗留脚本 `ops/refresh_content.py --accept` **不是日常发布链路**；该脚本虽然有默认方向锁，但显式 `--accept` 属于一次性编辑授权，未经网站负责人确认不得以此把 Skill 新编号写回网站。
4. 作者自建资源使用 `USR-S` / `USR-L` + 完整 UUID 的**私有**编号（Web #21），与官方目录完全隔离；个人同步不会自动上架成为官方资产。
5. 未来即使编号相同，若资源类别、名称、内容或授权不一致，**停止同步并人工核对**，不可批量覆盖。付费专属定义不得随公开 Skill 导出泄露。

## FG-025 的确切现状（2026-11-09）

- Skill 当前分支 `feature/skill-web-unification-v1-20261107` 有 `FG-025`，名称 **Perler Bead Pixel Art**；Web `studio2` 的公开 `plugin/content/catalog.json` 中没有此项。
- 此条虽然出现在 Skill 的现存本地 references 中，**它仍不是网站已批准/已发布的官方画风**。为了避免未经授权的数据/编号发布，本轮不删除用户原有 Skill 定义、也不把它静默反向发布到网站；正式发行包须在 #11 审定后处理。
- 网站审计文件 `handraw-web/ops/official_catalog_pending_11.json` 对该候选记录了精确内容 SHA256 指纹、Issue 和待审理由。只读工具 `ops/check_official_catalog_parity.py` 将逐条比对最新 Skill 分支。该工具常规 CI 将此项报告为 `pending_review`，而 **`--strict` 发布门禁必须失败**，直至网站已审批、两端内容同步并删除待审例外。
- 下一步由网站维护者决定：经管理员正式审批后收录并按官网编号同步；或者撤回/迁移 Skill 本地候选（不得悄悄丢失原创内容）。任一方案都需要 GitHub Issue 证据、两端对账和严格门禁。

## 操作核对

1. 网站管理员新增/调整资源后，先跑 Web `tests/test_official_assets.py`，确认连续编号、同名/同号冲突、权限和付费内容脱敏。
2. 经过审阅后执行 `ops/export_official_assets.py --db <受控离线 SQLite> --skill-root <Skill 原始资源目录> --out <待审目录>` 生成网站已发布资源导出包；审查导出结果、授权与图片，不将数据库或明文私有内容提交仓库。
3. Skill 内容被更新后，运行网站只读核对：`python ops/check_official_catalog_parity.py --skill-root <Skill 根目录>`，并按 Release 要求再跑 `--strict`。**任何新 Skill-only、Web-only、同号异类、内容被改的待审例外，都必须阻断发布。**
4. 只在双方编号完全一致、相关测试全绿、发包证据完整时关闭 Web #11 和 Skill #17。工厂化 CI 绿灯不代表部署的公网已同步。

以上步骤不得写入生产数据库，不得通过抹掉未审资源换取测试通过。