"""Profiles on the Dial: create, edit, discard and delete them with the knob (ported from
meticulous-integration tests/test_dial_profiles.py), and the screens of the profile editor: the circular
keyboard (CircleKeyboard), the numerical settings (SettingNumerical), the image picker (PressetProfileImage)
and "brew without saving".

The backend stores the profiles; every check reads them back from it, as the mobile app would.
"""

import re
import time
import uuid

import pytest

# SettingNumerical: a detent of the knob is 0.5 °C.
DEGREES_PER_DETENT = 0.5

# Keys.tsx DEFAULT_ALPHABET: the order of the keyboard's keys (left = the next one).
DEFAULT_KEYS = list("abcdefghijklmnopqrstuvwxyz1234567890") + ["space", "ok", "backspace", "capslock", "keyboardType", "cancel"]


# ---- the backend
def default_profile(backend) -> dict:
    _, defaults = backend.get("/api/v1/profile/defaults")
    return dict(defaults["default"][0])


def save_profile(backend, profile) -> dict:
    status, body = backend.post("/api/v1/profile/save", profile)
    assert status == 200, body
    return profile


def profiles_by_id(backend) -> dict:
    _, profiles = backend.get("/api/v1/profile/list?full=true")
    return {profile["id"]: profile for profile in profiles}


def a_profile(backend) -> dict:
    profile = default_profile(backend)
    profile.update(id=str(uuid.uuid4()), name=f"Profile {uuid.uuid4().hex[:6]}")
    return save_profile(backend, profile)


def delete_profile(backend, profile_id):
    backend.request("DELETE", f"/api/v1/profile/delete/{profile_id}")


@pytest.fixture
def cleanup(backend):
    """Profiles the test makes, deleted afterwards (the shared home stays short)."""
    before = set(profiles_by_id(backend))
    yield
    for profile_id in set(profiles_by_id(backend)) - before:
        delete_profile(backend, profile_id)


# ---- the Dial
def shown_temperature(screen) -> float:
    """The temperature the profile editor shows on its focused Temperature line: what Save stores."""
    screen.wait_for_text("Temperature:")
    return float(re.search(r"Temperature:\s*([\d.]+)", screen.text()).group(1))


def change_temperature(screen, detents: int) -> tuple[float, float]:
    """Turn the temperature by `detents`; what the editor shows before and after."""
    screen.focus("Temperature")
    before = shown_temperature(screen)
    screen.controls.push()
    screen.wait_for_route("temperature")
    screen.controls.turn(detents)
    screen.controls.push()
    screen.wait_for_route("pressetSettings")
    return before, shown_temperature(screen)


def go_home(screen):
    """Start from the home, whatever an earlier test or session left on screen."""
    if screen.state()["bubbleVisible"]:
        screen.controls.context()
    if screen.route() not in ("profileHome", "ready"):
        screen.c.call({"cmd": "screen", "name": "profileHome"})
        screen.wait_for_transition()
    screen.wait_for_home()


def open_new_profile(screen):
    """The "new" card opens the editor on a new profile made from the backend's Simple."""
    go_home(screen)
    screen.go_to_card("new")
    screen.controls.push()
    screen.wait_for_route("pressetSettings")
    screen.wait_for_focus("Name")


def open_profile(screen, profile):
    """Quick settings "Edit profile" on the profile's card."""
    go_home(screen)
    screen.wait_for_cards({profile["name"]})
    screen.go_to_card(profile["name"])
    screen.controls.context()
    screen.select("Edit profile")
    screen.wait_for_route("pressetSettings")


def create_on_the_dial(screen, backend) -> tuple[dict, float, float]:
    """Make a profile with the "new" card, 3 detents warmer than the template."""
    before = profiles_by_id(backend)
    open_new_profile(screen)
    template, shown = change_temperature(screen, 3)
    screen.select("Save")
    screen.wait_for_home()
    created = []
    deadline = time.monotonic() + 5
    while not created and time.monotonic() < deadline:
        created = [p for id_, p in profiles_by_id(backend).items() if id_ not in before]
        time.sleep(0.1)
    assert len(created) == 1, created
    return created[0], template, shown


