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

fn recovery_ready(fixture: &TestService) {
    let mut state = fixture.service.inner.state.lock().unwrap();
    state.volatile.recovery_upload_not_before = 0;
    state.volatile.access_token = Some("inert-test-token".to_string());
    state.volatile.access_token_expires_at = unix_seconds() + 500;
    if let Some(job) = state.persistent.recovery.as_mut() {
        job.espresso.next_scan_at = 0;
        job.pour_over.next_scan_at = 0;
    }
    for item in &mut state.persistent.queue {
        item.next_attempt_at = 0;
    }
}

fn recovery_routes(url: &Url) -> Reply {
    match url.path() {
        "/api/v1/history/upload-index/last" => Reply::json(json!({"file":ESPRESSO_PATH})),
        "/api/v1/history/pour-over/last" => Reply::json(json!({"file":POUR_PATH})),
        "/api/v1/history/upload-index" => index(&[ESPRESSO_PATH.to_string()]),
        "/api/v1/history/pour-over" => index(&[POUR_PATH.to_string()]),
        path if path.starts_with("/api/v1/history/pour-over/files/") => Reply::json(pour_over()),
        path if path.starts_with("/api/v1/history/files/") => Reply::json(espresso()),
        RECOVERY_PATH | SHOT_PATH => {
            Reply::json(json!({"success":true,"imported":true,"deleted":false}))
        }
        _ => Reply::bytes(500, "unexpected route"),
    }
}

#[test]
fn recovery_is_explicit_idempotent_and_can_start_while_paused() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    assert!(fixture.state().recovery.is_none());
    fixture.service.set_paused(true).unwrap();
    fixture.service.start_history_recovery().unwrap();
    let id = fixture.state().recovery.unwrap().id;
    fixture.service.start_history_recovery().unwrap();
    fixture.reload();
    assert_eq!(fixture.state().recovery.unwrap().id, id);
    fixture.service.worker_tick().unwrap();
    assert!(server.requests().is_empty());
    fixture.service.set_paused(false).unwrap();
    fixture.service.recover_saved_history();
    assert_eq!(fixture.state().queue.len(), 2);
    assert_eq!(fixture.service.status().recovery.unwrap().state, "running");
}

#[test]
fn recovery_loads_legacy_json_without_starting_or_altering_live_cursors() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap();
    let mut legacy = serde_json::to_value(fixture.state()).unwrap();
    legacy.as_object_mut().unwrap().remove("recovery");
    legacy["queue"][0]
        .as_object_mut()
        .unwrap()
        .remove("recoveryJobId");
    legacy["queue"][0]
        .as_object_mut()
        .unwrap()
        .remove("recoveryOnly");
    fs::write(
        &fixture.service.inner.state_path,
        serde_json::to_vec(&legacy).unwrap(),
    )
    .unwrap();
    fixture.reload();
    assert!(fixture.state().recovery.is_none());
    assert!(!fixture.state().queue[0].recovery_only);
    assert_eq!(
        fixture.state().history_cursor.as_deref(),
        Some(ESPRESSO_PATH)
    );
}

