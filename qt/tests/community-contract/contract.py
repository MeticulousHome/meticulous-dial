#!/usr/bin/env python3
"""Community uploader contract test: the Tauri Dial's community_upload.rs (the specification) against the
Qt Dial's port (qt/src/community*), request by request, through the same scenarios (scenarios.py).

For every scenario and each uploader: a fresh $CONFIG_PATH/community-upload with the scenario's state.json,
a fake Community server and a fake machine backend on 127.0.0.1 that record every request and answer from
the scenario's script, and the uploader's driver (rust/, cpp/) taking the Dial's commands on stdin. Then
the two recordings are normalized (random nonces, request ids, challenges and the clock replaced by checked
placeholders, every signature verified against its canonical string and public key) and compared:
requests (method, target, HTTP version, every header, body bytes, canonical string, signature, which tick
sent it), command answers, timing windows, the final state.json and queue files, and (informational) the
uploader's log lines. Writes report.md and report.json to --out; exits 1 on any unexplained difference.

    contract.py --rust "<argv of the Rust driver>" --cpp "<argv of the C++ driver>" --out DIR [--only NAME]

Run it through run.sh (builds both drivers, runs this in a container with --network none).
"""
import argparse
import base64
import difflib
import hashlib
import json
import math
import os
import queue
import re
import shlex
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse

import ed25519_ref
import scenarios as S

COMMUNITY_PORT = 18200
MACHINE_PORT = 18201
ELSEWHERE_PORT = 18202   # scenarios.ELSEWHERE
SAME_TICK_SECONDS = 0.3     # a request this soon after the previous answer came from the same worker tick
GAP_WINDOW = (-0.1, 0.85)   # an aligned retry after n seconds arrives within [n - 0.1, n + 0.85]
# Two clocks: both uploaders schedule in wall-clock seconds (unix_seconds(), currentSecsSinceEpoch), so
# timestamps and retry gaps are measured on the wall clock; the order of events and the waits use the
# monotonic one. (WSL2's wall clock steps back about 1.1 s every half minute.)
TIME_TOLERANCE = 3          # seconds, for times in answers, state.json and timestamps (a clock step + flooring)
ATTEMPTS = 3                # a scenario that fails while the wall clock stepped is run again, at most twice
IMPLS = ("rust", "cpp")
REASONS = {200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 400: "Bad Request",
           401: "Unauthorized", 404: "Not Found", 409: "Conflict", 422: "Unprocessable Entity",
           429: "Too Many Requests", 500: "Internal Server Error", 503: "Service Unavailable"}
UUID_V4 = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
I64_MAX = 2**63 - 1

# The one log line only the Qt uploader writes (at start: its storage and base URLs).
EXPLAINED_CPP_ONLY_LOG = "[CommunityUpload] storage "

# Differences that are intended and explained in docs/qt-migration/parity/community-contract.md: they
# are listed in the report but do not fail the run. {header name: the value only Qt sends}. Empty since
# qt/src/community/http.cpp writes HTTP/1.1 itself; with QNetworkAccessManager it held connection:
# Keep-Alive and accept-language: en,* (which it always adds).
EXPLAINED_CPP_ONLY_HEADERS = {}


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64url_decode(text):
    """The base64 crate's URL_SAFE_NO_PAD decoder: no padding, canonical trailing bits; None if invalid."""
    if not isinstance(text, str) or not re.fullmatch(r"[A-Za-z0-9_-]*", text) or len(text) % 4 == 1:
        return None
    data = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
    return data if b64url(data) == text else None


def sha256_hex(data):
    return hashlib.sha256(data).hexdigest()


# --- the fake servers --------------------------------------------------------------------------------

class Request:
    def __init__(self, seq, server, conn, t_recv, line, headers, body, chunked):
        self.seq, self.server, self.conn, self.t_recv = seq, server, conn, t_recv
        self.line = line
        parts = line.split(" ")
        self.method, self.target, self.version = (parts + ["", "", ""])[:3] if len(parts) != 3 else parts
        self.path, _, self.query = self.target.partition("?")
        self.headers = headers          # [(name as sent, value)], in order
        self.body = body
        self.chunked = chunked
        self.m_recv = time.monotonic()
        self.m_sent = None
        self.t_sent = None
        self.answer = None
        self.unexpected = False

    def header(self, name):
        for key, value in self.headers:
            if key.lower() == name:
                return value
        return None

    def dump(self):
        return {"seq": self.seq, "server": self.server, "connection": self.conn, "t_recv": self.t_recv,
                "t_sent": self.t_sent, "m_recv": self.m_recv, "m_sent": self.m_sent, "line": self.line,
                "headers": self.headers,
                "body": self.body.decode("utf-8", "backslashreplace"), "chunked": self.chunked,
                "answer": self.answer, "unexpected": self.unexpected}


