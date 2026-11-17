# Community uploader contract test: Tauri (Rust) vs Qt (C++)

The Tauri Dial's uploader (`src-tauri/src/community_upload.rs`, `community_upload/diagnostics.rs`, wired
by `src-tauri/src/lib.rs`) is the specification; the Qt Dial's port (`qt/src/community.cpp/.h`,
`qt/src/community/`) must put the same requests on the wire. This test runs both against the same local
fake Community server and fake machine backend, through the same scenarios, and compares what they send
request by request. Where they differed, the C++ was fixed (see "Differences found"). See
[community.md](community.md) for the port itself.

Run it: `bash qt/tests/community-contract/run.sh` (from WSL, in the checkout; `--only <scenario>` to run
some). It exits non-zero on any difference and writes `qt/build/contract-report/report.md` (every
scenario's normalized Rust request stream, command answers and final state.json, and the differences),
`report.json` and `runs/<scenario>/<rust|cpp>/` (the raw recorded requests with times, the commands,
the uploader's log lines, the final `community-upload/` directory). About 4 minutes (3.5 of them the
scenarios).

Nothing reaches a real service: both base URLs point at the fakes (the drivers refuse to start
otherwise), and the scenarios run in a container started with `--network none`.

## How it works

| Part | What it is |
|---|---|
| `rust/` (driver) | `src-tauri/src/community_upload.rs` compiled in place through `#[path]` (no copy, no seam, no feature added), driven as `lib.rs` does: `CommunityUploadRuntime::initialize()` then `start()` (the worker thread), then the six commands (`community_upload_status`, `begin_enrollment`, `set_upload_paused`, `disconnect`, `factory_reset_local`, `scan_history`) read from stdin. Crates and features as the Tauri Dial resolves them (src-tauri/Cargo.lock; reqwest 0.12.28 without compression, hyper 1.11, tower-http 0.6.11, serde_json 1.0.151 without `preserve_order`, checked against the arm64 build's fingerprints); uuid is 1.29 (1.25 is not in the offline cache; only `new_v4`/`to_string` are used). Built on the host with `cargo build --offline` (the community-interop approach) into `qt/build/contract-rust`; it runs in the bookworm image as is (glibc ≤ 2.34). |
| `cpp/` (driver) | The Qt Dial's `Community` singleton (`new Community(apiUrl)`, as `main.cpp`; its worker thread starts at once) with the QML calls (`beginEnrollment(serial or "")`, `setUploadPaused`, `disconnect`, `factoryResetLocal`, `scanHistory`, `status`), the same stdin protocol. Its own CMake project over `qt/src/community*` (no change to `qt/CMakeLists.txt`), built against Qt 6.4 in `qt-dial-bookworm` (`--network none`) into `qt/build/contract-cpp`. |
| `contract.py` | The orchestrator: per scenario and uploader, a fresh `$CONFIG_PATH/community-upload` with the scenario's state.json and queue bodies, three fake HTTP/1.1 servers on raw sockets (Community `127.0.0.1:18200`, a second Community host `:18202` for redirects, the machine `:18201`) that record the request line, every header as sent and the body bytes and answer from the scenario's script, the driver's commands and waits; then normalization, comparison and the report. |
| `scenarios.py` | The 16 scenarios (below): starting state, scripted answers (in order per endpoint), steps, timing windows. |
| `ed25519_ref.py` | RFC 8032's reference Ed25519 (the image has no Python crypto package), checked against `src-tauri/test-vectors/machine-upload-v1.json` before each run. |

Both uploaders start from the identity of that cross-language vector (installation id, seed, public key,
key id 22222222-…, version 3), written into the seeded state.json, so they sign with the same key and send
the same installation id and idempotency keys.

## What is compared

For every request, Rust's n-th against Qt's n-th:

- the server it went to, the request line (method, the target exactly as sent, `HTTP/1.1`);
- every header, name (case-insensitive, as HTTP defines it) and value; none is excluded. The values that
  are random or time-based are replaced by checked placeholders: `x-meticulous-nonce` (must be 24 random
  bytes, base64url without padding, never reused), `x-meticulous-request-id` (a lower-case UUID v4, never
  reused), `x-meticulous-timestamp` (must equal the fake server's clock plus the offset the server last
  advertised in `x-meticulous-server-time`, ±3 s), `x-meticulous-signature` (verified, below). Header order
  and name case are recorded in `requests.json` but not compared (not significant in HTTP; they are now
  the same anyway: hyper's order, lower case);
- the body bytes (the envelope carries the machine's shot bytes untouched; the exchange body's random
  challenge must be the one of the uploader's own QR link and is shown as `<challenge-1>`);
- the signature: the fake server rebuilds the canonical string (`meticulous-machine-request-v1` or
  `meticulous-enrollment-exchange-v1`) from the request as received and verifies the Ed25519 signature with
  the public key of the installation; the canonical strings (placeholders for timestamp, nonce, request id
  and body hash) are compared too. A clock or nonce seam would make the signatures byte-identical, but the
  Rust has none and is built as is; Ed25519 is deterministic, so a valid signature over an equal canonical
  string is the same check;
- the scripted answer it got, and when it was sent: in the same worker tick as the previous answer, a later
  tick, or after a Dial command; the retries the scenarios time (answers sent just after a wall-clock second
  boundary, so a `unix_seconds() + n` backoff starts at a known point) must come n seconds later within
  [n − 0.1, n + 0.85], by both;
- per uploader: every signature valid, every request in the scenario's script, no nonce or request id used
  twice (except by the request that follows a redirect, below).

Also: every command's answer (`status` JSON, the enrollment `{qrUrl, expiresAt}` with the decoded QR
payload byte for byte, error strings; times relative to the command, ±3 s), the final state.json (field
order, every field, new identities checked for consistency, item ids and times normalized), the queue body
files, and the uploaders' `[CommunityUpload]` log lines (`queued`, `upload_succeeded`, `upload_deferred`,
`failure {...}`, ...) line for line. The one explained difference: the start line only the Qt uploader
writes (its storage directory and base URLs).

Clocks: both uploaders schedule in wall-clock seconds, so timestamps and retry gaps are measured on the
wall clock; the order of events and the waits use the monotonic clock. WSL2's wall clock steps back about
1.1 s every half minute: the aligned answers check their alignment again after sleeping, times are
compared within ±3 s (one step plus whole-second flooring), and a scenario that fails while the wall clock
stepped during it is run again, at most twice (the report says so; a real difference fails every attempt).
On a machine with a steady clock none of this triggers.

## Scenarios

| Scenario | What it goes through (Rust paths) |
|---|---|
| `enroll` | status and pause before pairing (`Community backup is not connected`); `begin_enrollment` with a serial to trim; exchange 202 + Retry-After 1 + server time +500, then 200 (+1000); baseline (`/history/last` with a leading slash and spaces, `/pour-over/last` 404); `already connected`; a requested scan. `COMMUNITY_API_BASE` has a path (`/community/`): the requests drop it. |
| `history-upload` | the scan: index entries by `file`/`url`/`name`, duplicates, the cursor itself, older ones, empty entries, every special character class in a file name; the files; the raw envelope (odd whitespace, escapes, `-0.0`, `1e3`, an integer past u64); the Pour Over index (sorted, after its cursor) and record; token (+1000), uploads, idempotency keys. |
| `pause-resume` | paused: no request, a scan asked while paused waits; resume: token, upload, the due scan with cursors made of every form-encoded character; pause again; resume runs the asked scan. |
| `disconnect` | token, signed `DELETE /installations/current`, local reset. |
| `disconnect-errors` | token 503 + Retry-After 7 (error, retry record +7), DELETE 500 (+5), DELETE with the cached token 401 `retired_or_revoked_access` (done, reset). |
| `exchange-errors` | exchange 500 (backoff 2 s), 429 + Retry-After 1, 400 (pairing dropped, backoff 8 s), a new pairing, claim, baseline (Pour Over 204). |
| `upload-retry` | 503 + Retry-After 1; 401 `expired_request` (new token); 409 `replayed_request` (item backoff 4 s); Pour Over 422 → `community_pour_over_not_ready` (15 min, no worker backoff); the scan in the tick that succeeded. |
| `upload-reject` | 409 `idempotency_payload_mismatch` and 400 `invalid_shot` dropped with their bodies; 401 `retired_key` retires the authorization (new identity, queue kept). |
| `token-retired` | token 401 `not_authorized`; then `factory_reset_local`. |
| `history-errors` | index 500; a record without `data`; a half-written file (temporary, scan aborted, backoff 4 s); an id of 257 bytes; a file declared past 2 MiB; a Pour Over schema 5; then the uploads. |
| `baseline-errors` | `/last` 204, `/pour-over/last` 500, then `../evil/x.json` (`history_path_invalid`, backoff 4 s), then a good one. |
| `connection-drop` | the server reads the request and closes the connection without answering: an upload (`upload_network`), then a history index (`machine_history_unavailable`); the backoffs. |
| `enrollment-expiry` | a pairing issued 896 s ago: one exchange (202, Retry-After 6), then expired locally (`pairing_code_expired`); disconnect while not connected is a reset. |
| `response-shapes` | token answer not JSON, then one with extra fields and a non-numeric server time; Retry-After as an HTTP date; an error code to sanitize (`Busy-Now!` → `usyow`); a chunked success. |
| `redirects` | 307 to another host keeps the POST and its body and drops Authorization; 301 and 303 on GETs; 302 keeps a DELETE and its body; Referer. |
| `redirect-loop` | a redirect to itself: the request and 10 redirects, then a send() error and the 2 s backoff. |

Not covered here (unit tests cover them: `tst_community_model`, `tst_community_service`): the queue bounds
(128 items, 64 MiB) and full index pages (200 entries), token renewal after its 240 s (needs a clock seam the
Rust does not have), the one-time state migrations, TLS. Nothing here talks to the real server; that test is
to be done later with Alu.

## Results

2026-10-24, after the fixes below: 16 of 16 scenarios pass, three full runs in a row with no rerun. The
request streams are identical but for the checked placeholders; no request difference is explained away
(the only explained difference is the Qt-only start log line). The same harness run against the committed
QNetworkAccessManager client (built from `HEAD` into `qt/build/contract-baseline`) still fails, as it should
(`history-upload`: the path bytes; `connection-drop`: the replay). The community unit tests pass:
`tst_community_model` 79/79, `tst_community_service` 31 passed, 1 skipped (the interop case without its
helper), and `interopWithTheTauriUploader` passes with its helper (built into `qt/build/contract-interop`).
Unit tests built in `qt/build/contract-unit` with `-DDIAL_WITH_SENTRY=OFF`: `qt/CMakeLists.txt` now downloads
sentry-native at configure time, which a `--network none` build cannot.

## Differences found and fixed

The first run (Qt's uploader on QNetworkAccessManager) failed 14 of 14 scenarios. All differences were in
the HTTP layer; the uploader's logic (every request, body, signature, retry order and backoff, command
answer and state.json) already matched. Fixed by writing HTTP/1.1 directly over `QTcpSocket`/`QSslSocket`
in `qt/src/community/http.cpp` (QNetworkAccessManager cannot be configured out of any of these), and by
giving the machine requests their exact target bytes (`machineHistoryFileTarget`/`ListTarget` in `model.cpp`,
`HttpRequest::target`).

| # | Difference (Rust → Qt before) | Before | After |
|---|---|---|---|
| 1 | **A request resent with the same nonce, request id and signature.** When the server closes the connection without answering, hyper reports an error: the uploader records `upload_network` / `machine_history_unavailable`, backs off (2 s, then 4 s) and later signs a new request. QNetworkAccessManager resent the written request at once, on a new connection (seen for the upload POST and the history GET; its channel retries any method after `RemoteHostClosedError` while waiting for the answer). A real Community server rejects that as a replay. | `connection-drop`: Qt's request 2 in the same tick with request 1's nonce and request id; no failure recorded (`lastError` null instead of `machine_history_unavailable`), no backoff | the request is never written again; same stream, errors and backoffs as Rust |
| 2 | `cache-control: no-cache` and `pragma: no-cache` on every GET (from `CacheLoadControlAttribute = AlwaysNetwork`) | on the machine requests | not sent |
| 3 | `accept-encoding: identity` on every request (reqwest, built without compression, sends none) | every request | not sent |
| 4 | `connection: Keep-Alive` and `accept-language: en,*` (the locale's), which QNetworkAccessManager always adds | every request | not sent |
| 5 | The history file path: the url crate keeps `\|` and `^` in a path segment, QUrl encoded them (`%7C`, `%5E`) | `.../odd%20name%20[x]%7C%5E~...` | `.../odd%20name%20[x]\|^~...` |
| 6 | The `after=` cursor: `form_urlencoded` writes `~` as `%7E`, QUrl decoded it to `~` | `after=...%5E~%C3%A9...` | `after=...%5E%7E%C3%A9...` |
| 7 | Redirects: QNetworkAccessManager's own rules (no Referer, a POST made a GET kept its Content-Type, its no-less-safe policy). Now reqwest 0.12 / tower-http 0.6's: at most 10; 301/302 make only a POST a GET, 303 anything, both without the body and its headers; 307/308 keep both; `referer` set (not from https to http); Authorization dropped for another host or port. | not compared before (the `redirects` scenarios are new) | identical to Rust |
| 8 | A repeated response header: Qt joined the values, reqwest reads the first (only mattered for a doubled Retry-After) | — | the first, as Rust (unit test) |

Also aligned while at it: header names in lower case and in hyper's order (the request's headers,
`content-length`, `accept`, `user-agent`, `host`), not compared but now the same bytes.

Not a C++ difference, noted for the server: following a redirect sends the signed headers again, nonce
included (reqwest does, so the Qt port does as well; the `redirects` scenario shows it). A Community
deployment that redirects signed requests would see them as replays at the target.

## Remaining differences (not in the request bytes)

- Connections: reqwest keeps idle connections for reuse; the Qt client opens one per request (and closes
  it). Same requests; one more TCP/TLS handshake per request on the machine.
- Proxies: reqwest honors `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`/`NO_PROXY`; the Qt client uses none (the
  machine sets none).
- TLS: rustls with bundled webpki roots vs Qt's OpenSSL backend with the system CA store (`ca-certificates`),
  both TLS 1.2+, ALPN `http/1.1`, SNI and hostname verification. Not testable here: no network, and the Rust
  client trusts only its bundled roots, so it cannot talk to a local TLS fake. To check against the real
  server (with Alu).
- The timeouts: 5 s for TCP + TLS and 15 s in all, as reqwest's `connect_timeout`/`timeout`; Qt measures
  them with its timers, reqwest with tokio's.

## Files

`qt/tests/community-contract/`: `run.sh`, `contract.py`, `scenarios.py`, `ed25519_ref.py`, `rust/`
(`Cargo.toml`, `Cargo.lock`, `src/main.rs`), `cpp/` (`CMakeLists.txt`, `main.cpp`). Build output in
`qt/build/contract-rust`, `qt/build/contract-cpp`, `qt/build/contract-report`.
