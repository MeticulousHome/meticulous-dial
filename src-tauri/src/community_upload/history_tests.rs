use super::*;
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::JoinHandle;
use std::time::Instant;

const ESPRESSO_PATH: &str = "2026-09-24/0001.shot.json.zst";
const POUR_PATH: &str = "2026-09-24/0002.pour-over.json";

struct Reply {
    status: u16,
    body: Vec<u8>,
    declared_length: Option<usize>,
}

impl Reply {
    fn json(value: Value) -> Self {
        Self::bytes(200, serde_json::to_vec(&value).unwrap())
    }

    fn bytes(status: u16, body: impl Into<Vec<u8>>) -> Self {
        let body = body.into();
        Self {
            status,
            declared_length: Some(body.len()),
            body,
        }
    }
}

// Real blocking HTTP, bounded at both ends. Each server belongs to one test;
// neither service configuration nor process environment is shared between tests.
struct MachineServer {
    base: Url,
    requests: Arc<Mutex<Vec<String>>>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl MachineServer {
    fn start(route: impl Fn(&Url) -> Reply + Send + 'static) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let base = Url::parse(&format!("http://{}", listener.local_addr().unwrap())).unwrap();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let stop = Arc::new(AtomicBool::new(false));
        let server_requests = Arc::clone(&requests);
        let server_stop = Arc::clone(&stop);
        let server_base = base.clone();
        let thread = thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(30);
            while !server_stop.load(Ordering::Relaxed) && Instant::now() < deadline {
                let (mut stream, _) = match listener.accept() {
                    Ok(connection) => connection,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(2));
                        continue;
                    }
                    Err(error) => panic!("test HTTP listener failed: {error}"),
                };
                stream.set_nonblocking(false).unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(1)))
                    .unwrap();
                stream
                    .set_write_timeout(Some(Duration::from_secs(1)))
                    .unwrap();
                let mut request = Vec::new();
                let mut bytes = [0; 2048];
                while !request.windows(4).any(|window| window == b"\r\n\r\n") {
                    match stream.read(&mut bytes) {
                        Ok(0) | Err(_) => break,
                        Ok(count) => request.extend_from_slice(&bytes[..count]),
                    }
                    assert!(request.len() < 32 * 1024, "test request headers too large");
                }
                let text = String::from_utf8_lossy(&request);
                let Some(target) = text
                    .lines()
                    .next()
                    .and_then(|line| line.split_whitespace().nth(1))
                else {
                    continue;
                };
                let declared_body = text
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse::<usize>().unwrap())
                    })
                    .unwrap_or(0);
                assert!(declared_body <= MAX_SHOT_BODY_BYTES);
                let received_body = request.len()
                    - request
                        .windows(4)
                        .position(|window| window == b"\r\n\r\n")
                        .unwrap()
                    - 4;
                let mut remaining = declared_body.saturating_sub(received_body);
                while remaining > 0 {
                    let wanted = remaining.min(bytes.len());
                    match stream.read(&mut bytes[..wanted]) {
                        Ok(0) | Err(_) => break,
                        Ok(count) => remaining -= count,
                    }
                }
                server_requests.lock().unwrap().push(target.to_string());
                let response = route(&server_base.join(target).unwrap());
                let header = format!(
                    "HTTP/1.1 {} Test\r\nContent-Type: application/json\r\n{}Connection: close\r\n\r\n",
                    response.status,
                    response
                        .declared_length
                        .map(|length| format!("Content-Length: {length}\r\n"))
                        .unwrap_or_default(),
                );
                let _ = stream.write_all(header.as_bytes());
                let _ = stream.write_all(&response.body);
            }
        });
        Self {
            base,
            requests,
            stop,
            thread: Some(thread),
        }
    }

    fn requests(&self) -> Vec<String> {
        self.requests.lock().unwrap().clone()
    }
}

impl Drop for MachineServer {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let result = thread.join();
            if !thread::panicking() {
                result.expect("test HTTP server panicked");
            }
        }
    }
}

struct TestService {
    service: CommunityUploadService,
    root: PathBuf,
}

