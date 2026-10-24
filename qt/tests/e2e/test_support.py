"""Support: reporting an issue, the contact email, the mobile app's dispatched reports, notifications,
shot data sharing (boot prompt and Help us improve) and the unlock screens.

Ported from meticulous-integration tests/test_dial_support.py and the first-boot prompt of
tests/test_dial_01_first_boot.py; tests/reportHandoff.test.mts runs against ReportLib.js through
qt/scripts/js-tests.sh.

The ticket service and Sentry are third parties: every test that reports answers them on this machine
(ReportServices below), through the Dial's "support.reportServices" storage key (honoured only with the
test port open). A test checks the Dial points there before it reports, so no real ticket is minted.

Some tests change settings that matter beyond this Dial (shot data sharing uploads every brew to the fleet's
Supabase when on): those run only against a backend of your own (DIAL_PRIVATE_BACKEND=1). The boot prompt
needs a backend whose `shot_data_sharing` was never answered (a fresh STATE).

Typing a whole address with the knob on CircleKeyboard (the profile group's) takes long: the tests that need
typed text hand the screen what the keyboard reports (its handlers, through the route's item over the test
port's eval); long presses and the other steps go through the knob.
"""

import http.server
import json
import os
import threading
import time
import uuid

import pytest

PRIVATE_BACKEND = os.environ.get("DIAL_PRIVATE_BACKEND") == "1"
private_backend = pytest.mark.skipif(
    not PRIVATE_BACKEND,
    reason="changes settings other Dials on this backend depend on (shot data sharing uploads brews): "
    "run with DIAL_PRIVATE_BACKEND=1 against a backend of your own")

# upload_report goes to every Dial on the backend: each would upload the dispatch and show its outcome.
dispatches = pytest.mark.skipif(
    not PRIVATE_BACKEND,
    reason="a dispatched report reaches every Dial on this backend (each uploads it and shows a notification): "
    "run with DIAL_PRIVATE_BACKEND=1 against a backend of your own")

TICKET = 424242


class ReportServices:
    """The ticket service and Sentry, answered on 127.0.0.1 (a thread)."""

    def __init__(self, ticket=TICKET):
        self.ticket = ticket
        self.requests = []
        outer = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", 0) or 0))
                outer.requests.append((self.path, dict(self.headers), body))
                if self.path.startswith("/ticket"):
                    status, answer = 200, {"ticket": outer.ticket}
                elif "/envelope/" in self.path:
                    status, answer = 200, {"id": "0" * 32}
                else:
                    status, answer = 404, {"message": "not found"}
                data = json.dumps(answer).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *args):
                pass

        self._server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = self._server.server_address[1]
        threading.Thread(target=self._server.serve_forever, daemon=True).start()

    @property
    def ticket_url(self):
        return f"http://127.0.0.1:{self.port}/ticket"

    @property
    def sentry_dsn(self):
        return f"http://0123456789abcdef0123456789abcdef@127.0.0.1:{self.port}/8"

    def ticket_requests(self):
        return [json.loads(body) for path, _, body in self.requests if path.startswith("/ticket")]

    def envelopes(self):
        """Sentry's envelopes: [(header, [(item header, payload bytes)])]."""
        out = []
        for path, _, body in self.requests:
            if "/envelope/" not in path:
                continue
            first, _, rest = body.partition(b"\n")
            items = []
            while rest:
                line, _, rest = rest.partition(b"\n")
                if not line.strip():
                    continue
                item = json.loads(line)
                length = item.get("length")
                if length is None:
                    payload, _, rest = rest.partition(b"\n")
                else:
                    payload, rest = rest[:length], rest[length + 1:]
                items.append((item, payload))
            out.append((json.loads(first), items))
        return out

    def feedbacks(self):
        return [(header, items) for header, items in self.envelopes() if items and items[0][0]["type"] == "feedback"]

    def close(self):
        self._server.shutdown()


# ---- helpers

def js(screen, code):
    answer = screen.c.call({"cmd": "eval", "js": code})
    assert "error" not in answer, answer
    return answer["value"]


def point_dial_at(screen, services, sentry):
    value = json.dumps({"ticketServiceUrl": services.ticket_url, "sentryDsn": services.sentry_dsn if sentry else ""})
    js(screen, f"Native.storageSet('support.reportServices', {json.dumps(value)}), 1")


