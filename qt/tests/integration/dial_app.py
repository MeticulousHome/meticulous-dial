"""The Qt Dial in meticulous-integration's journeys: tests/dial_app.py's API over the Qt Dial's test port.

meticulous-integration's Dial journeys (tests/test_dial_*.py) drive the React Dial's web build in
Chromium through tests/dial_app.py. This module has the same names and does the same things to the Qt
Dial (qt/build/amd64/meticulous-dial-qt), which conftest.py of this overlay starts fresh for every
test under Xvfb, with its test port open (qml/Dial/components/TestServer.qml):

  route(), bubble_open(), routes()   the test port's state (Nav.screen, the bubble, Nav.history)
  text()                             every visible Text of the route and the bubble over it
  focused()                          the focused menu entry (OptionsMenu / a screen's dialFocusedLabel)
  active_card(), carousel(),         ProfileHome's probes dialProbe_activeCard, dialProbe_cards,
  card_selected()                    dialProbe_cardSelected
  pill_text()                        the Text inside the title pill's box (as _PILL_JS reads it)
  inject_turns()                     test port gestures ("keyboard") and backend button events ("socket")
  snapshot()                         the test port's grab, composited over black

The knob and the buttons stay fika-sil's (Controls, unchanged): the gesture crosses the firmware, the
UART and the backend's Socket.IO before it reaches the Qt Dial, as on a machine.

What a journey reads from the page itself (screen.page.evaluate) is mapped to the Qt Dial in
QtPage.evaluate: the Brew complete graph and the circular keyboard's selected key.
"""

import importlib.util
import json
import os
import sys
import time
from pathlib import Path

# The React module, for what does not depend on the browser: the controls (fika-sil), the timeline,
# the descriptions of what the test does, the profiles and the status helpers.
_UPSTREAM = Path(os.environ.get("INTEGRATION_TESTS", "/integration/tests")) / "dial_app.py"
_spec = importlib.util.spec_from_file_location("react_dial_app", _UPSTREAM)
react = importlib.util.module_from_spec(_spec)
sys.modules["react_dial_app"] = react
_spec.loader.exec_module(react)

# The Qt Dial's test-port client (qt/tests/e2e/dialctl.py).
_E2E = Path(os.environ.get("QT_DIAL_E2E", "/repo/qt/tests/e2e"))
sys.path.insert(0, str(_E2E))
import dialctl  # noqa: E402

DIAL_DIR = None  # no web build: conftest.py starts the Qt binary instead
VIEWPORT = react.VIEWPORT
MS_PER_DETENT = react.MS_PER_DETENT
MANUAL_PROFILE_ID = react.MANUAL_PROFILE_ID
Controls = react.Controls
Timeline = react.Timeline
describe_firmware_call = react.describe_firmware_call
describe_backend_call = react.describe_backend_call
default_profile = react.default_profile
save_profile = react.save_profile
statuses_seen = react.statuses_seen
in_order = react.in_order
_same = react._same
_speed = react._speed
# The browser's init scripts have no meaning here; the names stay importable.
ROUTE_RECORDER_JS = SCREEN_REPORTER_JS = TURN_INJECTOR_JS = ""


def build_dial(*_args, **_kwargs):
    raise RuntimeError("the Qt overlay runs the Qt Dial binary, not a web build")


StaticServer = None


class PageWatch:
    """What the Qt Dial did that a test may want to keep: its log, the QML errors in it, its requests.

    `requests` are the (method, url) the Dial sent to the backend (the recording proxy between them;
    Socket.IO's own requests are left out), with the backend's own URL, as Chromium lists them.
    `errors` are the JavaScript exceptions the QML engine logged (TypeError, ReferenceError, ...):
    the counterpart of the page errors the React fixture fails on.
    """

    ERROR_MARKERS = ("TypeError", "ReferenceError", "SyntaxError", "RangeError", "URIError", "EvalError")

    def __init__(self, proxy, log_path: Path):
        self._proxy = proxy
        self.log_path = log_path

    @property
    def requests(self):
        return list(self._proxy.requests)

    @property
    def console(self):
        try:
            return self.log_path.read_text(errors="replace").splitlines()
        except OSError:
            return []

    @property
    def errors(self):
        return [line for line in self.console if any(m in line for m in self.ERROR_MARKERS)]

    def write(self, path: Path):
        path.write_text(
            json.dumps({"page_errors": self.errors, "console": self.console[-4000:], "requests": self.requests}, indent=1)
        )


