"""Explicit storyboard -> illustrated, frame-aware whiteboard configuration.

No text guessing, asset substitution, network calls, or silent scene truncation.
"""
import base64
import hashlib
import json
import math
import mimetypes
from pathlib import Path
from PIL import Image
from frame_layout import resolve_frame
from subtitles import resolve_subtitle_mode


def read_board(ep_dir):
    path=Path(ep_dir)/"storyboard.json"
    if not path.is_file():
        raise ValueError("白板模式缺少storyboard.json；请先设计逐幕图像与布局，不从逗号猜步骤")
    board=json.loads(path.read_text(encoding="utf-8"))
    if board.get("version") != 1 or not board.get("scenes"):
        raise ValueError("storyboard.json需要version=1及非空scenes；新建工程只是草稿")
    return board


def prepare_asset(ep_dir, item):
    if not isinstance(item,dict) or not item.get("path"):
        raise ValueError("图像需要image.path；请将获准素材保存到本期assets")
    root=Path(ep_dir).resolve();path=(root/item["path"]).resolve()
    if not path.is_relative_to(root/"assets") or not path.is_file():
        raise ValueError(f"素材不存在或不在本期assets中：{item['path']}")
    with Image.open(path) as im:
        w,h=im.size
        if item.get("transparent") and ("A" not in im.getbands() or im.getchannel("A").getextrema()[0]!=0):
            raise ValueError(f"声称透明的素材没有真实alpha：{item['path']}")
        rect=item.get("source_rect",[0,0,w,h])
        if len(rect)!=4 or any(not isinstance(n,(int,float)) or not math.isfinite(n) for n in rect):
            raise ValueError("source_rect须为有效的像素[x,y,w,h]")
        x,y,rw,rh=rect
        if min(x,y)<0 or min(rw,rh)<=0 or x+rw>w or y+rh>h:
            raise ValueError(f"图集采样框越界：{item['path']}")
    data=path.read_bytes();mime=mimetypes.guess_type(path.name)[0] or "image/png"
    return {"imageUrl":f"data:{mime};base64,"+base64.b64encode(data).decode(),
            "sourceRect":rect,"path":item["path"],"sha256":hashlib.sha256(data).hexdigest()}


def validate_board(ep_dir):
    """Cheap preflight before paid synthesis; layout/asset/content errors fail here."""
    board=read_board(ep_dir);seen=set()
    for scene in board["scenes"]:
        key=scene.get("id")
        if not key or key in seen:raise ValueError("每幕需要唯一id")
        seen.add(key)
        if not scene.get("title"):raise ValueError(f"{key}缺少简短标题")
        layout=scene.get("layout","hero")
        if layout not in ("hero","steps","compare","diagram"):
            raise ValueError(f"{key}的layout不支持：{layout}；使用期内模板实现其他图型")
        if layout=="hero":prepare_asset(ep_dir,scene.get("image"))
        elif layout=="compare":
            if len(scene.get("items",[]))!=2:raise ValueError("compare需要两个可比较的完整主视觉")
            for item in scene["items"]:
                if not item.get("text"):raise ValueError("对比项需要简短标签")
                prepare_asset(ep_dir,item.get("image"))
        elif layout=="steps":
            if not 1<=len(scene.get("items",[]))<=4:raise ValueError("默认steps支持1–4项；更多项请拆幕或使用期内布局，不能截掉")
            for item in scene["items"]:
                if not item.get("text"):raise ValueError("每一步需要简短说明")
                prepare_asset(ep_dir,item.get("image"))
        elif layout=="diagram":
            if not 2<=len(scene.get("nodes",[]))<=4 or not all(isinstance(n,str) and n.strip() for n in scene["nodes"]):
                raise ValueError("diagram需要2–4个非空节点表达方向关系；长段落不是图表")
    return board