#[test]
fn recovery_imports_both_old_methods_through_quiet_endpoint_without_rewinding_live_cursors() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .mutate_persistent(|state| {
            state.history_cursor = Some("2026-10-01/newer.shot.json".to_string());
            state.pour_over_history_cursor = Some("2026-10-01/newer.pour-over.json".to_string());
            Ok(())
        })
        .unwrap();
    fixture.service.start_history_recovery().unwrap();
    fixture.service.recover_saved_history();
    let queued = fixture.state().queue;
    assert_eq!(queued.len(), 2);
    assert!(queued.iter().all(|item| item.recovery_only));
    for item in &queued {
        let expected = match item.history_kind {
            HistoryKind::Espresso => espresso(),
            HistoryKind::PourOver => pour_over(),
        };
        let raw = serde_json::to_vec(&expected).unwrap();
        let expected_body = [
            b"{\"contractVersion\":1,\"shot\":".as_slice(),
            raw.as_slice(),
            b"}".as_slice(),
        ]
        .concat();
        assert_eq!(
            fs::read(fixture.service.inner.queue_dir.join(&item.body_file)).unwrap(),
            expected_body
        );
    }
    fixture.reload();
    recovery_ready(&fixture);
    fixture.service.upload_next_shot().unwrap();
    assert_eq!(fixture.service.status().recovery.unwrap().state, "running");
    recovery_ready(&fixture);
    fixture.service.upload_next_shot().unwrap();
    fixture.reload();
    let status = fixture.service.status().recovery.unwrap();
    assert_eq!(status.state, "completed");
    assert_eq!(status.added, 2);
    assert_eq!(status.pending_count, 0);
    assert_eq!(
        fixture.state().history_cursor.as_deref(),
        Some("2026-10-01/newer.shot.json")
    );
    assert_eq!(
        fixture.state().pour_over_history_cursor.as_deref(),
        Some("2026-10-01/newer.pour-over.json")
    );
    assert_eq!(
        server
            .requests()
            .iter()
            .filter(|path| path.as_str() == RECOVERY_PATH)
            .count(),
        2
    );
    assert!(!server.requests().iter().any(|path| path == SHOT_PATH));
    let previous = fixture.state().recovery.unwrap().id;
    fixture.service.start_history_recovery().unwrap();
    assert_ne!(fixture.state().recovery.unwrap().id, previous);
}

#[test]
fn recovery_counts_existing_and_deleted_receipts_without_calling_them_added() {
    let requests = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let count = Arc::clone(&requests);
    let server = MachineServer::start(move |url| {
        if url.path() == RECOVERY_PATH {
            let deleted = count.fetch_add(1, Ordering::Relaxed) > 0;
            Reply::json(json!({"success":true,"imported":false,"deleted":deleted}))
        } else {
            recovery_routes(url)
        }
    });
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    fixture.service.recover_saved_history();
    for _ in 0..2 {
        recovery_ready(&fixture);
        fixture.service.upload_next_shot().unwrap();
    }
    let status = fixture.service.status().recovery.unwrap();
    assert_eq!(status.state, "completed");
    assert_eq!(
        (
            status.added,
            status.already_present,
            status.preserved_deleted
        ),
        (0, 1, 1)
    );
}

#[test]
fn recovery_reuses_live_queue_and_live_discovery_promotes_recovery_queue_without_duplicate_bodies()
{
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap();
    let original = fixture.state().queue[0].id;
    fixture.service.start_history_recovery().unwrap();
    fixture.service.recover_saved_history();
    assert_eq!(fixture.state().queue.len(), 2);
    assert_eq!(fixture.state().queue[0].id, original);
    assert!(!fixture.state().queue[0].recovery_only);
    assert!(fixture.state().queue[0].recovery_job_id.is_some());
    fixture
        .service
        .queue_history_path(HistoryKind::PourOver, POUR_PATH)
        .unwrap();
    assert_eq!(fixture.state().queue.len(), 2);
    assert!(!fixture.state().queue[1].recovery_only);
    assert_eq!(
        fs::read_dir(&fixture.service.inner.queue_dir)
            .unwrap()
            .count(),
        2
    );
    assert_eq!(
        server
            .requests()
            .iter()
            .filter(|path| path.contains("/files/"))
            .count(),
        2
    );
    for _ in 0..2 {
        recovery_ready(&fixture);
        fixture.service.upload_next_shot().unwrap();
    }
    assert_eq!(fixture.service.status().recovery.unwrap().added, 2);
    assert_eq!(
        server
            .requests()
            .iter()
            .filter(|path| path.as_str() == SHOT_PATH)
            .count(),
        2
    );
}

