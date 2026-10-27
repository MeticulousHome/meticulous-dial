"""meticulous-integration's conftest with the Qt Dial instead of the React Dial in Chromium.

The runner (run.sh, in-container.sh) copies meticulous-integration's tests/conftest.py next to this file
as integration_conftest.py. Everything in it is used as is (the firmware on fika-sil, the backend on its
pty, the Socket.IO `dial` client, the third parties, the journey catalog hooks, the timeline and the
journey reports); only the three fixtures that open the React Dial are replaced:

  dial_server  the session's Qt Dial host: Xvfb, the binary, the suite's CA (for answered third parties)
  browser      the same host (no Chromium)
  dial_app     QtDialApp: the Qt Dial started fresh for each test (a new process, a new storage file, as
               the React fixture opens a fresh browser context), against the session's backend through
               a recording proxy, with its test port open; screen.restart() starts it again on the same
               storage, as a page reload keeps the browser's localStorage.

The Dial never reaches a real service: it runs with DIAL_EXTERNAL_SERVICES=0 (its own guard,
src/netguard.cpp) and a Dial whose log does not say "external services are off" is stopped; its
http_proxy is a local gate that refuses third parties; and run.sh gives the test phase no network.

Environment (set by in-container.sh):
  QT_DIAL_BINARY  default /repo/qt/build/amd64/meticulous-dial-qt
  QT_DIAL_QML     default /repo/qt/qml
  QT_DIAL_FAIL_ON_QML_ERRORS  1: fail a test whose Dial logged a JavaScript exception, as the React
                  fixture fails on a page error (default 0: they are listed in pages/<test>.json)
"""

import os
import signal
import socket
import subprocess
import time
from pathlib import Path

import pytest

from integration_conftest import *  # noqa: F401,F403  (fixtures, hooks and helpers of the suite)
from integration_conftest import ARTIFACTS, _record_actions, _write_journey_report, restore_settings, wall_seconds
from integration_conftest import pytest_collection_modifyitems as _suite_collection_modifyitems

from dial_app import Controls, PageWatch, Screen, Timeline  # noqa: E402
from qt_dial_net import DialNetwork, SuiteCA  # noqa: E402
import video  # noqa: E402  (qt/tests/e2e/video.py, on the path through dial_app)

QT_DIAL_BINARY = os.environ.get("QT_DIAL_BINARY", "/repo/qt/build/amd64/meticulous-dial-qt")
QT_DIAL_QML = os.environ.get("QT_DIAL_QML", "/repo/qt/qml")
FAIL_ON_QML_ERRORS = os.environ.get("QT_DIAL_FAIL_ON_QML_ERRORS", "0") == "1"
EXTERNAL_SERVICES_OFF = "external services are off"

# The bug report's journey needs the real ticket service and Sentry (answered by the suite's third parties),
# which the Qt Dial never reaches in a test: with DIAL_EXTERNAL_SERVICES=0 it asks for no preflight probes and
# gets no ticket. qt/tests/e2e/test_support.py covers the report against its own fakes.
SUPPORT_JOURNEY_XFAIL = "the Qt Dial runs with its external services off in tests: no ticket service, no Sentry"


def pytest_collection_modifyitems(config, items):
    _suite_collection_modifyitems(config, items)
    for item in items:
        if item.nodeid.split("::")[0].endswith("test_dial_support.py"):
            item.add_marker(pytest.mark.xfail(reason=SUPPORT_JOURNEY_XFAIL, strict=False))