class Recording:
    def __init__(self):
        self.lock = threading.Lock()
        self.requests = []
        self.connections = 0
        self.last_activity = time.monotonic()

    def add(self, server, conn, line, headers, body, chunked):
        with self.lock:
            request = Request(len(self.requests), server, conn, time.time(), line, headers, body, chunked)
            self.requests.append(request)
            self.last_activity = request.m_recv
            return request

    def answered(self, request, answer):
        with self.lock:
            request.t_sent = time.time()
            request.m_sent = time.monotonic()
            request.answer = answer
            self.last_activity = request.m_sent

    def snapshot(self):
        with self.lock:
            busy = any(r.t_sent is None for r in self.requests)
            return len(self.requests), (time.monotonic() if busy else self.last_activity)


class FakeServer:
    """HTTP/1.1 on raw sockets (keep-alive, Content-Length or chunked bodies), so the recording has the
    request line, the header names and values exactly as sent and the body bytes."""

    def __init__(self, name, port, routes, recording):
        self.name, self.routes, self.recording = name, routes, recording
        self.counters = {}
        self.stopped = False
        self.sockets = []
        self.listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.listener.bind(("127.0.0.1", port))
        self.listener.listen(64)
        threading.Thread(target=self._accept, daemon=True).start()

    def stop(self):
        self.stopped = True
        for sock in [self.listener] + self.sockets:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            sock.close()

    def _accept(self):
        while not self.stopped:
            try:
                conn, _ = self.listener.accept()
            except OSError:
                return
            with self.recording.lock:
                self.recording.connections += 1
                number = self.recording.connections
            self.sockets.append(conn)
            threading.Thread(target=self._serve, args=(conn, number), daemon=True).start()

    def _serve(self, conn, number):
        reader = conn.makefile("rb")
        try:
            while not self.stopped:
                line = reader.readline(65537)
                if not line:
                    return
                if line in (b"\r\n", b"\n"):
                    continue
                headers = []
                while True:
                    raw = reader.readline(65537)
                    if not raw:
                        return
                    if raw in (b"\r\n", b"\n"):
                        break
                    name, _, value = raw.rstrip(b"\r\n").partition(b":")
                    headers.append((name.decode("latin-1"), value.strip(b" \t").decode("latin-1")))
                lower = {n.lower(): v for n, v in headers}
                body, chunked = b"", False
                if "chunked" in lower.get("transfer-encoding", "").lower():
                    chunked = True
                    while True:
                        size = int(reader.readline().split(b";")[0].strip(), 16)
                        if size == 0:
                            while reader.readline() not in (b"\r\n", b"\n", b""):
                                pass
                            break
                        body += reader.read(size)
                        reader.readline()
                elif "content-length" in lower:
                    body = reader.read(int(lower["content-length"]))
                request = self.recording.add(self.name, number, line.rstrip(b"\r\n").decode("latin-1"), headers,
                                             body, chunked)
                reply = self._route(request)
                if reply.align:
                    align_to_second()
                if reply.drop:
                    self.recording.answered(request, reply.describe())
                    try:
                        conn.shutdown(socket.SHUT_RDWR)
                    except OSError:
                        pass
                    return
                try:
                    conn.sendall(encode_reply(reply))
                finally:
                    self.recording.answered(request, reply.describe())
                if lower.get("connection", "").lower() == "close":
                    return
        except (OSError, ValueError):
            return
        finally:
            try:
                conn.close()
            except OSError:
                pass

    def _route(self, request):
        path = urllib.parse.unquote(request.path, errors="strict")
        key = "%s %s" % (request.method, path)
        if request.method == "POST" and path == S.SHOTS:
            try:
                shot = json.loads(request.body)["shot"]["id"]
            except (ValueError, KeyError, TypeError):
                shot = "?"
            if key + "#" + shot in self.routes:
                key += "#" + shot
        replies = self.routes.get(key)
        if not replies:
            request.unexpected = True
            return S.Reply(404, json={"error": "not_found"})
        count = self.counters.get(key, 0)
        self.counters[key] = count + 1
        return replies[min(count, len(replies) - 1)]


def align_to_second():
    """Waits until just after a wall-clock second boundary (checked again after the sleep: the clock may
    have stepped meanwhile), so the uploader's unix_seconds() + n backoff starts at a known point."""
    while True:
        now = time.time()
        if 0.03 <= now - math.floor(now) <= 0.12:
            return
        time.sleep(math.floor(now) + 1.05 - now)


def encode_reply(reply):
    status = reply.status
    body = reply.body_bytes()
    headers = []
    content_type = reply.content_type or ("application/json" if reply.json is not None else None)
    if content_type and status != 204:
        headers.append(("Content-Type", content_type))
    headers += reply.headers
    if reply.server_time is not None:
        value = reply.server_time
        headers.append(("x-meticulous-server-time",
                        str(int(time.time()) + value) if isinstance(value, int) else value))
    if status == 204:
        body = b""
    elif reply.chunked:
        headers.append(("Transfer-Encoding", "chunked"))
        body = (b"%x\r\n%s\r\n" % (len(body), body) if body else b"") + b"0\r\n\r\n"
    else:
        headers.append(("Content-Length", str(len(body))))
    head = "HTTP/1.1 %d %s\r\n" % (status, REASONS.get(status, "Status"))
    head += "".join("%s: %s\r\n" % pair for pair in headers)
    return (head + "\r\n").encode("latin-1") + body


