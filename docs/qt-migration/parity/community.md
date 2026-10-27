# Parity: community (the Community shot uploader, C++)

The Tauri Dial's uploader (`src-tauri/src/community_upload.rs`, `community_upload/diagnostics.rs`, the
`CommunityUploadRuntime` setup and the six `community_*` commands of `src-tauri/src/lib.rs`) ported to
C++/Qt and exposed to QML as the `Community` singleton of `Dial.Native`. Same files, formats, endpoints,
signatures, retries and diagnostics on the machine: the Qt Dial and the Tauri Dial take over each other's
enrollment and queue without losing either or uploading a shot twice. That is checked against the real
Rust code (see "Tests").

Files: `qt/src/community.h/.cpp` (QML singleton, worker thread, command thread), `qt/src/community/`
(`json` serde_json-compatible JSON, `crypto` Ed25519/SHA-256/base64url/UUID, `model` state and rules,
`storage` disk, `diagnostics`, `http` client, `service` the state machine), `qt/tests/unit/` (tests),
`qt/tests/e2e/test_community.py`.

## QML API

| API | Tauri command / React | Notes |
|---|---|---|
| `Community.status` (QVariantMap, NOTIFY `statusChanged`) | `community_upload_status`, `useCommunityUploadStatus` (refetch 1 s) | camelCase keys `state` (`not_connected` / `connected` / `upload_paused` / `unavailable`), `connected`, `paused`, `pendingCount`, `lastSuccessAt`, `lastError`, `lastRetryAt`, `enrollmentExpiresAt`; absent values are JS `null`. Refreshed every second, after every worker tick that changed it and after every call; `statusChanged` only fires on a change. |
| `beginEnrollment(serial)` → `enrollmentResult({qrUrl, expiresAt} \| {error})` | `community_begin_enrollment` | runs on the command thread (state.json write). Empty serial = none. |
| `setUploadPaused(bool)` → `operationFinished("setUploadPaused", error)` | `community_set_upload_paused` | `""` = ok |
| `disconnect()` → `operationFinished("disconnect", error)` | `community_disconnect` (spawn_blocking) | network: revoke, then local reset |
| `factoryResetLocal()` → `""` or error | `community_factory_reset_local` | synchronous on purpose: the factory reset must finish it before the backend wipes the machine |
| `scanHistory()` → `""` or error | `community_scan_history` | asks for a history scan at the next tick |

When the storage cannot be used every call answers "Community upload storage is unavailable. The Dial can
still brew normally." and `status.state` is `unavailable` with the init error in `lastError` (as Rust).

## Feature table