def settings(backend):
    status, body = backend.get("/api/v1/settings/")
    assert status == 200, body
    return body


def set_setting(backend, **values):
    status, body = backend.post("/api/v1/settings/", values)
    assert status == 200, body
    return body


def reports(backend):
    status, body = backend.get("/api/v1/reports/list?page=0&size=200")
    assert status == 200, body
    return {r["localID"]: r for r in body["content"]}


def wait_for(predicate, timeout_s=30, what="condition"):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        value = predicate()
        if value:
            return value
        time.sleep(0.1)
    raise AssertionError(f"timed out waiting for {what}")


def wait_for_settings_on_dial(screen, key, value, timeout_s=10):
    """The Dial polls the settings every 2 s; wait until it has `key` = value."""
    wait_for(lambda: js(screen, f"JSON.stringify(BackendSettings.data ? BackendSettings.data.{key} : undefined)") == json.dumps(value),
             timeout_s, f"the Dial to see {key}={value}")


def open_bug_report(screen):
    screen.wait_for_home()
    screen.controls.context()
    screen.wait_for_bubble("quick-settings")
    screen.select("Report an issue")
    screen.wait_for_bubble("bug-report")
    screen.wait_for_text("We strongly recommend reporting from the mobile app")


def report_screen(screen):
    return screen.probe("reportScreen")


def wait_for_report(screen, name, timeout_s=60):
    wait_for(lambda: report_screen(screen) == name, timeout_s, f"the bug report to show {name}")


def assert_reports_go_to(screen, services):
    where = json.loads(screen.probe("reportServices"))
    assert where["ticket"] == services.ticket_url, f"the Dial would reach the real ticket service: {where}"


# ---- fixtures

@pytest.fixture
def services(screen):
    s = ReportServices()
    point_dial_at(screen, s, sentry=False)
    yield s
    js(screen, "Native.storageRemove('support.reportServices'), 1")
    s.close()


@pytest.fixture
def contact_mail(backend, screen):
    """Restores report_contact_mail after the test."""
    before = settings(backend).get("report_contact_mail")
    yield
    set_setting(backend, report_contact_mail=before)


@pytest.fixture
def dispatched_reports_started(screen):
    """DispatchedReports has to run from the start; until the core starts it (main.qml), the bug report
    screen does when it first opens: open it once."""
    js(screen, "Nav.openBubble('bug-report'), 1")
    screen.wait_for_bubble("bug-report")
    time.sleep(0.6)
    screen.controls.context()
    screen.wait_for_bubble_closed()


# ---- the boot prompt (test_dial_01_first_boot.py)

def test_a_fresh_machine_asks_once_whether_to_share_shot_data(screen, backend):
    """Protects: the first boot reaching the home through the sharing prompt.

    Limit: resolvePostReadyScreen shows the prompt while the backend's `shot_data_sharing` is null; the
    answer is stored as a boolean. The boot is replayed by showing the ready screen again.
    Breaks when: the prompt stops storing the answer, or it shows again after being answered.
    """
    if settings(backend).get("shot_data_sharing", False) is not None:
        pytest.skip("needs a backend whose shot_data_sharing was never answered (start one with a fresh STATE)")
    screen.c.call({"cmd": "screen", "name": "ready"})
    screen.wait_for_route("shotDataSharingPrompt", timeout_s=60)
    assert screen.focused() == "Help improve"
    assert screen.has_text("You can change this any time from the menu under Help us improve.")

    screen.controls.right()
    screen.wait_for_focus("No thanks")
    screen.controls.push()
    screen.wait_for_route("profileHome")
    assert settings(backend)["shot_data_sharing"] is False
    routes = [name for _, name in screen.state()["history"]]
    assert routes[-3:] == ["ready", "shotDataSharingPrompt", "profileHome"], routes

    # The next boot goes straight to the home.
    wait_for_settings_on_dial(screen, "shot_data_sharing", False)
    screen.c.call({"cmd": "screen", "name": "ready"})
    screen.wait_for_route("profileHome", timeout_s=60)
    routes = [name for _, name in screen.state()["history"]]
    assert routes[-2:] == ["ready", "profileHome"], routes