def wait_for_active_card(screen, name, timeout_s=5):
    deadline = time.monotonic() + timeout_s
    while screen.active_card() != name and time.monotonic() < deadline:
        time.sleep(0.1)
    return screen.active_card()


def key(screen) -> str:
    return screen.probe("keyboardKey")


def keyboard_text(screen) -> str:
    return screen.probe("keyboardText")


def turn_to_key(screen, target: str):
    """Turn the keyboard to `target` (a DEFAULT_KEYS entry, any case) the short way round."""
    for _ in range(len(DEFAULT_KEYS)):
        current = key(screen)
        if current.lower() == target.lower():
            return
        c, t = DEFAULT_KEYS.index(current.lower() if len(current) == 1 else current), DEFAULT_KEYS.index(target)
        forward = (t - c) % len(DEFAULT_KEYS)
        steps = forward if forward <= len(DEFAULT_KEYS) - forward else forward - len(DEFAULT_KEYS)
        kind = "ENCODER_COUNTERCLOCKWISE" if steps > 0 else "ENCODER_CLOCKWISE"
        for _ in range(abs(steps)):
            screen.controls._button(kind)
            time.sleep(0.03)
        time.sleep(0.1)
    raise AssertionError(f"could not reach {target!r}; on {key(screen)!r}")


def type_keys(screen, keys):
    for k in keys:
        turn_to_key(screen, k)
        screen.controls.push()


def open_name_keyboard(screen):
    screen.focus("Name")
    screen.controls.push()
    screen.wait_for_route("name")
    deadline = time.monotonic() + 3
    while key(screen) is None and time.monotonic() < deadline:
        time.sleep(0.05)


# ---- journeys of meticulous-integration tests/test_dial_profiles.py
def test_a_profile_created_on_the_dial_is_saved_with_what_was_set(screen, backend, cleanup):
    """Protects: making a new profile at the machine.

    Limit: the "new" card opens the profile editor (PressetSettings) in create mode; Save posts it to
    /profile/save, and the backend's `profile` event (change `create`) makes the home refetch its list.
    """
    profile, template, shown = create_on_the_dial(screen, backend)

    assert shown > template, "turning the knob right did not warm the new profile"
    assert shown == pytest.approx(template + 3 * DEGREES_PER_DETENT)
    assert profile["temperature"] == pytest.approx(shown)
    assert profile["name"] == "Simple"
    screen.wait_for_cards({profile["name"]})
    screen.go_to_card(profile["name"])


@pytest.mark.xfail(
    strict=False,
    reason="as in meticulous-integration: ProfileContext handles the backend's `create` event to focus the "
    "new profile (setProfileIdToFind), but the home may stay on the 'new' card",
)
def test_the_home_focuses_the_profile_just_made(screen, backend, cleanup):
    a_profile(backend)  # the user already has one
    profile, _, _ = create_on_the_dial(screen, backend)
    assert wait_for_active_card(screen, profile["name"]) == profile["name"], screen.cards()


def test_editing_a_profile_on_the_dial_saves_it_under_the_same_identity(screen, backend, cleanup):
    """Protects: changing a profile the user already has: Save keeps the profile's id.

    The React journey also reboots the Dial; here the home is checked to offer it again after a refetch.
    """
    profile = a_profile(backend)
    count = len(profiles_by_id(backend))
    open_profile(screen, profile)

    opened, shown = change_temperature(screen, -4)
    assert opened == pytest.approx(profile["temperature"]), "the editor opened another profile"
    assert shown == pytest.approx(opened - 4 * DEGREES_PER_DETENT)
    screen.select("Save")
    screen.wait_for_home()

    deadline = time.monotonic() + 5
    while profiles_by_id(backend)[profile["id"]]["temperature"] != pytest.approx(shown) and time.monotonic() < deadline:
        time.sleep(0.1)
    saved = profiles_by_id(backend)
    assert len(saved) == count, "editing created a new profile"
    assert saved[profile["id"]]["temperature"] == pytest.approx(shown)
    assert saved[profile["id"]]["name"] == profile["name"]
    screen.c.call({"cmd": "eval", "js": "Profiles.refetch()"})
    screen.wait_for_cards({profile["name"]})