# --- the drivers ---------------------------------------------------------------------------------------

class Driver:
    def __init__(self, argv, env, cwd, stderr_path):
        self.stderr = open(stderr_path, "wb")
        self.proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.stderr,
                                     env=env, cwd=cwd)
        self.answers = queue.Queue()
        threading.Thread(target=self._read, daemon=True).start()
        ready = self.answers.get(timeout=30)
        if not ready or not ready.get("ready"):
            raise RuntimeError("driver did not start: %r" % (ready,))

    def _read(self):
        for line in self.proc.stdout:
            if line.startswith(b"@@ "):
                self.answers.put(json.loads(line[3:]))
        self.answers.put(None)

    def call(self, line, timeout=40):
        try:
            self.proc.stdin.write((line + "\n").encode())
            self.proc.stdin.flush()
            return self.answers.get(timeout=timeout)
        except (OSError, queue.Empty):
            return None

    def close(self):
        if self.proc.poll() is None:
            self.call("quit", timeout=10)
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait()
        self.stderr.close()
        return self.proc.returncode


class Run:
    def __init__(self, impl, scenario):
        self.impl, self.scenario = impl, scenario
        self.requests = []
        self.commands = []      # {"line", "t", "t_done", "answer"}
        self.notes = []         # waits that timed out, driver problems
        self.state_bytes = b""
        self.queue_files = {}
        self.logs = []
        self.exit_code = None
        self.t_end = 0.0
        self.clock_step = 0.0   # how far the wall clock moved against the monotonic one during the run


def write_private(path, data):
    with open(path, "wb") as f:
        f.write(data)
    os.chmod(path, 0o600)


def run_scenario(scenario, impl, argv, workdir):
    run = Run(impl, scenario)
    root = os.path.join(workdir, scenario.name, impl)
    shutil.rmtree(root, ignore_errors=True)
    upload = os.path.join(root, "config", "community-upload")
    os.makedirs(os.path.join(upload, "queue"))
    for directory in (upload, os.path.join(upload, "queue")):
        os.chmod(directory, 0o700)
    state, bodies = scenario.build_state(int(time.time()))
    write_private(os.path.join(upload, "state.json"), json.dumps(state, separators=(",", ":")).encode())
    for name, body in bodies.items():
        write_private(os.path.join(upload, "queue", name), body)

    recording = Recording()
    servers = [FakeServer("community", COMMUNITY_PORT, scenario.community(), recording),
               FakeServer("machine", MACHINE_PORT, scenario.machine(), recording),
               FakeServer("elsewhere", ELSEWHERE_PORT, scenario.elsewhere(), recording)]
    env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": root, "TZ": "UTC",
           "CONFIG_PATH": os.path.join(root, "config"),
           "COMMUNITY_API_BASE": "http://127.0.0.1:%d%s" % (COMMUNITY_PORT, scenario.community_suffix),
           "MACHINE_API_BASE": "http://127.0.0.1:%d" % MACHINE_PORT}
    driver = None
    offset_start = time.time() - time.monotonic()
    try:
        driver = Driver(argv, env, root, os.path.join(root, "stderr.log"))
        for step in scenario.steps:
            if isinstance(step, S.Cmd):
                t, m = time.time(), time.monotonic()
                answer = driver.call(step.line())
                run.commands.append({"line": step.line(), "command": step, "t": t, "m": m, "t_done": time.time(),
                                     "answer": answer})
                if answer is None:
                    run.notes.append("no answer to %r" % step.line())
            elif isinstance(step, S.Quiet):
                time.sleep(step.seconds)
            elif isinstance(step, S.Wait):
                deadline = time.monotonic() + step.timeout
                while True:
                    count, last = recording.snapshot()
                    now = time.monotonic()
                    if count >= step.requests and now - last >= step.quiet:
                        break
                    if now > deadline:
                        run.notes.append("waited %.0f s for %d requests, got %d" % (step.timeout, step.requests, count))
                        break
                    time.sleep(0.05)
    except Exception as error:   # a driver that does not start or dies: recorded, compared as a failure
        run.notes.append("driver failure: %s" % error)
    finally:
        run.t_end = time.time()
        run.clock_step = (time.time() - time.monotonic()) - offset_start
        if driver:
            run.exit_code = driver.close()
        for server in servers:
            server.stop()
    run.requests = list(recording.requests)
    try:
        with open(os.path.join(upload, "state.json"), "rb") as f:
            run.state_bytes = f.read()
    except OSError:
        run.notes.append("no state.json at the end")
    for name in sorted(os.listdir(os.path.join(upload, "queue"))):
        with open(os.path.join(upload, "queue", name), "rb") as f:
            run.queue_files[name] = f.read()
    with open(os.path.join(root, "stderr.log"), "rb") as f:
        for line in f.read().decode("utf-8", "replace").splitlines():
            if line.startswith("LOG "):
                level, _, message = line[4:].partition(" ")
                run.logs.append((level, message.replace(root, "<root>")))
    with open(os.path.join(root, "requests.json"), "w") as f:
        json.dump([r.dump() for r in run.requests], f, indent=1)
    with open(os.path.join(root, "commands.json"), "w") as f:
        json.dump([{"line": c["line"], "t": c["t"], "m": c["m"], "t_done": c["t_done"], "answer": c["answer"]}
                   for c in run.commands], f, indent=1)
    if run.exit_code not in (0, None):
        run.notes.append("driver exit code %s" % run.exit_code)
    return run