@private_backend
def test_help_improve_on_the_prompt_thanks_then_goes_home(screen, backend):
    """Protects: opting in from the boot prompt: stored true, "Thanks!" for 4 s, then the home."""
    before = settings(backend).get("shot_data_sharing")
    try:
        screen.c.call({"cmd": "screen", "name": "shotDataSharingPrompt"})
        screen.wait_for_route("shotDataSharingPrompt")
        assert screen.focused() == "Help improve"
        screen.controls.push()
        screen.wait_for_text("Thanks!")
        assert screen.has_text("Your brews will now help make every Meticulous better.")
        assert settings(backend)["shot_data_sharing"] is True
        started = time.monotonic()
        screen.wait_for_route("profileHome", timeout_s=10)
        assert time.monotonic() - started > 2.5
    finally:
        if before is not None:
            set_setting(backend, shot_data_sharing=before)
        else:
            set_setting(backend, shot_data_sharing=False)


def test_help_us_improve_from_the_menu_offers_the_choice_and_returns_to_it(screen, backend):
    """Protects: Menu > Help us improve: not sharing offers "Help improve" / "No thanks"; No thanks
    goes back to the screen under the menu with the menu open again (HelpUsImprove.tsx)."""
    if settings(backend).get("shot_data_sharing") is True:
        pytest.skip("the backend shares shot data; this checks the opt-in side")
    screen.wait_for_home()
    screen.controls.context()
    screen.wait_for_bubble("quick-settings")
    screen.select("Help us improve")
    screen.wait_for_route("helpUsImprove")
    screen.wait_for_text("Share sensor data from your brews anonymously")
    assert screen.focused() == "Help improve"
    screen.controls.right()
    screen.wait_for_focus("No thanks")
    screen.controls.push()
    screen.wait_for_route("profileHome")
    screen.wait_for_bubble("quick-settings")
    screen.controls.context()
    screen.wait_for_bubble_closed()


@private_backend
def test_help_us_improve_stops_sharing(screen, backend):
    """Protects: Menu > Help us improve while sharing: "Stop sharing" stores false and says so for 4 s."""
    before = settings(backend).get("shot_data_sharing")
    set_setting(backend, shot_data_sharing=True)
    try:
        wait_for_settings_on_dial(screen, "shot_data_sharing", True)
        screen.c.call({"cmd": "screen", "name": "helpUsImprove"})
        screen.wait_for_route("helpUsImprove")
        screen.wait_for_text("is being shared with Meticulous")
        assert screen.focused() == "Stop sharing"
        screen.controls.push()
        screen.wait_for_text("Sharing stopped")
        assert settings(backend)["shot_data_sharing"] is False
        screen.wait_for_bubble("quick-settings", timeout_s=8)
        screen.controls.context()
        screen.wait_for_bubble_closed()
    finally:
        set_setting(backend, shot_data_sharing=before if before is not None else False)


# ---- reporting an issue (test_dial_support.py)

def test_a_report_without_an_email_creates_the_report_and_sends_only_its_id(screen, backend, services, contact_mail):
    """Protects: filing a bug report at the machine, and what leaves it.

    Limit: Report creates the report on the backend (/reports/create) and sends it once, the email can be
    skipped (long press, then Ok), the ticket service receives only the report's event id (the serial
    and the report's local id), and the ticket is written to the backend's draft. Without Sentry (as the
    browser build of the React Dial) the Dial says the report did not go out and lets the user leave.
    Breaks when: the report is not created or is sent twice, skipping the email blocks the report,
    anything personal goes to the ticket service, the ticket is not stored, or a failed submission
    leaves the user with no way out.
    """
    set_setting(backend, report_contact_mail=None)
    before = reports(backend)
    open_bug_report(screen)
    wait_for_settings_on_dial(screen, "report_contact_mail", None)
    assert_reports_go_to(screen, services)
    screen.select("Report an issue")
    wait_for_report(screen, "reportSetup")
    screen.select("Report")

    screen.wait_for_route("reportContactEmail")
    screen.wait_for_text("email to reach you back")
    time.sleep(1)  # the keyboard settles before it takes gestures, as a person reads it
    screen.controls.long_push()  # skip the email
    screen.wait_for_text("No contact email")
    screen.controls.push()  # Ok, send without one

    screen.wait_for_text("Something went wrong", timeout_s=120)
    screen.wait_for_text("We could not send your report")
    screen.wait_for_text("Error code BR-05")
    created = {k: v for k, v in reports(backend).items() if k not in before}
    assert len(created) == 1, created
    (local_id, report), = created.items()
    assert report["ticket"] == TICKET
    serial = report["machineID"]
    assert services.ticket_requests() == [{"eventID": f"{serial}-{local_id}"}]
    assert services.feedbacks() == []

    screen.wait_for_focus("Exit")
    screen.controls.push()
    screen.wait_for_bubble("quick-settings")
    screen.controls.context()
    screen.wait_for_bubble_closed()
    screen.wait_for_home()