#[test]
fn recovery_one_unavailable_method_does_not_block_the_other_and_is_never_false_empty() {
    let server = MachineServer::start(|url| {
        if matches!(
            url.path(),
            "/api/v1/history/pour-over/last" | "/api/v1/history/pour-over"
        ) {
            Reply::bytes(404, "missing")
        } else {
            recovery_routes(url)
        }
    });
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    fixture.service.recover_saved_history();
    assert_eq!(fixture.state().queue.len(), 1);
    let recovery = fixture.state().recovery.unwrap();
    assert!(recovery.espresso.exhausted);
    assert!(!recovery.pour_over.initialized);
    assert!(!recovery.pour_over.exhausted);
    assert_eq!(
        recovery.pour_over.last_error.as_deref(),
        Some("machine_pour_over_history_unavailable")
    );
    recovery_ready(&fixture);
    fixture.service.upload_next_shot().unwrap();
    assert_eq!(fixture.service.status().recovery.unwrap().state, "running");
}

#[test]
fn recovery_confirmed_empty_indexes_complete_without_uploads() {
    let server = MachineServer::start(|url| {
        if url.path().ends_with("/last") {
            Reply::bytes(404, "empty")
        } else {
            index(&[])
        }
    });
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    fixture.service.recover_saved_history();
    assert_eq!(
        fixture.service.status().recovery.unwrap().state,
        "completed"
    );
    assert!(fixture.state().queue.is_empty());
}

#[test]
fn recovery_missing_endpoint_and_ambiguous_acknowledgements_retain_durable_queue() {
    for (status, body, declared, expected) in [
        (404, "missing", None, "recovery_server_upgrade_required"),
        (405, "missing", None, "recovery_server_upgrade_required"),
        (200, "{}", None, "upload_receipt_invalid"),
        (
            200,
            "{\"success\":true,\"imported\":true,\"deleted\":true}",
            None,
            "upload_receipt_invalid",
        ),
        (
            200,
            "{\"success\":true,\"imported\":true,\"deleted\":false}",
            Some(500),
            "upload_receipt_invalid",
        ),
    ] {
        let server = MachineServer::start(move |url| {
            if url.path() == RECOVERY_PATH {
                let mut reply = Reply::bytes(status, body);
                if declared.is_some() {
                    reply.declared_length = declared;
                }
                reply
            } else {
                recovery_routes(url)
            }
        });
        let fixture = TestService::new(&server, true);
        fixture.service.start_history_recovery().unwrap();
        fixture.service.recover_saved_history();
        recovery_ready(&fixture);
        fixture.service.upload_next_shot().unwrap();
        fixture.reload();
        assert_eq!(fixture.state().queue.len(), 2);
        assert_eq!(
            fixture.state().queue[0].last_error.as_deref(),
            Some(expected)
        );
        let progress = fixture.service.status().recovery.unwrap();
        assert_eq!(progress.state, "running");
        assert_eq!((progress.added, progress.failed), (0, 0));
    }
}

#[test]
fn recovery_missing_or_invalid_complete_files_retry_durably_then_report_partial_completion() {
    for missing in [false, true] {
        let server = MachineServer::start(move |url| {
            if url.path().starts_with("/api/v1/history/files/") {
                Reply::bytes(if missing { 404 } else { 200 }, "not json")
            } else {
                recovery_routes(url)
            }
        });
        let fixture = TestService::new(&server, true);
        fixture.service.start_history_recovery().unwrap();
        for attempt in 1..=3 {
            recovery_ready(&fixture);
            fixture.service.recover_saved_history();
            fixture.reload();
            let job = fixture.state().recovery.unwrap();
            assert_eq!(job.failed, if attempt == 3 { 1 } else { 0 });
            assert_eq!(job.espresso.exhausted, attempt == 3);
        }
        recovery_ready(&fixture);
        fixture.service.upload_next_shot().unwrap();
        let progress = fixture.service.status().recovery.unwrap();
        assert_eq!(progress.state, "completed");
        assert_eq!((progress.added, progress.failed), (1, 1));
        assert!(progress.last_error.is_some());
        assert!(fixture.state().history_cursor.is_none());
    }
}

