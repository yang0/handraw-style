"""Regression tests ensuring the existing work-share client accepts scoped tokens."""
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
source = ROOT / "skills" / "community-share" / "scripts" / "conversation_share.py"
spec = importlib.util.spec_from_file_location("handraw_conversation_share_cloud_test", source)
share = importlib.util.module_from_spec(spec)
spec.loader.exec_module(share)


class ScopedShareTests(unittest.TestCase):
    def test_hwt_account_uses_device_identity_endpoint(self):
        client = share.CommunityAPI("hwt_test_fixture_token")
        requested = []
        def fake_request(method, path, data=None, content_type=None):
            requested.append(path)
            return {"username": "alice", "displayName": "Alice", "scopes": ["publish", "library"]}
        client.request = fake_request
        self.assertEqual(client.current_user()["username"], "alice")
        client.check_work_access()
        self.assertEqual(requested, ["/api/auth/me", "/api/auth/me"])

    def test_hwt_publish_denied_without_scope(self):
        client = share.CommunityAPI("hwt_test_fixture_token")
        client.request = lambda *args: {"username": "alice", "scopes": ["library"]}
        with self.assertRaises(share.APIRejected):
            client.check_work_access()

    def test_local_device_credential_is_preferred(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "cloud_auth.json"
            p.write_text(json.dumps({"token": "hwt_fixture_from_device"}), encoding="utf-8")
            with patch.dict(os.environ, {"HANDRAW_PROFILE_HOME": tmp,
                                        "HANDRAW_COMMUNITY_API_KEY": ""}):
                self.assertEqual(share.load_key(), "hwt_fixture_from_device")


if __name__ == "__main__":
    unittest.main()
