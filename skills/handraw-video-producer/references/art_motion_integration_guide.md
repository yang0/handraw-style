# 综合艺术动画与手绘适配

> v1.0 · `handraw-video-producer`的共享制作引擎与方法层。实际代码位于`../lib/art_motion/`，命令入口`../bin/art_motion.py`或`hvp art-motion`。不依赖原参考目录运行。

## 1. 全路线与按需阅读

| 用户意图 | 制作路线与资源 |
| --- | --- |
| 拆解/复刻参考动画 | [拆解](art_motion/01-拆解.md) → [机制](art_motion/02-机制.md)；`analyze`输出接触表、帧差、节拍拟合与运动热图，再按新主题迁移机制 |
| 指定艺术风格的动画 | [一帧先行](art_motion/03-一帧先行四条路线.md)、[代码绘制](art_motion/04-纯代码绘制.md)、[风格配方](art_motion/风格配方/INDEX.md)；35个场景在引擎`scenes/`，是独立程序化风格库 |
| 口播驱动画面/整片 | [口播画面](art_motion/06-口播驱动的艺术短片.md)、[整片与回流](art_motion/12-口播整片与经验回流.md)；采用本项目实际配音/ASR，以关键词或短语驱动事件和相机 |
| 知识/科技/信息动画段 | [语法总表](art_motion/09-视频动画语法.md)，按信息作用选择以下九类语法，`render --spec`产出精确到帧的片段 |
| 角色/拟人表演 | [角色](art_motion/10-角色.md)，AI动作帧、透明层/绿幕、锚点与代码合成；按共用素材契约锁定身份、接触、遮挡与动作阶段 |
| 连续长卷与互动 | [长卷工程](art_motion/11-长卷穿越片.md)，与本项目[长卷手册](unbounded_scroll_director_guide.md)共同使用；知识题材再读[知识长卷指南](scroll_knowledge_guide.md) |
| 配乐与卡节奏 | [节奏与配乐](art_motion/05-节奏与配乐.md)；原创动机、BPM网格、分段配器与拟音，语音解释优先于音乐节拍 |
| 新写场景/风格/片段 | [作者接口](art_motion/08-风格作者规范.md)，复用绘画、镜头、图形、图表、文字、拼贴与转场库 |

迁入的方法文档保留上游历史经验和示例，它们用于参考；能力状态以本项目实际接入和验收为准。旧文档中作者身份、固定三方案审批、固定8帧、每幕运动配额、15秒速通节拍和示例商业事实不成为本项目通用约束。已有明确方向或授权时直接执行；未定视觉方向时提供少量差异化方案。稳定阅读可以静止，动作不能由背景帧差代替。

## 2. 九种解说语法

| grammar | 用途 | 手绘适配选择 |
| --- | --- | --- |
| `y1_kurzgesagt` | 系统、尺度与内部结构 | 保留尺度镜头与节点关系，按需叠加实际手绘对象 |
| `y2_vox` | 档案、截图、论证拼贴 | 使用真实材料或原创手绘图片；不把虚构插画当事实证据 |
| `y3_whiteboard` | 步骤、关系与推导 | 矢量逻辑、马克笔揭示、真实插画；字形笔顺另需路径数据 |
| `y4_storytime` | 经历、反应与笑点 | 原创角色；局部动作帧或几何表演，实际声音包络可传入 |
| `y5_kinetic_type` | 清单、章节、数字与关键词 | 编辑文字、主题色和停留节奏，少量图片按语义叠层 |
| `t1_3b1b` | 机制、形变与逻辑推导 | 概念配色保持稳定，画风变化不能改写知识关系 |
| `t2_keynote_ui` | 产品、功能、界面与步骤 | 真实截图等比放置；手绘素材用于解释和视觉包装 |
| `t3_finance_chart` | 数据、趋势与对比 | 坐标、单位、数据和来源保持真实；明确示意数据 |
| `y6_presenter_explainer` | 讲解员配合图像与要点 | 本项目新增参数化基础版；可用原创几何讲解员或实际透明角色换帧，不能等同上游整片的全部复杂表现 |