#[test]
fn recovery_truncated_file_never_uses_bad_file_retry_budget() {
    let server = MachineServer::start(|url| {
        if url.path().starts_with("/api/v1/history/files/") {
            let mut reply = Reply::bytes(200, "{}");
            reply.declared_length = Some(500);
            reply
        } else {
            recovery_routes(url)
        }
    });
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    for _ in 0..4 {
        recovery_ready(&fixture);
        fixture.service.recover_saved_history();
        fixture.reload();
    }
    let job = fixture.state().recovery.unwrap();
    assert_eq!(job.failed, 0);
    assert_eq!(job.espresso.file_attempts, 0);
    assert!(!job.espresso.exhausted);
    assert_eq!(fixture.state().queue.len(), 1);
}

#[test]
fn recovery_storage_failure_never_advances_checkpoint_and_ack_retry_counts_once() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    let job_id = fixture.state().recovery.unwrap().id;
    let state_path = &fixture.service.inner.state_path;
    fs::remove_file(state_path).unwrap();
    fs::create_dir(state_path).unwrap();
    let error = fixture
        .service
        .queue_history_path_for(
            HistoryKind::Espresso,
            ESPRESSO_PATH,
            Checkpoint::Recovery(job_id),
        )
        .unwrap_err();
    assert_eq!(error.category, "state_persist_failed");
    assert!(fixture.state().recovery.unwrap().espresso.cursor.is_none());
    assert!(fixture.state().queue.is_empty());
    assert_eq!(
        fs::read_dir(&fixture.service.inner.queue_dir)
            .unwrap()
            .count(),
        0
    );
    fs::remove_dir(state_path).unwrap();
    fixture.service.recover_saved_history();
    recovery_ready(&fixture);
    fs::remove_file(state_path).unwrap();
    fs::create_dir(state_path).unwrap();
    assert_eq!(
        fixture.service.upload_next_shot().unwrap_err().category,
        "state_persist_failed"
    );
    assert_eq!(fixture.state().queue.len(), 2);
    assert_eq!(fixture.state().recovery.unwrap().added, 0);
    fs::remove_dir(state_path).unwrap();
    recovery_ready(&fixture);
    fixture.service.upload_next_shot().unwrap();
    fixture.reload();
    assert_eq!(fixture.state().queue.len(), 1);
    assert_eq!(fixture.state().recovery.unwrap().added, 1);
}

#[test]
fn recovery_repair_cannot_transfer_historical_items_to_another_authorization() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap();
    fixture.service.start_history_recovery().unwrap();
    fixture.service.recover_saved_history();
    fixture
        .service
        .retire_local_authorization("authorization_revoked")
        .unwrap();
    let state = fixture.state();
    assert_eq!(state.queue.len(), 1);
    assert!(!state.queue[0].recovery_only);
    assert!(state.queue[0].recovery_job_id.is_none());
    assert_eq!(
        fixture.service.status().recovery.unwrap().state,
        "interrupted"
    );
    fixture
        .service
        .mutate_persistent(|state| {
            state.authorization_id = Some(Uuid::new_v4());
            state.key_id = Some(Uuid::new_v4());
            state.key_version = Some(1);
            Ok(())
        })
        .unwrap();
    fixture.reload();
    recovery_ready(&fixture);
    fixture.service.upload_next_shot().unwrap();
    assert!(!server.requests().iter().any(|path| path == RECOVERY_PATH));
    assert_eq!(fixture.service.status().recovery.unwrap().added, 0);
    fixture.service.start_history_recovery().unwrap();
    assert_eq!(fixture.service.status().recovery.unwrap().state, "running");
}

