"""Fixtures of the Qt Dial's end-to-end tests.

They drive a running Dial (qt/scripts/run-dev.sh start, or the machine through a tunnel) through its test
port, against a backend (qt/scripts/dev-backend.sh start: meticulous-backend in emulation mode). See
docs/qt-migration/TESTING.md.
"""

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dial import Backend, Screen  # noqa: E402
from dialctl import DialClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    c = DialClient(int(os.environ.get("DIAL_TEST_PORT", 9310)))
    yield c
    c.close()


@pytest.fixture(scope="session")
def backend():
    return Backend()


@pytest.fixture
def screen(client, request):
    s = Screen(client, request.node.name)
    yield s
    if request.node.rep_call.failed if hasattr(request.node, "rep_call") else False:
        s.snapshot("failed")
    # Leave the Dial on the home with the bubble closed for the next test.
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