class QtDialHost:
    """Xvfb for the session, the Dial's binary and the suite's CA."""

    DISPLAY = ":99"

    def __init__(self, workdir: Path):
        if not Path(QT_DIAL_BINARY).exists():
            raise RuntimeError(f"no Qt Dial binary at {QT_DIAL_BINARY}: qt/scripts/build.sh amd64")
        self.workdir = workdir
        self._xvfb_log = open(ARTIFACTS / "xvfb.log", "w")
        self.xvfb = subprocess.Popen(
            ["Xvfb", self.DISPLAY, "-screen", "0", "480x480x24", "-nolisten", "tcp"],
            stdout=self._xvfb_log, stderr=subprocess.STDOUT,
        )
        socket_path = Path(f"/tmp/.X11-unix/X{self.DISPLAY[1:]}")
        deadline = time.monotonic() + 10
        while not socket_path.exists():
            if self.xvfb.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError("Xvfb did not start, see xvfb.log")
            time.sleep(0.1)
        self.ca = SuiteCA(workdir / "ca")
        self.ca.install()

    def env(self, gate_url: str) -> dict:
        return {
            **os.environ,
            "DISPLAY": self.DISPLAY,
            "QT_QPA_PLATFORM": "xcb",
            "LIBGL_ALWAYS_SOFTWARE": "1",
            "QSG_RENDER_LOOP": "basic",
            "XDG_RUNTIME_DIR": str(self.workdir),
            # Never real services: the Dial's own guard (src/netguard.cpp) stays on whatever the caller's
            # environment says; QtDialApp checks its log for it.
            "DIAL_EXTERNAL_SERVICES": "0",
            # Nothing but this machine: third parties go to the gate (qt_dial_net.py).
            "http_proxy": gate_url, "https_proxy": gate_url,
            "HTTP_PROXY": gate_url, "HTTPS_PROXY": gate_url,
            "no_proxy": "127.0.0.1,localhost", "NO_PROXY": "127.0.0.1,localhost",
        }

    def close(self):
        self.ca.uninstall()
        self.xvfb.terminate()
        try:
            self.xvfb.wait(5)
        except subprocess.TimeoutExpired:
            self.xvfb.kill()
        self._xvfb_log.close()


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class QtDialApp:
    """The Qt Dial against the session's backend, one fresh process per test (DialApp's API)."""

    def __init__(self, host: QtDialHost, backend, firmware, dial, name: str):
        self._host = host
        self._backend = backend
        self._dial = dial
        self._name = name
        self.controls = Controls(firmware)
        self.timeline = Timeline()
        self.context = None
        self.page = None
        self.watch = None
        self.screen = None
        self.client = None
        self.proc = None
        self.network = None
        self.refused: list[str] = []
        self.answered: list[tuple[str, str | None]] = []
        self._external_answers: dict[str, dict] = {}
        self._storage = host.workdir / f"{name}.storage.json"
        self._log_path = ARTIFACTS / "pages" / f"{name}.dial.log"
        self.starts = 0
        self._recorder = None

    def open(self, first_boot: bool = False, home: bool = True):
        _, settings = self._backend.get("/api/v1/settings/")
        if first_boot:
            assert settings["shot_data_sharing"] is None, (
                "the first boot runs only on a fresh machine: run it before any other Dial test"
            )
        elif settings["shot_data_sharing"] is None:
            self._backend.post("/api/v1/settings/", {"shot_data_sharing": False})
        self._storage.unlink(missing_ok=True)
        self._log_path.unlink(missing_ok=True)
        self.network = DialNetwork(self._backend.url, self._host.ca, self._external_answers, self.refused, self.answered)
        self.watch = PageWatch(self.network, self._log_path)
        # The journey's video (qt/tests/e2e/video.py): the session's Xvfb screen from here to close(), as
        # Playwright records the React page. The timeline is timed from its first frame.
        self.timeline.video_start = time.time()
        if video.enabled():
            recorder = video.Recorder(self._host.DISPLAY, ARTIFACTS / "videos" / f"{self._name}.mp4")
            if recorder.start():
                self._recorder = recorder
                self.timeline.video_start = recorder.started_at
        self._start()
        self.screen = Screen(self, self.controls, ARTIFACTS / "screens", self._name, self.timeline)
        self.page = self.screen.page
        if home and not first_boot:
            self.screen.wait_for_home()
        return self.screen

    def answer_external(self, url_prefix: str, body: dict):
        """Stand in for a third-party service (not a Meticulous component) the Dial calls."""
        self._external_answers[url_prefix] = body

    # ---- the process
    def _start(self):
        import dialctl

        port = _free_port()
        log = open(self._log_path, "a")
        log.write(f"---- start {self.starts + 1} at {time.strftime('%H:%M:%S')}\n")
        log.flush()
        self.proc = subprocess.Popen(
            [QT_DIAL_BINARY, "--qml-dir", QT_DIAL_QML, "--storage", str(self._storage),
             "--api", self.network.url, "--test-port", str(port)],
            env=self._host.env(self.network.gate_url), stdout=log, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL, start_new_session=True,
        )
        log.close()
        deadline = time.monotonic() + 30
        while True:
            if self.proc.poll() is not None:
                raise RuntimeError(f"the Qt Dial exited with {self.proc.returncode}, see {self._log_path}")
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                    break
            except OSError:
                if time.monotonic() > deadline:
                    raise RuntimeError(f"the Qt Dial's test port did not open in 30 s, see {self._log_path}")
                time.sleep(0.1)
        self.client = dialctl.DialClient(port)
        self.starts += 1
        # The guard against real services must be on (main.cpp logs it at start); a Dial without it is
        # stopped before the test touches it.
        this_start = self._log_path.read_text(errors="replace").rsplit("---- start", 1)[-1]
        if EXTERNAL_SERVICES_OFF not in this_start:
            self._stop()
            raise RuntimeError(f"the Qt Dial did not log {EXTERNAL_SERVICES_OFF!r}: an old binary or "
                               f"DIAL_EXTERNAL_SERVICES is set; see {self._log_path}")

    def _stop(self):
        if self.client is not None:
            try:
                self.client.close()
            except Exception:  # noqa: BLE001
                pass
            self.client = None
        if self.proc is not None and self.proc.poll() is None:
            self.proc.send_signal(signal.SIGTERM)
            try:
                self.proc.wait(5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait(5)

    def restart(self):
        self._timeline_screens()
        self._stop()
        self._start()

    def _timeline_screens(self):
        """Each screen this process showed (Nav.history, its monotonic clock), on the timeline."""
        try:
            history = self.client.state().get("history") or []
            now_ms = float(self.client.call({"cmd": "eval", "js": "Native.monotonicMs()"})["value"])
        except Exception:  # noqa: BLE001
            return
        now = time.time()
        for ms, name in history:
            self.timeline.add("screen", name, now - (now_ms - ms) / 1000)

    def close(self, failed: bool):
        if self.proc is None:
            return None
        time.sleep(0.5)
        if failed and self.client is not None and self.proc.poll() is None:
            self.screen.snapshot("failed")
        self._timeline_screens()
        # The video ends with the journey, before the Dial's window goes away.
        clip = self._recorder.stop() if self._recorder is not None else None
        self.timeline.video_end = time.time()
        self._stop()
        self.watch.write(ARTIFACTS / "pages" / f"{self._name}.json")
        self._timeline_statuses()
        self.network.close()
        return str(clip.relative_to(ARTIFACTS)) if clip is not None else None

    def _timeline_statuses(self):
        last = None
        for at, (_, event, data) in zip(list(self._dial.event_times), list(self._dial.events)):
            if event == "status" and data and data.get("name") != last:
                last = data.get("name")
                self.timeline.add("machine", last, at)


@pytest.fixture(scope="session")
def dial_server(tmp_path_factory, backend):
    for directory in ("screens", "pages", "reports", "videos"):
        (ARTIFACTS / directory).mkdir(parents=True, exist_ok=True)
    host = QtDialHost(tmp_path_factory.mktemp("qt-dial"))
    yield host
    host.close()


@pytest.fixture(scope="session")
def browser(dial_server):
    return dial_server


@pytest.fixture
def dial_app(request, browser, dial_server, backend, firmware, dial, settings_at_start):
    """The Qt Dial on a machine that is idle, with the settings it booted with."""
    status = dial.wait_for(lambda s: True, wall_seconds(30), "a first status")
    for _ in range(3):
        if status["state"] == "idle":
            break
        dial.emit("action", "abort")
        try:
            status = dial.wait_for(lambda s: s["state"] == "idle", wall_seconds(90), "the machine idle")
        except AssertionError:
            status = dial.last_status()
    assert status["state"] == "idle", f"the machine did not return to idle: {status}"
    restore_settings(backend, settings_at_start)
    app = QtDialApp(dial_server, backend, firmware, dial, request.node.name)
    _record_actions(app.timeline, firmware, backend)
    request.node.journey_timeline = app.timeline
    started = time.monotonic()
    try:
        yield app
    finally:
        for target, name in ((firmware, "call"), (backend, "post"), (backend, "request")):
            target.__dict__.pop(name, None)
        reports = [getattr(request.node, f"report_{when}", None) for when in ("setup", "call")]
        failed = any(report is not None and report.failed for report in reports)
        video = app.close(failed)
    if app.page is not None:
        _write_journey_report(request.node, app, video, reports, time.monotonic() - started)
    if FAIL_ON_QML_ERRORS and app.watch is not None and app.watch.errors:
        pytest.fail(f"the Qt Dial threw: {app.watch.errors}", pytrace=False)