def test_discarding_the_changes_leaves_the_profile_as_it_was(screen, backend, cleanup):
    """Protects: backing out of the editor without saving: Discard goes home without posting anything."""
    profile = a_profile(backend)
    count = len(profiles_by_id(backend))
    open_profile(screen, profile)

    opened, shown = change_temperature(screen, 6)
    assert opened == pytest.approx(profile["temperature"])
    assert shown > opened, "turning the knob right did not warm the profile"
    screen.select("Discard")
    screen.wait_for_home()

    time.sleep(0.5)
    after = profiles_by_id(backend)
    assert after[profile["id"]]["temperature"] == profile["temperature"]
    assert len(after) == count


def test_deleting_a_profile_from_the_menu_removes_it_everywhere(screen, backend, cleanup):
    """Protects: Quick settings "Delete profile" is a hold item: a short push does not delete."""
    profile = a_profile(backend)
    go_home(screen)
    screen.wait_for_cards({profile["name"]})
    screen.go_to_card(profile["name"])
    screen.controls.context()
    screen.focus("Delete profile")

    screen.controls.push()
    assert profile["id"] in profiles_by_id(backend)

    if not screen.bubble_open():
        screen.controls.context()
        screen.focus("Delete profile")
    screen.controls.hold(1.8)
    screen.wait_for_home()

    deadline = time.monotonic() + 5
    while profile["id"] in profiles_by_id(backend) and time.monotonic() < deadline:
        time.sleep(0.1)
    assert profile["id"] not in profiles_by_id(backend)
    deadline = time.monotonic() + 5
    while profile["name"] in screen.cards() and time.monotonic() < deadline:
        time.sleep(0.1)
    assert profile["name"] not in screen.cards()


# ---- the editor
def test_the_editor_lists_the_settings_then_the_actions(screen, backend):
    """PressetSettings: name, temperature, output, image, the variables, then DEFAULT_SETTING's actions;
    the focused line shows its value (capitalized labels, as text-transform: capitalize)."""
    template = default_profile(backend)
    open_new_profile(screen)
    seen = [screen.focused()]
    for _ in range(20):
        screen.controls._button("ENCODER_CLOCKWISE")
        time.sleep(0.25)
        if screen.focused() == seen[-1]:
            break
        seen.append(screen.focused())
    variables = [v["name"] for v in template.get("variables", [])]
    assert seen == ["Name", "Temperature", "Output", "Select Image", *variables,
                    "Brew Without Saving", "Save", "Discard"], seen
    assert screen.has_text("Discard")
    # Back to the top: the name's value.
    screen.focus("Name")
    screen.wait_for_text("Name:")
    assert "Simple" in screen.texts()


def test_the_temperature_stops_at_its_maximum(screen, backend):
    """SettingNumerical: 0.5 °C steps up to 99 °C; at exactly 99 the knob stops."""
    open_new_profile(screen)
    screen.focus("Temperature")
    screen.controls.push()
    screen.wait_for_route("temperature")
    start = screen.probe("value")
    detents = int((99 - start) / DEGREES_PER_DETENT) + 4
    for _ in range(detents):
        screen.controls._button("ENCODER_CLOCKWISE")
        time.sleep(0.03)
    time.sleep(0.3)
    assert screen.probe("value") == 99
    assert screen.has_text("99.0")
    screen.controls.push()
    screen.wait_for_route("pressetSettings")
    assert shown_temperature(screen) == 99


