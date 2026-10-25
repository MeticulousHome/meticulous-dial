"""Fixtures of the Qt Dial's end-to-end tests.

They drive a running Dial (qt/scripts/run-dev.sh start, or the machine through a tunnel) through its test
port, against a backend (qt/scripts/dev-backend.sh start: meticulous-backend in emulation mode). Every test
that drives the Dial is recorded from the container's Xvfb screen (video.py; DIAL_VIDEO=0 turns it off, as
for a run against a machine). See docs/qt-migration/TESTING.md.
"""

import os
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dial import Backend, Screen  # noqa: E402
from dial import ARTIFACTS  # noqa: E402
from dialctl import DialClient  # noqa: E402
import html_report  # noqa: E402
import video  # noqa: E402


@pytest.fixture(scope="session")
def client():
    c = DialClient(int(os.environ.get("DIAL_TEST_PORT", 9310)))
    yield c
    c.close()


@pytest.fixture(scope="session")
def backend():
    return Backend()


def dismiss_dispatched_report_notices(s: Screen):
    """Acknowledge the Dial's own "report from the app was sent" notices (one "Ok" each). A report the app
    dispatched is uploaded by every Dial on the backend whenever its services allow it, so the notice can
    show up in any test and would keep the next ones off the home."""
    for _ in range(5):
        if s.route() != "notifications" or not str(s.probe("notificationId") or "").startswith("dispatched-report-"):
            return
        s.controls.push()
        time.sleep(1)


def start_video(name: str):
    """The test's video from the Xvfb display the Dial draws on (run-dev.sh's DISPLAY_NUM), or None."""
    display = os.environ.get("DISPLAY_NUM")
    if not display or not video.enabled():
        return None
    recorder = video.Recorder(f":{display}", ARTIFACTS / "videos" / f"{name}.mp4")
    return recorder if recorder.start() else None


@pytest.fixture
def screen(client, request):
    s = Screen(client, request.node.name)
    recorder = start_video(request.node.name)
    try:
        dismiss_dispatched_report_notices(s)
        yield s
        if request.node.rep_call.failed if hasattr(request.node, "rep_call") else False:
            s.snapshot("failed")
        # Leave the Dial on the home with the bubble closed for the next test.
        dismiss_dispatched_report_notices(s)
        state = client.state()
        if state["bubbleVisible"]:
            s.controls.context()
        if client.state()["screen"] not in ("profileHome", "ready"):
            client.call({"cmd": "screen", "name": "profileHome"})
            s.wait_for_transition()
    finally:
        if recorder is not None:
            html_report.attach_video(request.node, recorder.stop())


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)
    html_report.record(item, rep)


def pytest_sessionfinish(session, exitstatus):
    path = html_report.write(int(exitstatus))
    if path:
        print(f"HTML report: {path}")
