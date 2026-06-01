import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.llm_editor import _TypeUpBackendLLM
from agent.stt import (
    PCM_BYTES_PER_SECOND,
    TYPEUP_BACKEND_STT_BASE_TIMEOUT_SECONDS,
    TYPEUP_BACKEND_STT_TIMEOUT_PER_CHUNK_SECONDS,
    _TypeUpBackendSTT,
)


class TypeUpBackendTokenTests(unittest.TestCase):
    def test_stt_loads_latest_tokens_from_cloud_bridge(self):
        with tempfile.TemporaryDirectory() as tmp:
            bridge = Path(tmp) / "cloud-bridge.json"
            bridge.write_text(json.dumps({
                "apiBaseUrl": "http://cloud.example",
                "accessToken": "cloud-access",
                "refreshToken": "cloud-refresh",
            }), encoding="utf-8")

            stt = _TypeUpBackendSTT({
                "api_base_url": "http://config.example",
                "access_token": "config-access",
                "refresh_token": "config-refresh",
                "cloud_bridge_path": str(bridge),
            })

            self.assertEqual(stt._api_base_url, "http://cloud.example")
            self.assertEqual(stt._access_token, "cloud-access")
            self.assertEqual(stt._refresh_token, "cloud-refresh")

    def test_stt_timeout_scales_by_backend_audio_chunks(self):
        stt = _TypeUpBackendSTT({
            "api_base_url": "http://config.example",
            "access_token": "config-access",
        })

        one_chunk_timeout = TYPEUP_BACKEND_STT_BASE_TIMEOUT_SECONDS + TYPEUP_BACKEND_STT_TIMEOUT_PER_CHUNK_SECONDS
        two_chunk_timeout = TYPEUP_BACKEND_STT_BASE_TIMEOUT_SECONDS + TYPEUP_BACKEND_STT_TIMEOUT_PER_CHUNK_SECONDS * 2

        self.assertEqual(stt._stt_timeout_seconds(1 * PCM_BYTES_PER_SECOND), one_chunk_timeout)
        self.assertEqual(stt._stt_timeout_seconds(30 * PCM_BYTES_PER_SECOND), one_chunk_timeout)
        self.assertEqual(stt._stt_timeout_seconds(31 * PCM_BYTES_PER_SECOND), two_chunk_timeout)

    def test_llm_loads_latest_tokens_from_cloud_bridge(self):
        with tempfile.TemporaryDirectory() as tmp:
            bridge = Path(tmp) / "cloud-bridge.json"
            bridge.write_text(json.dumps({
                "apiBaseUrl": "http://cloud.example",
                "accessToken": "cloud-access",
                "refreshToken": "cloud-refresh",
            }), encoding="utf-8")

            llm = _TypeUpBackendLLM({
                "api_base_url": "http://config.example",
                "access_token": "config-access",
                "refresh_token": "config-refresh",
                "cloud_bridge_path": str(bridge),
            })

            self.assertEqual(llm._api_base_url, "http://cloud.example")
            self.assertEqual(llm._access_token, "cloud-access")
            self.assertEqual(llm._refresh_token, "cloud-refresh")


if __name__ == "__main__":
    unittest.main()