impl TestService {
    fn new(server: &MachineServer, baselined: bool) -> Self {
        let root = env::temp_dir().join(format!("dial-history-test-{}", Uuid::new_v4()));
        let queue_dir = root.join("queue");
        create_private_dir(&queue_dir).unwrap();
        let state_path = root.join("state.json");
        let mut persistent = fresh_state().unwrap();
        persistent.authorization_id = Some(Uuid::new_v4());
        persistent.key_id = Some(Uuid::new_v4());
        persistent.key_version = Some(1);
        persistent.history_baselined = baselined;
        persistent.pour_over_history_baselined = baselined;
        persist_state(&state_path, &persistent).unwrap();
        let service = CommunityUploadService {
            inner: Arc::new(Inner {
                state: Mutex::new(RuntimeState {
                    persistent,
                    volatile: VolatileState::default(),
                }),
                state_path,
                queue_dir,
                community_base: server.base.clone(),
                machine_base: server.base.clone(),
                client: Client::builder()
                    .no_proxy()
                    .timeout(Duration::from_secs(2))
                    .build()
                    .unwrap(),
            }),
        };
        Self { service, root }
    }

    fn state(&self) -> PersistentState {
        self.service.inner.state.lock().unwrap().persistent.clone()
    }

    fn reload(&self) {
        let persistent = load_or_create_state(&self.service.inner.state_path).unwrap();
        self.service.inner.state.lock().unwrap().persistent = persistent;
    }
}

