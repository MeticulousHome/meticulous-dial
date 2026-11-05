"""The home and the quick settings (ported from meticulous-integration tests/test_dial_02_home.py and
tests/test_dial_input.py)."""

import http.server
import threading
import time
import uuid
from pathlib import Path

import pytest


def default_profile(backend):
    _, defaults = backend.get("/api/v1/profile/defaults")
    return dict(defaults["default"][0])


@pytest.fixture
def saved(backend):
    """The profiles a test saves, deleted after it so they do not pile up on the backend's home."""
    ids = []
    yield ids
    for id_ in ids:
        backend.request("DELETE", f"/api/v1/profile/delete/{id_}")


def save_profile(backend, profile, saved=None):
    status, body = backend.post("/api/v1/profile/save", profile)
    assert status == 200, body
    if saved is not None:
        saved.append(profile["id"])


def test_the_boot_screen_waits_until_the_dial_is_online(screen):
    """Protects: after a power cycle the Dial starts before the backend; the boot screen's loading dot is
    the wait, so it stays until the Dial is online (socket, settings and profiles), even with the profiles
    in, and the home never opens on "Waiting for the backend to come online".

    Limit: the boot is replayed by showing the ready screen again with Device.isOnline put back to false.
    """
    def ev(code):
        return screen.c.call({"cmd": "eval", "js": code})["value"]

    ev("Device.isOnline = false; 'ok'")
    try:
        screen.c.call({"cmd": "screen", "name": "ready"})
        screen.wait_for_route("ready")
        assert ev("Profiles.profilesLoaded") == "true"
        time.sleep(1.5)
        assert screen.route() == "ready"
        assert screen.probe("phase") == "loading"
    finally:
        ev("Device._updateOnline(); 'ok'")
    assert ev("Device.isOnline") == "true"
    screen.wait_for_any_route(["profileHome", "shotDataSharingPrompt"], timeout_s=30)


def test_the_home_offers_every_profile_then_free_pour_and_new(screen, backend, saved):
    """Protects: finding every saved profile on the home with the knob.

    Limit: the carousel order of homeSelection.ts: espresso profiles, then pour-over profiles, then
    Free Pour, then new; the profiles are the backend's /profile/list.
    """
    names = {f"Home {n} {uuid.uuid4().hex[:4]}" for n in range(2)}
    for name in names:
        save_profile(backend, {**default_profile(backend), "id": str(uuid.uuid4()), "name": name}, saved)
    _, saved = backend.get("/api/v1/profile/list")
    espresso = [p["name"] for p in saved]

    screen.wait_for_home()
    # The new profiles arrive with the backend's "profile" events.
    cards = screen.wait_for_cards(names)
    assert cards[-2:] == ["Free Pour", "new"], cards
    assert sorted(cards[:-2]) == sorted(espresso), cards

    target = sorted(names)[0]
    screen.go_to_card("new")
    screen.go_to_card(target)
    assert screen.active_card() == target


def test_the_title_pill_names_the_selected_card(screen, backend, saved):
    """Protects: seeing which card a push selected: the pill reads "Catalog" while browsing and the
    selected card's name once a push zooms it (ProfileTitle)."""
    profile = {**default_profile(backend), "id": str(uuid.uuid4()), "name": f"Pill {uuid.uuid4().hex[:4]}"}
    save_profile(backend, profile, saved)
    screen.wait_for_home()
    screen.wait_for_cards({profile["name"]})
    screen.go_to_card("new")
    screen.go_to_card(profile["name"])
    assert not screen.card_selected()
    screen.controls.push()
    assert screen.card_selected()
    screen.wait_for_text(profile["name"])

    screen.go_to_card("Free Pour")
    assert not screen.card_selected()
    screen.controls.push()
    assert screen.card_selected()


def test_a_fast_spin_keeps_the_cards_it_passes_on_screen(screen, backend, saved):
    """Protects: seeing the profiles go by while spinning the knob fast, instead of a black screen until the
    carousel catches up (the list slides several cards behind the knob).

    Limit: the knob is turned 10 detents 15 ms apart through the test port; the cards drawn on screen are
    counted between detents and until the carousel settles.
    """
    names = {f"Spin {n} {uuid.uuid4().hex[:4]}" for n in range(10)}
    for name in names:
        save_profile(backend, {**default_profile(backend), "id": str(uuid.uuid4()), "name": name}, saved)
    screen.wait_for_home()
    cards = screen.wait_for_cards(names)
    screen.go_to_card(cards[0])
    time.sleep(0.5)

    start, drawn = screen.active_index(), []
    t0 = time.monotonic()
    for n in range(10):
        screen.c.call({"cmd": "button", "type": "ENCODER_COUNTERCLOCKWISE"})
        while time.monotonic() < t0 + (n + 1) * 0.015:
            drawn.append(screen.probe("cardsDrawn"))
    settle = time.monotonic() + 0.5
    while time.monotonic() < settle:
        drawn.append(screen.probe("cardsDrawn"))

    assert screen.active_index() == start + 10
    assert min(drawn) >= 1, f"{drawn.count(0)} of {len(drawn)} samples with no card on screen"