# --- normalization -----------------------------------------------------------------------------------

class Rel:
    """A time as seconds from a reference (a command, the end of the run); equal within TIME_TOLERANCE."""

    def __init__(self, delta):
        self.delta = delta

    def __eq__(self, other):
        return isinstance(other, Rel) and abs(self.delta - other.delta) <= TIME_TOLERANCE

    def __repr__(self):
        return "<now%+d>" % self.delta


class Context:
    """What one run's normalization learns: public keys by installation and key id, challenge labels."""

    def __init__(self, scenario):
        self.installations = {S.INSTALLATION_ID: S.PUBLIC_KEY}
        self.keys = {S.KEY_ID: S.PUBLIC_KEY}
        self.labels = {}
        self.offsets = {0}
        for routes in (scenario.community(), scenario.machine(), scenario.elsewhere()):
            for replies in routes.values():
                for reply in replies:
                    if isinstance(reply.server_time, int):
                        self.offsets.add(reply.server_time)

    def label(self, challenge):
        if challenge not in self.labels:
            self.labels[challenge] = "<challenge-%d>" % (len(self.labels) + 1)
        return self.labels[challenge]

    def substitute(self, text):
        for value, label in self.labels.items():
            text = text.replace(value, label)
        return text


def normalize_enrollment(value, t_cmd, ctx, problems):
    if not isinstance(value, dict) or "qrUrl" not in value:
        return value
    match = re.fullmatch(r"(.*[?&]enrollment=)([^&#]*)(.*)", value["qrUrl"])
    out = {"expiresAt": Rel(value.get("expiresAt", 0) - int(t_cmd)) if isinstance(value.get("expiresAt"), int)
           else value.get("expiresAt")}
    if not match:
        out["qrUrl"] = value["qrUrl"]
        problems.append("the QR link has no enrollment parameter")
        return out
    out["qrUrl"] = match.group(1) + "<payload>" + match.group(3)
    payload = b64url_decode(match.group(2))
    if payload is None:
        problems.append("the enrollment payload is not base64url (no padding)")
        out["payload"] = match.group(2)
        return out
    try:
        fields = json.loads(payload)
    except ValueError:
        problems.append("the enrollment payload is not JSON")
        out["payload"] = payload.decode("utf-8", "replace")
        return out
    challenge = fields.get("challenge")
    if b64url_decode(challenge) is None or len(b64url_decode(challenge)) != 32:
        problems.append("the enrollment challenge is not 32 random bytes in base64url")
    else:
        ctx.label(challenge)
    if isinstance(fields.get("installationId"), str) and isinstance(fields.get("publicKey"), str):
        ctx.installations[fields["installationId"]] = fields["publicKey"]
    text = ctx.substitute(payload.decode("utf-8"))
    issued = fields.get("issuedAt")
    if isinstance(issued, int):
        text = text.replace('"issuedAt":%d' % issued, '"issuedAt":<issuedAt>')
        out["issuedAt"] = Rel(issued - int(t_cmd))
        if isinstance(value.get("expiresAt"), int):
            out["expiresAt - issuedAt"] = value["expiresAt"] - issued
    out["payload"] = text
    return out


def normalize_status(value, t_cmd):
    if not isinstance(value, dict):
        return value
    out = dict(value)
    for key in ("lastSuccessAt", "lastRetryAt", "enrollmentExpiresAt"):
        if isinstance(out.get(key), int):
            out[key] = Rel(out[key] - int(t_cmd))
    return out


def normalize_command(entry, ctx, problems):
    answer = entry["answer"]
    if answer is None:
        return {"line": entry["line"], "answer": "<no answer>"}
    if "error" in answer:
        return {"line": entry["line"], "error": answer["error"]}
    value = answer.get("ok")
    command = entry["command"].command
    if command == "status":
        value = normalize_status(value, entry["t"])
    elif command == "enroll":
        value = normalize_enrollment(value, entry["t"], ctx, problems)
    return {"line": entry["line"], "ok": value}