class QtPage:
    """The few things the journeys read with screen.page.evaluate(...), answered by the Qt Dial."""

    def __init__(self, screen):
        self._screen = screen

    def evaluate(self, js, arg=None):
        if ".route-brewComplete" in js:
            return self._screen.graph()
        if "main-letter" in js:
            # The circular keyboard's selected key (CircleKeyboard dialProbe_keyboardKey).
            return self._screen.probe("keyboardKey")
        if "__dialRoutes" in js:
            return [[0, name] for name in self._screen.routes()]
        raise NotImplementedError(f"the Qt overlay cannot evaluate this page script: {js.strip()[:160]!r}")

    def reload(self):
        self._screen.restart()

    def wait_for_timeout(self, ms):
        time.sleep(ms / 1000)

    def screenshot(self, path):
        self._screen._grab(Path(path))


# The texts whose middle is inside the title pill's box (NavTitle: x 125, y 60, 230 x 24): the line
# the pill shows, "Catalog" or the selected card's name; the other line is scrolled out and clipped.
_PILL_JS = """(function () {
  const out = [];
  function walk(it) {
    if (!it || !it.visible || it.opacity <= 0.001) return;
    if (it.hasOwnProperty("phase") && it.phase === "leave") return;
    if (it instanceof Text && it.text && String(it.text).trim().length) {
      const p = it.mapToItem(root, 0, 0);
      const middle = p.y + it.height / 2;
      if (p.x < 355 && p.x + it.width > 125 && middle > 60 && middle < 84) out.push(String(it.text).trim());
    }
    const kids = it.children;
    for (let i = 0; i < kids.length; i++) walk(kids[i]);
  }
  walk(router);
  return JSON.stringify(out);
})()"""

# TestServer's own text collector over the whole canvas (its "texts" command covers the route and the bubble).
_CANVAS_TEXTS_JS = "(function () { const out = []; collectTexts(root, out); return JSON.stringify(out); })()"

# Brew complete's graph as _GRAPH_JS reads it: the curves drawn (PlotLine items with points) and
# what the selection reads (every text of the route).
_GRAPH_JS = """(function () {
  if (!router.current || router.current.screenName !== "brewComplete") return "null";
  let curves = 0;
  const texts = [];
  function walk(it) {
    if (!it || !it.visible || it.opacity <= 0.001) return;
    if (it.hasOwnProperty("points") && it.hasOwnProperty("count") && it.hasOwnProperty("lineWidth") && it.count > 20) curves++;
    if (it instanceof Text && it.text && String(it.text).trim().length) texts.push(String(it.text));
    const kids = it.children;
    for (let i = 0; i < kids.length; i++) walk(kids[i]);
  }
  walk(router.current);
  return JSON.stringify({ curves: curves, reading: texts.join(" ") });
})()"""


