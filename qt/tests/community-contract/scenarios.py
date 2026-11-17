"""The scenarios of the Community contract test (contract.py runs each against both uploaders).

A scenario is: the state.json (and queue bodies) the uploader starts from, the scripted answers of the
fake Community server and of the fake machine backend (per endpoint, in order; the last one repeats),
and the steps the orchestrator takes (the Dial's commands, waits). The expected streams in the comments
come from reading community_upload.rs (reference/); the test itself only compares the two uploaders with
each other (plus the timing windows in `gaps`, which both must meet).

Every identity is the one of the cross-language vector (qt/tests/test-vectors/machine-upload-v1.json), so
both uploaders sign with the same key and send the same installation id and idempotency keys.
"""
import json

INSTALLATION_ID = "11111111-1111-4111-8111-111111111111"
KEY_ID = "22222222-2222-4222-8222-222222222222"
KEY_VERSION = 3
PRIVATE_SEED = "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A"
PUBLIC_KEY = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"
AUTHORIZATION_ID = "44444444-4444-4444-8444-444444444444"

EXCHANGE = "/api/machine-uploads/v1/enrollments/exchange"
TOKEN = "/api/machine-uploads/v1/token"
SHOTS = "/api/machine-uploads/v1/shots"
REVOKE = "/api/machine-uploads/v1/installations/current"
LAST = "/api/v1/history/last"
POUR_OVER_LAST = "/api/v1/history/pour-over/last"
UPLOAD_INDEX = "/api/v1/history/upload-index"
POUR_OVER_INDEX = "/api/v1/history/pour-over"
FILES = "/api/v1/history/files/"
POUR_OVER_FILES = "/api/v1/history/pour-over/files/"

ELSEWHERE = "http://127.0.0.1:18202"   # the second fake Community host (contract.py starts it)

ESPRESSO_CURSOR = "2026-10-20/08:00:00.shot.json"
POUR_OVER_CURSOR = "2026-10-20/07:30:00.pour-over.json"
# Every character class of the url crate's path-segment and form encoders (and QUrl's normalization).
ODD_NAME = "odd name [x]|^~é#?%{}`\"<>'!$&()*+,;=@.shot.json"
ODD_PATH = "2026-10-21/" + ODD_NAME
ODD_POUR_OVER_PATH = "2026-10-19/po~cursor %+&=ü.pour-over.json"


class Reply:
    """One scripted answer. server_time: x-meticulous-server-time = now + this many seconds (an int) or
    this raw text (a str). align: send it just after a second boundary, so the uploader's whole-second
    backoff (unix_seconds() + n) starts at a known point and its retry time can be checked. drop: read
    the request and close the connection without an answer."""

    def __init__(self, status=200, json=None, body=None, headers=(), server_time=None, align=False,
                 chunked=False, drop=False, content_type=None):
        self.status = status
        self.json = json
        self.body = body
        self.headers = list(headers)
        self.server_time = server_time
        self.align = align
        self.chunked = chunked
        self.drop = drop
        self.content_type = content_type

    def body_bytes(self):
        if self.body is not None:
            return self.body
        if self.json is not None:
            return json.dumps(self.json, separators=(",", ":")).encode()
        return b""

    def describe(self):
        if self.drop:
            return "connection closed, no answer"
        text = str(self.status)
        if self.json is not None:
            text += " " + json.dumps(self.json, separators=(",", ":"))[:80]
        elif self.body:
            text += " %d bytes" % len(self.body)
        for name, value in self.headers:
            text += " [%s: %s]" % (name, value)
        if self.server_time is not None:
            text += " [server-time %s]" % (("now%+d" % self.server_time) if isinstance(self.server_time, int)
                                          else self.server_time)
        if self.chunked:
            text += " [chunked]"
        return text


def drop(align=True):
    return Reply(drop=True, align=align)


class Cmd:
    """A Dial command (the Tauri command / the QML call): status, enroll, pause, disconnect, reset, scan."""

    def __init__(self, command, argument=None):
        self.command = command
        self.argument = argument

    def line(self):
        return self.command if self.argument is None else "%s %s" % (self.command, self.argument)