def check_signature(request, ctx):
    """Rebuilds the canonical string a server would check and verifies the signature. Returns
    (normalized canonical, verdict)."""
    timestamp = request.header("x-meticulous-timestamp")
    nonce = request.header("x-meticulous-nonce")
    request_id = request.header("x-meticulous-request-id")
    signature = request.header("x-meticulous-signature")
    digest = sha256_hex(request.body)
    if request.header("x-meticulous-installation-id") is not None:
        installation = request.header("x-meticulous-installation-id")
        canonical = ("meticulous-enrollment-exchange-v1\nmethod:POST\npath:%s\naudience:meticulous-community\n"
                     "installation-id:%s\ntimestamp:%s\nnonce:%s\nrequest-id:%s\nbody-sha256:%s\n"
                     % (request.path, installation.lower(), timestamp, nonce, (request_id or "").lower(), digest))
        public = ctx.installations.get(installation)
    elif request.header("x-meticulous-key-id") is not None:
        key_id = request.header("x-meticulous-key-id")
        canonical = ("meticulous-machine-request-v1\nmethod:%s\npath:%s\naudience:meticulous-community\n"
                     "key-id:%s\nkey-version:%s\ntimestamp:%s\nnonce:%s\nrequest-id:%s\nbody-sha256:%s\n"
                     % (request.method.upper(), request.path, key_id.lower(), request.header("x-meticulous-key-version"),
                        timestamp, nonce, (request_id or "").lower(), digest))
        public = ctx.keys.get(key_id)
    else:
        return None, None
    normalized = canonical
    for value, placeholder in ((timestamp, "<timestamp>"), (nonce, "<nonce>"), ((request_id or "").lower(), "<request-id>"),
                               (digest, "<sha256(body)>")):
        if value:
            normalized = normalized.replace(":" + value + "\n", ":" + placeholder + "\n")
    if public is None:
        return normalized, "no known public key"
    key = b64url_decode(public)
    sig = b64url_decode(signature or "")
    if key is None or sig is None or len(sig) != 64:
        return normalized, "INVALID (not a base64url Ed25519 signature)"
    if not ed25519_ref.verify(key, canonical.encode(), sig):
        return normalized, "INVALID (does not verify)"
    return normalized, "valid Ed25519 over the canonical string"


def normalize_requests(run, ctx, problems):
    out = []
    nonces, request_ids = {}, {}
    previous = None
    command_times = [c["m"] for c in run.commands]
    for request in run.requests:
        rec = {"server": request.server, "request": request.line}
        headers = {}
        for name, value in request.headers:
            headers.setdefault(name.lower(), []).append(value)
        normalized_headers = {}
        for name, values in headers.items():
            if name in ("x-meticulous-timestamp", "x-meticulous-nonce", "x-meticulous-request-id",
                        "x-meticulous-signature"):
                values = ["<%s>" % name[len("x-meticulous-"):]] * len(values)
            normalized_headers[name] = values[0] if len(values) == 1 else values
        rec["headers"] = normalized_headers
        where = "request %d (%s %s)" % (request.seq, request.method, request.path)
        # Following a redirect sends the same signed headers again (reqwest does): allowed for the request
        # right after a redirect answer, a replay anywhere else.
        follows_redirect = previous is not None and re.match(r"30[12378] ", previous.answer or "") is not None
        nonce = request.header("x-meticulous-nonce")
        if nonce is not None:
            raw = b64url_decode(nonce)
            if raw is None or len(raw) != 24:
                problems.append("%s: the nonce is not 24 bytes in base64url" % where)
            if nonce in nonces and not (follows_redirect and nonces[nonce] == previous.seq):
                problems.append("%s: nonce reused from request %d (a replay)" % (where, nonces[nonce]))
            elif nonce in nonces:
                rec["signed headers"] = "those of request %d (the redirect it follows)" % nonces[nonce]
            nonces[nonce] = request.seq
        request_id = request.header("x-meticulous-request-id")
        if request_id is not None:
            if not UUID_V4.fullmatch(request_id):
                problems.append("%s: the request id is not a lower-case UUID v4" % where)
            if request_id in request_ids and not (follows_redirect and request_ids[request_id] == previous.seq):
                problems.append("%s: request id reused from request %d" % (where, request_ids[request_id]))
            request_ids[request_id] = request.seq
        timestamp = request.header("x-meticulous-timestamp")
        if timestamp is not None:
            try:
                delta = int(timestamp) - int(request.t_recv)
                offset = min(ctx.offsets, key=lambda o: abs(delta - o))
                rec["timestamp"] = ("server clock %+d s" % offset if abs(delta - offset) <= TIME_TOLERANCE
                                    else "off by %+d s" % delta)
            except ValueError:
                rec["timestamp"] = "not an integer: %r" % timestamp
        body = request.body
        try:
            rec["body"] = ctx.substitute(body.decode("utf-8"))
        except UnicodeDecodeError:
            rec["body"] = "<%d bytes, not UTF-8, sha256 %s>" % (len(body), sha256_hex(body))
        if request.chunked:
            rec["body transfer"] = "chunked"
        canonical, verdict = check_signature(request, ctx)
        if canonical is not None:
            rec["canonical"] = ctx.substitute(canonical)
            rec["signature"] = verdict
            if not verdict.startswith("valid"):
                problems.append("%s: signature %s" % (where, verdict))
        rec["answer"] = request.answer
        if request.unexpected:
            problems.append("%s: not in the scenario's script (answered 404)" % where)
        if previous is None:
            rec["sent"] = "first request"
        else:
            since = previous.m_sent or previous.m_recv
            if any(since <= t <= request.m_recv for t in command_times):
                rec["sent"] = "after a command"
            elif request.m_recv - since < SAME_TICK_SECONDS:
                rec["sent"] = "same tick"
            else:
                rec["sent"] = "later tick"
        # The wall-clock gap: the uploaders' own clock for their backoffs.
        rec["_gap"] = None if previous is None else request.t_recv - (previous.t_sent or previous.t_recv)
        out.append(rec)
        previous = request
    return out


