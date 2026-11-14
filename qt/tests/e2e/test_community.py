"""The Community uploader singleton (Dial.Native's Community, the C++ port of the Tauri Dial's
community_upload.rs) inside a running Dial, through the test port.

The uploader's logic is covered by the Qt Test unit tests (qt/tests/unit/tst_community_*.cpp, run with
ctest). These checks only make sure the running Dial has the singleton with the API the Community
settings screen uses. They do not enroll: the dev Dial talks to the production Community server unless
COMMUNITY_API_BASE says otherwise.
"""

import json

STATES = {"not_connected", "connected", "upload_paused", "unavailable"}


def evaluate(client, js):
    return client.call({"cmd": "eval", "js": js})["value"]


def test_status_has_the_tauri_shape(client):
    status = json.loads(evaluate(client, "JSON.stringify(Community.status)"))
    assert set(status) == {
        "state", "connected", "paused", "pendingCount", "lastSuccessAt", "lastError", "lastRetryAt",
        "enrollmentExpiresAt",
    }
    assert status["state"] in STATES
    assert isinstance(status["connected"], bool)
    assert isinstance(status["paused"], bool)
    assert isinstance(status["pendingCount"], int)
    for key in ("lastSuccessAt", "lastRetryAt", "enrollmentExpiresAt"):
        assert status[key] is None or isinstance(status[key], (int, float))
    assert status["lastError"] is None or isinstance(status["lastError"], str)
    assert status["connected"] == (status["state"] in ("connected", "upload_paused"))


def test_scan_history_is_accepted(client):
    status = json.loads(evaluate(client, "JSON.stringify(Community.status)"))
    expected = "" if status["state"] != "unavailable" else \
        "Community upload storage is unavailable. The Dial can still brew normally."
    assert evaluate(client, "Community.scanHistory()") == expected


def test_commands_are_invokable(client):
    for name in ("beginEnrollment", "setUploadPaused", "disconnect", "factoryResetLocal", "scanHistory"):
        assert evaluate(client, f"typeof Community.{name}") == "function"
    for name in ("statusChanged", "enrollmentResult", "operationFinished"):
        assert evaluate(client, f"typeof Community.{name}.connect") == "function"