def test_a_flow_variable_steps_by_a_tenth(screen, backend):
    """SettingNumerical: the flow variables ("flow_..." keys) open the flow gauge, 0.1 ml/s a step,
    rounded to one decimal; turning left stops at 0."""
    template = default_profile(backend)
    flows = [v for v in template.get("variables", []) if v["key"].startswith("flow")]
    if not flows:
        pytest.skip("the template has no flow variable")
    open_new_profile(screen)
    screen.focus(flows[0]["name"])
    screen.controls.push()
    screen.wait_for_route("flow")
    assert screen.probe("value") == pytest.approx(flows[0]["value"])
    screen.controls.turn(2)
    assert screen.probe("value") == pytest.approx(round(flows[0]["value"] + 0.2, 1))
    for _ in range(int(flows[0]["value"] * 10) + 6):
        screen.controls._button("ENCODER_COUNTERCLOCKWISE")
        time.sleep(0.03)
    time.sleep(0.3)
    assert screen.probe("value") == 0
    assert screen.has_text("ml/s")
    screen.controls.push()
    screen.wait_for_route("pressetSettings")


def test_a_new_name_typed_on_the_keyboard_is_saved(screen, backend, cleanup):
    """CircleKeyboard on the name: backspace, letters (the first one capitalized on an empty text), ok."""
    before = set(profiles_by_id(backend))
    open_new_profile(screen)
    open_name_keyboard(screen)
    assert keyboard_text(screen) == "Simple"
    assert key(screen) == "a"
    turn_to_key(screen, "backspace")
    for _ in range(len("Simple")):
        screen.controls.push()
    assert keyboard_text(screen) == ""
    # An empty text: caps lock on (capitalizeFirstLetter), off again after the first letter.
    assert screen.probe("capsLock") == "active"
    name = f"zq{uuid.uuid4().hex[:3]}"
    letters = [c for c in name]
    type_keys(screen, letters)
    expected = name[0].upper() + name[1:]
    assert keyboard_text(screen) == expected
    assert screen.probe("capsLock") == "inactive"
    turn_to_key(screen, "ok")
    screen.controls.push()
    screen.wait_for_route("pressetSettings")
    screen.wait_for_text(f"Name:")
    assert expected in screen.texts()
    screen.select("Save")
    screen.wait_for_home()
    deadline = time.monotonic() + 5
    created = []
    while not created and time.monotonic() < deadline:
        created = [p for id_, p in profiles_by_id(backend).items() if id_ not in before]
        time.sleep(0.1)
    assert [p["name"] for p in created] == [expected]


def test_cancel_on_the_keyboard_keeps_the_name(screen, backend):
    open_new_profile(screen)
    open_name_keyboard(screen)
    type_keys(screen, ["x", "y"])
    assert keyboard_text(screen) == "Simplexy"
    turn_to_key(screen, "cancel")
    screen.controls.push()
    screen.wait_for_route("pressetSettings")
    screen.wait_for_text("Name:")
    assert "Simple" in screen.texts()


def test_ok_on_a_blank_name_is_refused(screen, backend):
    """"ok" and "space" on a blank text shake the caption and do nothing."""
    open_new_profile(screen)
    open_name_keyboard(screen)
    turn_to_key(screen, "backspace")
    for _ in range(len("Simple")):
        screen.controls.push()
    turn_to_key(screen, "space")
    screen.controls.push()
    assert keyboard_text(screen) == ""
    turn_to_key(screen, "ok")
    screen.controls.push()
    time.sleep(0.5)
    assert screen.route() == "name"
    turn_to_key(screen, "cancel")
    screen.controls.push()
    screen.wait_for_route("pressetSettings")