前八种迁入上游可运行片段；第九种迁入语法卡与整片参考代码，并新增本项目基础片段实现。各自语法卡位于`art_motion/动画语法/`。原整片快照在`lib/art_motion/scripts/engine/reference_films/`，需要本期口播、原创角色和时间线，不能当作现成新题材影片。

## 3. 手绘库适配契约

1. **语法、外观、布局分别选**：grammar决定解释动作；style_code决定素材视觉语言；layout_code决定构图规则；color_codes记录主题色。三者不能相互冒充。
2. **实时解析风格**：`bind`调用当前`resolve_reference.py`，兼容分类ID（如`FE-004`）及旧数字别名；按模型能力使用作者/风格名、正向特征及需要的风格参考。实际生图走当前手绘Skill和内置imagegen，参考图只取画风、不迁移主体。
3. **程序化与素材路线**：35个场景有已写的渲染器；其他注册风格通常通过生成/导入真实图片实现，或另写并验证绘制代码。仅指定ID、纸纹或调色不能声称全部注册画风已被代码精确实现。
4. **真实图型**：读取`layouts.json`及对应prompt_file。binding保留规则用于导演检查；它不自动生成所有图型的动态布局。按图型安排实际区域、层和镜头，检查对应关系及可读性。
5. **颜色不猜值**：color_codes解析为当前库的名字与提示；实际渲染用显式CSS色值。`handdraw.render.palette`可指定paper/ink/accent或精确color_map，保留概念颜色和真实截图原色。
6. **图片与动作**：`image`指向本地PNG/WebP/JPEG，`bind`检查文件并内嵌素材，保留源路径和SHA256；缺图中止。`handdraw.background`为背景，`layers`可按归一化region摆位、换帧或沿keyframes运动。source_rect对应真实图集采样，脚/手锚点与前后遮挡按[素材契约](frame_and_asset_contract.md)记录。
7. **音频与字幕**：统一使用用户指定的配音或现有音轨。实际TTS/ASR走本项目对应流程；语音时间、事件和相机分别记录。原画面片段默认无声；可混入已有audio。画内、独立、无字幕遵循[字幕手册](subtitle_and_information_guide.md)。本引擎不宣称自动合成配音或自动逐字对齐。

### 片段示例字段

```json
{
  "grammar": "y3_whiteboard", "duration": 6, "width": 1920, "height": 1080, "fps": 30,
  "handdraw": {
    "style_code": "FE-004", "model": "gpt-image-2", "color_codes": ["C-34", "C-10"],
    "render": {"palette": {"paper": "#fff8e8", "ink": "#26364a", "accent": "#7f9981"}},
    "layers": [{"image": "assets/character.png", "region": [0.72, 0.3, 0.2, 0.5], "at": 1,
      "frames": [{"at": 1, "source_rect": [0,0,400,600]}, {"at": 3, "source_rect": [400,0,400,600]}]}]
  },
  "cues": [{"at": 0, "kind": "title", "text": "一个明确的问题"},
    {"at": 1, "kind": "image", "image": "assets/scene.png"},
    {"at": 4, "kind": "highlight", "data": {"target": "image", "index": 0}}]
}
```

示例路径和采样框需换成真实素材；主题来自本期脚本。`voice_envelope:{fps,a}`只驱动说话示意/幅度，不等于音素口型同步。动作帧只能表达已有素材，不能自动生出连续肢体动作。图像素材移动不自动成为真实步态或物理模拟。

## 4. 可运行入口

在项目根目录执行，工具自动定位随包引擎；使用已安装的浏览器（默认msedge，环境变量`ART_MOTION_BROWSER`可选），FFmpeg/FFprobe优先PATH，兼容本项目现有工具位置。

首次使用运行`python -m pip install -r skills/handraw-video-producer/requirements.txt`。另需可用的FFmpeg、FFprobe和浏览器；微软Edge未安装时配置`ART_MOTION_BROWSER`并安装对应Playwright浏览器。火山配音沿用已配置的`volc-tts`流程与本地凭据，凭据不放入Skill包。原复杂配乐脚本的可选依赖见下文。

