"""Observable account lifecycle for conversational hosts; no real network or credentials."""
import contextlib
import importlib.util
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "handraw_cloud.py"
spec = importlib.util.spec_from_file_location("conversation_cloud", SOURCE)
cloud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cloud)


class ConversationAccountTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        env = patch.dict(os.environ, {"HANDRAW_PROFILE_HOME": tmp.name})
        env.start()
        self.addCleanup(env.stop)

    def start(self, now=1000):
        response = {"deviceCode": "private-device-secret", "userCode": "ABCD-2345",
                    "verificationUrl": "/?view=device&code=ABCD-2345", "expiresIn": 600, "interval": 5}
        with patch.object(cloud.API, "request", return_value=response) as api, \
                patch.object(cloud.time, "time", return_value=now):
            receipt = cloud.start_binding(SimpleNamespace(no_browser=True))
        return receipt, api

    def assert_no_secrets(self, receipt):
        output = json.dumps(receipt, ensure_ascii=False)
        for secret in ("private-device-secret", "hwt_private_token", "cloud_pending_auth", "cloud_auth.json"):
            self.assertNotIn(secret, output)

    def test_unbound_status_never_starts_authorization_or_writes(self):
        with patch.object(cloud.API, "request") as api:
            result = cloud.current_account_status()
        self.assertEqual(result["state"], "unbound")
        self.assertFalse(result["connected"])
        self.assertTrue(result["footer"])
        self.assertEqual(list(self.root.iterdir()), [])
        api.assert_not_called()

    def test_start_returns_public_link_and_reuses_live_approval(self):
        receipt, api = self.start()
        self.assertEqual(receipt["verificationUrl"], "https://handraw-style.com/?view=device&code=ABCD-2345")
        self.assertEqual(receipt["state"], "pending")
        self.assertEqual(api.call_args.args[:2], ("POST", "/api/auth/device"))
        self.assert_no_secrets(receipt)
        self.assertFalse(cloud.Credentials().path.exists())
        with patch.object(cloud.API, "request") as api, patch.object(cloud.time, "time", return_value=1001):
            repeated = cloud.start_binding(SimpleNamespace(no_browser=True))
            status = cloud.current_account_status()
        api.assert_not_called()
        self.assertEqual(repeated["verificationUrl"], receipt["verificationUrl"])
        self.assertEqual(status["state"], "pending")
        self.assert_no_secrets(status)

    def test_check_obeys_interval_pending_and_server_slowdown(self):
        self.start()
        with patch.object(cloud.API, "request") as api, patch.object(cloud.time, "time", return_value=1001):
            self.assertEqual(cloud.complete_binding()["state"], "pending")
        api.assert_not_called()
        with patch.object(cloud.API, "request", side_effect=cloud.CloudError(400, "slow_down")), \
                patch.object(cloud.time, "time", return_value=1006):
            result = cloud.complete_binding()
        self.assertEqual(result["state"], "pending")
        self.assertEqual(cloud.read_pending()["interval"], 10)
        with patch.object(cloud.API, "request") as api, patch.object(cloud.time, "time", return_value=1010):
            cloud.complete_binding()
        api.assert_not_called()
        with patch.object(cloud.API, "request", side_effect=cloud.CloudError(400, "authorization_pending")), \
                patch.object(cloud.time, "time", return_value=1017):
            self.assertEqual(cloud.complete_binding()["state"], "pending")
        self.assertFalse(cloud.Credentials().path.exists())

    def test_approval_verifies_identity_and_finishes_without_exposing_token(self):
        self.start()
        replies = [{"token": "hwt_private_token", "user": {"username": "cached-name"}, "scopes": ["library"]},
                   {"username": "actual-user", "scopes": ["library"]}]
        with patch.object(cloud.API, "request", side_effect=replies) as api, \
                patch.object(cloud.time, "time", return_value=1006):
            result = cloud.complete_binding()
        # Identity is verified before anything else; the level read is read-only and best effort.
        self.assertEqual([call.args[:2] for call in api.call_args_list][:2],
                         [("POST", "/api/auth/device/token"), ("GET", "/api/auth/me")])
        self.assertTrue(all(call.args[0] == "GET" for call in api.call_args_list[1:]))
        self.assertTrue(result["connected"])
        self.assertEqual(result["username"], "actual-user")
        self.assertFalse(cloud.pending_path().exists())
        self.assertEqual(cloud.Credentials().read()["token"], "hwt_private_token")
        self.assertEqual(cloud.Credentials().read()["user"]["username"], "actual-user")
        self.assert_no_secrets(result)

    def test_identity_outage_retains_one_shot_token_and_can_recover(self):
        self.start()
        replies = [{"token": "hwt_private_token", "user": {"username": "cached-name"}},
                   cloud.CloudError(0, "network_error")]
        with patch.object(cloud.API, "request", side_effect=replies), \
                patch.object(cloud.time, "time", return_value=1006):
            result = cloud.complete_binding()
        self.assertEqual(result["state"], "unverified")
        self.assertFalse(result["connected"])
        self.assertFalse(cloud.pending_path().exists())
        self.assertTrue(cloud.Credentials().path.exists())
        with patch.object(cloud.API, "request", return_value={"username": "actual-user"}) as api:
            recovered = cloud.complete_binding()
        self.assertEqual(recovered["state"], "connected")
        self.assertIn(("GET", "/api/auth/me"), [call.args[:2] for call in api.call_args_list])
        self.assert_no_secrets(result)

    def test_rejected_expired_and_network_failure_preserve_local_creation(self):
        for code, expected in (("access_denied", "denied"), ("expired_token", "expired"),
                               ("network_error", "pending")):
            with self.subTest(code=code):
                cloud.pending_path().unlink(missing_ok=True)
                self.start()
                with patch.object(cloud.API, "request", side_effect=cloud.CloudError(400, code)), \
                        patch.object(cloud.time, "time", return_value=1006):
                    result = cloud.complete_binding()
                self.assertEqual(result["state"], expected)
                self.assertEqual(cloud.pending_path().exists(), expected == "pending")
                self.assertFalse(cloud.Credentials().path.exists())
                self.assert_no_secrets(result)

    def test_expired_link_is_not_polled_and_explicit_start_can_replace_it(self):
        self.start()
        with patch.object(cloud.API, "request") as api, patch.object(cloud.time, "time", return_value=1601):
            self.assertEqual(cloud.current_account_status()["state"], "expired")
            self.assertEqual(cloud.complete_binding()["state"], "expired")
        api.assert_not_called()
        new, api = self.start(now=1602)
        self.assertEqual(new["state"], "pending")
        api.assert_called_once()

    def test_status_checks_live_identity_and_distinguishes_revocation_from_outage(self):
        cloud.Credentials().save({"token": "hwt_private_token", "user": {"username": "cached-name"}})
        for error, expected in ((cloud.CloudError(401, "token_invalid"), "needs_rebind"),
                                (cloud.CloudError(0, "network_error"), "unverified"),
                                (cloud.CloudError(503, "busy"), "unverified")):
            with self.subTest(expected=expected), patch.object(cloud.API, "request", side_effect=error) as api:
                result = cloud.current_account_status()
            self.assertEqual(result["state"], expected)
            self.assertNotIn("username", result)
            self.assertEqual(api.call_args.kwargs["timeout"], 5)
            self.assertTrue(cloud.Credentials().path.exists())
            self.assert_no_secrets(result)
        with patch.object(cloud.API, "request", return_value={"username": "actual-user"}):
            self.assertEqual(cloud.current_account_status()["username"], "actual-user")

    def test_status_and_unbind_cli_output_is_safe_and_clears_pending_too(self):
        self.start()
        cloud.Credentials().save({"token": "hwt_private_token"})
        out = io.StringIO()
        with patch.object(cloud.API, "request") as api, contextlib.redirect_stdout(out):
            cloud.main(["unbind"])
            cloud.main(["status"])
        api.assert_not_called()
        self.assertFalse(cloud.Credentials().path.exists())
        self.assertFalse(cloud.pending_path().exists())
        self.assertNotIn("hwt_private_token", out.getvalue())

    def test_conversational_cli_start_and_check_return_machine_readable_receipts(self):
        reply = {"deviceCode": "private-device-secret", "userCode": "ABCD-2345",
                 "verificationUrl": "/?view=device&code=ABCD-2345", "expiresIn": 600, "interval": 5}
        output = io.StringIO()
        with patch.object(cloud.API, "request", return_value=reply), \
                patch.object(cloud.time, "time", return_value=1000), \
                patch.object(cloud.webbrowser, "open") as browser, contextlib.redirect_stdout(output):
            cloud.main(["bind", "--start", "--no-browser"])
        browser.assert_not_called()
        self.assertEqual(json.loads(output.getvalue())["state"], "pending")
        self.assertNotIn("private-device-secret", output.getvalue())
        output = io.StringIO()
        with patch.object(cloud.API, "request", side_effect=[
                {"token": "hwt_private_token", "user": {"username": "actual-user"}},
                {"username": "actual-user"}]), patch.object(cloud.time, "time", return_value=1006), \
                contextlib.redirect_stdout(output):
            cloud.main(["bind", "--check"])
        self.assertEqual(json.loads(output.getvalue())["state"], "connected")
        self.assertNotIn("hwt_private_token", output.getvalue())

    def test_connected_footer_shows_level_and_ignores_level_failures(self):
        cloud.Credentials().save({"token": "hwt_private_token", "user": {"username": "lv-user"}})

        calls = iter([{"username": "lv-user"}, {"level": 3, "name": "手绘匠人", "xp": 240}])
        with patch.object(cloud.API, "request", side_effect=lambda *a, **k: next(calls)):
            status = cloud.current_account_status()
        self.assertEqual(status["state"], "connected")
        self.assertIn("Lv3 手绘匠人", status["footer"])
        self.assert_no_secrets(status)
        calls = iter([{"username": "lv-user"}])

        def failing(*a, **k):
            try:
                return next(calls)
            except StopIteration:
                raise cloud.CloudError(404, "not_found")
        with patch.object(cloud.API, "request", side_effect=failing):
            status = cloud.current_account_status()
        self.assertEqual(status["state"], "connected")
        self.assertNotIn("Lv", status["footer"])

    def test_level_command_reports_progress_cap_and_jury(self):
        cloud.Credentials().save({"token": "hwt_private_token", "user": {"username": "lv-user"}})
        reply = {"level": 4, "name": "风格作者", "xp": 700, "nextLevel": 5, "nextName": "画坊主理", "nextXp": 1500,
                 "perks": ["收费定价最高 50 积分"], "priceCap": 50, "jury": {"eligible": False, "checks": [{"label": "注册满 30 天", "ok": False}]}}
        output = io.StringIO()
        with patch.object(cloud.API, "request", return_value=reply), contextlib.redirect_stdout(output):
            cloud.main(["level"])
        data = json.loads(output.getvalue())
        self.assertEqual((data["level"], data["priceCap"]), (4, 50))
        self.assertEqual(data["next"], {"level": 5, "name": "画坊主理", "xpNeeded": 800})
        self.assertFalse(data["jury"]["eligible"])
        self.assertNotIn("hwt_private_token", output.getvalue())

    def test_switching_accounts_reports_pending_instead_of_old_cached_identity(self):
        cloud.Credentials().save({"token": "hwt_private_token", "user": {"username": "old-account"}})
        self.start()
        with patch.object(cloud.API, "request") as api, patch.object(cloud.time, "time", return_value=1001):
            result = cloud.current_account_status()
        api.assert_not_called()
        self.assertEqual(result["state"], "pending")
        self.assertNotIn("username", result)
        self.assert_no_secrets(result)

    def test_unsafe_authorization_link_and_broken_state_do_not_leak_or_bind(self):
        for path in ("//evil.test/approve", "/\\evil.test", "/device\nInjected", "/../approve"):
            with self.subTest(path=path), patch.object(cloud.API, "request", return_value={
                    "verificationUrl": path, "deviceCode": "private-device-secret", "userCode": "ABCD-2345"}):
                with self.assertRaises(ValueError):
                    cloud.start_binding(SimpleNamespace(no_browser=True))
                self.assertFalse(cloud.pending_path().exists())
        cloud.pending_path().write_text('{"deviceCode":"private-device-secret"}', encoding="utf-8")
        self.assertEqual(cloud.current_account_status()["state"], "needs_rebind")
        self.assertEqual(cloud.complete_binding()["state"], "needs_rebind")


if __name__ == "__main__":
    unittest.main()