def test_a_report_with_a_saved_email_reaches_sentry_with_the_archive(screen, backend, services, contact_mail):
    """Protects: a report delivered: ticket, the draft linked to it, the archive and the contact email in
    one Sentry feedback, the report marked submitted with Sentry's event id, the ticket on screen.

    Limit: sendSentryFeedback (reportSubmission.ts): a feedback item with contact_email and the machine as
    name, the archive as the attachment bug-report-information.tar.zst (application/zstd).
    """
    email = f"e2e-{uuid.uuid4().hex[:6]}@example.com"
    set_setting(backend, report_contact_mail=email)
    point_dial_at(screen, services, sentry=True)
    before = reports(backend)
    open_bug_report(screen)
    wait_for_settings_on_dial(screen, "report_contact_mail", email)
    assert_reports_go_to(screen, services)
    assert screen.focused() == "Your contact info"
    screen.select("Report an issue")
    wait_for_report(screen, "reportSetup")
    screen.wait_for_text(f"We will reach you back at {email}")
    screen.select("Report")
    wait_for_report(screen, "submitted", timeout_s=120)
    screen.wait_for_text("Thanks for Your feedback")
    screen.wait_for_text(str(TICKET))

    created = {k: v for k, v in reports(backend).items() if k not in before}
    assert len(created) == 1, created
    (local_id, report), = created.items()
    assert report["status"] == "submitted"
    assert report["ticket"] == TICKET
    feedbacks = services.feedbacks()
    assert len(feedbacks) == 1
    header, items = feedbacks[0]
    event = json.loads(items[0][1])
    assert report["eventID"] == header["event_id"] == event["event_id"]
    assert event["contexts"]["feedback"]["contact_email"] == email
    assert event["contexts"]["feedback"]["name"] == report["machineID"]
    assert event["contexts"]["feedback"]["message"] == "Bug report submitted through quick report"
    assert event["tags"]["meticulous.report_origin"] == "dial"
    assert event["tags"]["localID"] == local_id
    attachment, data = items[1]
    assert attachment["type"] == "attachment"
    assert attachment["filename"] == "bug-report-information.tar.zst"
    assert attachment["content_type"] == "application/zstd"
    assert len(data) == attachment["length"] > 0
    assert event["tags"]["meticulous.report_attachment_bytes"] == str(len(data))
    assert data[:4] == b"\x28\xb5\x2f\xfd"  # zstd

    screen.wait_for_focus("Exit")
    screen.controls.push()
    screen.wait_for_bubble("quick-settings")
    screen.controls.context()
    screen.wait_for_bubble_closed()


def test_the_email_typed_on_the_contact_screen_goes_with_the_report_and_is_saved(screen, backend, services, contact_mail):
    """Protects: the contact email screen: local part, a listed domain, confirm; the report goes out with
    that address (once, by the bubble that comes back) and it is saved for next time."""
    set_setting(backend, report_contact_mail=None)
    point_dial_at(screen, services, sentry=True)
    before = reports(backend)
    open_bug_report(screen)
    wait_for_settings_on_dial(screen, "report_contact_mail", None)
    assert_reports_go_to(screen, services)
    screen.select("Report an issue")
    wait_for_report(screen, "reportSetup")
    screen.select("Report")
    screen.wait_for_route("reportContactEmail")
    local = f"e2e{uuid.uuid4().hex[:5]}"
    js(screen, f"router.current.item.localPartTyped('{local}@'), 1")  # what the keyboard reports as typed
    screen.wait_for_text("Your email domain")
    screen.wait_for_text(f"{local}@")
    screen.focus("outlook.com")
    screen.controls.push()
    screen.wait_for_text("Confirm your email")
    assert screen.focused() == "ok"
    screen.controls.push()
    screen.wait_for_bubble("bug-report")
    wait_for_report(screen, "submitted", timeout_s=120)

    email = f"{local}@outlook.com"
    assert settings(backend)["report_contact_mail"] == email
    created = {k: v for k, v in reports(backend).items() if k not in before}
    assert len(created) == 1, created
    assert len(services.ticket_requests()) == 1
    feedbacks = services.feedbacks()
    assert len(feedbacks) == 1
    assert json.loads(feedbacks[0][1][0][1])["contexts"]["feedback"]["contact_email"] == email
    screen.controls.push()  # Exit
    screen.wait_for_bubble("quick-settings")
    screen.controls.context()
    screen.wait_for_bubble_closed()