def test_the_keyboard_wraps_and_switches_character_sets(screen, backend):
    """Keys.tsx: right from the first key is the last one ("cancel"), left from it the first again; the
    character set key cycles default, accents, special characters; caps lock click / double click."""
    open_new_profile(screen)
    open_name_keyboard(screen)
    assert key(screen) == "a"
    seen = []
    for _ in range(4):
        screen.controls._button("ENCODER_CLOCKWISE")
        time.sleep(0.15)
        seen.append(key(screen))
    assert seen == ["cancel", "keyboardType", "capslock", "backspace"], seen
    screen.controls._button("ENCODER_COUNTERCLOCKWISE")
    time.sleep(0.15)
    assert key(screen) == "capslock"
    # A click toggles caps lock, a double click locks it.
    assert screen.probe("capsLock") == "inactive"
    screen.controls.push()
    assert screen.probe("capsLock") == "active"
    screen.controls.double_push()
    assert screen.probe("capsLock") == "locked"
    screen.controls.double_push()
    assert screen.probe("capsLock") == "inactive"
    screen.controls._button("ENCODER_COUNTERCLOCKWISE")
    time.sleep(0.15)
    assert key(screen) == "keyboardType"
    types = []
    for _ in range(3):
        screen.controls.push()
        types.append(screen.probe("keyboardType"))
    assert types == ["ACCENT", "SPECIAL", "DEFAULT"], types
    screen.controls._button("ENCODER_COUNTERCLOCKWISE")
    screen.controls._button("ENCODER_COUNTERCLOCKWISE")
    time.sleep(0.2)
    assert key(screen) == "a"
    turn_to_key(screen, "cancel")
    screen.controls.push()
    screen.wait_for_route("pressetSettings")


def test_reverse_scrolling_turns_the_keyboard_the_other_way(screen, backend):
    """reverse_scrolling.keyboard: turning right selects the next key."""
    _, settings = backend.get("/api/v1/settings/")
    reverse = dict(settings["reverse_scrolling"])
    backend.post("/api/v1/settings/", {"reverse_scrolling": {**reverse, "keyboard": True}})
    try:
        open_new_profile(screen)
        open_name_keyboard(screen)
        deadline = time.monotonic() + 5
        while screen.c.call({"cmd": "eval", "js": "BackendSettings.data.reverse_scrolling.keyboard"})["value"] != "true":
            assert time.monotonic() < deadline, "the Dial did not get the setting"
            time.sleep(0.2)
        screen.controls._button("ENCODER_CLOCKWISE")
        time.sleep(0.2)
        assert key(screen) == "b"
        screen.controls._button("ENCODER_COUNTERCLOCKWISE")
        screen.controls._button("ENCODER_COUNTERCLOCKWISE")
        time.sleep(0.2)
        assert key(screen) == "cancel"
        screen.controls.push()
        screen.wait_for_route("pressetSettings")
    finally:
        backend.post("/api/v1/settings/", {"reverse_scrolling": reverse})


def test_a_long_press_takes_back_the_character_and_reports(screen):
    """CircleKeyboard onLongPress (longPressEnabled): the press that starts a long press typed a character;
    it is removed before longPressed fires. Without the flag the character stays (longPressed still fires,
    for a screen that has no handler it is nothing)."""
    # On the "dose" route (no component: nothing else hears the knob), a keyboard made for the test.
    js = (
        "(function () { const host = router.current;"
        " const k = Qt.createQmlObject('import QtQuick; import Dial; CircleKeyboard { property int longs: 0;"
        " property string seen: \"\"; objectName: \"e2eKeyboard\"; longPressEnabled: %s; capitalizeFirstLetter: false;"
        " onLongPressed: { longs++; seen = text } }', host); return 1 })()"
    )
    go_home(screen)
    screen.c.call({"cmd": "screen", "name": "dose"})
    screen.wait_for_route("dose")
    probe = ("(function () { const kids = router.current.children; let k = null;"
             " for (let i = 0; i < kids.length; i++) if (kids[i].objectName === 'e2eKeyboard') k = kids[i];"
             " return k ? k.%s : null })()")
    try:
        for enabled in ("true", "false"):
            screen.c.call({"cmd": "eval", "js": js % enabled})
            screen.controls.long_push()
            text = screen.c.call({"cmd": "eval", "js": probe % "text"})["value"]
            longs = screen.c.call({"cmd": "eval", "js": probe % "longs"})["value"]
            if enabled == "true":
                assert (text, longs) == ("", "1")
            else:
                assert (text, longs) == ("a", "1")
            screen.c.call({"cmd": "eval", "js": probe % "destroy()"})
    finally:
        screen.c.call({"cmd": "eval", "js": probe % "destroy()"})