def normalize_state(run, ctx, problems):
    try:
        state = json.loads(run.state_bytes)
    except ValueError:
        return {"state.json": "<not JSON>"}, {}
    out = {"field order": list(state.keys())}
    identity = (state.get("installationId"), state.get("privateSeed"), state.get("publicKey"))
    if identity == (S.INSTALLATION_ID, S.PRIVATE_SEED, S.PUBLIC_KEY):
        out["identity"] = "the scenario's identity"
    else:
        seed = b64url_decode(identity[1] or "")
        valid = (UUID_V4.fullmatch(identity[0] or "") and seed is not None and len(seed) == 32
                 and b64url(ed25519_ref.public_key(seed)) == identity[2])
        out["identity"] = "a new identity (valid)" if valid else "a new identity (INVALID: %r)" % (identity,)
    t_end = int(run.t_end)
    enrollment = state.get("enrollment")
    if isinstance(enrollment, dict):
        enrollment = dict(enrollment)
        challenge = enrollment.get("challenge")
        if challenge in ctx.labels:
            enrollment["challenge"] = ctx.labels[challenge]
        elif challenge != "Y29udHJhY3QtY2hhbGxlbmdlLWZpeGVkLTMyYnl0ZXM":
            raw = b64url_decode(challenge or "")
            enrollment["challenge"] = "<32 random bytes>" if raw is not None and len(raw) == 32 else challenge
        if isinstance(enrollment.get("issuedAt"), int):
            enrollment["issuedAt"] = Rel(enrollment["issuedAt"] - t_end)
    out["enrollment"] = enrollment
    for key in ("authorizationId", "keyId", "keyVersion", "paused", "historyBaselined", "historyCursor",
                "pourOverHistoryBaselined", "pourOverHistoryCursor", "lastError"):
        out[key] = state.get(key)
    for key in ("lastSuccessAt", "lastRetryAt"):
        out[key] = Rel(state[key] - t_end) if isinstance(state.get(key), int) else state.get(key)
    names = {}
    items = []
    for index, item in enumerate(state.get("queue") or []):
        item = dict(item)
        item_id = item.get("id", "")
        if not item_id.startswith("aaaaaaaa-0000-"):
            if not UUID_V4.fullmatch(item_id):
                problems.append("queue item %d: id %r is not a UUID v4" % (index, item_id))
            names[item_id] = "<new item %d>" % (index + 1)
            item["id"] = names[item_id]
        if item.get("bodyFile") == item_id + ".json":
            item["bodyFile"] = "<id>.json"
        value = item.get("nextAttemptAt")
        if isinstance(value, int) and value not in (0, I64_MAX):
            item["nextAttemptAt"] = Rel(value - t_end)
        items.append(item)
    out["queue"] = items
    files = {}
    for name, body in run.queue_files.items():
        stem = name[:-5] if name.endswith(".json") else name
        files[names.get(stem, stem) + ".json"] = body.decode("utf-8", "backslashreplace")
    return out, files


def normalize_logs(run):
    lines = []
    for level, message in run.logs:
        if "[CommunityUpload]" not in message or (run.impl == "cpp" and message.startswith(EXPLAINED_CPP_ONLY_LOG)):
            continue
        message = re.sub(r'"occurredAt":\d+', '"occurredAt":<t>', message)
        lines.append("%s %s" % (level, message))
    return lines


def normalize(run):
    ctx = Context(run.scenario)
    problems = list(run.notes)
    commands = [normalize_command(c, ctx, problems) for c in run.commands]
    requests = normalize_requests(run, ctx, problems)
    state, files = normalize_state(run, ctx, problems)
    return {"commands": commands, "requests": requests, "state": state, "queue files": files,
            "logs": normalize_logs(run), "problems": problems}


# --- comparison --------------------------------------------------------------------------------------

def show(value):
    if isinstance(value, Rel):
        return repr(value)
    text = json.dumps(plain(value), ensure_ascii=False)
    return text if len(text) <= 300 else text[:300] + "..."


def plain(value):
    if isinstance(value, Rel):
        return repr(value)
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items() if not str(k).startswith("_")}
    if isinstance(value, list):
        return [plain(v) for v in value]
    return value


