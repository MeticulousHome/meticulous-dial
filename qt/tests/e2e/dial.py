"""The Qt Dial seen by a test: what it shows and the machine's controls, through its test port.

The same vocabulary as meticulous-integration's tests/dial_app.py (Screen, Controls) so its journeys port
over: route(), bubble_open(), wait_for_route(), text(), has_text(), focused(), select(), focus() and the
knob and buttons. The controls are injected as the backend's own socket.io "button" events
(ENCODER_CLOCKWISE, ENCODER_PRESSED, ...), the same path the real encoder takes into the Dial.

Environment: DIAL_TEST_PORT (default 9310), DIAL_API (default http://127.0.0.1:18080),
DIAL_ARTIFACTS (screenshots, default qt/build/e2e-artifacts).
"""

import json
import os
import time
import urllib.request
from pathlib import Path

from dialctl import DialClient

ARTIFACTS = Path(os.environ.get("DIAL_ARTIFACTS", Path(__file__).resolve().parents[2] / "build" / "e2e-artifacts"))

# Time between detents when turning, like a brisk human turn.
DETENT_S = 0.06


class Controls:
    """The rotary encoder and the buttons. Right is clockwise: it moves down a menu; on the home,
    left (counter-clockwise) moves to the next card."""

    def __init__(self, client: DialClient):
        self.c = client

    def _button(self, kind, t=300):
        self.c.call({"cmd": "button", "type": kind, "t": t})

    def turn(self, detents: int):
        kind = "ENCODER_CLOCKWISE" if detents > 0 else "ENCODER_COUNTERCLOCKWISE"
        for _ in range(abs(detents)):
            self._button(kind)
            time.sleep(DETENT_S)
        time.sleep(0.2)

    def right(self, detents: int = 1):
        self.turn(detents)

    def left(self, detents: int = 1):
        self.turn(-detents)

    def push(self):
        """A short press: pressDown, pressUp, then click."""
        self._button("ENCODER_PRESSED")
        time.sleep(0.08)
        self._button("ENCODER_RELEASED")
        self._button("ENCODER_PUSH")
        time.sleep(0.3)

    def double_push(self):
        self._button("ENCODER_DOUBLE")
        time.sleep(0.3)

    def long_push(self):
        self._button("ENCODER_PRESSED")
        time.sleep(0.6)
        self._button("ENCODER_LONG")
        self._button("ENCODER_RELEASED")
        time.sleep(0.5)

    def hold(self, seconds: float):
        self._button("ENCODER_PRESSED")
        time.sleep(seconds)
        self._button("ENCODER_RELEASED")
        time.sleep(0.3)

    def context(self):
        self._button("CONTEXT")
        time.sleep(0.6)

    def tare(self):
        self._button("TARE")
        time.sleep(0.3)


class Screen:
    def __init__(self, client: DialClient, name: str = "test"):
        self.c = client
        self.controls = Controls(client)
        self._name = name
        self.shots = []

    # ---- what it shows
    def state(self):
        return self.c.state()

    def route(self):
        return self.c.state()["screen"]

    def bubble_open(self):
        return bool(self.c.state()["bubble"])

    def bubble_component(self):
        return self.c.state()["bubbleComponent"]

    def wait_for_transition(self, timeout_s=3):
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline and self.c.state()["transitioning"]:
            time.sleep(0.05)

    def wait_for_route(self, name, timeout_s=30):
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if self.route() == name:
                self.wait_for_transition()
                return
            time.sleep(0.1)
        self.snapshot(f"not-{name}")
        raise AssertionError(f"the Dial did not reach {name} in {timeout_s:.0f} s; it shows {self.route()}")

    def wait_for_any_route(self, names, timeout_s=30):
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if (r := self.route()) in names:
                return r
            time.sleep(0.1)
        raise AssertionError(f"the Dial reached none of {names}; it shows {self.route()}")

    def wait_for_bubble_closed(self, timeout_s=5):
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if not self.bubble_open():
                return
            time.sleep(0.05)
        raise AssertionError("the bubble did not close")

    def wait_for_bubble(self, component=None, timeout_s=5):
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            s = self.c.state()
            if s["bubbleVisible"] and (component is None or s["bubbleComponent"] == component):
                return
            time.sleep(0.05)
        raise AssertionError(f"the bubble {component or ''} did not open: {self.c.state()}")

    def wait_for_home(self, timeout_s=60):
        self.wait_for_route("profileHome", timeout_s)
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline and not self.probe("cards"):
            time.sleep(0.1)

    def texts(self):
        return self.c.texts()

    def text(self):
        return "\n".join(self.c.texts())

    def has_text(self, text):
        return text.casefold() in self.text().casefold()

    def wait_for_text(self, text, timeout_s=30):
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if self.has_text(text):
                return
            time.sleep(0.1)
        self.snapshot("no-text")
        raise AssertionError(f"the Dial does not show {text!r}: {self.text()[:300]!r}")

    def probe(self, name):
        return self.c.probe(name)

    def focused(self):
        return self.c.focused()

    def wait_for_focus(self, label, timeout_s=5):
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if _same(self.focused(), label):
                return
            time.sleep(0.05)
        raise AssertionError(f"focus is on {self.focused()!r}, not {label!r}")

    def focus(self, label, max_steps=25):
        seen = []
        for direction in (1, -1):
            for _ in range(max_steps):
                current = self.focused()
                if _same(current, label):
                    return
                seen.append(current)
                self.controls.turn(direction)
                if self.focused() == current:
                    break  # the end of the list in this direction
        self.snapshot(f"no-{label}")
        raise AssertionError(f"{label!r} is not in the menu; went through {seen}")

    def select(self, label, max_steps=25):
        self.focus(label, max_steps)
        self.controls.push()

    def snapshot(self, what):
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        path = ARTIFACTS / f"{self._name}-{len(self.shots) + 1:02d}-{what}.png"
        self.c.grab(str(path))
        self.shots.append(path)
        return path

    # ---- the home carousel
    def cards(self):
        return self.probe("cards") or []

    def active_card(self):
        return self.probe("activeCard")

    def card_selected(self):
        return bool(self.probe("cardSelected"))

    def wait_for_cards(self, names, timeout_s=10):
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            cards = self.cards()
            if set(names) <= set(cards):
                time.sleep(0.5)  # let a queued refetch land
                return self.cards()
            time.sleep(0.1)
        raise AssertionError(f"cards {names} not on the home: {self.cards()}")

    def active_index(self):
        return self.probe("activeIndex")

    def go_to_card(self, name, limit=None):
        """Turn the knob towards `name` (its first card when profiles share the name); on the home, left is
        the next card."""
        for _ in range(limit or len(self.cards()) + 10):
            cards, current = self.cards(), self.active_card()
            if current == name:
                return
            if name not in cards:
                raise AssertionError(f"no card {name!r} in {cards}")
            self.controls.turn(-1 if cards.index(name) > self.active_index() else 1)
        if self.active_card() == name:
            return
        raise AssertionError(f"could not reach {name!r}; on {self.active_card()!r}")


def _same(focused, label):
    return focused is not None and (focused.casefold() == label.casefold() or focused.casefold().startswith(label.casefold()))


class Backend:
    def __init__(self, url=None):
        self.url = (url or os.environ.get("DIAL_API", "http://127.0.0.1:18080")).rstrip("/")

    def request(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.url + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"} if data else {})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            raw = e.read()
            return e.code, (json.loads(raw) if raw else None)

    def get(self, path):
        return self.request("GET", path)

    def post(self, path, body=None):
        return self.request("POST", path, body if body is not None else {})