def test_cancel_while_collecting_drops_the_report(screen, backend, services, contact_mail):
    """Protects: Cancel during the collection: the request is aborted, nothing is submitted, the bubble
    is back on its first screen (cancelCreateReport)."""
    set_setting(backend, report_contact_mail="cancel@example.com")
    open_bug_report(screen)
    wait_for_settings_on_dial(screen, "report_contact_mail", "cancel@example.com")
    assert_reports_go_to(screen, services)
    screen.select("Report an issue")
    wait_for_report(screen, "reportSetup")
    screen.c.call({"cmd": "button", "type": "ENCODER_PRESSED", "t": 300})  # Report
    screen.c.call({"cmd": "button", "type": "ENCODER_RELEASED", "t": 300})
    time.sleep(0.15)
    if screen.probe("reportStatus") not in ("fetching", "slowFetch"):
        pytest.xfail("the emulated backend collected before Cancel could be pressed")
    assert screen.focused() == "Cancel"
    screen.controls.push()
    wait_for_report(screen, "message", timeout_s=10)
    assert screen.probe("reportStatus") == "idle"
    time.sleep(3)
    assert services.ticket_requests() == []
    screen.controls.context()
    screen.wait_for_bubble_closed()


def test_the_issue_date_picker_changes_fields_confirms_and_goes_back(screen, contact_mail, backend):
    """Protects: Select date: the knob changes the field (never past now, minutes in half hours), a press
    moves to the next field, a long press confirms, a double press goes back (BugReport.tsx)."""
    open_bug_report(screen)
    screen.select("Report an issue")
    wait_for_report(screen, "reportSetup")
    screen.select("Select date")
    wait_for_report(screen, "selectIssueDate")
    screen.wait_for_text("Guide us to when the issue occurred")
    assert screen.focused() == "day"
    start = screen.probe("issueDate")
    assert start.endswith(":00") or start.endswith(":30"), start
    screen.controls.right()  # tomorrow is in the future: stays now
    assert screen.probe("issueDate") == start
    screen.controls.left(2)
    two_days = screen.probe("issueDate")
    assert two_days != start
    screen.controls.push()
    assert screen.focused() == "month"
    for field in ("year", "hours", "minutes", "day"):
        screen.controls.push()
        assert screen.focused() == field
    screen.controls.long_push()  # confirm
    wait_for_report(screen, "reportSetup")
    day, month, year = two_days.split(" ")[0].split(".")
    for part in (day, month, year):
        screen.wait_for_text(part)

    screen.select("Select date")
    wait_for_report(screen, "selectIssueDate")
    assert screen.probe("issueDate") == two_days  # opens on the picked date
    screen.controls.left()
    screen.controls.double_push()  # back without keeping it
    wait_for_report(screen, "reportSetup")
    screen.select("Back")
    wait_for_report(screen, "message")
    screen.controls.context()
    screen.wait_for_bubble_closed()


def test_contact_us_shows_the_support_page_as_a_qr_code(screen):
    open_bug_report(screen)
    screen.select("Contact us")
    wait_for_report(screen, "contactUs")
    screen.wait_for_text("Scan to open Meticulous contact information")
    assert screen.focused() == "Back"
    screen.controls.push()
    wait_for_report(screen, "message")
    screen.focus("Back")
    screen.controls.push()  # Back on the first screen: the quick settings
    screen.wait_for_bubble("quick-settings")
    screen.controls.context()
    screen.wait_for_bubble_closed()