def differences(a, b, path):
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for key in list(a) + [k for k in b if k not in a]:
            if str(key).startswith("_"):
                continue
            where = "%s.%s" % (path, key)
            if key not in b:
                out.append((where, a[key], "<absent>"))
            elif key not in a:
                out.append((where, "<absent>", b[key]))
            else:
                out += differences(a[key], b[key], where)
    elif isinstance(a, list) and isinstance(b, list) and not (path.endswith("field order")):
        for index in range(max(len(a), len(b))):
            where = "%s[%d]" % (path, index)
            if index >= len(b):
                out.append((where, a[index], "<absent>"))
            elif index >= len(a):
                out.append((where, "<absent>", b[index]))
            else:
                out += differences(a[index], b[index], where)
    elif not (a == b):
        out.append((path, a, b))
    return out


def explained(where, rust, cpp):
    match = re.fullmatch(r"requests\[\d+\]\.headers\.([a-z0-9-]+)", where)
    if match and rust == "<absent>" and EXPLAINED_CPP_ONLY_HEADERS.get(match.group(1)) == cpp:
        return "Qt-only header %s: %s" % (match.group(1), cpp)
    return None


def render_request(index, rec):
    lines = ["#%d %s  %s   -> %s   (%s%s)" % (index, rec["server"], rec["request"], rec["answer"], rec["sent"],
                                              ", %.2f s" % rec["_gap"] if rec.get("_gap") is not None else "")]
    for name in sorted(rec["headers"]):
        lines.append("    %s: %s" % (name, rec["headers"][name]))
    if "timestamp" in rec:
        lines.append("    (timestamp = %s)" % rec["timestamp"])
    if rec["body"]:
        body = rec["body"] if len(rec["body"]) <= 600 else rec["body"][:600] + "... (%d chars)" % len(rec["body"])
        lines.append("    body: " + body.replace("\n", "\\n"))
    if "canonical" in rec:
        lines.append("    canonical: " + rec["canonical"].replace("\n", "\\n"))
        lines.append("    signature: " + rec["signature"])
    if "signed headers" in rec:
        lines.append("    signed headers: " + rec["signed headers"])
    return "\n".join(lines)


def compare(scenario, runs):
    rust, cpp = (normalize(runs[impl]) for impl in IMPLS)
    result = {"scenario": scenario.name, "title": scenario.title, "covers": scenario.covers,
              "counts": {impl: len(runs[impl].requests) for impl in IMPLS}, "failures": [], "explained": [],
              "timing": [], "rust": rust, "cpp": cpp, "log differences": []}
    for impl, data in (("rust", rust), ("cpp", cpp)):
        for problem in data["problems"]:
            result["failures"].append("%s: %s" % (impl, problem))
    for section in ("requests", "commands", "state", "queue files"):
        for where, a, b in differences(rust[section], cpp[section], section):
            reason = explained(where, a, b)
            if reason:
                result["explained"].append("%s: %s" % (where, reason))
            else:
                result["failures"].append("%s: rust %s | cpp %s" % (where, show(a), show(b)))
    for index, seconds in sorted(scenario.gaps.items()):
        for impl, data in (("rust", rust), ("cpp", cpp)):
            if index >= len(data["requests"]):
                continue
            gap = data["requests"][index]["_gap"]
            low, high = seconds + GAP_WINDOW[0], seconds + GAP_WINDOW[1]
            verdict = "ok" if gap is not None and low <= gap <= high else "OUTSIDE"
            result["timing"].append("%s request %d: %.2f s after the previous answer, expected %d s [%.2f, %.2f] %s"
                                    % (impl, index, gap or -1, seconds, low, high, verdict))
            if verdict != "ok":
                result["failures"].append("%s: request %d came %.2f s after the previous answer, expected %d s"
                                          % (impl, index, gap or -1, seconds))
    if rust["logs"] != cpp["logs"]:
        result["log differences"] = list(difflib.unified_diff(rust["logs"], cpp["logs"], "rust", "cpp", lineterm="", n=1))
        result["failures"].append("the [CommunityUpload] log lines differ (see the diff)")
    if any(m.startswith(EXPLAINED_CPP_ONLY_LOG) for impl in IMPLS for _, m in runs[impl].logs if impl == "cpp"):
        result["explained"].append("log: Qt-only start line \"%s...\"" % EXPLAINED_CPP_ONLY_LOG)
    result["clock steps"] = {impl: round(runs[impl].clock_step, 2) for impl in IMPLS}
    return result


# --- report --------------------------------------------------------------------------------------------

