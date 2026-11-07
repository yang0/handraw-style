#!/usr/bin/env python3
"""Handraw account, library, resource and creation cloud bridge.

Only explicit CLI commands upload or publish anything. The website owns permissions,
revisions and publication; unavailable /api/v1 endpoints fail closed.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import mimetypes
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import webbrowser
from pathlib import Path

BASE_URL = "https://handraw-style.com"
MAX_JSON = 4 * 1024 * 1024
MAX_IMAGE = 24 * 1024 * 1024
CATEGORIES = ("characters", "props", "scenes")
ROOT = Path(__file__).resolve().parents[3]


def profile_home() -> Path:
    return Path(os.environ.get("HANDRAW_PROFILE_HOME") or (Path.home() / ".handraw-style")).expanduser()


def atomic_json(path: Path, data: dict) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=".cloud-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            json.dump(data, out, ensure_ascii=False, indent=2)
            out.write("\n")
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def read_json(path: Path, default: dict | None = None) -> dict:
    if not path.exists():
        return default.copy() if default is not None else {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("本地云端索引格式异常")
    return data


class CloudError(Exception):
    def __init__(self, status: int, code: str, detail: str = ""):
        self.status, self.code = status, code
        self.detail = detail[:180]
        super().__init__(f"网站接口失败 HTTP {status} [{code}]" + (f"：{self.detail}" if self.detail else ""))


class RejectRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("拒绝跟随重定向，避免泄露账号令牌")


class API:
    """A pinned-origin API client; transport injection allows fully offline tests."""

    def __init__(self, token: str | None = None, opener=None):
        self.token = token
        self.opener = opener or urllib.request.build_opener(RejectRedirect())

    def request(self, method: str, path: str, body: dict | None = None,
                *, raw: bool = False, limit: int | None = None):
        parsed = urllib.parse.urlsplit(path)
        if (parsed.scheme or parsed.netloc or parsed.fragment or
                not parsed.path.startswith(("/api/", "/studio/api/")) or
                parsed.path.startswith("//") or "\\" in path or
                any(segment in (".", "..") for segment in parsed.path.split("/")) or
                any(ord(c) < 32 for c in path)):
            raise ValueError("禁止跨站或非法的 API 请求路径")
        if method not in ("GET", "POST", "PUT", "DELETE"):
            raise ValueError("不支持的 HTTP 方法")
        headers = {"Accept": "*/*" if raw else "application/json",
                   "User-Agent": "HandrawSkillCloud/1.0"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        payload = None
        if body is not None:
            payload = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            headers["Content-Type"] = "application/json; charset=utf-8"
        req = urllib.request.Request(BASE_URL + path, data=payload, headers=headers, method=method)
        cap = limit or (MAX_IMAGE if raw else MAX_JSON)
        try:
            with self.opener.open(req, timeout=40) as response:
                data = response.read(cap + 1)
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read(16384))
                code = str(detail.get("code") or detail.get("error") or "http_error")
            except (ValueError, AttributeError):
                code = "http_error"
            if exc.code == 404 and path.startswith("/api/v1/"):
                code = "server_contract_not_ready"
            raise CloudError(exc.code, code) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise CloudError(0, "network_error", "网络不可用，未删除本地数据") from None
        if len(data) > cap:
            raise ValueError("服务器响应超过安全限制")
        if raw:
            return data
        try:
            result = json.loads(data)
        except ValueError:
            raise CloudError(502, "invalid_json") from None
        if not isinstance(result, dict) or result.get("ok") is False:
            raise CloudError(502, str(result.get("code", "invalid_response")) if isinstance(result, dict) else "invalid_response")
        return result


class Credentials:
    def __init__(self, root: Path | None = None):
        self.path = (root or profile_home()) / "cloud_auth.json"

    def read(self) -> dict:
        return read_json(self.path)

    def save(self, data: dict) -> None:
        token = data.get("token")
        if not isinstance(token, str) or not token.startswith("hwt_"):
            raise ValueError("网站未返回可使用的个人设备令牌")
        atomic_json(self.path, {"token": token, "scopes": data.get("scopes", []),
                                "user": data.get("user", {})})

    def clear(self) -> None:
        self.path.unlink(missing_ok=True)

    def client(self) -> API:
        token = self.read().get("token")
        if not token:
            raise ValueError("Skill 尚未绑定网站账号：运行 handraw_cloud.py bind")
        return API(token)


class SyncState:
    def __init__(self, auth: dict):
        username = str(auth.get("user", {}).get("username", "")).strip().lower()
        if not username:
            raise ValueError("登录资料缺少用户名，请重新绑定")
        ident = hashlib.sha256(username.encode()).hexdigest()[:16]
        self.path = profile_home() / f"cloud-sync-{ident}.json"
        self.data = read_json(self.path, {"assets": {}, "cursors": {}, "resources": {}})
        for field in ("assets", "cursors", "resources"):
            self.data.setdefault(field, {})

    def save(self):
        atomic_json(self.path, self.data)


def bind_account(args):
    api = API()
    result = api.request("POST", "/api/auth/device",
                         {"clientName": "Handraw Style Skill", "scopes": ["library", "publish"]})
    code, secret = result["userCode"], result["deviceCode"]
    verification = str(result["verificationUrl"])
    if not verification.startswith("/") or verification.startswith("//"):
        raise ValueError("网站返回了不安全的授权地址")
    url = BASE_URL + verification
    print(f"请在网站登录并批准 Skill 授权：{url}\n设备验证码：{code}", flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    deadline = time.monotonic() + min(int(result.get("expiresIn", 600)), 600)
    interval = max(5, int(result.get("interval", 5)))
    while time.monotonic() < deadline:
        time.sleep(interval)
        try:
            token = api.request("POST", "/api/auth/device/token", {"deviceCode": secret})
        except CloudError as exc:
            if exc.code == "authorization_pending":
                continue
            if exc.code == "slow_down":
                interval += 5
                continue
            raise
        Credentials().save(token)
        who = Credentials().client().request("GET", "/api/auth/me")
        print(json.dumps({"connected": True, "username": who.get("username"),
                          "scopes": who.get("scopes")}, ensure_ascii=False))
        return
    raise ValueError("设备授权已超时，没有保存令牌，请重新执行绑定")


def custom_root(arg: str | None) -> Path:
    if arg:
        root = Path(arg).expanduser()
    else:
        cfg = read_json(profile_home() / "config.json")
        if not cfg.get("tuku_dir"):
            raise ValueError("请先初始化自建图库，或传 --library-dir 指定图库")
        root = Path(str(cfg["tuku_dir"])).expanduser()
    if not root.is_dir():
        raise ValueError("本地图库路径不存在")
    return root.resolve()


def load_manifest(root: Path) -> dict:
    result = read_json(root / "library.json")
    for cat in CATEGORIES:
        if not isinstance(result.get(cat), list):
            result[cat] = []
    return result


def id_is_safe(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value))


def key_for(root: Path, cat: str, local_id: str) -> str:
    return f"{root}|{cat}|{local_id}"


def asset_push(args):
    api, state = Credentials().client(), SyncState(Credentials().read())
    root = custom_root(args.library_dir)
    manifest = load_manifest(root)
    candidates = [(cat, item) for cat in CATEGORIES for item in manifest[cat]
                  if isinstance(item, dict) and id_is_safe(str(item.get("id", "")))]
    if args.id:
        candidates = [(cat, item) for cat, item in candidates if item["id"] == args.id]
        if not candidates:
            raise ValueError("自建图库找不到该资产 ID")
    results = []
    for cat, item in candidates:
        local_id = str(item["id"])
        file = root / cat / (local_id + ".webp")
        if not file.is_file() or file.is_symlink():
            results.append({"localId": local_id, "skipped": "找不到 WebP 原图"})
            continue
        blob = file.read_bytes()
        if not 0 < len(blob) <= MAX_IMAGE or not blob.startswith(b"RIFF") or blob[8:12] != b"WEBP":
            raise ValueError(f"{local_id} 不是有效大小的 WebP 资源文件")
        sha = hashlib.sha256(blob).hexdigest()
        meta = {"cat": cat, "localId": local_id, "name": item.get("name", local_id),
                "nameEn": item.get("name_en", ""), "tags": item.get("tags", [])}
        fingerprint = hashlib.sha256(json.dumps(meta, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        key = key_for(root, cat, local_id)
        previous = state.data["assets"].get(key, {})
        if previous.get("sha256") == sha and previous.get("metadata") == fingerprint and not args.force:
            results.append({"localId": local_id, "uid": previous.get("uid"), "unchanged": True})
            continue
        uid = previous.get("uid") or str(uuid.uuid4())
        payload = dict(meta, sha256=sha, dataUrl="data:image/webp;base64," +
                       base64.b64encode(blob).decode("ascii"), origin="skill")
        if previous.get("revision") is not None:
            payload["baseRevision"] = int(previous["revision"])
        response = api.request("PUT", "/api/library/assets/" + uid, payload)
        remote = response.get("item", response)
        real_uid = str(remote.get("uid") or uid)
        state.data["assets"][key] = {"uid": real_uid, "revision": int(remote["revision"]),
                                      "sha256": sha, "metadata": fingerprint}
        state.save()
        results.append({"localId": local_id, "uid": real_uid,
                        "revision": remote["revision"], "deduped": bool(response.get("deduped"))})
    return {"results": results}


def _webp(blob: bytes) -> bytes:
    if blob[:4] == b"RIFF" and blob[8:12] == b"WEBP":
        return blob
    try:
        from PIL import Image
        from io import BytesIO
        with Image.open(BytesIO(blob)) as img:
            if img.width * img.height > 40_000_000:
                raise ValueError("图片像素过大")
            out = BytesIO()
            img.convert("RGBA" if "A" in img.getbands() else "RGB").save(out, "WEBP", quality=92)
            return out.getvalue()
    except ImportError:
        raise ValueError("云端 PNG/JPEG 导入图库需要 Pillow：pip install Pillow") from None


def asset_pull(args):
    """Import into an explicit custom library. Never delete local files on remote tombstones."""
    api, state = Credentials().client(), SyncState(Credentials().read())
    root = custom_root(args.library_dir)
    manifest = load_manifest(root)
    results = []
    cursor = None
    while True:
        query = "limit=200" + (("&since=" + urllib.parse.quote(cursor)) if cursor is not None else "")
        payload = api.request("GET", "/api/library/assets?" + query)
        for item in payload.get("items", []):
            cat = item.get("cat")
            uid = str(item.get("uid", ""))
            if cat not in CATEGORIES or not re.fullmatch(r"[a-f0-9-]{36}", uid, re.I):
                continue
            if item.get("deletedAt"):
                results.append({"uid": uid, "skipped": "云端已删除，本地数据保留"})
                continue
            existing = next((p for p in manifest[cat] if p.get("cloud_uid") == uid), None)
            if existing:
                local_id = existing["id"]
            else:
                wanted = str(item.get("localId") or "")
                occupied = {p.get("id") for p in manifest[cat]}
                local_id = wanted if id_is_safe(wanted) and wanted not in occupied else "CLOUD-" + uid.split("-")[0].upper()
                while local_id in occupied:
                    local_id += "X"
            key = key_for(root, cat, local_id)
            previous = state.data["assets"].get(key, {})
            output = root / cat / (local_id + ".webp")
            if previous.get("revision") == item.get("revision") and output.exists() and not args.force:
                continue
            if output.exists() and not existing:
                raise ValueError(f"本地路径冲突，不覆盖：{output}")
            # Do not overwrite a modified local image, even if this was previously synced.
            if output.exists() and previous.get("sha256"):
                current = hashlib.sha256(output.read_bytes()).hexdigest()
                if current != previous["sha256"] and not args.force:
                    results.append({"uid": uid, "conflict": "本地图片已修改，保留本地文件"})
                    continue
            raw = api.request("GET", "/api/library/assets/" + uid + "/image", raw=True)
            if item.get("sha256") and hashlib.sha256(raw).hexdigest() != item["sha256"]:
                raise ValueError(f"{uid} 云端文件 SHA256 校验失败")
            image = _webp(raw)
            output.parent.mkdir(parents=True, exist_ok=True)
            tmp = output.with_name(output.name + "." + uuid.uuid4().hex + ".tmp")
            try:
                tmp.write_bytes(image)
                os.replace(tmp, output)
            finally:
                tmp.unlink(missing_ok=True)
            if not existing:
                existing = {"id": local_id, "cloud_uid": uid}
                manifest[cat].append(existing)
            existing.update({"cloud_uid": uid, "name": item.get("name", local_id),
                             "name_en": item.get("nameEn", ""), "tags": item.get("tags", []),
                             "image": f"../../../images/custom/{cat}/{local_id}.webp"})
            state.data["assets"][key] = {"uid": uid, "revision": int(item["revision"]),
                                          "sha256": hashlib.sha256(image).hexdigest(),
                                          "remoteSha256": item.get("sha256", "")}
            atomic_json(root / "library.json", manifest)
            state.save()
            mirror = ROOT / "images" / "custom" / cat / (local_id + ".webp")
            mirror.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(output, mirror)
            results.append({"uid": uid, "localId": local_id, "restored": True})
        if not payload.get("hasMore"):
            break
        next_cursor = payload.get("nextCursor")
        if not next_cursor or next_cursor == cursor:
            raise ValueError("服务端分页游标没有前进，停止同步避免循环")
        cursor = str(next_cursor)
    return {"results": results, "note": "远端删除不会自动删除本地图片；可使用 custom-asset-manager 刷新画廊"}


def resource_push(args):
    """Explicitly push one owned definition to the planned Web resource contract."""
    from importlib.util import spec_from_file_location, module_from_spec
    path = ROOT / "skills" / "personal-library" / "scripts" / "personal_library.py"
    spec = spec_from_file_location("handraw_personal_resources", path)
    mod = module_from_spec(spec)
    spec.loader.exec_module(mod)
    library = mod.Library()
    record = library.get(args.id)
    if record.get("section") != "owned" or record.get("kind") not in ("style", "layout"):
        raise ValueError("只有自建的画风/图型可以同步为本人资源")
    record_id = str(record["id"]).removeprefix("mine:")
    uid = str(uuid.UUID(record_id))
    state = SyncState(Credentials().read())
    previous = state.data["resources"].get(args.id, {})
    body = {"id": uid, "kind": record["kind"], "name": record["name"],
            "definition": {"zh": record["prompt_zh"], "en": record["prompt_en"]},
            "license": record["license"], "examples": record.get("examples", []),
            "version": record.get("version", "1.0.0"), "visibility": "private",
            "origin": record.get("origin"), "schemaVersion": 1}
    if previous.get("revision") is not None:
        body["baseRevision"] = int(previous["revision"])
    response = Credentials().client().request("PUT", "/api/v1/me/resources/" + uid, body)
    item = response.get("resource", response.get("item", response))
    state.data["resources"][args.id] = {"revision": int(item["revision"]), "uid": uid}
    state.save()
    return {"id": args.id, "remoteId": uid, "revision": item["revision"], "visibility": "private"}


def resources_list():
    data = Credentials().client().request("GET", "/api/skill/library")
    return {"collected": data.get("collected", []), "owned": data.get("owned", []),
            "official": data.get("official", [])}


def local_history_create(args):
    """Durably copy explicitly supplied images. No network and no publication."""
    if not args.image or not args.original_request_file:
        raise ValueError("需要图片和原始创作指令文件")
    original = Path(args.original_request_file).read_text(encoding="utf-8")
    if not original.strip():
        raise ValueError("原始创作指令不能为空")
    rid = str(uuid.UUID(args.run_id)) if args.run_id else str(uuid.uuid4())
    location = profile_home() / "generation-history" / rid
    if location.exists():
        raise ValueError("该生成 ID 已有记录，不覆盖")
    location.mkdir(parents=True, exist_ok=False)
    files = []
    try:
        for idx, filename in enumerate(args.image):
            source = Path(filename).expanduser()
            if not source.is_file() or source.is_symlink() or source.stat().st_size > MAX_IMAGE:
                raise ValueError("图片不存在、是符号链接或超过大小限制")
            # The original extension is preserved. Never serve this directory publicly.
            suffix = source.suffix.lower()
            if suffix not in (".png", ".jpg", ".jpeg", ".webp"):
                raise ValueError("仅允许 PNG/JPEG/WebP 图片")
            output = location / f"{idx + 1:03d}{suffix}"
            shutil.copyfile(source, output)
            files.append({"file": output.name, "sha256": hashlib.sha256(output.read_bytes()).hexdigest()})
        record = {"runId": rid, "originClient": "skill", "status": "success",
                  "originalRequest": original, "images": files,
                  "createdAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                  "cloudState": "local_only"}
        atomic_json(location / "record.json", record)
        return {"runId": rid, "localOnly": True, "images": len(files)}
    except Exception:
        shutil.rmtree(location, ignore_errors=True)
        raise


def local_history_upload(args):
    """Pending backend API. Never silently promote private generations to public works."""
    rid = str(uuid.UUID(args.run_id))
    folder = profile_home() / "generation-history" / rid
    record = read_json(folder / "record.json")
    if not record:
        raise ValueError("本地生成历史不存在")
    items = []
    for entry in record.get("images", []):
        file = (folder / entry["file"]).resolve()
        if file.parent != folder.resolve() or not file.is_file():
            raise ValueError("生成历史图片路径无效")
        blob = file.read_bytes()
        if hashlib.sha256(blob).hexdigest() != entry["sha256"]:
            raise ValueError("生成历史图片已变化，禁止误传")
        mime = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
        items.append({"name": entry["file"], "sha256": entry["sha256"],
                      "dataUrl": f"data:{mime};base64," + base64.b64encode(blob).decode()})
    data = {"externalRunId": rid, "originClient": "skill", "visibility": "private",
            "status": "success", "originalRequest": record["originalRequest"],
            "images": items, "requestId": f"skill-history-{rid}"}
    result = Credentials().client().request("POST", "/api/v1/me/generations", data)
    record["cloudState"] = "synced"
    record["cloudId"] = result.get("id")
    atomic_json(folder / "record.json", record)
    return {"runId": rid, "synced": True, "cloudId": result.get("id"), "visibility": "private"}


def planned_get(path: str):
    return Credentials().client().request("GET", path)


def planned_like(args):
    return Credentials().client().request("POST",
        "/api/v1/works/" + str(uuid.UUID(args.id)) + "/likes", {"liked": not args.remove})


def output(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    command = parser.add_subparsers(dest="command", required=True)
    bind = command.add_parser("bind", help="网站授权 Skill 设备令牌")
    bind.add_argument("--no-browser", action="store_true")
    command.add_parser("whoami", help="校验当前网站身份")
    command.add_parser("unbind", help="清除本机令牌（网站也可撤销授权）")
    assets = command.add_parser("assets")
    ac = assets.add_subparsers(dest="action", required=True)
    for name in ("push", "pull"):
        p = ac.add_parser(name)
        p.add_argument("--library-dir")
        p.add_argument("--force", action="store_true")
        if name == "push":
            p.add_argument("--id")
    ac.add_parser("list")
    resources = command.add_parser("resources")
    rc = resources.add_subparsers(dest="action", required=True)
    rc.add_parser("list")
    pull = rc.add_parser("pull"); pull.add_argument("--id", required=True)
    push = rc.add_parser("push"); push.add_argument("--id", required=True)
    history = command.add_parser("history")
    hc = history.add_subparsers(dest="action", required=True)
    make = hc.add_parser("record")
    make.add_argument("--image", action="append", required=True)
    make.add_argument("--original-request-file", required=True)
    make.add_argument("--run-id")
    upload = hc.add_parser("upload"); upload.add_argument("--run-id", required=True)
    hc.add_parser("list")
    social = command.add_parser("social")
    sc = social.add_subparsers(dest="action", required=True)
    sc.add_parser("notifications")
    comments = sc.add_parser("comments"); comments.add_argument("--id", required=True)
    like = sc.add_parser("like"); like.add_argument("--id", required=True)
    like.add_argument("--remove", action="store_true")
    publish = command.add_parser("publish", help="用户明确授权后发布已准备的作品草稿")
    publish.add_argument("--draft", required=True)
    args = parser.parse_args(argv)
    if args.command == "bind":
        bind_account(args)
        return
    if args.command == "whoami":
        output(Credentials().client().request("GET", "/api/auth/me"))
    elif args.command == "unbind":
        Credentials().clear()
        output({"localCredentialsCleared": True,
                "note": "如需服务端撤销令牌，请在网站账号设置的授权设备页面撤销"})
    elif args.command == "assets":
        if args.action == "push":
            output(asset_push(args))
        elif args.action == "pull":
            output(asset_pull(args))
        else:
            output(planned_get("/api/library/assets?limit=200"))
    elif args.command == "resources":
        if args.action == "list":
            output(resources_list())
        elif args.action == "pull":
            import subprocess
            target = ROOT / "scripts" / "personal_library.py"
            subprocess.run([sys.executable, str(target), "sync", "--id", args.id], check=True)
        else:
            output(resource_push(args))
    elif args.command == "history":
        if args.action == "record":
            output(local_history_create(args))
        elif args.action == "upload":
            output(local_history_upload(args))
        else:
            folder = profile_home() / "generation-history"
            output({"records": [read_json(p) for p in sorted(folder.glob("*/record.json"))] if folder.exists() else []})
    elif args.command == "social":
        if args.action == "notifications":
            output(planned_get("/api/v1/me/notifications"))
        elif args.action == "comments":
            output(planned_get("/api/v1/works/" + str(uuid.UUID(args.id)) + "/comments"))
        else:
            output(planned_like(args))
    elif args.command == "publish":
        import subprocess
        target = ROOT / "skills" / "community-share" / "scripts" / "conversation_share.py"
        subprocess.run([sys.executable, str(target), "publish", "--draft", args.draft], check=True)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, CloudError, OSError) as exc:
        raise SystemExit(str(exc)) from None