def test_your_contact_info_changes_and_forgets_the_address(screen, backend, contact_mail):
    """Protects: "Your contact info": pressing the address opens the contact email screen on the confirm
    step and comes back to the same screen; holding "Remove contact info" forgets it."""
    email = "keep@example.com"
    set_setting(backend, report_contact_mail=email)
    open_bug_report(screen)
    wait_for_settings_on_dial(screen, "report_contact_mail", email)
    screen.select("Your contact info")
    wait_for_report(screen, "yourContactInfo")
    screen.wait_for_text("We reach you back about your reports at the address below.")
    assert screen.focused() == email
    screen.controls.push()
    screen.wait_for_route("reportContactEmail")
    screen.wait_for_text("Your contact email")
    assert screen.probe("contactDraft") == email
    screen.controls.right(2)  # ok -> local -> domain
    assert screen.focused() == "domain"
    screen.controls.push()
    screen.wait_for_text("Your email domain")
    screen.focus("gmail.com")
    screen.controls.push()
    screen.wait_for_text("Your contact email")
    screen.focus("ok")
    screen.controls.push()
    screen.wait_for_bubble("bug-report")
    wait_for_report(screen, "yourContactInfo")
    assert settings(backend)["report_contact_mail"] == "keep@gmail.com"
    wait_for_settings_on_dial(screen, "report_contact_mail", "keep@gmail.com")

    screen.focus("Remove contact info")
    screen.controls.hold(1.6)
    wait_for_report(screen, "message")
    assert settings(backend)["report_contact_mail"] is None
    wait_for(lambda: not screen.has_text("Your contact info"), 6, "the contact info entry to go")
    screen.controls.context()
    screen.wait_for_bubble_closed()


# ---- reports dispatched from the mobile app

def dispatch(backend, ticket, **extra):
    status, minted = backend.request("POST", "/api/v1/reports/request")
    assert status == 200, minted
    status, body = backend.request("POST", "/api/v1/reports/dispatch", {"localID": minted["localID"], "ticket": ticket, **extra})
    assert status == 202, body
    return minted["localID"]


@dispatches
def test_a_report_dispatched_from_the_app_is_uploaded_and_announced(screen, backend, services, dispatched_reports_started):
    """Protects: the mobile app's reports: the backend's upload_report reaches the Dial, which collects,
    links the ticket, delivers to Sentry with the app user's contact and announces it as a notification
    (dispatchedReports.ts, SocketProviderValue.tsx)."""
    point_dial_at(screen, services, sentry=True)
    ticket = 700000 + int(time.time()) % 100000
    local_id = dispatch(backend, ticket, email="app@example.com", name="App User", description="from the app")
    screen.wait_for_route("notifications", timeout_s=120)
    message = f"The report with ticket number {ticket} from the mobile app was sent together with the machine's diagnostics."
    screen.wait_for_text(message)
    assert screen.focused() == "Ok"
    report = reports(backend)[local_id]
    assert report["status"] == "submitted"
    event = json.loads(services.feedbacks()[-1][1][0][1])
    assert event["contexts"]["feedback"]["contact_email"] == "app@example.com"
    assert event["contexts"]["feedback"]["name"] == "App User"
    assert event["contexts"]["feedback"]["message"] == "from the app"
    assert event["tags"]["meticulous.report_origin"] == "mobile"
    screen.controls.push()
    screen.wait_for_home()


@dispatches
def test_a_dispatched_report_that_cannot_reach_sentry_says_so(screen, backend, services, dispatched_reports_started):
    """Protects: a failed upload of an app report is announced with its message and code (BR-05)."""
    ticket = 600000 + int(time.time()) % 100000
    dispatch(backend, ticket)
    screen.wait_for_route("notifications", timeout_s=120)
    screen.wait_for_text(f"The report with ticket number {ticket} from the mobile app could not be sent. "
                         "We could not send your report. Error code BR-05.")
    screen.controls.push()
    screen.wait_for_home()


# ---- notifications

def notify(screen, **notification):
    """A backend notification as the socket delivers it (SocketProviderValue's "notification")."""
    js(screen, f"Backend.onNotification({json.dumps(json.dumps(notification))}), 1")


def test_a_notification_takes_the_screen_and_a_response_dismisses_it(screen):
    """Protects: notifications: the newest one fills the screen with its responses; the knob picks one, a
    press acknowledges it and the Dial goes back (Notification.tsx, useNotificationHandler)."""
    screen.wait_for_home()
    nid = f"e2e-{uuid.uuid4().hex[:6]}"
    notify(screen, id=nid, message="The water tank is empty.\nRefill it to continue.", responses=["Yes", "No", "Update"])
    screen.wait_for_route("notifications")
    screen.wait_for_text("The water tank is empty.")
    assert screen.focused() == "Yes"
    screen.controls.right()
    assert screen.focused() == "No"
    screen.controls.right()
    assert screen.focused() == "Update"
    screen.controls.right()  # the last one: stays
    assert screen.focused() == "Update"
    screen.controls.left(2)
    assert screen.focused() == "Yes"
    screen.controls.push()  # unknown to the backend (404): dismissed all the same
    screen.wait_for_route("profileHome")
    assert js(screen, "Notifications.count") == "0"