impl Drop for TestService {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn espresso() -> Value {
    json!({"id": "espresso-1", "data": [{"time": 100, "pressure": 8, "weight": 2}]})
}

fn pour_over() -> Value {
    json!({
        "id": "pour-1", "brewType": "pour_over", "schemaVersion": 4, "mode": "free_pour",
        "samples": [{"t": 0.0, "weight": 0.0}, {"t": 101.5, "weight": 1.2}],
        "pours": [], "recipe": {"pourTargets": []}, "measurements": {"durationMs": 102}
    })
}

fn index(paths: &[String]) -> Reply {
    Reply::json(
        json!({"history": paths.iter().map(|file| json!({"file": file})).collect::<Vec<_>>()}),
    )
}

#[test]
fn initial_espresso_baseline_reads_only_latest_file_metadata() {
    let server = MachineServer::start(|url| match url.path() {
        "/api/v1/history/upload-index/last" => Reply::json(json!({"file": ESPRESSO_PATH})),
        // A formerly fatal valid full record must never be requested.
        "/api/v1/history/last" => {
            Reply::json(json!({"file": ESPRESSO_PATH, "data": "x".repeat(350_000)}))
        }
        _ => Reply::bytes(500, "unexpected route"),
    });
    let fixture = TestService::new(&server, false);
    assert!(fixture.service.observe_new_shots().unwrap());
    let state = fixture.state();
    assert!(state.history_baselined);
    assert_eq!(state.history_cursor.as_deref(), Some(ESPRESSO_PATH));
    assert!(
        state.queue.is_empty(),
        "pre-enrollment history must not upload"
    );
    assert_eq!(server.requests(), ["/api/v1/history/upload-index/last"]);
}

#[test]
fn empty_metadata_baselines_but_invalid_metadata_does_not() {
    for value in [json!({"file": null}), json!({}), json!({"file": 123})] {
        let empty = value == json!({"file": null});
        let server = MachineServer::start(move |_| Reply::json(value.clone()));
        let fixture = TestService::new(&server, false);
        let result = fixture.service.observe_new_shots();
        assert_eq!(result.is_ok(), empty);
        assert_eq!(fixture.state().history_baselined, empty);
        assert!(fixture.state().history_cursor.is_none());
    }
}

#[test]
fn older_backends_take_one_latest_snapshot_then_queue_new_brews() {
    for unavailable in [404, 405] {
        let latest_before_pairing = "2026-09-23/0001.shot.json.zst";
        let server = MachineServer::start(move |url| match url.path() {
            "/api/v1/history/upload-index/last" => Reply::bytes(unavailable, ""),
            "/api/v1/history" => {
                let query = url.query_pairs().collect::<Vec<_>>();
                assert!(
                    query
                        .iter()
                        .any(|(key, value)| key == "sort" && value == "desc")
                );
                assert!(
                    query
                        .iter()
                        .any(|(key, value)| key == "max_results" && value == "1")
                );
                assert!(
                    query
                        .iter()
                        .any(|(key, value)| key == "dump_data" && value == "false")
                );
                assert!(!query.iter().any(|(key, _)| key == "after"));
                Reply::json(
                    json!({"history": [{"file": latest_before_pairing, "profile": {"name": "Previous espresso"}}]}),
                )
            }
            "/api/v1/history/upload-index" => {
                assert!(
                    url.query_pairs()
                        .any(|(key, value)| key == "after" && value == latest_before_pairing)
                );
                index(&[ESPRESSO_PATH.to_string()])
            }
            path if path == format!("/api/v1/history/files/{ESPRESSO_PATH}") => {
                Reply::json(espresso())
            }
            _ => Reply::bytes(500, "unexpected route"),
        });
        let fixture = TestService::new(&server, false);
        assert!(fixture.service.observe_new_shots().unwrap());
        assert!(fixture.state().history_baselined);
        assert_eq!(
            fixture.state().history_cursor.as_deref(),
            Some(latest_before_pairing)
        );
        assert!(fixture.state().queue.is_empty());
        assert_eq!(
            server.requests().len(),
            2,
            "baseline must finish in one snapshot"
        );
        fixture.reload();
        assert!(fixture.service.observe_new_shots().unwrap());
        assert_eq!(
            fixture.state().history_cursor.as_deref(),
            Some(ESPRESSO_PATH)
        );
        assert_eq!(
            fixture.state().queue.len(),
            1,
            "post-baseline brew must not be absorbed into baseline"
        );
        assert_eq!(server.requests().len(), 4);
        assert!(
            !server
                .requests()
                .iter()
                .any(|request| request == "/api/v1/history/last")
        );
    }
}

#[test]
fn legacy_latest_snapshot_accepts_large_profile_metadata_without_samples() {
    let response = json!({"history": [{"file": ESPRESSO_PATH, "profile": {
        "name": "Imported profile", "image": "x".repeat(350_000)
    }}]});
    let bytes = serde_json::to_vec(&response).unwrap();
    assert!(bytes.len() > MAX_CONTROL_RESPONSE_BYTES && bytes.len() < MAX_SHOT_BODY_BYTES);
    let server = MachineServer::start(move |url| match url.path() {
        "/api/v1/history/upload-index/last" => Reply::bytes(404, ""),
        "/api/v1/history" => Reply::bytes(200, bytes.clone()),
        _ => Reply::bytes(500, "unexpected route"),
    });
    let fixture = TestService::new(&server, false);
    assert!(fixture.service.observe_new_shots().unwrap());
    assert!(fixture.state().history_baselined);
    assert_eq!(
        fixture.state().history_cursor.as_deref(),
        Some(ESPRESSO_PATH)
    );
    assert!(fixture.state().queue.is_empty());
}

#[test]
fn empty_legacy_snapshot_baselines_but_oversized_profile_does_not() {
    for oversized in [false, true] {
        let server = MachineServer::start(move |url| match url.path() {
            "/api/v1/history/upload-index/last" => Reply::bytes(404, ""),
            "/api/v1/history" if oversized => Reply::json(
                json!({"history": [{"file": ESPRESSO_PATH, "profile": {"image": "x".repeat(MAX_SHOT_BODY_BYTES)}}]}),
            ),
            "/api/v1/history" => index(&[]),
            _ => Reply::bytes(500, "unexpected route"),
        });
        let fixture = TestService::new(&server, false);
        let result = fixture.service.observe_new_shots();
        if oversized {
            assert_eq!(
                result.unwrap_err().category,
                "machine_history_response_too_large"
            );
        } else {
            assert!(result.unwrap());
        }
        assert_eq!(fixture.state().history_baselined, !oversized);
        assert!(fixture.state().history_cursor.is_none());
        assert!(fixture.state().queue.is_empty());
    }
}

#[test]
fn normal_discovery_rejects_nonadvancing_pages_without_advancing_cursor() {
    let paths = (0..200)
        .map(|number| format!("2026-09-23/{number:04}.shot.json.zst"))
        .collect::<Vec<_>>();
    let last = paths.last().unwrap().clone();
    let server = MachineServer::start(move |url| match url.path() {
        "/api/v1/history/upload-index" => index(&paths),
        _ => Reply::bytes(500, "unexpected route"),
    });
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .mutate_persistent(|state| {
            state.history_cursor = Some(last.clone());
            Ok(())
        })
        .unwrap();
    let error = fixture.service.observe_new_shots().unwrap_err();
    assert_eq!(error.category, "machine_history_invalid");
    assert!(fixture.state().history_baselined);
    assert_eq!(
        fixture.state().history_cursor.as_deref(),
        Some(last.as_str())
    );
    assert!(fixture.state().queue.is_empty());
    assert_eq!(server.requests().len(), 1);
}

#[test]
fn espresso_discovery_failures_do_not_starve_pour_overs_or_advance_espresso() {
    for (kind, category) in [
        (0, "machine_history_invalid"),
        (1, "machine_history_response_too_large"),
        (2, "machine_history_read_failed"),
        (3, "machine_history_unavailable"),
        (4, "machine_history_response_too_large"),
    ] {
        let server = MachineServer::start(move |url| match url.path() {
            "/api/v1/history/upload-index" => match kind {
                0 => Reply::bytes(200, "not JSON"),
                1 => Reply::json(
                    json!({"history": [], "padding": "x".repeat(MAX_CONTROL_RESPONSE_BYTES)}),
                ),
                2 => Reply {
                    status: 200,
                    body: b"{\"history\":".to_vec(),
                    declared_length: Some(100),
                },
                4 => Reply {
                    status: 200,
                    body: serde_json::to_vec(
                        &json!({"history": [], "padding": "x".repeat(MAX_CONTROL_RESPONSE_BYTES)}),
                    )
                    .unwrap(),
                    declared_length: None,
                },
                _ => Reply::bytes(503, "temporarily unavailable"),
            },
            "/api/v1/history/pour-over" => index(&[POUR_PATH.to_string()]),
            path if path == format!("/api/v1/history/pour-over/files/{POUR_PATH}") => {
                Reply::json(pour_over())
            }
            _ => Reply::bytes(500, "unexpected route"),
        });
        let fixture = TestService::new(&server, true);
        let error = fixture.service.worker_tick().unwrap_err();
        assert_eq!(error.category, category);
        let state = fixture.state();
        assert_eq!(
            state.queue.len(),
            1,
            "failure {category} starved pour-over discovery"
        );
        assert_eq!(state.queue[0].history_kind, HistoryKind::PourOver);
        assert_eq!(state.pour_over_history_cursor.as_deref(), Some(POUR_PATH));
        assert!(state.history_cursor.is_none());
        let persisted = load_or_create_state(&fixture.service.inner.state_path).unwrap();
        assert_eq!(persisted.queue.len(), 1);
    }
}

#[test]
fn pour_over_failure_preserves_successful_espresso_discovery() {
    let server = MachineServer::start(|url| match url.path() {
        "/api/v1/history/upload-index" => index(&[ESPRESSO_PATH.to_string()]),
        path if path == format!("/api/v1/history/files/{ESPRESSO_PATH}") => Reply::json(espresso()),
        "/api/v1/history/pour-over" => Reply::bytes(200, "not JSON"),
        _ => Reply::bytes(500, "unexpected route"),
    });
    let fixture = TestService::new(&server, true);
    assert_eq!(
        fixture.service.worker_tick().unwrap_err().category,
        "machine_pour_over_history_invalid"
    );
    let state = fixture.state();
    assert_eq!(state.queue.len(), 1);
    assert_eq!(state.queue[0].history_kind, HistoryKind::Espresso);
    assert_eq!(state.history_cursor.as_deref(), Some(ESPRESSO_PATH));
    assert!(state.pour_over_history_cursor.is_none());
}

#[test]
fn actual_shot_bodies_larger_than_metadata_limit_are_still_durably_queued() {
    let mut shot = espresso();
    shot["data"] = Value::Array(vec![
        json!({"time": 1000, "pressure": 9.1, "flow": 2.3, "weight": 24.0});
        9000
    ]);
    let raw = serde_json::to_vec(&shot).unwrap();
    assert!(raw.len() > MAX_CONTROL_RESPONSE_BYTES && raw.len() + 64 < MAX_SHOT_BODY_BYTES);
    let server = MachineServer::start(move |_| Reply::bytes(200, raw.clone()));
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap();
    fixture.reload();
    let state = fixture.state();
    assert_eq!(state.queue.len(), 1);
    assert_eq!(state.history_cursor.as_deref(), Some(ESPRESSO_PATH));
    let stored: Value = serde_json::from_slice(
        &fs::read(
            fixture
                .service
                .inner
                .queue_dir
                .join(&state.queue[0].body_file),
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(stored["shot"], shot);
}

#[test]
fn queue_state_storage_failure_keeps_cursor_retryable_without_duplicate_body() {
    let server = MachineServer::start(|_| Reply::json(espresso()));
    let fixture = TestService::new(&server, true);
    let state_path = &fixture.service.inner.state_path;
    fs::remove_file(state_path).unwrap();
    fs::create_dir(state_path).unwrap();
    let error = fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap_err();
    assert_eq!(error.category, "state_persist_failed");
    assert!(fixture.state().queue.is_empty());
    assert!(fixture.state().history_cursor.is_none());
    assert_eq!(
        fs::read_dir(&fixture.service.inner.queue_dir)
            .unwrap()
            .count(),
        0
    );
    fs::remove_dir(state_path).unwrap();
    fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap();
    fixture.reload();
    assert_eq!(fixture.state().queue.len(), 1);
    assert_eq!(
        fs::read_dir(&fixture.service.inner.queue_dir)
            .unwrap()
            .count(),
        1
    );
    assert_eq!(
        fixture.state().history_cursor.as_deref(),
        Some(ESPRESSO_PATH)
    );
}

#[test]
fn malformed_or_stale_index_entries_never_advance_discovery_cursor() {
    for history in [
        json!([{"file": ESPRESSO_PATH}, {}]),
        json!([{"file": ESPRESSO_PATH}, {"file": 123}]),
        json!([{"file": "2026-09-23/0001.shot.json.zst"}, {"file": ESPRESSO_PATH}]),
    ] {
        let server = MachineServer::start(move |url| match url.path() {
            "/api/v1/history/upload-index" => Reply::json(json!({"history": history})),
            path if path == format!("/api/v1/history/files/{ESPRESSO_PATH}") => {
                Reply::json(espresso())
            }
            _ => Reply::bytes(500, "unexpected route"),
        });
        let fixture = TestService::new(&server, true);
        let before = "2026-09-23/0002.shot.json.zst";
        fixture
            .service
            .mutate_persistent(|state| {
                state.history_cursor = Some(before.to_string());
                Ok(())
            })
            .unwrap();
        assert_eq!(
            fixture.service.observe_new_shots().unwrap_err().category,
            "machine_history_invalid"
        );
        assert_eq!(fixture.state().history_cursor.as_deref(), Some(before));
        assert!(fixture.state().queue.is_empty());
        assert_eq!(
            server.requests().len(),
            1,
            "invalid index must not partially queue"
        );
    }
}

#[test]
fn community_upload_outage_does_not_stop_local_discovery() {
    let server = MachineServer::start(|url| match url.path() {
        SHOT_PATH => Reply::bytes(503, "{}"),
        path if path == format!("/api/v1/history/files/{ESPRESSO_PATH}") => Reply::json(espresso()),
        "/api/v1/history/upload-index" => index(&[]),
        "/api/v1/history/pour-over" => index(&[POUR_PATH.to_string()]),
        path if path == format!("/api/v1/history/pour-over/files/{POUR_PATH}") => {
            Reply::json(pour_over())
        }
        _ => Reply::bytes(500, "unexpected route"),
    });
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap();
    {
        let mut state = fixture.service.inner.state.lock().unwrap();
        state.volatile.access_token = Some("test-access-token".to_string());
        state.volatile.access_token_expires_at = unix_seconds() + 240;
    }
    assert_eq!(
        fixture.service.worker_tick().unwrap_err().category,
        "upload_failed"
    );
    let state = fixture.state();
    assert_eq!(state.queue.len(), 2);
    assert_eq!(state.queue[0].attempt_count, 1);
    assert!(state.queue[0].next_attempt_at > unix_seconds());
    assert_eq!(state.queue[1].history_kind, HistoryKind::PourOver);
    assert_eq!(state.pour_over_history_cursor.as_deref(), Some(POUR_PATH));
    assert!(
        fixture
            .service
            .inner
            .queue_dir
            .join(&state.queue[0].body_file)
            .exists()
    );
}

#[test]
fn revoked_authorization_stops_discovery_and_retains_queued_body_for_repair() {
    let server = MachineServer::start(|url| match url.path() {
        SHOT_PATH => Reply::bytes(403, r#"{"error":"retired_key"}"#),
        path if path == format!("/api/v1/history/files/{ESPRESSO_PATH}") => Reply::json(espresso()),
        _ => Reply::bytes(500, "unexpected route"),
    });
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap();
    {
        let mut state = fixture.service.inner.state.lock().unwrap();
        state.volatile.access_token = Some("test-access-token".to_string());
        state.volatile.access_token_expires_at = unix_seconds() + 240;
    }
    assert_eq!(
        fixture.service.worker_tick().unwrap_err().category,
        "retired_key"
    );
    let state = fixture.state();
    assert!(state.key_id.is_none());
    assert_eq!(state.queue.len(), 1);
    assert!(
        fixture
            .service
            .inner
            .queue_dir
            .join(&state.queue[0].body_file)
            .exists()
    );
    assert_eq!(
        server.requests().len(),
        2,
        "revocation must stop new discovery"
    );
}

#[test]
fn duplicate_entries_in_full_index_page_do_not_complete_discovery_early() {
    let server = MachineServer::start(|url| match url.path() {
        "/api/v1/history/upload-index" => {
            if url.query_pairs().any(|(key, _)| key == "after") {
                index(&[])
            } else {
                index(&vec![ESPRESSO_PATH.to_string(); 200])
            }
        }
        path if path == format!("/api/v1/history/files/{ESPRESSO_PATH}") => Reply::json(espresso()),
        _ => Reply::bytes(500, "unexpected route"),
    });
    let fixture = TestService::new(&server, true);
    assert!(!fixture.service.observe_new_shots().unwrap());
    assert_eq!(
        fixture.state().history_cursor.as_deref(),
        Some(ESPRESSO_PATH)
    );
    assert_eq!(fixture.state().queue.len(), 1);
    assert!(fixture.service.observe_new_shots().unwrap());
    assert_eq!(
        fixture.state().history_cursor.as_deref(),
        Some(ESPRESSO_PATH)
    );
    assert_eq!(fixture.state().queue.len(), 1);
    assert_eq!(server.requests().len(), 3);
}

#[test]
fn rich_pour_over_metadata_uses_small_pages_and_discovers_the_next_page() {
    let paths = (1..=100)
        .map(|number| format!("2026-09-24/{number:04}.pour-over.json"))
        .collect::<Vec<_>>();
    let first_last = paths[19].clone();
    let second_first = paths[20].clone();
    let server = MachineServer::start(move |url| match url.path() {
        "/api/v1/history/pour-over" => {
            let limit = url
                .query_pairs()
                .find(|(key, _)| key == "max_results")
                .unwrap()
                .1
                .parse::<usize>()
                .unwrap();
            let after = url
                .query_pairs()
                .find(|(key, _)| key == "after")
                .map(|(_, value)| value.into_owned());
            let entries = paths.iter().filter(|path| after.as_ref().is_none_or(|cursor| *path > cursor)).take(limit).map(|path| json!({
                "file": path, "name": "咖".repeat(512), "brewType": "pour_over", "mode": "profile",
                "schemaVersion": 4, "timestamp": 1758751200000_u64, "durationMs": 240000,
                "totalWeight": 300, "targetWeight": 300, "pourCount": 5, "sampleCount": 1201
            })).collect::<Vec<_>>();
            // Match Python's default ensure_ascii encoding used by the backend.
            let bytes = serde_json::to_string(&json!({"history": entries}))
                .unwrap()
                .replace('咖', "\\u5496")
                .into_bytes();
            if limit == 20 {
                assert!(bytes.len() < MAX_CONTROL_RESPONSE_BYTES);
            } else {
                assert!(bytes.len() > MAX_CONTROL_RESPONSE_BYTES);
            }
            Reply::bytes(200, bytes)
        }
        path if path.starts_with("/api/v1/history/pour-over/files/") => {
            let mut brew = pour_over();
            brew["id"] = Value::String(path.to_string());
            Reply::json(brew)
        }
        _ => Reply::bytes(500, "unexpected route"),
    });
    let fixture = TestService::new(&server, true);
    assert!(!fixture.service.observe_new_pour_overs().unwrap());
    assert_eq!(fixture.state().queue.len(), 20);
    assert_eq!(
        fixture.state().pour_over_history_cursor.as_deref(),
        Some(first_last.as_str())
    );
    fixture.reload();
    assert!(!fixture.service.observe_new_pour_overs().unwrap());
    assert_eq!(fixture.state().queue.len(), 40);
    assert!(
        fixture
            .state()
            .queue
            .iter()
            .any(|shot| shot.history_path == second_first)
    );
}