```powershell
python -X utf8 skills/handraw-video-producer/bin/hvp.py art-motion catalog
python -X utf8 skills/handraw-video-producer/bin/hvp.py art-motion bind --spec videos/my-clip.json --out videos/my-clip.bound.json
python -X utf8 skills/handraw-video-producer/bin/hvp.py art-motion render --spec videos/my-clip.json --out videos/my-clip.mp4
python -X utf8 skills/handraw-video-producer/bin/hvp.py art-motion render --spec videos/my-clip.json --alpha --out videos/my-clip.mov
python -X utf8 skills/handraw-video-producer/bin/hvp.py art-motion render --film gallery --solo 17_ink --stills 0.2,0.6 --out videos/art-stills
python -X utf8 skills/handraw-video-producer/bin/hvp.py art-motion render --film demos/long_scroll --out videos/scroll-demo.mp4
python -X utf8 skills/handraw-video-producer/bin/hvp.py art-motion qa --spec videos/my-clip.json --out videos/my-clip-qa
python -X utf8 skills/handraw-video-producer/bin/hvp.py art-motion analyze --video videos/reference.mp4 --out videos/reference-analysis
python -X utf8 skills/handraw-video-producer/bin/hvp.py art-motion music --duration 30 --bpm 86 --out videos/original-music.wav
```

角色抠图、切帧和字体子集可用`art-motion sprites --tool key_green|key_split|font_subset`透传其真实参数；先用`--help`查看。自定义整片可复制随包engine到期内工程，写段落/场景文件，再调用其render.py；不要改包内示范来覆盖旧片。九类片段可作为现有分镜的画面轨，素材中记录产物路径、时间范围和来源。

AI视频模型首尾帧路线已迁入方法；调用仍需要另行可用的服务连接和实际授权。不能因方法文档存在就声称本地CLI已经实现视频模型接口。上游复杂原创配乐脚本已保留，运行需其numpy/scipy/soundfile依赖；本项目`music`入口使用numpy实现独立原创轻音乐，无需这些额外依赖。

## 5. 验收、来源与版本

先用关键帧确认视觉方向，再检查过程、文字框景、相邻帧和转场。固定相机/分层核验主体动作；同一时刻冷/热渲、逆向跳转和重新加载必须一致。整片检查完整解码、帧数、声音实长及编码后响度。QA阈值用于发现问题，不是审美总分；按实际问题修正。复杂片段在有可用且获授权的独立审片人员/agent时交其审片，并保留时间码、根因和复验。没有完成动态观看或听审时如实标注，用户接受另记。

保留MIT版权、字体OFL及笔顺数据Arphic许可，见`lib/art_motion/NOTICE.md`。作者限制用途角色图片未迁入；共享讲解员改为本项目原创几何旅人，长卷示范采用本项目原创图集的有限帧。它们验证装载与合成接口，不等同原作角色风格或动作审美验收。

`lib/art_motion/import_manifest.json`记录原文件哈希、迁移路径、当前适配哈希和排除项。本项目适配修改与验证记录保存于`lib/art_motion/integration_record.json`；静帧、编码、动态审看与用户接受分开。上游版本升级先比对清单并保留本地适配，不直接再次覆盖导入目录。

### 2026-10-09 集成验证

`tests/test_art_motion.py`通过56项运行检查：35个场景加载、同刻重复和回跳；九类片段分别检查1920×1080与1080×1920、三个时点及重载；实际手绘图片装载、分类ID与旧别名解析、缺图拒绝、原创有限帧长卷示范装载，以及60帧/2秒的MP4与ProRes透明通道编码。配乐入口也实际输出了WAV。单独运行`qa`检查手绘片段，确定性通过、文字框景问题0、相邻帧跳变0。

本次修复了临时画布状态残留、浏览器纹理读回后端切换、适配层语法和Windows本地资源并发连接问题。画布固定读回后端以保持冷渲、回跳和编码一致；复杂场景仍应测量本期性能。此记录属于运行、静帧与编码验证，不等同全部示范的动态审美验收。新题材继续按素材和声画验收，本项目知识长卷案例尚未完成成片。