def test_a_long_notification_scrolls_before_its_options(screen):
    """Protects: a message taller than its box scrolls 50 px a detent and the options are only picked
    once its end is shown; turning back up deselects."""
    screen.wait_for_home()
    long_text = "\n".join(f"Line {n} of a long notification that wraps." for n in range(14))
    notify(screen, id=f"e2e-{uuid.uuid4().hex[:6]}", message=long_text, responses=["Ok", "Later"])
    screen.wait_for_route("notifications")
    assert screen.probe("notificationScrollable") is True
    assert screen.probe("notificationCanSelect") is False
    for _ in range(40):
        if screen.probe("notificationCanSelect"):
            break
        screen.controls.right()
    assert screen.probe("notificationCanSelect") is True
    assert screen.focused() == "Ok"
    screen.controls.right()
    assert screen.focused() == "Later"
    screen.controls.left()
    screen.controls.left()  # scrolls up: no longer at the end
    assert screen.probe("notificationCanSelect") is False
    assert screen.focused() == "Ok"
    screen.controls.push()
    screen.wait_for_route("profileHome")


def test_a_single_response_notification_shows_one_button(screen):
    screen.wait_for_home()
    notify(screen, id=f"e2e-{uuid.uuid4().hex[:6]}", message="Descaling finished.", responses=["Ok"])
    screen.wait_for_route("notifications")
    screen.wait_for_text("Descaling finished.")
    assert screen.focused() == "Ok"
    screen.controls.push()
    screen.wait_for_route("profileHome")


# ---- unlock screens

def test_the_unlock_screen_tries_complete_codes_and_remembers_a_rejected_one(screen, backend):
    """Protects: UnlockScreen.tsx: a code that looks complete is tried as typed, a 403 is not tried again
    until it changes, ok tries anyway, the master code unlocks and goes home (api.ts unlockMachine)."""
    screen.c.call({"cmd": "screen", "name": "unlock"})
    screen.wait_for_route("unlock")
    _, info = backend.get("/api/v1/machine")
    screen.wait_for_text(f"Unlock Code for S/N: {info['serial']}")
    # A wrong code (not the serial's): typed, then typed again, then submitted.
    serial = int(str(info["serial"]).strip() or 0)
    wrong = "00000" if str((serial ^ 0xC0FFEE) % 99999) != "0" else "11111"
    js(screen, f"router.current.item.tryUnlock('{wrong}', false), 1")
    wait_for(lambda: screen.probe("unlockResult"), 10, "an answer")
    assert screen.probe("unlockResult") == {"ok": False, "status": 403}
    js(screen, "router.current.item.lastResult = null, 1")
    js(screen, f"router.current.item.tryUnlock('{wrong}', false), 1")
    time.sleep(1)
    assert screen.probe("unlockResult") is None  # not tried again as typed
    js(screen, f"router.current.item.tryUnlock('{wrong}', true), 1")
    wait_for(lambda: screen.probe("unlockResult"), 10, "an answer")
    assert screen.probe("unlockResult") == {"ok": False, "status": 403}
    js(screen, "router.current.item.tryUnlock('MET', false), 1")
    screen.wait_for_route("profileHome", timeout_s=10)


def test_the_master_calibration_lock_ignores_wrong_codes_and_cancels_to_the_manufacturing_menu(screen):
    screen.c.call({"cmd": "screen", "name": "masterCalibrationLock"})
    screen.wait_for_route("masterCalibrationLock")
    screen.wait_for_text("Unlock Master Calibration")
    # What the keyboard reports (typing digits with the knob takes long).
    keyboard = "router.current.item.children[0]"
    js(screen, f"{keyboard}.edited('1234'), {keyboard}.submitted('1234'), 1")
    time.sleep(1)
    assert screen.route() == "masterCalibrationLock"
    js(screen, f"{keyboard}.cancelled(), 1")
    screen.wait_for_route("profileHome")
    screen.wait_for_bubble("manufacturingSettings")
    screen.controls.context()
    screen.wait_for_bubble_closed()