#[test]
fn recovery_snapshot_and_capacity_are_bounded_across_pages_and_new_brews() {
    let paths = (1..=205)
        .map(|n| format!("2026-09-24/{n:04}.shot.json"))
        .collect::<Vec<_>>();
    let boundary = paths[203].clone();
    let captured = boundary.clone();
    let server = MachineServer::start(move |url| match url.path() {
        "/api/v1/history/upload-index/last" => Reply::json(json!({"file":captured})),
        "/api/v1/history/upload-index" => {
            let after = url
                .query_pairs()
                .find(|(key, _)| key == "after")
                .map(|(_, v)| v.into_owned());
            index(
                &paths
                    .iter()
                    .filter(|path| after.as_ref().is_none_or(|cursor| *path > cursor))
                    .take(200)
                    .cloned()
                    .collect::<Vec<_>>(),
            )
        }
        "/api/v1/history/pour-over/last" => Reply::json(json!({"file":null})),
        "/api/v1/history/pour-over" => index(&[]),
        path if path.starts_with("/api/v1/history/files/") => {
            let mut brew = espresso();
            brew["id"] = json!(path);
            Reply::json(brew)
        }
        RECOVERY_PATH | SHOT_PATH => {
            Reply::json(json!({"success":true,"imported":true,"deleted":false}))
        }
        _ => Reply::bytes(500, "unexpected route"),
    });
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .mutate_persistent(|state| {
            state.history_cursor = Some(boundary.clone());
            Ok(())
        })
        .unwrap();
    fixture.service.start_history_recovery().unwrap();
    for _ in 0..5 {
        recovery_ready(&fixture);
        fixture.service.recover_saved_history();
    }
    assert_eq!(fixture.state().queue.len(), 4);
    let request_count = server.requests().len();
    recovery_ready(&fixture);
    fixture.service.recover_saved_history();
    assert_eq!(
        server.requests().len(),
        request_count,
        "full recovery queue must not poll large indexes"
    );
    fixture.service.observe_new_shots().unwrap();
    assert_eq!(fixture.state().queue.len(), 5);
    recovery_ready(&fixture);
    fixture.service.upload_next_shot().unwrap();
    assert_eq!(
        server.requests().last().unwrap(),
        SHOT_PATH,
        "new brew gets live priority"
    );
    for _ in 0..204 {
        recovery_ready(&fixture);
        fixture.service.upload_next_shot().unwrap();
        fixture.service.recover_saved_history();
    }
    fixture.reload();
    let progress = fixture.service.status().recovery.unwrap();
    assert_eq!(progress.state, "completed");
    assert_eq!(progress.added, 204);
    assert_eq!(
        fixture.state().recovery.unwrap().espresso.cursor.as_deref(),
        Some(boundary.as_str())
    );
    assert_eq!(
        fixture.state().history_cursor.as_deref(),
        Some("2026-09-24/0205.shot.json")
    );
}

#[test]
fn recovery_scheduler_reserves_live_capacity_and_limits_backfill_to_twenty_per_minute() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    fixture.service.recover_saved_history();
    fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap();
    let mut state = fixture.service.inner.state.lock().unwrap();
    for item in &mut state.persistent.queue {
        item.next_attempt_at = 0;
    }
    state.volatile.recovery_upload_not_before = 103;
    state.volatile.live_upload_streak = 3;
    assert!(
        !recovery::next_due_item(&mut state, 102)
            .unwrap()
            .recovery_only,
        "pacing must never delay live"
    );
    assert!(
        recovery::next_due_item(&mut state, 103)
            .unwrap()
            .recovery_only,
        "recovery has bounded fairness"
    );
    state.persistent.queue.retain(|item| item.recovery_only);
    assert!(recovery::next_due_item(&mut state, 102).is_none());
    assert!(recovery::next_due_item(&mut state, 103).is_some());
}