class PictureHost:
    """A profile picture on the internet: a local HTTP server that answers with the picture, or, while
    `failure` is set, "drop"s every connection without an answer (the Wi-Fi is not up yet) or keeps it open
    without one ("hang"). Counts the requests."""

    def __init__(self):
        picture = (Path(__file__).resolve().parents[2] / "qml/Dial/assets/icons/idle-no-wifi.png").read_bytes()
        host = self
        self.failure = "drop"
        self.requests = 0
        self.closed = threading.Event()

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                host.requests += 1
                self.close_connection = True
                failure = host.failure
                if failure == "hang":
                    host.closed.wait(60)
                if failure:
                    return
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(len(picture)))
                self.end_headers()
                self.wfile.write(picture)

            def log_message(self, *args):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/picture.png"

    def close(self):
        self.closed.set()
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def picture_host():
    host = PictureHost()
    yield host
    host.close()


def wait_until(predicate, timeout_s, what):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.1)
    raise AssertionError(f"timed out waiting for {what}")


def show_remote_picture_after_a_failed_load(screen, backend, saved, picture_host, timeout_s):
    """Saves a profile whose picture is on `picture_host`, lets the host fail the card's first load, makes it
    answer from then on and waits for the card to show the picture without leaving the home."""
    name = f"Remote picture {uuid.uuid4().hex[:4]}"
    profile = default_profile(backend)
    profile.update(id=str(uuid.uuid4()), name=name, display={**(profile.get("display") or {}), "image": picture_host.url})
    save_profile(backend, profile, saved)
    screen.wait_for_home()
    screen.wait_for_cards({name})
    wait_until(lambda: picture_host.requests >= 1, 10, "the card to load the picture")
    picture_host.failure = None

    screen.go_to_card(name)
    wait_until(lambda: (screen.probe("activeCardImage") or {}).get("loaded"), timeout_s,
               "the card to show the picture once the host answers")
    assert screen.route() == "profileHome"
    assert picture_host.requests >= 2


def test_a_remote_picture_that_failed_shows_once_the_network_is_up(screen, backend, saved, picture_host):
    """Protects: seeing a profile picture hosted on the internet after a boot where the home opened before
    the Wi-Fi connected: its first load fails ("Host not found") and the card loads it again once the
    network is up, without leaving the home; a picture that loaded is not loaded again (no flicker).

    Limit: the internet is a local HTTP server that drops the first request and answers from then on; the
    card's retries are 2, 4, 8... s after each failure, so the second load is the one 2 s after the first.
    """
    show_remote_picture_after_a_failed_load(screen, backend, saved, picture_host, timeout_s=15)
    loads = picture_host.requests
    time.sleep(6)
    assert picture_host.requests == loads, "the picture was loaded again after it showed"
    assert screen.probe("activeCardImage")["loaded"]


def test_a_remote_picture_whose_load_hangs_shows_once_the_network_is_up(screen, backend, saved, picture_host):
    """Protects: the same, when the first load never gets an answer: with the host's name unresolved, Qt 6.4
    can leave one of several requests to an HTTPS host waiting forever, and its card would wait with it.

    Limit: the server keeps the first request open without answering; a load with no progress for 15 s
    counts as failed.
    """
    picture_host.failure = "hang"
    show_remote_picture_after_a_failed_load(screen, backend, saved, picture_host, timeout_s=25)


def test_the_context_button_opens_and_closes_the_quick_settings(screen):
    """Protects: the context button toggling the quick settings over any screen (App.tsx, Bubble.tsx)."""
    screen.wait_for_home()
    screen.controls.context()
    screen.wait_for_bubble("quick-settings")
    assert screen.focused() is not None
    screen.controls.context()
    screen.wait_for_bubble_closed()


def test_quick_settings_list_on_the_home_of_a_profile(screen):
    """Protects: the profile options and the default ones in the order QuickSettings.tsx lists them."""
    screen.wait_for_home()
    screen.go_to_card(screen.cards()[0])
    screen.controls.context()
    screen.wait_for_bubble("quick-settings")
    seen = [screen.focused()]
    for _ in range(20):
        screen.controls.right()
        f = screen.focused()
        if f == seen[-1]:
            break
        seen.append(f)
    assert seen[:3] == ["Edit profile", "Last shot", "Delete profile"], seen
    assert seen[3:] == ["sleep", "raise", "purge", "Brew Settings", "wifi", "config", "Report an issue",
                        "Experimental", "Help us improve", "exit"], seen


def test_exit_closes_the_quick_settings(screen):
    screen.wait_for_home()
    screen.controls.context()
    screen.wait_for_bubble("quick-settings")
    screen.select("exit")
    screen.wait_for_bubble_closed()
    assert screen.route() == "profileHome"