class Wait:
    """Until the uploader made `requests` requests in all, then `quiet` seconds without one."""

    def __init__(self, requests, quiet=2.0, timeout=30.0):
        self.requests = requests
        self.quiet = quiet
        self.timeout = timeout


class Quiet:
    def __init__(self, seconds):
        self.seconds = seconds


class Scenario:
    def __init__(self, name, title, covers, steps, state, community=None, machine=None, gaps=None,
                 community_suffix="", elsewhere=None):
        self.name = name
        self.title = title
        self.covers = covers
        self.steps = steps
        self._state = state
        self._community = community or (lambda: {})
        self._machine = machine or (lambda: {})
        # A second Community host (another port, ELSEWHERE) for redirects that leave the first one.
        self._elsewhere = elsewhere or (lambda: {})
        # {request index: n}: the request comes n seconds after the previous answer (an aligned one).
        self.gaps = gaps or {}
        self.community_suffix = community_suffix

    def build_state(self, now):
        return self._state(now)

    def community(self):
        return self._community()

    def machine(self):
        return self._machine()

    def elsewhere(self):
        return self._elsewhere()


# --- records -------------------------------------------------------------------------------------

def espresso(shot_id):
    # Raw bytes as the machine serves them: odd whitespace, escapes, raw UTF-8, -0.0, 1e3, an integer
    # past u64, unknown fields. The upload must carry these bytes untouched.
    return ('{\n  "id": "%s",\n  "time": 1761037200.25,\n  "name": "Caf\\u00e9 é",\n'
            '  "data": [ {"time": 0, "shot": {"pressure": 0.0, "flow": 1.50, "weight": -0.0}} ],\n'
            '  "big": 123456789012345678901234567890,\n'
            '  "profile": {"name": "Contract", "future": {"kept": true, "n": 1e3}}\n}\n' % shot_id).encode()


def pour_over(record_id, schema=4):
    return ('{"schemaVersion":%d,"id":"%s","brewType":"pour_over","mode":"free_pour",'
            '"recipe":{"pourTargets":[{"weight":50}]},"pours":[{"start":0}],'
            '"samples":[{"t":403.0,"w":0,"f":1,"p":1},{"t":403.25,"w":1.2,"f":4.3,"p":1}],'
            '"measurements":{"durationMs":403}}' % (schema, record_id)).encode()


def envelope(raw):
    return b'{"contractVersion":1,"shot":' + raw + b"}"


def queued(index, source_id, path, raw, kind="espresso"):
    item_id = "aaaaaaaa-0000-4000-8000-%012d" % index
    item = {"id": item_id, "sourceShotId": source_id, "historyPath": path, "historyKind": kind,
            "bodyFile": item_id + ".json", "attemptCount": 0, "nextAttemptAt": 0, "lastError": None}
    return item, envelope(raw)


def state(queue=(), **fields):
    value = {
        "installationId": INSTALLATION_ID, "privateSeed": PRIVATE_SEED, "publicKey": PUBLIC_KEY,
        "enrollment": None, "authorizationId": None, "keyId": None, "keyVersion": None, "paused": False,
        "historyBaselined": False, "historyCursor": None, "pourOverHistoryBaselined": False,
        "pourOverHistoryCursor": None, "queue": [], "lastSuccessAt": None, "lastError": None,
        "lastRetryAt": None,
    }
    value.update(fields)
    bodies = {}
    for item, body in queue:
        value["queue"].append(item)
        bodies[item["bodyFile"]] = body
    return value, bodies


def connected(queue=(), **fields):
    base = dict(authorizationId=AUTHORIZATION_ID, keyId=KEY_ID, keyVersion=KEY_VERSION, historyBaselined=True,
                historyCursor=ESPRESSO_CURSOR, pourOverHistoryBaselined=True, pourOverHistoryCursor=POUR_OVER_CURSOR)
    base.update(fields)
    return state(queue, **base)


EXCHANGED = {"accessToken": "tok-exchange", "authorizationId": AUTHORIZATION_ID, "keyId": KEY_ID,
             "keyVersion": KEY_VERSION}
