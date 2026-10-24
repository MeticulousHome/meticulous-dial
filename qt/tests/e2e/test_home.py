"""The home and the quick settings (ported from meticulous-integration tests/test_dial_02_home.py and
tests/test_dial_input.py)."""

import uuid

import pytest


def default_profile(backend):
    _, defaults = backend.get("/api/v1/profile/defaults")
    return dict(defaults["default"][0])


def save_profile(backend, profile):
    status, body = backend.post("/api/v1/profile/save", profile)
    assert status == 200, body


def test_the_home_offers_every_profile_then_free_pour_and_new(screen, backend):
    """Protects: finding every saved profile on the home with the knob.

    Limit: the carousel order of homeSelection.ts: espresso profiles, then pour-over profiles, then
    Free Pour, then new; the profiles are the backend's /profile/list.
    """
    names = {f"Home {n} {uuid.uuid4().hex[:4]}" for n in range(2)}
    for name in names:
        save_profile(backend, {**default_profile(backend), "id": str(uuid.uuid4()), "name": name})
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


def test_the_title_pill_names_the_selected_card(screen, backend):
    """Protects: seeing which card a push selected: the pill reads "Catalog" while browsing and the
    selected card's name once a push zooms it (ProfileTitle)."""
    profile = {**default_profile(backend), "id": str(uuid.uuid4()), "name": f"Pill {uuid.uuid4().hex[:4]}"}
    save_profile(backend, profile)
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