def write_report(out_dir, results, argv):
    lines = ["# Community uploader contract: Tauri (Rust) vs Qt (C++)", "",
             "Generated by `qt/tests/community-contract/run.sh` on %s." % time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
             "Rust driver: `%s`. C++ driver: `%s`." % (" ".join(argv["rust"]), " ".join(argv["cpp"])), "",
             "| Scenario | Requests (Rust / Qt) | Explained | Result |", "|---|---|---|---|"]
    for r in results:
        lines.append("| %s | %d / %d | %d | %s |" % (r["scenario"], r["counts"]["rust"], r["counts"]["cpp"],
                                                   len(r["explained"]), "PASS" if not r["failures"] else
                                                   "**FAIL** (%d)" % len(r["failures"])))
    lines.append("")
    for r in results:
        lines += ["## %s: %s" % (r["scenario"], r["title"]), "",
                  "Rust paths: " + ", ".join("`%s`" % c for c in r["covers"]), ""]
        for note in r.get("attempt notes", []):
            lines += ["Note: " + note, ""]
        if r["failures"]:
            lines += ["### Differences", ""] + ["- " + f for f in r["failures"]] + [""]
        if r["explained"]:
            lines += ["### Explained differences", ""] + ["- " + e for e in sorted(set(r["explained"]))] + [""]
        if r["timing"]:
            lines += ["### Timing", ""] + ["- " + t for t in r["timing"]] + [""]
        lines += ["### Commands (Rust)", "", "```"]
        for c in r["rust"]["commands"]:
            lines.append("%s -> %s" % (c["line"], show({k: v for k, v in c.items() if k != "line"})))
        lines += ["```", "", "### Requests (Rust; Qt identical unless listed above)", "", "```"]
        for index, rec in enumerate(r["rust"]["requests"]):
            lines.append(render_request(index, rec))
        lines += ["```", ""]
        if len(r["rust"]["requests"]) != len(r["cpp"]["requests"]) or r["failures"]:
            lines += ["### Requests (Qt)", "", "```"]
            for index, rec in enumerate(r["cpp"]["requests"]):
                lines.append(render_request(index, rec))
            lines += ["```", ""]
        lines += ["### Final state.json (Rust)", "", "```", json.dumps(plain(r["rust"]["state"]), ensure_ascii=False,
                                                                       indent=1), "```", ""]
        if r["log differences"]:
            lines += ["### Log lines (Rust vs Qt)", "", "```diff"] + r["log differences"] + ["```", ""]
    with open(os.path.join(out_dir, "report.md"), "w") as f:
        f.write("\n".join(lines))
    with open(os.path.join(out_dir, "report.json"), "w") as f:
        json.dump(plain(results), f, ensure_ascii=False, indent=1)


def self_test():
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../test-vectors/machine-upload-v1.json")) as f:
        vector = json.load(f)
    seed = b64url_decode(vector["privateSeed"])
    request = vector["request"]
    assert b64url(ed25519_ref.public_key(seed)) == vector["publicKey"] == S.PUBLIC_KEY
    assert ed25519_ref.verify(b64url_decode(vector["publicKey"]), request["canonical"].encode(),
                              b64url_decode(request["signature"]))
    assert not ed25519_ref.verify(b64url_decode(vector["publicKey"]), request["canonical"].encode() + b"x",
                                  b64url_decode(request["signature"]))
    assert (vector["installationId"], vector["keyId"], vector["privateSeed"]) == (S.INSTALLATION_ID, S.KEY_ID, S.PRIVATE_SEED)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rust", required=True, help="argv of the Rust driver (shell words)")
    parser.add_argument("--cpp", required=True, help="argv of the C++ driver (shell words)")
    parser.add_argument("--out", required=True)
    parser.add_argument("--work", default="/tmp/community-contract")
    parser.add_argument("--only", action="append", help="run only these scenarios")
    args = parser.parse_args()
    self_test()
    argv = {"rust": shlex.split(args.rust), "cpp": shlex.split(args.cpp)}
    os.makedirs(args.out, exist_ok=True)
    selected = [s for s in S.SCENARIOS if not args.only or s.name in args.only]
    results = []
    for scenario in selected:
        notes = []
        for attempt in range(1, ATTEMPTS + 1):
            runs = {}
            for impl in IMPLS:
                started = time.monotonic()
                runs[impl] = run_scenario(scenario, impl, argv[impl], args.work)
                print("  %-18s %-4s %2d requests  %.1f s" % (scenario.name, impl, len(runs[impl].requests),
                                                              time.monotonic() - started), flush=True)
            result = compare(scenario, runs)
            stepped = {impl: runs[impl].clock_step for impl in IMPLS if abs(runs[impl].clock_step) > 0.3}
            if not result["failures"] or not stepped or attempt == ATTEMPTS:
                break
            # Both uploaders schedule on the wall clock: a step inside a timed interval moves a retry.
            note = ("attempt %d failed while the wall clock stepped (%s): %s; run again"
                    % (attempt, ", ".join("%s %+.2f s" % kv for kv in stepped.items()), "; ".join(result["failures"][:3])))
            notes.append(note)
            print("    " + note, flush=True)
        result["attempt notes"] = notes
        results.append(result)
        print("%-18s %s" % (scenario.name, "PASS" if not result["failures"] else "FAIL"), flush=True)
        for failure in result["failures"][:30]:
            print("    " + failure, flush=True)
        for note in sorted(set(result["explained"]))[:5]:
            print("    explained: " + note, flush=True)
    shutil.copytree(args.work, os.path.join(args.out, "runs"), dirs_exist_ok=True)
    write_report(args.out, results, argv)
    failed = [r["scenario"] for r in results if r["failures"]]
    print("\n%d scenarios, %d failed%s. Report: %s" % (len(results), len(failed),
                                                       (" (" + ", ".join(failed) + ")") if failed else "",
                                                       os.path.join(args.out, "report.md")))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
