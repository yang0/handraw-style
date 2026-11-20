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
import math
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
MAX_IMAGE = 15 * 1024 * 1024
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
                *, raw: bool = False, limit: int | None = None, timeout: int = 40):
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
            with self.opener.open(req, timeout=timeout) as response:
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
            raise ValueError("还没绑定手绘风账号。告诉 Skill“绑定手绘风账号”，即可继续。")
        return API(token)


def account_status(state: str, **fields) -> dict:
    """Return only presentation-safe account information, never credentials."""
    footers = {
        "unbound": "👤 手绘风账号：未绑定｜说“绑定手绘风账号”，可同步私有图库与画风图型、下载获准离线使用的收藏、分享作品和互动。",
        "pending": "👤 手绘风账号：等待网页授权｜完成后说“我已授权”，我会继续绑定。",
        "expired": "👤 手绘风账号：授权链接已过期｜说“重新绑定账号”即可获取新链接。",
        "needs_rebind": "👤 手绘风账号：绑定已失效｜说“重新绑定账号”即可恢复连接。",
        "denied": "👤 手绘风账号：本次授权未获批准｜需要时说“绑定手绘风账号”重试。",
        "unverified": "👤 手绘风账号：本机已保存绑定，暂时无法向网站核验｜本地创作可以继续。",
        "unavailable": "👤 手绘风账号：暂时无法连接网站｜稍后说“绑定手绘风账号”重试，本地创作可以继续。",
    }
    if state == "connected":
        # A username is an identifier, not markdown or user-authored instructions.
        username = "".join(c for c in str(fields.get("username", "")) if c.isalnum() or c in "-_.")[:64]
        fields["username"] = username
        footer = f"👤 手绘风账号：已绑定 @{username}"
        level = fields.get("level")
        if isinstance(level, dict) and isinstance(level.get("level"), int):
            name = "".join(c for c in str(level.get("name", "")) if c.isalnum())[:12]
            footer += f" · Lv{level['level']} {name}".rstrip()
    else:
        footer = footers[state]
    return {"state": state, "connected": state == "connected", "footer": footer, **fields}


def pending_path() -> Path:
    return profile_home() / "cloud_pending_auth.json"


def verification_path(value) -> str:
    path = str(value)
    parsed = urllib.parse.urlsplit(path)
    if (not path.startswith("/") or parsed.netloc or parsed.scheme or parsed.fragment
            or "\\" in path or any(ord(c) < 32 for c in path)
            or any(part in (".", "..") for part in parsed.path.split("/"))):
        raise ValueError("网站返回了不安全的授权地址")
    return path


def read_pending() -> dict:
    pending = read_json(pending_path())
    if pending:
        verification_path(pending["verificationPath"])
        if (not isinstance(pending.get("deviceCode"), str) or not pending["deviceCode"]
                or not re.fullmatch(r"[A-Z0-9-]{4,32}", str(pending.get("userCode", "")))
                or not isinstance(pending.get("expiresAt"), (int, float))
                or not isinstance(pending.get("interval"), int) or not 5 <= pending["interval"] <= 60):
            raise ValueError("本机授权进度无效，请重新绑定账号")
    return pending


def pending_status(pending: dict) -> dict:
    return account_status("pending", userCode=pending["userCode"],
                          verificationUrl=BASE_URL + verification_path(pending["verificationPath"]),
                          expiresIn=max(0, int(pending["expiresAt"] - time.time())),
                          retryAfter=max(0, math.ceil(pending.get("nextPollAt", 0) - time.time())))


def current_account_status() -> dict:
    """A footer read never starts authorization, polls a device or uploads data."""
    try:
        credentials = Credentials().read()
    except (ValueError, OSError):
        return account_status("needs_rebind")
    token = credentials.get("token")
    try:
        pending = read_pending()
    except (ValueError, KeyError, OSError):
        if not token:
            return account_status("needs_rebind")
        pending = {}
    if pending and pending["expiresAt"] > time.time():
        return pending_status(pending)
    if token:
        if not isinstance(token, str) or not token.startswith("hwt_"):
            return account_status("needs_rebind")
        try:
            who = API(token).request("GET", "/api/auth/me", timeout=5)
        except CloudError as exc:
            return account_status("needs_rebind" if exc.status == 401 else "unverified")
        if not isinstance(who.get("username"), str) or not who["username"].strip():
            return account_status("unverified")
        level = None
        try:  # best effort: a level lookup never changes the account state
            raw = API(token).request("GET", "/api/me/level", timeout=5)
            if isinstance(raw.get("level"), int):
                level = {"level": raw["level"], "name": raw.get("name", ""), "xp": raw.get("xp", 0)}
        except Exception:
            level = None
        return account_status("connected", username=who["username"], **({"level": level} if level else {}))
    if pending:
        return account_status("expired")
    return account_status("unbound")