EMPTY = {"history": []}


def empty_history():
    return {"GET " + UPLOAD_INDEX: [Reply(json=EMPTY)], "GET " + POUR_OVER_INDEX: [Reply(json=EMPTY)]}


def token(*tokens):
    return [Reply(json={"accessToken": t}) for t in tokens]


SCENARIOS = [
    Scenario(
        "enroll",
        "Pairing code, exchange (202 + Retry-After, then the claim), history baseline, a requested scan",
        ["begin_enrollment", "try_exchange", "enrollment_headers", "update_server_clock",
         "observe_new_shots/observe_new_pour_overs (baseline)", "fetch_*_history_path(s)", "set_paused (not connected)",
         "request_history_scan"],
        # exchange 202 (Retry-After 1, server time +500) -> exchange 200 (server time +1000) -> next tick:
        # GET last, GET pour-over/last (404 = none); then the requested scan: upload-index after the
        # baseline, pour-over without a cursor. COMMUNITY_API_BASE has a path: the requests drop it.
        [Cmd("status"), Cmd("pause", "true"), Cmd("enroll", json.dumps("  MET-CONTRACT-0001  ")), Wait(4),
         Cmd("status"), Cmd("enroll", "null"), Cmd("scan"), Wait(6), Cmd("status")],
        lambda now: state(),
        community=lambda: {"POST " + EXCHANGE: [
            Reply(202, headers=[("Retry-After", "1")], server_time=500, align=True),
            Reply(200, json=EXCHANGED, server_time=1000)]},
        machine=lambda: {"GET " + LAST: [Reply(json={"file": " /" + ESPRESSO_CURSOR + " ", "name": "ignored"})],
                         "GET " + POUR_OVER_LAST: [Reply(404, json={"detail": "none"})],
                         **empty_history()},
        gaps={1: 1},
        community_suffix="/community/"),

    Scenario(
        "history-upload",
        "History scan: index entries (file/url/name, duplicates, old, odd characters), files, envelope, uploads",
        ["observe_new_shots", "observe_new_pour_overs", "fetch_history_paths", "fetch_pour_over_history_paths",
         "normalize_history_path", "machine_history_file_url", "queue_history_path", "validate_history_record",
         "ensure_access_token", "signed_headers", "idempotency_key", "upload_next_shot", "complete_queue_item"],
        # tick 1: GET upload-index -> 3 files (sorted, deduplicated, after the cursor) -> GET pour-over
        # -> its file; token (server time +1000) + upload of the first, then one upload per tick.
        [Wait(11), Cmd("status")],
        lambda now: connected(),
        community=lambda: {"POST " + TOKEN: [Reply(json={"accessToken": "tok-1", "expiresIn": 300}, server_time=1000)],
                           "POST " + SHOTS: [Reply(201, json={"id": "server-id", "status": "stored"})]},
        machine=lambda: {
            "GET " + UPLOAD_INDEX: [Reply(json={"history": [
                {"name": "ignored", "file": "2026-10-21/09:15:00.shot.json"},
                {"url": "/2026-10-21/09:00:00.shot.json", "name": "x"},
                {"name": " " + ESPRESSO_CURSOR + " "},
                {"file": "2026-10-21/09:00:00.shot.json"},
                {"name": "2026-10-19/07:00:00.shot.json"},
                {"file": ODD_PATH},
                {"name": None, "url": None},
                {"unknown": 1}]})],
            "GET " + FILES + "2026-10-21/09:00:00.shot.json": [Reply(body=espresso("shot-B"))],
            "GET " + FILES + "2026-10-21/09:15:00.shot.json": [Reply(body=espresso("shot-C"))],
            "GET " + FILES + ODD_PATH: [Reply(body=espresso("shot-D"))],
            "GET " + POUR_OVER_INDEX: [Reply(json={"history": [{"file": "2026-10-21/09:30:00.pour-over.json"},
                                                                {"file": POUR_OVER_CURSOR}]})],
            "GET " + POUR_OVER_FILES + "2026-10-21/09:30:00.pour-over.json": [Reply(body=pour_over("po-0002"))]}),

    Scenario(
        "pause-resume",
        "Paused: no requests, a scan asked while paused waits; resume uploads and scans (odd cursors in the query)",
        ["set_paused", "worker_tick (paused)", "request_history_scan", "fetch_history_paths (after=)"],
        # paused: nothing. resume: token + upload, then the due scan (cursors with every form-encoded
        # character). pause, scan, nothing. resume: the asked scan runs.
        [Quiet(2.0), Cmd("status"), Cmd("scan"), Quiet(2.0), Cmd("pause", "false"), Wait(4), Cmd("status"),
         Cmd("pause", "true"), Cmd("scan"), Quiet(2.0), Cmd("status"), Cmd("pause", "false"), Wait(6),
         Cmd("status")],
        lambda now: connected([queued(1, "shot-A", "2026-10-21/08:00:00.shot.json", espresso("shot-A"))],
                              paused=True, historyCursor=ODD_PATH, pourOverHistoryCursor=ODD_POUR_OVER_PATH),
        community=lambda: {"POST " + TOKEN: token("tok-1"), "POST " + SHOTS: [Reply(201)]},
        machine=empty_history),

    Scenario(
        "disconnect",
        "Disconnect while connected: token, signed DELETE, local reset",
        ["disconnect", "revoke_current", "factory_reset_local"],
        [Cmd("disconnect"), Cmd("status"), Quiet(2.0)],
        lambda now: connected([queued(1, "shot-A", "2026-10-21/08:00:00.shot.json", espresso("shot-A"))],
                              paused=True),
        community=lambda: {"POST " + TOKEN: token("tok-d"), "DELETE " + REVOKE: [Reply(204)]}),

    Scenario(
        "disconnect-errors",
        "Disconnect failing at the token (503 + Retry-After), at the DELETE (500), then a retired authorization",
        ["disconnect", "revoke_current", "record_retry", "authorization_is_retired", "response_failure"],
        # token 503 -> error, retry record +7. token 200, DELETE 500 -> error, +5. DELETE (cached token)
        # 401 retired_or_revoked_access -> done, local reset.
        [Cmd("disconnect"), Cmd("status"), Cmd("disconnect"), Cmd("status"), Cmd("disconnect"), Cmd("status"),
         Quiet(1.0)],
        lambda now: connected(paused=True),
        community=lambda: {
            "POST " + TOKEN: [Reply(503, json={"error": "maintenance"}, headers=[("Retry-After", "7")]),
                              Reply(json={"accessToken": "tok-2"})],
            "DELETE " + REVOKE: [Reply(500, body=b"oops", content_type="text/plain"),
                                 Reply(401, json={"error": "retired_or_revoked_access"})]}),

    Scenario(
        "exchange-errors",
        "Exchange 500 (backoff 2 s), 429 + Retry-After 1, 400 (pairing dropped, backoff 8 s), new pairing, claim",
        ["try_exchange", "response_failure", "failure_is_permanent", "record_worker_failure", "record_retry"],
        [Cmd("enroll", "null"), Wait(3), Cmd("status"), Cmd("enroll", json.dumps("MET-CONTRACT-0002")),
         Wait(6, timeout=40), Cmd("status")],
        lambda now: state(),
        community=lambda: {"POST " + EXCHANGE: [
            Reply(500, align=True),
            Reply(429, json={"error": "rate_limited"}, headers=[("Retry-After", "1")], align=True),
            Reply(400, json={"error": "invalid_enrollment"}, align=True),
            Reply(json=EXCHANGED)]},
        machine=lambda: {"GET " + LAST: [Reply(json={"file": ESPRESSO_CURSOR})],
                         "GET " + POUR_OVER_LAST: [Reply(204)]},
        gaps={1: 2, 2: 1, 3: 8}),

    Scenario(
        "upload-retry",
        "Upload 503 + Retry-After, 401 expired_request (new token), 409 replayed_request, Pour Over 422",
        ["upload_next_shot", "defer_queue_item", "schedule_queue_retry", "reclassify_upload_failure",
         "next_due_queue_item", "ensure_access_token (token dropped)", "record_worker_failure"],
        # token, A 503 (RA 1) | A 201, scan (same tick) | B 401 expired | token, B 409 | B 201 | C 422 ->
        # community_pour_over_not_ready (15 min, no worker backoff).
        [Wait(10), Cmd("status")],
        lambda now: connected([queued(1, "shot-A", "2026-10-21/08:00:00.shot.json", espresso("shot-A")),
                               queued(2, "shot-B", "2026-10-21/08:05:00.shot.json", espresso("shot-B")),
                               queued(3, "po-C", "2026-10-21/08:10:00.pour-over.json", pour_over("po-C"),
                                      "pour_over")]),
        community=lambda: {
            "POST " + TOKEN: token("tok-1", "tok-2"),
            "POST " + SHOTS + "#shot-A": [Reply(503, json={"error": "overloaded"}, headers=[("Retry-After", "1")],
                                                align=True), Reply(201)],
            "POST " + SHOTS + "#shot-B": [Reply(401, json={"error": "expired_request"}, align=True),
                                          Reply(409, json={"error": "replayed_request"}, align=True), Reply(201)],
            "POST " + SHOTS + "#po-C": [Reply(422, json={"detail": "unknown brew type"})]},
        machine=empty_history,
        gaps={2: 1, 6: 2, 8: 4}),

    Scenario(
        "upload-reject",
        "Permanent rejections dropped (409 mismatch, 400 invalid_shot); 401 retired_key retires the authorization",
        ["discard_rejected_queue_item", "drop_queue_item", "retire_local_authorization",
         "rotate_identity_preserving_queue", "failure_is_permanent"],
        [Wait(4), Cmd("status"), Quiet(2.0)],
        lambda now: connected([queued(1, "shot-D", "2026-10-21/08:00:00.shot.json", espresso("shot-D")),
                               queued(2, "shot-E", "2026-10-21/08:05:00.shot.json", espresso("shot-E")),
                               queued(3, "shot-F", "2026-10-21/08:10:00.shot.json", espresso("shot-F"))]),
        community=lambda: {
            "POST " + TOKEN: token("tok-1"),
            "POST " + SHOTS + "#shot-D": [Reply(409, json={"error": "idempotency_payload_mismatch"}, align=True)],
            "POST " + SHOTS + "#shot-E": [Reply(400, json={"error": "invalid_shot"}, align=True)],
            "POST " + SHOTS + "#shot-F": [Reply(401, json={"error": "retired_key"}, align=True)]},
        gaps={2: 2, 3: 4}),

    Scenario(
        "token-retired",
        "Token refused with not_authorized: authorization retired, queue kept; then the local factory reset",
        ["ensure_access_token", "retire_local_authorization", "factory_reset_local"],
        [Wait(1), Cmd("status"), Cmd("reset"), Cmd("status")],
        lambda now: connected([queued(1, "shot-G", "2026-10-21/08:00:00.shot.json", espresso("shot-G"))]),
        community=lambda: {"POST " + TOKEN: [Reply(401, json={"error": "not_authorized"})]}),

    Scenario(
        "history-errors",
        "Machine errors: index 500, a record without data, a half-written file, an over-long id, a 2 MiB+ file, "
        "a Pour Over schema 5",
        ["fetch_history_paths", "queue_history_path", "validate_history_record", "skip_history_path",
         "MAX_SHOT_BODY_BYTES"],
        # index 500 | index, p1 skipped (no data), p2 not JSON yet (abort, backoff 4) | index, p2 queued,
        # p3 skipped (id > 256), p4 skipped (too large), pour-over index, po-1 skipped (schema 5), po-2
        # queued | token, upload p2 | upload po-2.
        [Wait(14), Cmd("status")],
        lambda now: connected(),
        community=lambda: {"POST " + TOKEN: token("tok-1"), "POST " + SHOTS: [Reply(201)]},
        machine=lambda: {
            "GET " + UPLOAD_INDEX: [Reply(500, body=b"Internal Server Error", content_type="text/plain", align=True),
                                    Reply(json={"history": [{"file": "2026-10-21/10:%02d:00.shot.json" % m}
                                                            for m in (0, 5, 10, 15)]})],
            "GET " + FILES + "2026-10-21/10:00:00.shot.json": [Reply(body=b'{"id":"shot-p1","profile":{}}')],
            "GET " + FILES + "2026-10-21/10:05:00.shot.json": [Reply(body=b'{"id":"shot-p2","data":[', align=True),
                                                              Reply(body=espresso("shot-p2"))],
            "GET " + FILES + "2026-10-21/10:10:00.shot.json": [Reply(body=json.dumps({"id": "x" * 257,
                                                                                       "data": []}).encode())],
            "GET " + FILES + "2026-10-21/10:15:00.shot.json": [Reply(body=b'{"id":"big","data":[' + b"0," * (1100 * 1024)
                                                                    + b"0]}")],
            "GET " + POUR_OVER_INDEX: [Reply(json={"history": [{"file": "2026-10-21/10:20:00.pour-over.json"},
                                                                {"file": "2026-10-21/10:25:00.pour-over.json"}]})],
            "GET " + POUR_OVER_FILES + "2026-10-21/10:20:00.pour-over.json": [Reply(body=pour_over("po-1", schema=5))],
            "GET " + POUR_OVER_FILES + "2026-10-21/10:25:00.pour-over.json": [Reply(body=pour_over("po-2"))]},
        gaps={1: 2, 4: 4}),

    Scenario(
        "baseline-errors",
        "Baseline: espresso last 204, Pour Over last 500, then a traversal path, then a good one",
        ["fetch_last_history_path", "fetch_last_pour_over_history_path", "normalize_history_path"],
        # last 204, pour-over/last 500 | index (no after), pour-over/last ../evil (history_path_invalid,
        # backoff 4) | index, pour-over/last ok.
        [Wait(6), Cmd("status")],
        lambda now: connected(historyBaselined=False, historyCursor=None, pourOverHistoryBaselined=False,
                              pourOverHistoryCursor=None),
        machine=lambda: {
            "GET " + LAST: [Reply(204)],
            "GET " + POUR_OVER_LAST: [Reply(500, align=True), Reply(json={"file": "../evil/x.json"}, align=True),
                                      Reply(json={"file": "2026-10-21/09:30:00.pour-over.json"})],
            "GET " + UPLOAD_INDEX: [Reply(json=EMPTY)]},
        gaps={2: 2, 4: 4}),

    Scenario(
        "connection-drop",
        "The server reads a request and closes the connection without answering (upload, then history index)",
        ["upload_next_shot (upload_network)", "fetch_history_paths (machine_history_unavailable)"],
        # token, H dropped (backoff 2) | H 201, index dropped (the tick failed again: the failure count
        # is 2, backoff 4) | index, pour-over.
        [Wait(6), Cmd("status")],
        lambda now: connected([queued(1, "shot-H", "2026-10-21/08:00:00.shot.json", espresso("shot-H"))]),
        community=lambda: {"POST " + TOKEN: token("tok-1"), "POST " + SHOTS: [drop(), Reply(201)]},
        machine=lambda: {"GET " + UPLOAD_INDEX: [drop(), Reply(json=EMPTY)],
                         "GET " + POUR_OVER_INDEX: [Reply(json=EMPTY)]},
        gaps={2: 2, 4: 4}),

    Scenario(
        "enrollment-expiry",
        "A pairing past its 10 min + 5 min grace expires locally; disconnect while not connected is a reset",
        ["expire_local_enrollment", "enrollment_exchange_expired", "disconnect (not connected)"],
        # issued 896 s ago: one exchange (202, Retry-After 6), then expired before the next one.
        [Wait(1), Cmd("status"), Quiet(7.5), Cmd("status"), Cmd("disconnect"), Cmd("status")],
        lambda now: state(enrollment={"challenge": "Y29udHJhY3QtY2hhbGxlbmdlLWZpeGVkLTMyYnl0ZXM",
                                      "issuedAt": now - 896, "machineSerial": "MET-OLD"}),
        community=lambda: {"POST " + EXCHANGE: [Reply(202, headers=[("Retry-After", "6")])]}),

    Scenario(
        "response-shapes",
        "Token answer not JSON, then with extra fields and a non-numeric server time; Retry-After as an "
        "HTTP date; an error code to sanitize; a chunked success",
        ["parse_json_response", "update_server_clock", "response_failure", "safe_category"],
        # token not JSON (backoff 2) | token, J 503 "Busy-Now!" (Retry-After unparsable: item 2 s, worker
        # 4 s) | J 200 chunked, index, pour-over.
        [Wait(6), Cmd("status")],
        lambda now: connected([queued(1, "shot-J", "2026-10-21/08:00:00.shot.json", espresso("shot-J"))]),
        community=lambda: {
            "POST " + TOKEN: [Reply(body=b"not json", content_type="application/json", align=True),
                              Reply(json={"accessToken": "tok-1", "extra": [1, 2]}, server_time="abc")],
            "POST " + SHOTS: [Reply(503, json={"error": "Busy-Now!"},
                                    headers=[("Retry-After", "Wed, 21 Oct 2026 07:28:00 GMT")], align=True),
                              Reply(json={"ok": True}, chunked=True)]},
        machine=empty_history,
        gaps={1: 2, 3: 4}),

    Scenario(
        "redirects",
        "Redirects as reqwest 0.12 / tower-http 0.6 follow them: 307 to another host keeps the POST and its "
        "body and drops Authorization; 301 and 303 on GETs; 302 keeps a DELETE and its body; Referer",
        ["reqwest Client (redirect::Policy::default, referer)", "ensure_access_token", "upload_next_shot",
         "fetch_last_*", "revoke_current"],
        # token 307 -> elsewhere/token | shot 307 -> elsewhere/shots (no Authorization) | scan: last 301 ->
        # last?moved=1, pour-over/last 303 -> pour-over/last?moved=1 (404) | disconnect: DELETE 302 ->
        # DELETE ?moved=1 (body kept, same host: Authorization kept) -> 204.
        [Wait(8), Cmd("status"), Cmd("disconnect"), Cmd("status")],
        lambda now: connected([queued(1, "shot-K", "2026-10-21/08:00:00.shot.json", espresso("shot-K"))],
                              historyBaselined=False, historyCursor=None, pourOverHistoryBaselined=False,
                              pourOverHistoryCursor=None),
        community=lambda: {
            "POST " + TOKEN: [Reply(307, headers=[("Location", ELSEWHERE + TOKEN)])],
            "POST " + SHOTS: [Reply(307, headers=[("Location", ELSEWHERE + SHOTS)])],
            "DELETE " + REVOKE: [Reply(302, headers=[("Location", REVOKE + "?moved=1")]), Reply(204)]},
        elsewhere=lambda: {"POST " + TOKEN: token("tok-elsewhere"), "POST " + SHOTS: [Reply(201)]},
        machine=lambda: {
            "GET " + LAST: [Reply(301, headers=[("Location", LAST + "?moved=1")]),
                            Reply(json={"file": ESPRESSO_CURSOR})],
            "GET " + POUR_OVER_LAST: [Reply(303, headers=[("Location", "last?moved=1")]), Reply(404)]}),

    Scenario(
        "redirect-loop",
        "A redirect loop: reqwest gives up after 10 redirects (a send() error, machine_history_unavailable)",
        ["reqwest redirect::Policy::limited(10)", "fetch_history_paths", "record_worker_failure"],
        # GET upload-index -> 302 to itself: the request and 10 redirects, then an error (backoff 2 s);
        # then the index answers: index, pour-over.
        [Wait(13), Cmd("status")],
        lambda now: connected(),
        machine=lambda: {
            "GET " + UPLOAD_INDEX: [Reply(302, headers=[("Location", UPLOAD_INDEX + "?max_results=200")])] * 10
                                   + [Reply(302, headers=[("Location", UPLOAD_INDEX + "?max_results=200")], align=True),
                                      Reply(json=EMPTY)],
            "GET " + POUR_OVER_INDEX: [Reply(json=EMPTY)]},
        gaps={11: 2}),
]
