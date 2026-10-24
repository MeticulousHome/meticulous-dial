"""Fixtures of the Qt Dial's end-to-end tests.

They drive a running Dial (qt/scripts/run-dev.sh start, or the machine through a tunnel) through its test
port, against a backend (qt/scripts/dev-backend.sh start: meticulous-backend in emulation mode). See
docs/qt-migration/TESTING.md.
"""

import os
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dial import Backend, Screen  # noqa: E402
from dialctl import DialClient  # noqa: E402
import html_report  # noqa: E402


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


@pytest.fixture
def screen(client, request):
    s = Screen(client, request.node.name)
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