#[test]
fn recovery_rechecks_pause_and_authorization_after_download_before_checkpointing() {
    for change_authorization in [false, true] {
        let during_download: Arc<Mutex<Option<CommunityUploadService>>> =
            Arc::new(Mutex::new(None));
        let callback = Arc::clone(&during_download);
        let server = MachineServer::start(move |url| {
            if url.path().starts_with("/api/v1/history/files/") {
                callback
                    .lock()
                    .unwrap()
                    .as_ref()
                    .unwrap()
                    .mutate_persistent(|state| {
                        if change_authorization {
                            state.authorization_id = Some(Uuid::new_v4());
                        } else {
                            state.paused = true;
                        }
                        Ok(())
                    })
                    .unwrap();
            }
            recovery_routes(url)
        });
        let fixture = TestService::new(&server, true);
        *during_download.lock().unwrap() = Some(fixture.service.clone());
        fixture.service.start_history_recovery().unwrap();
        fixture.service.recover_saved_history();
        assert!(fixture.state().queue.is_empty());
        assert!(fixture.state().recovery.unwrap().espresso.cursor.is_none());
        assert_eq!(
            fs::read_dir(&fixture.service.inner.queue_dir)
                .unwrap()
                .count(),
            0
        );
        fixture.service.interrupt_mismatched_recovery().unwrap();
        assert_eq!(
            fixture.service.status().recovery.unwrap().state,
            if change_authorization {
                "interrupted"
            } else {
                "running"
            }
        );
    }
}

#[test]
fn recovery_permanent_rejection_and_missing_body_finish_with_visible_failures() {
    let server = MachineServer::start(|url| {
        if url.path() == RECOVERY_PATH {
            Reply::bytes(409, r#"{"error":"idempotency_conflict"}"#)
        } else {
            recovery_routes(url)
        }
    });
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    fixture.service.recover_saved_history();
    let first = fixture.state().queue[0].body_file.clone();
    fs::remove_file(fixture.service.inner.queue_dir.join(first)).unwrap();
    recovery_ready(&fixture);
    assert_eq!(
        fixture.service.upload_next_shot().unwrap_err().category,
        "queued_body_missing"
    );
    recovery_ready(&fixture);
    fixture.service.upload_next_shot().unwrap();
    let progress = fixture.service.status().recovery.unwrap();
    assert_eq!(progress.state, "completed");
    assert_eq!((progress.added, progress.failed), (0, 2));
}

#[test]
fn recovery_queue_write_failure_leaves_original_machine_file_retryable() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    let job = fixture.state().recovery.unwrap().id;
    fs::remove_dir(&fixture.service.inner.queue_dir).unwrap();
    fs::write(&fixture.service.inner.queue_dir, b"not a directory").unwrap();
    let failure = fixture
        .service
        .queue_history_path_for(
            HistoryKind::Espresso,
            ESPRESSO_PATH,
            Checkpoint::Recovery(job),
        )
        .unwrap_err();
    assert_eq!(failure.category, "queue_write_failed");
    fixture.reload();
    assert!(fixture.state().recovery.unwrap().espresso.cursor.is_none());
    assert!(fixture.state().queue.is_empty());
    fs::remove_file(&fixture.service.inner.queue_dir).unwrap();
    create_private_dir(&fixture.service.inner.queue_dir).unwrap();
    fixture.service.recover_saved_history();
    assert_eq!(fixture.state().queue.len(), 2);
}

#[test]
fn recovery_healthy_authorization_guard_does_not_write_state_on_every_worker_tick() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    // An unwritable state destination makes accidental no-op writes observable.
    fs::remove_file(&fixture.service.inner.state_path).unwrap();
    fs::create_dir(&fixture.service.inner.state_path).unwrap();
    fixture.service.interrupt_mismatched_recovery().unwrap();
    fs::remove_dir(&fixture.service.inner.state_path).unwrap();
}
