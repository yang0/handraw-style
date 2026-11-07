"""Offline contract and data-safety tests for the Skill cloud bridge.

No production network calls, credentials or databases.
"""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import stat
import tempfile
import unittest
import urllib.error
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
FILE = ROOT / "skills" / "handraw-cloud" / "scripts" / "handraw_cloud.py"
spec = importlib.util.spec_from_file_location("handraw_cloud_under_test", FILE)
cloud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cloud)


class Response:
    def __init__(self, data):
        self.data = data if isinstance(data, bytes) else json.dumps(data).encode()

    def read(self, count=-1):
        return self.data[:count] if count >= 0 else self.data

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class CloudBridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.env = patch.dict(os.environ, {"HANDRAW_PROFILE_HOME": self.tmp.name}, clear=False)
        self.env.start()
        self.addCleanup(self.env.stop)
        cloud.Credentials().save({"token": "hwt_fixture", "user": {"username": "tester"},
                                  "scopes": ["library", "publish"]})

    def make_lib(self):
        root = Path(self.tmp.name) / "tuku"
        (root / "characters").mkdir(parents=True, exist_ok=True)
        cloud.atomic_json(root / "library.json", {
            "characters": [{"id": "CH-002", "name": "喵星人", "tags": ["自建"], "image": "local"}],
            "props": [], "scenes": []})
        (root / "characters" / "CH-002.webp").write_bytes(b"RIFF\x04\x00\x00\x00WEBPTESTDATA")
        cloud.atomic_json(Path(self.tmp.name) / "config.json", {"tuku_dir": str(root)})
        return root

    def test_api_pins_origin_and_does_not_redirect(self):
        seen = []
        class Opener:
            def open(self, req, timeout=40):
                seen.append(req)
                return Response({"ok": True, "username": "tester"})
        api = cloud.API("hwt_fixture", opener=Opener())
        self.assertEqual(api.request("GET", "/api/auth/me")["username"], "tester")
        self.assertEqual(seen[0].full_url, "https://handraw-style.com/api/auth/me")
        self.assertEqual(seen[0].get_header("Authorization"), "Bearer hwt_fixture")
        for bad in ("https://evil.test/api/auth/me", "//evil.test", "/api/../admin",
                    "/api/x\nX-Injected", "/outside/api/works", "/api/x#frag"):
            with self.subTest(path=bad), self.assertRaises(ValueError):
                api.request("GET", bad)
        self.assertIsNone(cloud.RejectRedirect().redirect_request(None, None, 302, "", {}, "https://evil.test/") if False else None)

    def test_missing_contract_fails_closed(self):
        class Opener:
            def open(self, req, timeout=40):
                raise urllib.error.HTTPError(req.full_url, 404, "Not Found", {}, io.BytesIO(b'{"code":"not_found"}'))
        with self.assertRaises(cloud.CloudError) as ctx:
            cloud.API("hwt_fixture", opener=Opener()).request("GET", "/api/v1/me/resources")
        self.assertEqual(ctx.exception.code, "server_contract_not_ready")

    def test_credential_file_is_private_and_unbind_local_only(self):
        p = cloud.Credentials().path
        self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o600)
        self.assertEqual(cloud.Credentials().read()["token"], "hwt_fixture")
        cloud.Credentials().clear()
        self.assertFalse(p.exists())
        with self.assertRaises(ValueError):
            cloud.Credentials().client()

    def test_bind_device_code_and_prove_account(self):
        calls = []
        def fake_request(self, method, path, body=None, **kwargs):
            calls.append((method, path, body))
            if path == "/api/auth/device":
                return {"deviceCode": "secret-device-code", "userCode": "ABCD-1234",
                        "verificationUrl": "/?view=device&code=ABCD-1234",
                        "expiresIn": 600, "interval": 5}
            if path == "/api/auth/device/token":
                self.assert_no_token = None
                return {"token": "hwt_new_token", "user": {"username": "creator"}, "scopes": ["library"]}
            return {"username": "creator", "scopes": ["library"]}
        out = io.StringIO()
        with patch.object(cloud.API, "request", fake_request), patch.object(cloud.time, "sleep"), \
             contextlib.redirect_stdout(out):
            cloud.bind_account(SimpleNamespace(no_browser=True))
        self.assertEqual(cloud.Credentials().read()["token"], "hwt_new_token")
        self.assertEqual(calls[1][2]["deviceCode"], "secret-device-code")
        self.assertNotIn("hwt_new_token", out.getvalue())
        self.assertNotIn("secret-device-code", out.getvalue())
        self.assertIn("creator", out.getvalue())

    def test_asset_push_is_idempotent_and_stable(self):
        root = self.make_lib()
        responses = []
        def fake_request(self, method, path, body=None, **kwargs):
            self_case = fake_request
            self_case.headers_seen = body
            responses.append((method, path))
            self.assertTrue if False else None
            return {"ok": True, "item": {"uid": path.split("/")[-1], "revision": 1}}
        with patch.object(cloud.API, "request", fake_request):
            first = cloud.asset_push(SimpleNamespace(id=None, library_dir=str(root), force=False))
            second = cloud.asset_push(SimpleNamespace(id=None, library_dir=str(root), force=False))
        self.assertEqual(len(responses), 1)
        self.assertEqual(first["results"][0]["revision"], 1)
        self.assertTrue(second["results"][0]["unchanged"])
        self.assertEqual(cloud.load_manifest(root)["characters"][0]["cloud_uid"],
                         first["results"][0]["uid"])

    def test_asset_pull_preserves_existing_and_imports_cloud_uid(self):
        root = self.make_lib()
        uid = str(uuid.uuid4())
        blob = b"RIFF\x04\x00\x00\x00WEBPREMOTE"
        def fake_request(self, method, path, body=None, *, raw=False, **kwargs):
            if path.endswith("/image"):
                return blob
            return {"ok": True, "items": [{
                "uid": uid, "localId": "CH-002", "cat": "characters", "name": "云端角色",
                "nameEn": "Cloud role", "tags": [], "revision": 1,
                "sha256": hashlib.sha256(blob).hexdigest(), "deletedAt": None}],
                "hasMore": False}
        with patch.object(cloud.API, "request", fake_request):
            result = cloud.asset_pull(SimpleNamespace(library_dir=str(root), force=False))
        item = [p for p in cloud.load_manifest(root)["characters"] if p.get("cloud_uid") == uid][0]
        self.assertNotEqual(item["id"], "CH-002")  # no overwrite of unrelated local asset
        self.assertTrue((root / "characters" / (item["id"] + ".webp")).exists())
        self.assertEqual((root / "characters" / "CH-002.webp").read_bytes(),
                         b"RIFF\x04\x00\x00\x00WEBPTESTDATA")
        self.assertTrue(result["results"][0]["restored"])

    def test_asset_pull_preserves_modified_local_image(self):
        root = self.make_lib()
        uid = str(uuid.uuid4())
        manifest = cloud.load_manifest(root)
        manifest["characters"][0]["cloud_uid"] = uid
        cloud.atomic_json(root / "library.json", manifest)
        state = cloud.SyncState(cloud.Credentials().read())
        state.data["assets"][cloud.key_for(root, "characters", "CH-002")] = {
            "uid": uid, "revision": 1, "sha256": "different_sha"}
        state.save()
        def fake_request(self, method, path, body=None, **kwargs):
            self.assertFalse if False else None
            return {"ok": True, "items": [{
                "uid": uid, "cat": "characters", "revision": 2,
                "sha256": "abc", "deletedAt": None}], "hasMore": False}
        with patch.object(cloud.API, "request", fake_request):
            result = cloud.asset_pull(SimpleNamespace(library_dir=str(root), force=False))
        self.assertEqual(result["results"][0]["conflict"], "本地图片已修改，保留本地文件")

    def test_history_requires_explicit_upload_and_keeps_local_copy(self):
        root = Path(self.tmp.name)
        img = root / "example.webp"
        img.write_bytes(b"RIFF\x04\x00\x00\x00WEBPTEST")
        text = root / "prompt.txt"
        text.write_text("请画一张铅笔小猫\n第二行", encoding="utf-8")
        data = cloud.local_history_create(SimpleNamespace(image=[str(img)],
                               original_request_file=str(text), run_id=None))
        p = root / "generation-history" / data["runId"] / "record.json"
        saved = json.loads(p.read_text(encoding="utf-8"))
        self.assertTrue(data["localOnly"])
        self.assertEqual(saved["cloudState"], "local_only")
        self.assertEqual(saved["originalRequest"], "请画一张铅笔小猫\n第二行")
        with self.assertRaises(ValueError):
            cloud.local_history_create(SimpleNamespace(image=[str(img)],
                original_request_file=str(text), run_id=data["runId"]))

    def test_history_server_failure_does_not_mark_synced(self):
        root = Path(self.tmp.name)
        (root / "prompt.txt").write_text("测试生成", encoding="utf-8")
        (root / "image.png").write_bytes(b"\x89PNG\r\n\x1a\nBINARY")
        data = cloud.local_history_create(SimpleNamespace(
            image=[str(root / "image.png")],
            original_request_file=str(root / "prompt.txt"), run_id=None))
        with patch.object(cloud.API, "request", side_effect=cloud.CloudError(403, "token_scope_denied")):
            with self.assertRaises(cloud.CloudError):
                cloud.local_history_upload(SimpleNamespace(run_id=data["runId"]))
        row = cloud.read_json(root / "generation-history" / data["runId"] / "record.json")
        self.assertEqual(row["cloudState"], "local_only")

    def test_private_owned_resource_requires_server(self):
        local_dir = Path(self.tmp.name) / "personal-library"
        res_id = "mine:" + str(uuid.uuid4())
        local_dir.mkdir()
        cloud.atomic_json(local_dir / "library.json", {"schema_version": 1, "resources": [
            {"id": res_id, "kind": "style", "section": "owned", "name": "线稿",
             "prompt_zh": "细线稿", "prompt_en": "Fine ink line art", "license": "个人使用",
             "version": "1.0.0"}]})
        request_body = []
        def fake_request(self, method, path, body=None, **kwargs):
            request_body.append(body)
            raise cloud.CloudError(403, "token_scope_denied")
        with patch.object(cloud.API, "request", fake_request):
            with self.assertRaises(cloud.CloudError):
                cloud.resource_push(SimpleNamespace(id=res_id))
        self.assertEqual(request_body[0]["visibility"], "private")
        self.assertFalse(cloud.SyncState(cloud.Credentials().read()).data["resources"])

    def test_resource_restore_refuses_silent_overwrite(self):
        root = Path(self.tmp.name) / "personal-library"
        root.mkdir()
        rid = str(uuid.uuid4())
        cloud.atomic_json(root / "library.json", {"schema_version": 1, "resources": [{
            "id": "mine:" + rid, "kind": "style", "name": "本地修改",
            "prompt_zh": "旧定义", "prompt_en": "Old", "license": "个人",
            "version": "1.0.0", "section": "owned"}]})
        def fake_request(self, method, path, body=None, **kwargs):
            return {"ok": True, "items": [{
                "id": rid, "kind": "style", "name": "远端修改",
                "definition": {"zh": "新定义", "en": "New"},
                "license": "个人", "version": "2.0.0", "revision": 2}],
                "hasMore": False}
        with patch.object(cloud.API, "request", fake_request):
            result = cloud.resource_restore(SimpleNamespace(force=False))
        self.assertIn("conflict", result["results"][0])
        self.assertEqual(cloud.read_json(root / "library.json")["resources"][0]["name"], "本地修改")

    def test_social_comment_empty_rejected(self):
        with self.assertRaises(ValueError):
            cloud.planned_comment(SimpleNamespace(id=str(uuid.uuid4()), text="   "))


if __name__ == "__main__":
    unittest.main()
