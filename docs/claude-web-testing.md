# claude 分支：Skill × Web 联动测试

关联：Skill #18、#15、#16、#17；Web #84。

`claude` 从现有 `master` 合入 `origin/feature/skill-web-unification-v1-20261107`，保留现有画风、图型、图库重命名与分享流程，包含后续 GIF、资源编号回执和冲突修订。`master` 不随测试更新。分支集成不等于用户账号联测通过。

## 1. 确认目录与绑定账号

在 PowerShell 中执行：

```powershell
Set-Location E:\handraw-style
git branch --show-current
python -X utf8 scripts/handraw_cloud.py --help
python -X utf8 scripts/handraw_cloud.py bind
python -X utf8 scripts/handraw_cloud.py whoami
```

分支应为 `claude`。绑定会打开官网授权页，用你自己的账号登录并批准。只有成功回读用户名后才算绑定完成。已经绑定时直接执行 `whoami`，无需重复授权。Agent 的 Skill 列表可能在打开聊天时固定；若旧聊天找不到 `handraw-cloud`，在本目录新建聊天，或明确让它读取 `skills/handraw-cloud/SKILL.md`。

## 2. 先测读取，再测私有同步

```powershell
python -X utf8 scripts/handraw_cloud.py assets list
python -X utf8 scripts/handraw_cloud.py resources list
python -X utf8 scripts/handraw_cloud.py history cloud-list
python -X utf8 scripts/handraw_cloud.py social notifications
```

允许返回空列表。资源列表的“已解锁”不等于“允许离线导出”；付费在线及黑盒资源保持网站权限边界。

图库测试使用已经初始化的自建图库，以下路径替换为你的实际图库路径：

```powershell
python -X utf8 scripts/handraw_cloud.py assets push --library-dir 'D:\我的测试图库' --id CH-002
python -X utf8 scripts/handraw_cloud.py assets pull --library-dir 'D:\我的测试图库'
```

在官网账号设置的“个人云空间”或个人主页“我的图库”核对同一素材。默认 pull 保留本地未同步修改，遇冲突先检查双方内容。

个人画风测试：

```powershell
python -X utf8 scripts/personal_library.py create --kind style --name '联动测试纸感水彩' --zh '纸张纹理、水彩晕染、柔和低饱和色彩' --en 'Paper texture, watercolor washes, soft muted colors' --license '个人使用'
```

把返回的完整 `mine:UUID` 填入下一条命令：

```powershell
python -X utf8 scripts/handraw_cloud.py resources push --id 'mine:替换为返回的UUID'
python -X utf8 scripts/handraw_cloud.py resources restore
```

网站查看并编辑后再 restore，核对内容及 revision；两端都改动时应提示冲突。私人资源不会因此发布到社区。收藏下载使用 `resources list` 返回的可导出资源 ID：`python -X utf8 scripts/handraw_cloud.py resources pull --id '资源ID'`。

## 3. 测试多图作品上传

选择可公开的测试图片和原始创作指令文件，替换示例路径：

```powershell
python -X utf8 scripts/handraw_cloud.py history record --original-request-file 'D:\测试图片\原始指令.txt' --image 'D:\测试图片\01.png' --image 'D:\测试图片\02.gif'
python -X utf8 scripts/handraw_cloud.py history list
```

到这里仅保存在本地。确认愿意公开后，将返回的 runId 填入：

```powershell
python -X utf8 scripts/handraw_cloud.py history upload --run-id '替换为runId'
python -X utf8 scripts/handraw_cloud.py history cloud-list
```

上传即公开整批图片和原始指令。核对唯一 workId、正确 imageCount、作品封面及详情全部图片。再次上传同一 runId 应复用作品。已有分享草稿也可使用 `publish --draft '草稿路径'`；对同一组图片选择一种上传路径，避免另建一份作品。当前 history 上传不携带画风/图型关联，需保留这些关联时使用 community-share 草稿分享流程。

## 4. 测试互动

将下面的作品ID替换为真实作品 ID，互动操作会写入网站：

```powershell
python -X utf8 scripts/handraw_cloud.py works detail --id '作品ID'
python -X utf8 scripts/handraw_cloud.py social like --id '作品ID'
python -X utf8 scripts/handraw_cloud.py social collect --id '作品ID'
python -X utf8 scripts/handraw_cloud.py social comment --id '作品ID' --text '来自本地 Skill 的联动测试'
python -X utf8 scripts/handraw_cloud.py social comments --id '作品ID'
```

网页刷新核对状态。点赞和收藏可加 `--remove` 撤销。通知归属接收账号；给自己的作品互动不保证产生通知。网站账号设置可撤销设备，撤销后 `whoami` 及写操作应失败；`unbind` 只清除本机令牌。

## 自动验证与边界

```powershell
python -X utf8 -m unittest discover -s skills/handraw-cloud/tests -p 'test_*.py' -v
python -X utf8 -m pytest skills/community-share/tests -q
python -X utf8 -m unittest discover -s skills/handdraw-style-prompter/scripts -p 'test_custom_library_rename.py' -v
```

`claude` 推送触发 Ubuntu 和 Windows CI。Unix 文件权限位仅在 POSIX 系统断言；Windows 不以 `0600/0700` 判断 ACL，三项 POSIX 权限测试明确跳过，不代表已验证 Windows ACL。设备绑定、真实账号双向同步、发布、跨设备和桌面/平板/手机验收仍需按以上步骤完成；离线测试通过不能替代这些结果。