def start_binding(args) -> dict:
    """Start/resume device approval and return immediately to the conversation."""
    try:
        pending = read_pending()
    except (ValueError, KeyError, OSError):
        pending = {}
    if not pending or pending["expiresAt"] <= time.time():
        try:
            result = API().request("POST", "/api/auth/device",
                                   {"clientName": "Handraw Style Skill", "scopes": ["library", "publish"]})
        except CloudError:
            return account_status("unavailable")
        path = verification_path(result["verificationUrl"])
        code, secret = result["userCode"], result["deviceCode"]
        if (not isinstance(secret, str) or not secret
                or not re.fullmatch(r"[A-Z0-9-]{4,32}", str(code))):
            raise ValueError("网站未返回有效的设备授权信息")
        interval = max(5, min(int(result.get("interval", 5)), 60))
        pending = {"deviceCode": secret, "userCode": code, "verificationPath": path,
                   "expiresAt": time.time() + max(1, min(int(result.get("expiresIn", 600)), 600)),
                   "interval": interval, "nextPollAt": time.time() + interval}
        atomic_json(pending_path(), pending)
    receipt = pending_status(pending)
    if not args.no_browser:
        webbrowser.open(receipt["verificationUrl"])
    return receipt


def complete_binding() -> dict:
    """Check once after the user returns; do not block the conversational turn."""
    try:
        pending = read_pending()
    except (ValueError, KeyError, OSError):
        return account_status("needs_rebind")
    if not pending:
        return current_account_status()
    if pending["expiresAt"] <= time.time():
        return account_status("expired")
    if pending.get("nextPollAt", 0) > time.time():
        return pending_status(pending)
    pending["nextPollAt"] = time.time() + pending["interval"]
    atomic_json(pending_path(), pending)
    try:
        result = API().request("POST", "/api/auth/device/token", {"deviceCode": pending["deviceCode"]})
    except CloudError as exc:
        if exc.code == "slow_down":
            pending["interval"] = min(60, pending["interval"] + 5)
            pending["nextPollAt"] = time.time() + pending["interval"]
            atomic_json(pending_path(), pending)
        if exc.code in ("authorization_pending", "slow_down"):
            return pending_status(pending)
        if exc.code in ("access_denied", "expired_token", "invalid_grant"):
            pending_path().unlink(missing_ok=True)
            return account_status("denied" if exc.code == "access_denied" else "expired")
        return {**pending_status(pending), "message": "暂时无法确认授权，请稍后告诉我“我已授权”重试。"}
    # Persist the exchanged token before identity verification: device exchange
    # is one-shot, and a transient /me failure must not discard that grant.
    Credentials().save(result)
    pending_path().unlink(missing_ok=True)
    status = current_account_status()
    if status["connected"]:
        result["user"] = {"username": status["username"]}
        Credentials().save(result)
    return status


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
    verification = verification_path(result["verificationUrl"])
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
        pending_path().unlink(missing_ok=True)
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
        linked_uid = str(item.get("cloud_uid") or "")
        if linked_uid:
            try:
                linked_uid = str(uuid.UUID(linked_uid))
            except ValueError:
                raise ValueError(f"{local_id} 的云端资源 ID 无效，请先检查 library.json") from None
        if previous.get("uid") and linked_uid and previous["uid"] != linked_uid:
            raise ValueError(f"{local_id} 的本地同步记录与图库云端 ID 不一致，已停止覆盖")
        if linked_uid and previous.get("revision") is None:
            raise ValueError(f"{local_id} 已绑定云端资产但缺少版本记录，请先执行 assets pull 恢复版本，避免重复创建")
        uid = previous.get("uid") or linked_uid or str(uuid.uuid4())
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
        # Persist the cloud identity in the original local manifest to prevent
        # a later pull from importing this same picture as a second asset.
        if item.get("cloud_uid") != real_uid:
            item["cloud_uid"] = real_uid
            atomic_json(root / "library.json", manifest)
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