| Feature | Rust source | Qt file | Status | Notes |
|---|---|---|---|---|
| Runtime init, unavailable fallback, `initialization_failed` log | `CommunityUploadRuntime::initialize`, `CommunityUploadService::new` | `community.cpp`, `service.cpp` (`create`) | done | dirs, state, orphans, then the base URL checks, in the Rust order and with its error strings |
| Paths: `$CONFIG_PATH/community-upload/{state.json, queue/<uuid>.json, diagnostics.json}`, default `/meticulous-user/config` | `new`, `config.rs` | `Community::storageRoot` | done | see "Differences" for the dev fallback |
| `COMMUNITY_API_BASE` (default `https://community.meticuloushome.com`), `MACHINE_API_BASE` (default `http://localhost:8080`) | `new` | `community.cpp` | done | `MACHINE_API_BASE` unset: the Dial's `--api` URL (the same on the machine) |
| Private dirs 0700, files 0600, atomic write (exclusive temp, fsync, rename, fsync dir) | `create_private_dir`, `write_private_file_atomic` | `storage.cpp` | done | |
| state.json format | `PersistentState`, `QueuedShot`, `EnrollmentState` (serde camelCase) | `model.cpp` (`serializeState`, `parseState`) | done | byte-identical to `serde_json::to_vec` (struct order, compact, `null`s, i64::MAX kept); serde's rules on read (missing `Option` = null, `#[serde(default)]` for `historyKind` / `pourOverHistory*`, strict number kinds, duplicate fields rejected, UUID forms) |
| `validate_state` (seed decodes to 32 bytes, public key matches) | `validate_state` | `model.cpp` | done | |
| One-time migrations on load: parked Pour Overs reactivated, fractional-sample replay | `reactivate_deployment_blocked_pour_overs`, `schedule_fractional_sample_rejection_replay` | `model.cpp`, `storage.cpp` | done | written back only when they change something |
| Orphaned queue bodies removed at start (regular files only) | `remove_orphaned_queue_files` | `storage.cpp` | done | |
| Ed25519 identity from a 32-byte seed, base64url no-pad, UUID v4 installation id, identity rotation keeping the queue | `fresh_state`, `rotate_identity_preserving_queue`, ed25519-dalek | `crypto.cpp` (OpenSSL libcrypto), `model.cpp` | done | matches the cross-language vector `src-tauri/test-vectors/machine-upload-v1.json` |
| Enrollment: 32-byte challenge, QR link `<base>/my-setup/machine/connect?enrollment=<base64url(json)>`, payload keys sorted as `json!`, serial trimmed to 128 chars, 10 min TTL + 5 min exchange grace, `pairing_code_expired` | `begin_enrollment`, `expire_local_enrollment`, `enrollment_exchange_expired` | `service.cpp`, `model.cpp` | done | the payload is byte-identical to Rust's for the same enrollment |
| Exchange: `meticulous-enrollment-exchange-v1` canonical string and headers, 202 + Retry-After (default 2 s), permanent refusal forgets the enrollment, token kept 240 s | `try_exchange`, `enrollment_headers` | `service.cpp`, `model.cpp` | done | |
| Signed machine requests: `meticulous-machine-request-v1` canonical, `x-meticulous-*` headers, 24-byte nonce, request id, server clock offset from `x-meticulous-server-time` | `signed_headers`, `update_server_clock` | `model.cpp`, `service.cpp` | done | |
| Token: signed `POST /token` `{"contractVersion":1}`, cached until 20 s before its 240 s, retirement on `not_authorized` / `retired_key` / `retired_or_revoked_access` | `ensure_access_token`, `retire_local_authorization` | `service.cpp` | done | |
| History scan: baseline from `/api/v1/history/last` and `/pour-over/last` (404/204 = none), then `/upload-index?max_results=200&after=` and `/pour-over?sort=asc&max_results=200&after=`, entries `file`/`url`/`name`, normalized, sorted (UTF-8 bytes), deduplicated; 60 s cadence, 5 s when a page was full or the queue is full | `observe_new_shots`, `observe_new_pour_overs`, `fetch_*`, `normalize_history_path` | `service.cpp`, `model.cpp` | done | query values form-encoded as `url`'s `query_pairs_mut` does, path segments encoded as `path_segments_mut().push` |
| Queueing: file fetch bounded at 2 MiB, record validation (espresso `data`; Pour Over type, schema 1-4, mode, ≤ 3001 samples with `t` in [0, 600000], duration, ≤ 128 pours / targets), envelope `{"contractVersion":1,"shot":<raw bytes>}` without reserializing, queue ≤ 128 items and ≤ 64 MiB, cursor advanced with the queued item, permanent record failures skipped | `queue_history_path`, `validate_history_record`, `ensure_queue_capacity`, `skip_history_path` | `service.cpp`, `model.cpp` | done | |
| Upload: signed `POST /shots`, `Authorization: Bearer`, `x-meticulous-idempotency-key` = sha256(`meticulous-machine-shot-idempotency-v1\n<installation>\n<source id>\n`), success removes item and body | `upload_next_shot`, `idempotency_key`, `complete_queue_item` | `service.cpp` | done | |
| Failure classification: category from `{"error"}` (sanitized), Retry-After, permanent 4xx except 401/408/429, 409 except `replayed_request`; token dropped on `invalid_access` / `expired_request`; permanent rejections dropped with their body; Pour Over 404/405/415/422/`invalid_json`/`invalid_shot` → `community_pour_over_not_ready` retried in 15 min without a worker backoff; item backoff 2^n ≤ 300 s | `response_failure`, `failure_is_permanent`, `reclassify_upload_failure`, `schedule_queue_retry`, `discard_rejected_queue_item`, `defer_queue_item` | `model.cpp`, `service.cpp` | done | |
| Worker loop: 500 ms, backoff 2^n ≤ 30 s or Retry-After (≥ 1 s), `last_error` / `last_retry_at` recorded | `start`, `record_worker_failure`, `record_retry` | `community.cpp` (`CommunityWorker`), `service.cpp` | done | low-priority thread |
| Disconnect: token + signed `DELETE /installations/current`; a retired authorization counts as done; failure → "Could not disconnect from Community. Check the internet connection and try again." and a 5 s retry record | `disconnect`, `revoke_current` | `service.cpp` | done | |
| Local factory reset: fresh identity, queue bodies deleted, volatile state cleared | `factory_reset_local` | `service.cpp` | done | |
| Diagnostics: allowlisted categories (else `other_error`), one log line per (category, HTTP status) per 5 min, request id kept, `upload_resumed` after a durable completion, `diagnostics.json` snapshot (0600) at most every 30 s, write failure/recovery logs | `diagnostics.rs` | `diagnostics.cpp` | done | same JSON (sorted keys) |
| HTTP client: connect 5 s, total 15 s, User-Agent `meticulous-dial-community-upload-v1`, HTTP/1.1, no cookies, no compression, control responses ≤ 256 KiB; the request bytes reqwest sends (headers, exact targets, no resend of a written request, reqwest's redirects) | reqwest `Client::builder` (0.12, hyper 1, tower-http 0.6) | `http.cpp` (HTTP/1.1 over `QTcpSocket`/`QSslSocket`) | done | compared request by request with the Rust: [community-contract.md](community-contract.md); see "Differences" |
| Log lines `[CommunityUpload] queued / upload_succeeded / upload_deferred / upload_rejected_permanently / history_rejected / failure {...}` | `log::*` | `service.cpp`, `diagnostics.cpp` | done | through Qt's message handler (journal priorities) |
| `config.rs` (`config.yml` profile order) | `config.rs` | — | not applicable | not used by the uploader; only `CONFIG_PATH` is shared |

## Differences on purpose

- Storage root on a development machine: with no `CONFIG_PATH` and no `/meticulous-user`, the uploader uses
  `<temp>/meticulous-dial-config/community-upload` (what the Rust debug build does) instead of failing; on
  the machine it is `/meticulous-user/config/community-upload`, as the release Tauri Dial.
- `MACHINE_API_BASE` falls back to the Dial's `--api` URL (`http://localhost:8080` on the machine, like Rust's
  default), so a dev Dial reads the history of its own backend.