class Screen:
    """What the Qt Dial shows: its route, the bubble over it, the focused menu entry."""

    def __init__(self, app, controls: Controls, artifacts: Path, name: str, timeline=None):
        self._app = app
        self.controls = controls
        self.timeline = timeline
        self._artifacts = artifacts
        self._name = name
        self.shots: list[Path] = []
        self.page = QtPage(self)

    # ---- the test port
    @property
    def client(self):
        return self._app.client

    def state(self):
        return self.client.state()

    def probe(self, name):
        return self.client.probe(name)

    def eval(self, js):
        return self.client.call({"cmd": "eval", "js": js})["value"]

    # ---- what it shows
    def route(self) -> str | None:
        return self.state()["screen"] or None

    def bubble_open(self) -> bool:
        return bool(self.state()["bubble"])

    def wait_for_bubble_closed(self, timeout_s: float = 5) -> None:
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if not self.bubble_open():
                return
            time.sleep(0.05)
        raise AssertionError("the quick settings bubble did not close")

    def wait_for_route(self, name: str, timeout_s: float = 30) -> None:
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if self.route() == name:
                self.wait_for_transition()
                return
            time.sleep(0.1)
        self.snapshot(f"not-{name}")
        raise AssertionError(f"the Dial did not reach {name} in {timeout_s:.0f} s; it shows {self.route()}")

    def wait_for_transition(self, timeout_s: float = 3) -> None:
        """Until the screen change is over (Router, 450 ms): screens take no gesture before."""
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline and self.state()["transitioning"]:
            time.sleep(0.05)

    def wait_for_any_route(self, names: list[str], timeout_s: float = 30) -> str:
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if (route := self.route()) in names:
                return route
            time.sleep(0.1)
        self.snapshot("not-" + "-or-".join(names))
        raise AssertionError(f"the Dial reached none of {names} in {timeout_s:.0f} s; it shows {self.route()}")

    def wait_for_home(self, timeout_s: float = 60) -> None:
        """The home with its carousel loaded (a focused card): it shows a loader until the profiles arrive."""
        self.wait_for_route("profileHome", timeout_s)
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if self.route() == "profileHome" and self.probe("activeCard"):
                return
            time.sleep(0.1)
        self.snapshot("no-home-card")
        raise AssertionError(f"the home shows no focused card in {timeout_s:.0f} s; cards {self.probe('cards')}")

    def texts(self) -> list[str]:
        """Every visible Text on the display: the route, the bottom status, the bubble and the scale
        overlay, as the React journeys read the whole `.meticulous-main-canvas`."""
        try:
            return json.loads(self.eval(_CANVAS_TEXTS_JS))
        except (ValueError, KeyError, TypeError):
            return self.client.texts()

    def text(self) -> str:
        """What the screen shows: the visible text of the route and the bubble over it."""
        return "\n".join(self.texts())

    def wait_for_text(self, text: str, timeout_s: float = 30) -> None:
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if self.has_text(text):
                return
            time.sleep(0.1)
        self.snapshot("no-text")
        raise AssertionError(f"the Dial does not show {text!r}: {self.text()[:300]!r}")

    def has_text(self, text: str) -> bool:
        return text.casefold() in self.text().casefold()

    def focused(self) -> str | None:
        """The focused entry's label, trimmed as the React fixture trims the label's innerText."""
        value = self.client.focused()
        return value.strip() if isinstance(value, str) else value

    def wait_for_focus(self, label: str, timeout_s: float = 5) -> None:
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if _same(self.focused(), label):
                return
            time.sleep(0.05)
        raise AssertionError(f"focus is on {self.focused()!r}, not {label!r}")

    def select(self, label: str, max_steps: int = 25) -> None:
        """Turn the knob until `label` is focused in the menu on screen, then push."""
        self._note(f"Choose “{label}”")
        self._focus(label, max_steps)
        self.controls.push()

    def focus(self, label: str, max_steps: int = 25) -> None:
        """Turn the knob until `label` is focused in the menu on screen."""
        self._note(f"Go to “{label}”")
        self._focus(label, max_steps)

    def restart(self) -> None:
        """Start the Dial again (a new process, the same storage), as after a reboot of the machine."""
        self._note("Restart the Dial")
        self._app.restart()

    def _note(self, text: str) -> None:
        if self.timeline is not None:
            self.timeline.add("you", text)

    def _focus(self, label: str, max_steps: int = 25) -> None:
        seen = []
        for direction in (1, -1):
            for _ in range(max_steps):
                current = self.focused()
                if _same(current, label):
                    return
                seen.append(current)
                before = current
                self.controls.turn(direction)
                time.sleep(0.15)
                if self.focused() == before:
                    break  # the end of the list in this direction
        self.snapshot(f"no-{label}")
        raise AssertionError(f"{label!r} is not in the menu; went through {seen}")

    def routes(self) -> list[str]:
        """Every screen shown since the Dial started, in order (Nav.history)."""
        return [name for _, name in self.state().get("history") or []]

    def history(self) -> list:
        return self.state().get("history") or []

    def graph(self):
        return json.loads(self.eval(_GRAPH_JS))

    def snapshot(self, what: str) -> Path:
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in what)[:60]
        path = self._artifacts / f"{self._name}-{len(self.shots) + 1:02d}-{safe}.png"
        try:
            self._grab(path)
        except Exception as error:  # a dead Dial: keep the test's own failure
            path.with_suffix(".txt").write_text(f"no screenshot: {error}\n")
        self.shots.append(path)
        return path

    def _grab(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.client.grab(str(path))
        _over_black(path)


def _over_black(path: Path):
    """The test port saves straight alpha: composite it over the black of the display."""
    try:
        from PIL import Image
    except ImportError:
        return
    try:
        image = Image.open(path).convert("RGBA")
        black = Image.new("RGBA", image.size, (0, 0, 0, 255))
        Image.alpha_composite(black, image).convert("RGB").save(path)
    except OSError:
        pass


# ---- the home carousel ------------------------------------------------------------


def active_card(screen: Screen) -> str | None:
    """The name on the focused card of the home carousel."""
    if screen.route() != "profileHome":
        return None
    return screen.probe("activeCard") or None


def card_selected(screen: Screen) -> bool:
    """Whether the home's focused card is selected (zoomed in: ProfileHome's homeHoverState)."""
    return screen.route() == "profileHome" and bool(screen.probe("cardSelected"))


def wait_for_card_selected(screen: Screen, timeout_s: float = 3) -> bool:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline and not card_selected(screen):
        time.sleep(0.05)
    return card_selected(screen)


def carousel(screen: Screen) -> list[str]:
    """The cards of the home carousel in their order (all of them: the Qt home lists every card)."""
    if screen.route() != "profileHome":
        return []
    return list(screen.probe("cards") or [])


def home_cards(screen: Screen) -> list[str]:
    """Every card a user reaches by turning the knob from the first card to the last."""
    cards = carousel(screen)
    go_to_card(screen, cards[0])
    reached = [active_card(screen)]
    for name in cards[1:]:
        go_to_card(screen, name)
        reached.append(active_card(screen))
    return reached


def go_to_card(screen: Screen, name: str, limit: int = 60) -> None:
    """Turn the knob towards `name` one detent at a time. On the home, left is the next card.

    As meticulous-integration's go_to_card: a turn the Dial ignores (the first one only leaves a
    selected card) is turned again; a card not listed is searched for towards the end, then back.
    """
    if active_card(screen) != name:
        screen._note(f"Go to the “{name}” card")
    towards, unchanged = -1, 0
    for _ in range(limit):
        cards, current = carousel(screen), active_card(screen)
        if current == name:
            return
        if current not in cards:
            break
        if name in cards:
            screen.controls.turn(-1 if cards.index(name) > cards.index(current) else 1)
            continue
        screen.controls.turn(towards)
        if active_card(screen) == current:
            unchanged += 1
            if unchanged >= 3:
                towards, unchanged = -towards, 0
        else:
            unchanged = 0
    screen.snapshot(f"no-card-{name}")
    raise AssertionError(f"the knob did not reach the {name!r} card; cards {carousel(screen)}")


def pill_text(screen: Screen) -> str | None:
    """What the home's title pill shows: "Catalog", or the name of the selected card."""
    shown = json.loads(screen.eval(_PILL_JS))
    return shown[0] if shown else None


def wait_for_pill(screen: Screen, text: str, timeout_s: float = 3) -> str | None:
    """Until the pill shows `text` (its line slides in over 0.3 s); what it shows then."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if (pill_text(screen) or "").casefold() == text.casefold():
            break
        time.sleep(0.05)
    return pill_text(screen)


# ---- turns straight into the Dial -------------------------------------------------------


def inject_turns(screen: Screen, via: str, direction: str, count: int, within_s: float) -> float:
    """`count` turns of the knob straight into the Dial, spread over `within_s` (0: one burst).

    "keyboard": the test port's gestures (right / left), the Qt Dial's counterpart of the React
    Dial's development keys; "socket": backend `button` events (ENCODER_CLOCKWISE, ...) handled as
    the Dial's Socket.IO client hands them over (Input.handleButton), all sent before any answer is
    read when within_s is 0.
    """
    gap_ms = within_s * 1000 / max(count - 1, 1)
    source = {"keyboard": "keyboard", "socket": "as the backend’s socket delivers them"}[via]
    if count == 1:
        screen._note(f"Turn {direction} ({source}, straight into the Dial)")
    else:
        how = "in one burst" if within_s == 0 else f"in {within_s * 1000:.0f} ms"
        screen._note(f"Turn {direction} ×{count} {how} ({source}, straight into the Dial)")
    if via == "keyboard":
        message = {"cmd": "gesture", "type": direction}
    else:
        message = {"cmd": "button", "type": "ENCODER_CLOCKWISE" if direction == "right" else "ENCODER_COUNTERCLOCKWISE",
                   "t": round(gap_ms)}
    return _send_spread(screen.client, message, count, gap_ms / 1000 if within_s > 0 else 0.0)


def _send_spread(client, message, count, gap_s) -> float:
    import asyncio

    async def go():
        started = time.perf_counter()
        ids = []
        for n in range(count):
            if n and gap_s:
                await asyncio.sleep(gap_s)
            ids.append(next(dialctl._ids))
            await client._ws.send(json.dumps(dict(message, id=ids[-1])))
        took = time.perf_counter() - started
        waiting = set(ids)
        while waiting:
            answer = json.loads(await asyncio.wait_for(client._ws.recv(), 10))
            waiting.discard(answer.get("id"))
        return took

    return client._loop.run_until_complete(go())