def test_an_image_picked_is_saved_with_the_profile(screen, backend, cleanup):
    """PressetProfileImage: left shows the next default image; a push stores it in the profile."""
    _, images = backend.get("/api/v1/profile/image")
    before = set(profiles_by_id(backend))
    open_new_profile(screen)
    screen.focus("Select Image")
    screen.controls.push()
    screen.wait_for_route("pressetProfileImage")
    screen.wait_for_text(f"1 / {len(images)}")
    screen.controls.left(2)
    assert screen.probe("activeIndex") == 2
    screen.wait_for_text(f"3 / {len(images)}")
    screen.controls.right(1)
    assert screen.probe("activeImage") == images[1]
    screen.controls.push()
    screen.wait_for_route("pressetSettings")
    screen.select("Save")
    screen.wait_for_home()
    deadline = time.monotonic() + 5
    created = []
    while not created and time.monotonic() < deadline:
        created = [p for id_, p in profiles_by_id(backend).items() if id_ not in before]
        time.sleep(0.1)
    assert len(created) == 1
    assert created[0]["display"]["image"].endswith(images[1])


def wait_until(predicate, timeout_s, what):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.1)
    raise AssertionError(f"timed out waiting for {what}")


def test_the_image_picker_shows_the_images_when_the_list_was_missing(screen, backend, cleanup):
    """Protects: choosing a profile's image after the Dial started before the backend (the nightly restart):
    the picker showed nothing, a black screen, because the image list it had asked for at start had failed.
    The picker, opened, asks for the list again; the image chosen is saved and the home shows it.
    Limit: useProfileDefaultImages (a stale query refetched on mount and on reconnect); the image list of
    GET /api/v1/profile/image; the card's ProfileImage.
    """
    _, images = backend.get("/api/v1/profile/image")
    profile = a_profile(backend)
    current = (profile.get("display") or {}).get("image") or ""
    target = next(i for i, image in enumerate(images) if i > 0 and not current.endswith(image))
    # As after a failed start: the Dial has no image list.
    screen.c.call({"cmd": "eval", "js": "Profiles.defaultImages = []"})

    open_profile(screen, profile)
    screen.focus("Select Image")
    screen.controls.push()
    screen.wait_for_route("pressetProfileImage")
    screen.wait_for_text(f"1 / {len(images)}", timeout_s=10)
    wait_until(lambda: screen.probe("activeImageShown"), 10, "the first image on screen")
    screen.controls.left(target)
    wait_until(lambda: screen.probe("activeImage") == images[target] and screen.probe("activeImageShown"), 10,
               f"image {target + 1} on screen")
    screen.controls.push()
    screen.wait_for_route("pressetSettings")
    screen.select("Save")
    screen.wait_for_home()

    wait_until(lambda: (profiles_by_id(backend)[profile["id"]].get("display") or {}).get("image", "").endswith(images[target]),
               5, "the backend to keep the image")
    screen.go_to_card(profile["name"])
    wait_until(lambda: (screen.probe("activeCardImage") or {}).get("source", "").endswith(images[target])
               and screen.probe("activeCardImage").get("loaded"), 10, "the card to show the image")


def test_brew_without_saving_starts_the_profile_as_edited(screen, backend):
    """PressetSettings "brew without saving": loads the edited profile and starts it (heating, or the purge
    when the piston is up), without saving it."""
    count = len(profiles_by_id(backend))
    open_new_profile(screen)
    _, shown = change_temperature(screen, 2)
    screen.select("Brew Without Saving")
    try:
        route = screen.wait_for_any_route(["heating", "manual-purge", "barometer"], timeout_s=15)
        assert route in ("heating", "manual-purge", "barometer")
        assert len(profiles_by_id(backend)) == count, "brew without saving saved the profile"
        status, last = backend.get("/api/v1/profile/last")
        assert status == 200 and last["profile"]["temperature"] == pytest.approx(shown), last
    finally:
        backend.get("/api/v1/action/stop")
        screen.c.call({"cmd": "eval", "js": "Profiles.profileStarting = false"})
        screen.c.call({"cmd": "screen", "name": "profileHome"})
        screen.wait_for_route("profileHome")