- `status` is a copy published after every state change: the GUI thread never waits for a state.json fsync.
  `scanHistory()` sets a flag the worker applies at its next tick (Rust zeroes the timer under the state
  lock); a request made during a scan is no longer lost.
- Commands run one at a time, in order, on one command thread (Tauri ran them on its command threads).
  `factoryResetLocal()` and `scanHistory()` return their result synchronously (the API asks for a string).
- A failed atomic write removes its temporary file (Rust leaves it; startup cleaned only the queue dir).
- TLS: `QSslSocket` (Qt's OpenSSL backend) with the system CA store (`/etc/ssl/certs`), TLS 1.2+, ALPN
  `http/1.1`, where reqwest used rustls with bundled webpki roots. The machine needs `ca-certificates` (below).
- HTTP is written over `QTcpSocket`/`QSslSocket` rather than QNetworkAccessManager, which resent a request
  (same nonce and signature) when the server closed the connection before answering, added Connection,
  Accept-Language, Accept-Encoding (and Cache-Control/Pragma on GETs) and re-encoded URLs; see
  [community-contract.md](community-contract.md). What remains different: one connection per request
  (reqwest keeps idle ones for reuse), and `HTTP(S)_PROXY` variables are not honored (reqwest honors them;
  the machine sets none).
- At shutdown the request in flight is aborted and not recorded as a failure (the Tauri process just died).
- OpenSSL unable to make a key (not seen in practice) gives the storage-unavailable error instead of a panic.
- JSON: an own parser with serde_json's semantics (number kinds `4` / `4.0` / `-3`, strict grammar, UTF-8
  and surrogate checks, 127 levels), because QJsonDocument turns `4.0` into an integer. Not reproduced:
  serde's acceptance of a JSON array as a struct (`["token"]` as a TokenResponse).

## Not done