def build_config(ep_dir,meta,timing):
    subtitle_mode=resolve_subtitle_mode(meta)
    board=validate_board(ep_dir)
    frame=resolve_frame(width=meta.get("width",1080),height=meta.get("height",1920),fps=meta.get("fps",30))
    duration=float(timing.get("duration",0));segments=timing.get("segments",[])
    if not math.isfinite(duration) or duration<=0 or not segments:raise ValueError("需要实际音频时长和语音边界")
    palette={"paper":"#fcf7ea","ink":"#242b38","primary":"#194ac8","accent":"#f6762b",**meta.get("palette",{})}
    if any(not isinstance(v,str) or not v.startswith("#") or len(v) not in (4,7) or any(ch not in "0123456789abcdefABCDEF" for ch in v[1:]) for v in palette.values()):
        raise ValueError("palette需要实际十六进制颜色；C-*名称必须先按当前色库解析，不能作为CSS颜色")
    scenes=[];used=[];cues=[]
    for i,scene in enumerate(board["scenes"]):
        indices=scene.get("segment_indices",[i])
        if not isinstance(indices,list) or not indices or any(type(n) is not int or n<0 or n>=len(segments) for n in indices):
            raise ValueError(f"{scene['id']}的segment_indices不指向实际语音")
        if indices!=list(range(indices[0],indices[-1]+1)):raise ValueError("一幕映射连续语义段，避免时间线跳跃")
        used.extend(indices)
        group=[segments[n] for n in indices]
        if any(not 0<=float(s['start'])<float(s['end'])<=duration+.001 for s in group):raise ValueError("语音边界越界")
        start=0.0 if i==0 else float(group[0]["start"])
        result={**scene,"start":start,"end":float(group[-1]["end"])}
        if scene.get("image"):result["image"]=prepare_asset(ep_dir,scene["image"])
        if scene.get("items"):result["items"]=[{**item,"image":prepare_asset(ep_dir,item["image"])} for item in scene["items"]]
        scenes.append(result)
    if used!=list(range(len(segments))):raise ValueError("分镜必须按顺序完整覆盖全部语音段，不能漏掉或重复台词")
    for i,scene in enumerate(scenes):scene["end"]=scenes[i+1]["start"] if i+1<len(scenes) else duration
    if any(s["start"]>=s["end"] for s in scenes):raise ValueError("分镜时间非递增")
    for n,seg in enumerate(segments):
        cue={"text":seg["text"],"start":seg["start"],"end":seg["end"]}
        if subtitle_mode=="burn-in" and seg.get("caption_lines"):
            lines=seg["caption_lines"]
            if not isinstance(lines,list) or not all(isinstance(s,str) for s in lines) or ''.join(''.join(lines).split())!=''.join(seg['text'].split()):
                raise ValueError("caption_lines必须完整保留原字幕文字，只改变断行")
            cue["lines"]=lines
        cues.append(cue)
    if any(float(a['end'])>float(b['start'])+.001 for a,b in zip(cues,cues[1:])):raise ValueError("字幕重叠，先校正真实语音边界")
    return {**frame,"duration":duration,"title":meta.get("title","手绘知识"),"palette":palette,"scenes":scenes,"cues":cues,"subtitle_mode":subtitle_mode}


def prepare_whiteboard(ep_dir,meta,timing,template):
    config=build_config(ep_dir,meta,timing);work=Path(ep_dir)/"work";work.mkdir(exist_ok=True)
    source=Path(template).read_text(encoding="utf-8")
    if source.count("/*WHITEBOARD_CONFIG*/")!=1:raise ValueError("白板模板配置注入点不唯一")
    html=work/"scene.html"
    html.write_text(source.replace("/*WHITEBOARD_CONFIG*/","window.CONFIG="+json.dumps(config,ensure_ascii=False)+";"),encoding="utf-8")
    # Record resolved paths/hashes, not enormous inline data URLs.
    evidence=json.loads(json.dumps(config))
    for scene in evidence["scenes"]:
        for item in ([scene]+scene.get("items",[])):
            if item.get("image"):item["image"].pop("imageUrl",None)
    (work/"whiteboard_config.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding="utf-8")
    return html