def share_webp(blob: bytes, max_edge: int = 2048, square: bool = False) -> tuple[bytes, str]:
    """Share-size image (handraw-web docs/sharing-v2.md: WebP, long edge <= 2048, q85).

    Without Pillow the original bytes are returned unchanged; the website also
    accepts PNG/JPEG.
    """
    if blob[:4] == b"GIF8":
        return blob, "image/gif"  # keep animation
    try:
        from PIL import Image
        from io import BytesIO
    except ImportError:
        if blob[8:12] == b"WEBP":
            return blob, "image/webp"
        return blob, "image/png" if blob[:4] == b"\x89PNG" else "image/jpeg"
    try:
        opened = Image.open(BytesIO(blob))
    except Exception:
        # Unreadable here: send unchanged and let the website validate it.
        if blob[8:12] == b"WEBP":
            return blob, "image/webp"
        return blob, "image/png" if blob[:4] == b"\x89PNG" else "image/jpeg"
    with opened as img:
        if img.width * img.height > 40_000_000:
            raise ValueError("图片像素过大")
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
        if square:
            side = min(img.size)
            left, top = (img.width - side) // 2, (img.height - side) // 2
            img = img.crop((left, top, left + side, top + side))
        img.thumbnail((max_edge, max_edge))
        out = BytesIO()
        img.save(out, "WEBP", quality=85)
        return out.getvalue(), "image/webp"


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
                local_id = str(existing["id"])
                if not id_is_safe(local_id):
                    raise ValueError("本地图库索引包含不安全的资产 ID")
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
            # Metadata changes are independent from image changes. Without this
            # check a remote pull could silently erase offline name/tag edits.
            if existing and not args.force:
                local_meta = {"cat": cat, "localId": local_id,
                              "name": existing.get("name", local_id),
                              "nameEn": existing.get("name_en", ""),
                              "tags": existing.get("tags", [])}
                local_fingerprint = hashlib.sha256(json.dumps(
                    local_meta, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
                known_fingerprint = previous.get("metadata")
                if known_fingerprint:
                    changed = local_fingerprint != known_fingerprint
                else:
                    # Partial API payloads do not imply the missing metadata
                    # was changed. Compare only fields explicitly returned.
                    changed = any(
                        local_meta[local_name] != item[remote_name]
                        for remote_name, local_name in
                        (("name", "name"), ("nameEn", "nameEn"), ("tags", "tags"))
                        if remote_name in item
                    )
                if changed:
                    results.append({"uid": uid, "conflict": "本地名称或标签已有修改，保留本地数据"})
                    continue
            # No tracked local hash means we cannot prove the local file is
            # unchanged; never overwrite it unless the user explicitly forces.
            if output.exists() and not args.force:
                current = hashlib.sha256(output.read_bytes()).hexdigest()
                # Recover a lost sync index only when the local file is
                # byte-identical to the authenticated server's SHA256.
                # Otherwise remain fail-closed and preserve local changes.
                known = previous.get("sha256") or item.get("sha256")
                if not known or current != known:
                    results.append({"uid": uid, "conflict": "本地图片未验证或已修改，保留本地文件"})
                    continue
            raw = api.request("GET", "/api/library/assets/" + uid + "/image", raw=True)
            if item.get("sha256") and hashlib.sha256(raw).hexdigest() != item["sha256"]:
                raise ValueError(f"{uid} 云端文件 SHA256 校验失败")
            image = _webp(raw)
            output.parent.mkdir(parents=True, exist_ok=True)
            tmp = output.with_name(output.name + "." + uuid.uuid4().hex + ".tmp")
            try:
                tmp.write_bytes(image)
                os.chmod(tmp, 0o600)
                os.replace(tmp, output)
            finally:
                tmp.unlink(missing_ok=True)
            if not existing:
                existing = {"id": local_id, "cloud_uid": uid}
                manifest[cat].append(existing)
            existing.update({"cloud_uid": uid, "name": item.get("name", local_id),
                             "name_en": item.get("nameEn", ""), "tags": item.get("tags", []),
                             "image": f"../../../images/custom/{cat}/{local_id}.webp"})
            synced_meta = {"cat": cat, "localId": local_id,
                           "name": existing["name"], "nameEn": existing["name_en"],
                           "tags": existing["tags"]}
            metadata_hash = hashlib.sha256(json.dumps(
                synced_meta, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            state.data["assets"][key] = {"uid": uid, "revision": int(item["revision"]),
                                          "sha256": hashlib.sha256(image).hexdigest(),
                                          "metadata": metadata_hash,
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
    # Refresh the ignored dynamic gallery index, never bake user assets into
    # tracked HTML. Only do so for the configured active library.
    config = read_json(profile_home() / "config.json")
    active = Path(str(config.get("tuku_dir") or "")).expanduser()
    manager_dir = ROOT / "skills" / "handdraw-style-prompter" / "scripts"
    if config.get("tuku_dir") and active.is_dir() and active.resolve() == root and manager_dir.is_dir():
        sys.path.insert(0, str(manager_dir))
        try:
            import custom_library_manager
            custom_library_manager.export_custom_assets_js()
        except Exception:
            results.append({"warning": "图库已恢复，但本地画廊索引刷新失败，请运行 custom-asset-manager"})
    return {"results": results, "note": "云端删除不会自动删除本地图片"}


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
    # #16 / Web #21: the website is authoritative for the stable USR-S/L code.
    # Never silently accept a conflicting code for the same local UUID/kind.
    expected_code = ("USR-S" if record["kind"] == "style" else "USR-L") + uid.replace("-", "").upper()
    code = str(item.get("code") or expected_code).strip().upper()
    if code != expected_code:
        raise ValueError("网站返回的自定义资源编号与本地 UUID/类别不一致；未确认同步")
    state.data["resources"][args.id] = {
        "revision": int(item["revision"]), "uid": uid, "code": code}
    state.save()
    return {"id": args.id, "remoteId": uid, "code": code,
            "revision": item["revision"], "visibility": "private"}


def resource_publish(args):
    """Publish one owned style/layout to the community (website sharing-v2 §2.1).

    Free resources go live at once; a point price sends it to the community
    jury first. The definition is pushed (private sync) before publishing.
    """
    pushed = resource_push(args)
    description = (args.description or "").strip()
    if not 8 <= len(description) <= 300:
        raise ValueError("简介需要 8 到 300 字")
    images = [Path(v).expanduser() for v in (args.image or [])]
    cover = Path(args.cover).expanduser()
    if not 2 <= len(images) <= 9:
        raise ValueError("需要 2 到 9 张示例图（加封面共至少 3 张）")
    for f in [cover, *images]:
        if not f.is_file() or f.is_symlink() or not 0 < f.stat().st_size <= MAX_IMAGE:
            raise ValueError(f"图片不可用：{f}")

    def data_url(path, **kw):
        blob, mime = share_webp(path.read_bytes(), **kw)
        return f"data:{mime};base64," + base64.b64encode(blob).decode()

    body = {"price": int(args.price), "description": description,
            "cover": data_url(cover, max_edge=1024, square=True),
            "images": [data_url(f) for f in images]}
    result = Credentials().client().request(
        "POST", f"/api/v1/me/resources/{pushed['remoteId']}/publish", body)
    published = result.get("published") or {}
    return {"id": args.id, "code": published.get("code"), "status": published.get("status"),
            "path": published.get("url"), "idempotent": bool(result.get("idempotent")),
            "note": "已公开到社区" if published.get("status") == "approved" else "已提交社区评审，通过后开售"}


def my_level():
    """Creator level, progress, price cap and jury checklist for the bound account."""
    raw = Credentials().client().request("GET", "/api/me/level")
    jury = raw.get("jury") or {}
    return {
        "level": raw.get("level"), "name": raw.get("name"), "xp": raw.get("xp"),
        "next": ({"level": raw.get("nextLevel"), "name": raw.get("nextName"), "xpNeeded": int(raw.get("nextXp") or 0) - int(raw.get("xp") or 0)}
                 if raw.get("nextLevel") else None),
        "perks": raw.get("perks") or [],
        "priceCap": raw.get("priceCap", 0),
        "jury": {"eligible": bool(jury.get("eligible")), "checks": jury.get("checks") or []},
    }


def resources_list():
    data = Credentials().client().request("GET", "/api/skill/library")
    return {"collected": data.get("collected", []), "owned": data.get("owned", []),
            "official": data.get("official", [])}


def resource_restore(args):
    """Restore owned definitions from the planned contract without destroying edits."""
    from importlib.util import spec_from_file_location, module_from_spec
    path = ROOT / "skills" / "personal-library" / "scripts" / "personal_library.py"
    spec = spec_from_file_location("handraw_personal_resources", path)
    mod = module_from_spec(spec)
    spec.loader.exec_module(mod)
    os.environ.setdefault("HANDRAW_SKILL_ROOT", str(ROOT))
    library = mod.Library()
    local = library.index()
    by_id = {r["id"]: r for r in local["resources"]}
    state = SyncState(Credentials().read())
    cursor, results = None, []
    while True:
        query = "limit=100" + ("&since=" + urllib.parse.quote(cursor) if cursor else "")
        response = Credentials().client().request("GET", "/api/v1/me/resources?" + query)
        for item in response.get("items", []):
            if item.get("kind") not in ("style", "layout"):
                continue
            uid = str(uuid.UUID(str(item["id"])))
            key = "mine:" + uid
            if item.get("deletedAt"):
                results.append({"id": key, "skipped": "云端软删除，本地保留"})
                continue
            definition = item.get("definition")
            if not isinstance(definition, dict):
                raise ValueError("服务端个人资源缺少完整定义")
            fields = {"id": key, "kind": item["kind"],
                      "name": str(item.get("name") or ""),
                      "prompt_zh": str(definition.get("zh") or ""),
                      "prompt_en": str(definition.get("en") or ""),
                      "license": str(item.get("license") or ""),
                      "version": str(item.get("version") or "1.0.0"),
                      "section": "owned", "origin": item.get("origin"),
                      "examples": item.get("examples") or []}
            library.validate_resource(fields)
            existing = by_id.get(key)
            if existing:
                comparable = ("name", "kind", "prompt_zh", "prompt_en", "license", "version", "origin", "examples")
                if any(existing.get(k) != fields.get(k) for k in comparable) and not args.force:
                    results.append({"id": key, "conflict": "本地定义不同，未覆盖；使用 --force 才覆盖"})
                    continue
                existing.update(fields)
            else:
                local["resources"].append(fields)
                by_id[key] = fields
            expected_code = ("USR-S" if item["kind"] == "style" else "USR-L") + uid.replace("-", "").upper()
            code = str(item.get("code") or expected_code).strip().upper()
            if code != expected_code:
                raise ValueError("网站个人资源编号与 UUID 不匹配，拒绝覆盖本地数据")
            state.data["resources"][key] = {
                "uid": uid, "code": code, "revision": int(item["revision"])}
            library.write(local)
            state.save()
            results.append({"id": key, "code": code, "restored": True})
        if not response.get("hasMore"):
            break
        next_cursor = str(response.get("nextCursor") or "")
        if not next_cursor or next_cursor == cursor:
            raise ValueError("个人资源分页游标无效")
        cursor = next_cursor
    return {"results": results}


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
    location.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
    location.mkdir(mode=0o700, exist_ok=False)
    files = []
    try:
        for idx, filename in enumerate(args.image):
            source = Path(filename).expanduser()
            if (not source.is_file() or source.is_symlink() or
                    not 0 < source.stat().st_size <= MAX_IMAGE):
                raise ValueError("图片不存在、为空、是符号链接或超过大小限制")
            # The original extension is preserved. Never serve this directory publicly.
            suffix = source.suffix.lower()
            if suffix not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
                raise ValueError("仅允许 PNG/JPEG/WebP/GIF 图片")
            output = location / f"{idx + 1:03d}{suffix}"
            shutil.copyfile(source, output)
            os.chmod(output, 0o600)
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
    """Upload explicitly selected local images as public works. No second publish step."""
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
        shared, mime = share_webp(blob)
        name = Path(entry["file"]).stem + (".webp" if mime == "image/webp" else Path(entry["file"]).suffix)
        items.append({"name": name, "sha256": hashlib.sha256(shared).hexdigest(),
                      "dataUrl": f"data:{mime};base64," + base64.b64encode(shared).decode()})
    # Upload is the explicit public-sharing action, not a private backup.
    # Local history creation stays offline, and never publishes anything.
    data = {"externalRunId": rid, "originClient": "skill", "visibility": "public",
            "status": "success", "originalRequest": record["originalRequest"],
            "images": items, "requestId": f"skill-history-{rid}"}
    # Sharing v2: optional title, notes and a structured recipe so others can
    # make the same picture. Only official codes; own resources by website id.
    if getattr(args, "title", None):
        data["title"] = args.title.strip()[:60]
    if getattr(args, "notes", None):
        data["notes"] = args.notes.strip()[:2000]
    recipe = {}
    if getattr(args, "style", None):
        recipe["styles"] = [code for code in args.style if not code.upper().startswith("MY-")][:2]
    if getattr(args, "layout", None) and not args.layout.upper().startswith("MY-"):
        recipe["layout"] = args.layout
    if getattr(args, "ratio", None):
        recipe["ratio"] = args.ratio
    if getattr(args, "personal_resource", None):
        recipe["personalResources"] = [str(uuid.UUID(v.removeprefix("mine:"))) for v in args.personal_resource][:4]
    if recipe:
        data["recipe"] = recipe
    result = Credentials().client().request("POST", "/api/v1/me/generations", data)
    # V3: one uploaded run -> one canonical multi-image work. A partial or
    # malformed acknowledgement must never mark the local history as synced.
    work_id = str(result.get("workId") or "").strip()
    work_ids = result.get("workIds")
    if (not work_id or work_ids != [work_id] or
            result.get("imageCount") != len(items)):
        raise ValueError("云端未确认整批图片属于同一件作品；本地记录未标记为已同步")
    record["cloudState"] = "synced"
    record["cloudId"] = result.get("id")
    record["workId"] = work_id
    record["workIds"] = [work_id]
    record["imageCount"] = len(items)
    record["coverMediaId"] = str(result.get("coverMediaId") or "")
    record["coverUrl"] = str(result.get("coverUrl") or "")
    record["visibility"] = "public"
    record["url"] = str(result.get("url") or "")
    atomic_json(folder / "record.json", record)
    return {"runId": rid, "synced": True, "cloudId": result.get("id"),
            "workId": work_id, "workIds": [work_id],
            "imageCount": len(items),
            "coverMediaId": record["coverMediaId"], "coverUrl": record["coverUrl"],
            "url": record["url"], "visibility": "public"}


def planned_get(path: str):
    return Credentials().client().request("GET", path)


def work_id(value: str) -> str:
    # Published works may use both UUIDs and legacy 'work_...' IDs.
    clean = str(value or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", clean):
        raise ValueError("作品 ID 格式不安全")
    return clean


def public_work(args):
    return API().request("GET", "/api/works/" + work_id(args.id))


def public_comments(args):
    response = public_work(args)
    work = response.get("work") or {}
    return {"id": work_id(args.id), "comments": work.get("comments", [])}


def public_works(args):
    if not args.author:
        raise ValueError("请指定公开作品作者用户名")
    query = urllib.parse.urlencode({"author": args.author, "limit": "24"})
    return API().request("GET", "/api/works/feed?" + query)


def planned_like(args):
    return Credentials().client().request("POST",
        "/api/v1/works/" + work_id(args.id) + "/likes", {"liked": not args.remove})


def planned_comment(args):
    text = args.text.strip()
    if not 1 <= len(text) <= 3000:
        raise ValueError("评论内容长度需为 1–3000 字符")
    return Credentials().client().request("POST",
        "/api/v1/works/" + work_id(args.id) + "/comments",
        {"text": text, "requestId": "skill-comment-" + str(uuid.uuid4())})


def planned_collect(args):
    # This route and explicit 'set/unset' actions already exist in handraw-web
    # and are permitted by the current library-scoped device tokens.
    return Credentials().client().request("POST", "/api/collections/toggle",
        {"bucket": "works", "id": work_id(args.id),
         "action": "unset" if args.remove else "set"})


def output(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    command = parser.add_subparsers(dest="command", required=True)
    bind = command.add_parser("bind", help="网站授权 Skill 设备令牌")
    bind.add_argument("--no-browser", action="store_true")
    binding_mode = bind.add_mutually_exclusive_group()
    binding_mode.add_argument("--start", action="store_true", help="返回授权链接，供自然语言对话使用")
    binding_mode.add_argument("--check", action="store_true", help="用户完成网页授权后检查一次")
    command.add_parser("status", help="返回可直接展示的账号状态，不自动绑定或上传")
    command.add_parser("whoami", help="校验当前网站身份")
    command.add_parser("level", help="查看创作等级、经验、收费定价上限与评审团条件")
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
    rpub = rc.add_parser("publish", help="把自建画风/图型发布到社区：免费即上架，收费经社区评审")
    rpub.add_argument("--id", required=True)
    rpub.add_argument("--description", required=True)
    rpub.add_argument("--price", type=int, default=0, help="积分价格，0 为免费；须为网站配置的档位")
    rpub.add_argument("--cover", required=True, help="封面图，会自动裁成正方形")
    rpub.add_argument("--image", action="append", required=True, help="示例图，2-9 张")
    restore = rc.add_parser("restore"); restore.add_argument("--force", action="store_true")
    history = command.add_parser("history")
    hc = history.add_subparsers(dest="action", required=True)
    make = hc.add_parser("record")
    make.add_argument("--image", action="append", required=True)
    make.add_argument("--original-request-file", required=True)
    make.add_argument("--run-id")
    upload = hc.add_parser("upload", help="将本地作品上传并自动公开，不需第二次发布"); upload.add_argument("--run-id", required=True)
    upload.add_argument("--title", help="作品标题，最多 60 字")
    upload.add_argument("--notes", help="创作说明/配方心得，最多 2000 字")
    upload.add_argument("--style", action="append", help="官方画风编号，最多 2 个")
    upload.add_argument("--layout", help="官方图型编号")
    upload.add_argument("--ratio", help="画面比例，如 3:4")
    upload.add_argument("--personal-resource", action="append", help="用到的自建资源 ID（只传网站 ID，不传定义）")
    hc.add_parser("list")
    hc.add_parser("cloud-list", help="读取网站统一生成历史与对应公开作品")
    works = command.add_parser("works", help="公开作品的无需登录查询")
    wc = works.add_subparsers(dest="action", required=True)
    work_list = wc.add_parser("list"); work_list.add_argument("--author", required=True)
    work_detail = wc.add_parser("detail"); work_detail.add_argument("--id", required=True)
    social = command.add_parser("social")
    sc = social.add_subparsers(dest="action", required=True)
    sc.add_parser("notifications")
    comments = sc.add_parser("comments"); comments.add_argument("--id", required=True)
    like = sc.add_parser("like"); like.add_argument("--id", required=True)
    like.add_argument("--remove", action="store_true")
    comment = sc.add_parser("comment"); comment.add_argument("--id", required=True)
    comment.add_argument("--text", required=True)
    collect = sc.add_parser("collect"); collect.add_argument("--id", required=True)
    collect.add_argument("--remove", action="store_true")
    publish = command.add_parser("publish", help="用户明确授权后发布已准备的作品草稿")
    publish.add_argument("--draft", required=True)
    args = parser.parse_args(argv)
    if args.command == "bind":
        if args.start:
            output(start_binding(args))
        elif args.check:
            output(complete_binding())
        else:
            bind_account(args)
        return
    if args.command == "status":
        output(current_account_status())
    elif args.command == "level":
        output(my_level())
    elif args.command == "whoami":
        output(Credentials().client().request("GET", "/api/auth/me"))
    elif args.command == "unbind":
        Credentials().clear()
        pending_path().unlink(missing_ok=True)
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
        elif args.action == "push":
            output(resource_push(args))
        elif args.action == "publish":
            output(resource_publish(args))
        else:
            output(resource_restore(args))
    elif args.command == "history":
        if args.action == "record":
            output(local_history_create(args))
        elif args.action == "upload":
            output(local_history_upload(args))
        elif args.action == "cloud-list":
            output(planned_get("/api/v1/me/generations?limit=100"))
        else:
            folder = profile_home() / "generation-history"
            output({"records": [read_json(p) for p in sorted(folder.glob("*/record.json"))] if folder.exists() else []})
    elif args.command == "works":
        output(public_works(args) if args.action == "list" else public_work(args))
    elif args.command == "social":
        if args.action == "notifications":
            output(planned_get("/api/v1/me/notifications"))
        elif args.action == "comments":
            output(public_comments(args))
        elif args.action == "like":
            output(planned_like(args))
        elif args.action == "comment":
            output(planned_comment(args))
        else:
            output(planned_collect(args))
    elif args.command == "publish":
        import subprocess
        target = ROOT / "skills" / "community-share" / "scripts" / "conversation_share.py"
        subprocess.run([sys.executable, str(target), "publish", "--draft", args.draft], check=True)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, CloudError, OSError) as exc:
        raise SystemExit(str(exc)) from None