- The arm64 unit tests are built but not run (no qemu in this environment); the amd64 ones run in the
  container. Nothing was run on a machine or against the real Community server (not allowed here); the
  protocol is checked against the Rust code and the cross-language vector instead.

## Runtime packages (.deb Depends)

- `libssl3` (libcrypto.so.3: Ed25519; also what Qt's TLS plugin loads)
- `ca-certificates` (HTTPS to community.meticuloushome.com through the system CA store)
- `libqt6network6` (already needed; ships the `tls/libqopensslbackend.so` plugin)

Build: `libssl-dev` and `libssl-dev:arm64`, added as a new last layer of `qt/docker/Dockerfile.bookworm`
(the local `qt-dial-bookworm` image was rebuilt with it).

## Tests

- `qt/tests/unit/tst_community_model.cpp` (QtTest totals: 79 passed): every Rust test of `community_upload.rs` and
  `diagnostics.rs` that is pure (enrollment grace, raw envelope, Pour Over validation incl. `403.0` and the
  bounds, path traversal, permanent classes, Pour Over reclassification, bounded backoff, reactivation,
  replay, queue bounds, due-item order, identity rotation, serde defaults, snapshot sanitizing, reporter
  0600 and 30 s limit, log suppression), the cross-language vector (public key, body hash, canonical
  string, signature, idempotency key, OpenSSL verify), the JSON parser against serde_json's rules,
  state.json byte compatibility, URLs, the QR payload.
- `qt/tests/unit/tst_community_service.cpp` (31 passed, 1 skipped: the interop case without its helper): the state machine against a fake machine
  and a fake Community server that verifies every signature (enroll → 202 → exchange → baseline → queue →
  upload; token refresh; 503/401/409/retired/Pour Over 422; exchange refusal; expiry; pause; disconnect
  ok / offline / retired; factory reset; skipped and pending records; queue and page bounds; worker backoff;
  vanished bodies; init errors; taking over a Tauri state), the port of `diagnostics.rs`'
  `queue_persist_failures_preserve_diagnostics_until_upload_completes`, the HTTP client against a local
  server (reqwest's exact header set, exact targets, no cookies, body bounds, timeouts, refused connection,
  stop, no resend after a connection closed unanswered, reqwest's redirect rules) and its response reader
  (interim responses, chunked, LF lines, Content-Length rules), and the QML singleton end to end with its
  threads (enroll, worker exchange, pause, disconnect, diagnostics.json, unavailable).
- The contract test against the real Rust code, `bash qt/tests/community-contract/run.sh`: both uploaders
  against the same local fake Community server and machine, 16 scenarios, compared request by request
  (headers, bodies, signatures, retries and their timing, command answers, state.json). Passes; see
  [community-contract.md](community-contract.md).
- Interop with the real Rust code, `bash qt/tests/unit/community-interop/run.sh` (cargo builds
  `community_upload.rs` itself, offline): the Tauri uploader reads a Qt-written state and queue, uploads both
  shots with signatures and idempotency keys the server accepts, and the Qt Dial reads the result; a
  Tauri-started enrollment is finished by the Qt Dial with the Rust-made key; Rust-written state.json files
  re-serialize byte for byte. Passes.
- Run the unit tests: `cmake -S qt -B qt/build/tests-amd64 -G Ninja -DDIAL_BUILD_TESTS=ON && cmake --build
  qt/build/tests-amd64 && (cd qt/build/tests-amd64 && ctest --output-on-failure)` in `qt-dial-bookworm`.
  Result: 2/2 suites pass.
- `qt/tests/e2e/test_community.py` (3): the singleton's status shape, `scanHistory()` and the API in a running
  Dial. Passes. It does not enroll (see below).

## Requests for the core

- `qt/scripts/run-dev.sh`: pass `COMMUNITY_API_BASE` (and `CONFIG_PATH`) into the container. A dev Dial that
  starts an enrollment otherwise polls the production Community server every 2 s until the code expires.
- `qt/scripts/build.sh` builds the image only when it is missing: a checkout with an older `qt-dial-bookworm`
  needs `docker build -t qt-dial-bookworm -f qt/docker/Dockerfile.bookworm qt/docker` once for libssl-dev.
- The .deb packaging (not in the tree yet): add `libssl3, ca-certificates` to Depends.
