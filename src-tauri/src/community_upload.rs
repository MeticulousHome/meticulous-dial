use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use ed25519_dalek::{Signer, SigningKey};
use rand_core::{OsRng, RngCore};
use reqwest::blocking::{Client, Response};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, RETRY_AFTER};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use url::Url;
use uuid::Uuid;

const CONTRACT_VERSION: u8 = 1;
const AUDIENCE: &str = "meticulous-community";
const EXCHANGE_PATH: &str = "/api/machine-uploads/v1/enrollments/exchange";
const TOKEN_PATH: &str = "/api/machine-uploads/v1/token";
const SHOT_PATH: &str = "/api/machine-uploads/v1/shots";
const REVOKE_PATH: &str = "/api/machine-uploads/v1/installations/current";
const DEFAULT_COMMUNITY_BASE: &str = "https://community.meticuloushome.com";
const DEFAULT_MACHINE_BASE: &str = "http://localhost:8080";
const MAX_SHOT_BODY_BYTES: usize = 2 * 1024 * 1024;
const ENROLLMENT_TTL_SECONDS: i64 = 10 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EnrollmentState {
    challenge: String,
    issued_at: i64,
    machine_serial: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueuedShot {
    id: Uuid,
    source_shot_id: String,
    history_path: String,
    body_file: String,
    attempt_count: u32,
    next_attempt_at: i64,
    last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistentState {
    installation_id: Uuid,
    private_seed: String,
    public_key: String,
    enrollment: Option<EnrollmentState>,
    authorization_id: Option<Uuid>,
    key_id: Option<Uuid>,
    key_version: Option<u32>,
    paused: bool,
    history_baselined: bool,
    history_cursor: Option<String>,
    queue: Vec<QueuedShot>,
    last_success_at: Option<i64>,
    last_error: Option<String>,
    last_retry_at: Option<i64>,
}

#[derive(Default)]
struct VolatileState {
    access_token: Option<String>,
    access_token_expires_at: i64,
    clock_offset_seconds: i64,
    worker_not_before: i64,
    worker_failure_count: u32,
}

struct RuntimeState {
    persistent: PersistentState,
    volatile: VolatileState,
}

#[derive(Clone)]
pub struct CommunityUploadService {
    inner: Arc<Inner>,
}

struct Inner {
    state: Mutex<RuntimeState>,
    state_path: PathBuf,
    queue_dir: PathBuf,
    community_base: Url,
    machine_base: Url,
    client: Client,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityUploadStatus {
    state: &'static str,
    connected: bool,
    paused: bool,
    pending_count: usize,
    last_success_at: Option<i64>,
    last_error: Option<String>,
    last_retry_at: Option<i64>,
    enrollment_expires_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityEnrollment {
    qr_url: String,
    expires_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExchangeResponse {
    access_token: String,
    authorization_id: Uuid,
    key_id: Uuid,
    key_version: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TokenResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct ErrorResponse {
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HistoryEntry {
    name: Option<String>,
    url: Option<String>,
    file: Option<String>,
}

#[derive(Debug)]
struct RequestFailure {
    category: String,
    retry_after_seconds: Option<i64>,
    permanent: bool,
}

impl std::fmt::Display for RequestFailure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.category)
    }
}

impl std::error::Error for RequestFailure {}

impl CommunityUploadService {
    pub fn new() -> Result<Self, String> {
        let default_config = if cfg!(debug_assertions) {
            env::temp_dir().join("meticulous-dial-config")
        } else {
            PathBuf::from("/meticulous-user/config")
        };
        let root = env::var("CONFIG_PATH")
            .map(PathBuf::from)
            .unwrap_or(default_config)
            .join("community-upload");
        let queue_dir = root.join("queue");
        create_private_dir(&root).map_err(safe_error)?;
        create_private_dir(&queue_dir).map_err(safe_error)?;
        let state_path = root.join("state.json");
        let persistent = load_or_create_state(&state_path).map_err(safe_error)?;
        remove_orphaned_queue_files(&queue_dir, &persistent.queue).map_err(safe_error)?;

        let community_base = Url::parse(
            &env::var("COMMUNITY_API_BASE").unwrap_or_else(|_| DEFAULT_COMMUNITY_BASE.to_string()),
        )
        .map_err(|_| "Invalid COMMUNITY_API_BASE".to_string())?;
        let machine_base = Url::parse(
            &env::var("MACHINE_API_BASE").unwrap_or_else(|_| DEFAULT_MACHINE_BASE.to_string()),
        )
        .map_err(|_| "Invalid MACHINE_API_BASE".to_string())?;
        if !matches!(community_base.scheme(), "https" | "http") {
            return Err("Unsupported Community API scheme".to_string());
        }
        if !matches!(machine_base.scheme(), "https" | "http") {
            return Err("Unsupported machine API scheme".to_string());
        }

        let client = Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(15))
            .user_agent("meticulous-dial-community-upload-v1")
            .build()
            .map_err(safe_error)?;

        Ok(Self {
            inner: Arc::new(Inner {
                state: Mutex::new(RuntimeState {
                    persistent,
                    volatile: VolatileState::default(),
                }),
                state_path,
                queue_dir,
                community_base,
                machine_base,
                client,
            }),
        })
    }

    pub fn start(&self) {
        let service = self.clone();
        thread::spawn(move || {
            loop {
                if service.worker_is_ready() {
                    match service.worker_tick() {
                        Ok(()) => service.clear_worker_failure_count(),
                        Err(error) => service.record_worker_failure(&error),
                    }
                }
                thread::sleep(Duration::from_millis(500));
            }
        });
    }

    pub fn status(&self) -> CommunityUploadStatus {
        let state = self
            .inner
            .state
            .lock()
            .expect("community state lock poisoned");
        let connected = state.persistent.key_id.is_some() && state.persistent.key_version.is_some();
        CommunityUploadStatus {
            state: if connected && state.persistent.paused {
                "upload_paused"
            } else if connected {
                "connected"
            } else {
                "not_connected"
            },
            connected,
            paused: state.persistent.paused,
            pending_count: state.persistent.queue.len(),
            last_success_at: state.persistent.last_success_at,
            last_error: state.persistent.last_error.clone(),
            last_retry_at: state.persistent.last_retry_at,
            enrollment_expires_at: state
                .persistent
                .enrollment
                .as_ref()
                .map(|enrollment| enrollment.issued_at + ENROLLMENT_TTL_SECONDS),
        }
    }

    pub fn begin_enrollment(
        &self,
        machine_serial: Option<String>,
    ) -> Result<CommunityEnrollment, String> {
        let serial = machine_serial
            .map(|value| value.trim().chars().take(128).collect::<String>())
            .filter(|value| !value.is_empty());
        let issued_at = unix_seconds();
        let mut challenge_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut challenge_bytes);
        let enrollment = EnrollmentState {
            challenge: URL_SAFE_NO_PAD.encode(challenge_bytes),
            issued_at,
            machine_serial: serial,
        };

        let (installation_id, public_key) = self.mutate_persistent(|state| {
            if state.key_id.is_some() {
                return Err("Community backup is already connected".to_string());
            }
            state.enrollment = Some(enrollment.clone());
            state.last_error = None;
            Ok((state.installation_id, state.public_key.clone()))
        })?;

        let payload = json!({
            "kind": "meticulous-community-enrollment",
            "contractVersion": CONTRACT_VERSION,
            "installationId": installation_id,
            "challenge": enrollment.challenge,
            "publicKey": public_key,
            "issuedAt": enrollment.issued_at,
            "machineSerial": enrollment.machine_serial,
        });
        let encoded = URL_SAFE_NO_PAD.encode(serde_json::to_vec(&payload).map_err(safe_error)?);
        let mut qr_url = self.inner.community_base.clone();
        qr_url.set_path("/my-setup/machine/connect");
        qr_url.set_query(Some(&format!("enrollment={encoded}")));
        Ok(CommunityEnrollment {
            qr_url: qr_url.to_string(),
            expires_at: issued_at + ENROLLMENT_TTL_SECONDS,
        })
    }

    pub fn set_paused(&self, paused: bool) -> Result<(), String> {
        self.mutate_persistent(|state| {
            if state.key_id.is_none() {
                return Err("Community backup is not connected".to_string());
            }
            state.paused = paused;
            state.last_error = None;
            Ok(())
        })
    }

    pub fn disconnect(&self) -> Result<(), String> {
        let connected = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| "Community state unavailable".to_string())?;
            state.persistent.key_id.is_some()
        };
        if connected {
            self.revoke_current().map_err(|failure| {
                self.record_retry(&failure.category, failure.retry_after_seconds.unwrap_or(5));
                "Could not disconnect from Community. Check the internet connection and try again."
                    .to_string()
            })?;
        }

        self.factory_reset_local()
    }

    pub fn factory_reset_local(&self) -> Result<(), String> {
        let queue_files = self.mutate_persistent(|state| {
            let files = state
                .queue
                .iter()
                .map(|item| item.body_file.clone())
                .collect::<Vec<_>>();
            *state = fresh_state()?;
            Ok(files)
        })?;
        for file in queue_files {
            let _ = fs::remove_file(self.inner.queue_dir.join(file));
        }
        let mut state = self
            .inner
            .state
            .lock()
            .map_err(|_| "Community state unavailable".to_string())?;
        state.volatile = VolatileState::default();
        Ok(())
    }

    fn worker_tick(&self) -> Result<(), RequestFailure> {
        self.expire_local_enrollment();
        let snapshot = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            (
                state.persistent.enrollment.clone(),
                state.persistent.key_id,
                state.persistent.paused,
            )
        };

        if snapshot.1.is_none() {
            if snapshot.0.is_some() {
                self.try_exchange()?;
            }
            return Ok(());
        }
        if snapshot.2 {
            return Ok(());
        }

        self.observe_new_shots()?;
        self.upload_next_shot()?;
        Ok(())
    }

    fn expire_local_enrollment(&self) {
        let expired = {
            let state = self
                .inner
                .state
                .lock()
                .expect("community state lock poisoned");
            state
                .persistent
                .enrollment
                .as_ref()
                .is_some_and(|value| value.issued_at + ENROLLMENT_TTL_SECONDS < unix_seconds())
                && state.persistent.key_id.is_none()
        };
        if expired {
            let _ = self.mutate_persistent(|state| {
                state.enrollment = None;
                state.last_error = Some("pairing_code_expired".to_string());
                Ok(())
            });
        }
    }

    fn try_exchange(&self) -> Result<(), RequestFailure> {
        let (installation_id, private_seed, enrollment, timestamp) = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            let enrollment = state
                .persistent
                .enrollment
                .clone()
                .ok_or_else(|| temporary("enrollment_missing"))?;
            (
                state.persistent.installation_id,
                state.persistent.private_seed.clone(),
                enrollment,
                unix_seconds() + state.volatile.clock_offset_seconds,
            )
        };
        let body = serde_json::to_vec(&json!({
            "contractVersion": CONTRACT_VERSION,
            "installationId": installation_id,
            "challenge": enrollment.challenge,
        }))
        .map_err(|_| permanent("invalid_exchange_body"))?;
        let headers = enrollment_headers(
            installation_id,
            &private_seed,
            timestamp,
            EXCHANGE_PATH,
            &body,
        )?;
        let response = self
            .inner
            .client
            .post(self.community_url(EXCHANGE_PATH))
            .header(CONTENT_TYPE, "application/json")
            .headers(headers)
            .body(body)
            .send()
            .map_err(|_| temporary("exchange_network"))?;
        self.update_server_clock(&response);
        if response.status().as_u16() == 202 {
            let retry_after = response
                .headers()
                .get(RETRY_AFTER)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.parse::<i64>().ok())
                .unwrap_or(2);
            self.schedule_worker_after(retry_after);
            return Ok(());
        }
        if !response.status().is_success() {
            let failure = response_failure(response, "exchange_failed");
            if failure.permanent {
                self.mutate_persistent_failure(|state| {
                    state.enrollment = None;
                    state.last_error = Some(failure.category.clone());
                    state.last_retry_at = None;
                    Ok(())
                })?;
            }
            return Err(failure);
        }
        let exchanged = response
            .json::<ExchangeResponse>()
            .map_err(|_| temporary("exchange_response_invalid"))?;
        self.mutate_persistent_failure(|state| {
            state.authorization_id = Some(exchanged.authorization_id);
            state.key_id = Some(exchanged.key_id);
            state.key_version = Some(exchanged.key_version);
            state.enrollment = None;
            state.paused = false;
            state.history_baselined = false;
            state.history_cursor = None;
            state.last_error = None;
            Ok(())
        })?;
        let mut state = self
            .inner
            .state
            .lock()
            .map_err(|_| temporary("state_unavailable"))?;
        state.volatile.access_token = Some(exchanged.access_token);
        state.volatile.access_token_expires_at = unix_seconds() + 240;
        Ok(())
    }

    fn observe_new_shots(&self) -> Result<(), RequestFailure> {
        let (baselined, cursor) = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            (
                state.persistent.history_baselined,
                state.persistent.history_cursor.clone(),
            )
        };
        let latest = self.fetch_last_history_path()?;
        if !baselined {
            self.mutate_persistent_failure(|state| {
                state.history_baselined = true;
                state.history_cursor = latest;
                Ok(())
            })?;
            return Ok(());
        }
        let Some(latest_path) = latest else {
            return Ok(());
        };
        if cursor.as_ref().is_some_and(|value| value >= &latest_path) {
            return Ok(());
        }

        let paths = self.fetch_history_paths()?;
        for path in paths {
            let current_cursor = {
                self.inner
                    .state
                    .lock()
                    .map_err(|_| temporary("state_unavailable"))?
                    .persistent
                    .history_cursor
                    .clone()
            };
            if current_cursor.as_ref().is_some_and(|value| value >= &path) {
                continue;
            }
            match self.queue_history_path(&path) {
                Ok(()) => {}
                Err(failure) if failure.permanent => {
                    self.skip_history_path(&path, &failure.category)?;
                }
                Err(failure) => return Err(failure),
            }
        }
        Ok(())
    }

    fn fetch_last_history_path(&self) -> Result<Option<String>, RequestFailure> {
        let response = self
            .inner
            .client
            .get(self.machine_url("/api/v1/history/last"))
            .send()
            .map_err(|_| temporary("machine_history_unavailable"))?;
        if response.status().as_u16() == 404 || response.status().as_u16() == 204 {
            return Ok(None);
        }
        if !response.status().is_success() {
            return Err(temporary("machine_history_unavailable"));
        }
        let value = response
            .json::<Value>()
            .map_err(|_| temporary("machine_history_invalid"))?;
        value
            .get("file")
            .and_then(Value::as_str)
            .map(normalize_history_path)
            .transpose()
    }

    fn fetch_history_paths(&self) -> Result<Vec<String>, RequestFailure> {
        let dates = self.fetch_history_entries("/api/v1/history/files/")?;
        let mut paths = Vec::new();
        for date in dates {
            let Some(date_name) = date.name.or(date.url) else {
                continue;
            };
            let date_name = normalize_history_segment(&date_name)?;
            let entries =
                self.fetch_history_entries(&format!("/api/v1/history/files/{date_name}"))?;
            for entry in entries {
                let Some(file_name) = entry.url.or(entry.name).or(entry.file) else {
                    continue;
                };
                let file_name = normalize_history_segment(&file_name)?;
                if file_name.contains(".shot.json") {
                    paths.push(format!("{date_name}/{file_name}"));
                }
            }
        }
        paths.sort();
        paths.dedup();
        Ok(paths)
    }

    fn fetch_history_entries(&self, path: &str) -> Result<Vec<HistoryEntry>, RequestFailure> {
        let response = self
            .inner
            .client
            .get(self.machine_url(path))
            .send()
            .map_err(|_| temporary("machine_history_unavailable"))?;
        if !response.status().is_success() {
            return Err(temporary("machine_history_unavailable"));
        }
        response
            .json::<Vec<HistoryEntry>>()
            .map_err(|_| temporary("machine_history_invalid"))
    }

    fn queue_history_path(&self, history_path: &str) -> Result<(), RequestFailure> {
        let response = self
            .inner
            .client
            .get(self.machine_history_file_url(history_path)?)
            .send()
            .map_err(|_| temporary("shot_file_pending"))?;
        if !response.status().is_success() {
            return Err(temporary("shot_file_pending"));
        }
        let declared = response.content_length().unwrap_or(0);
        if declared as usize > MAX_SHOT_BODY_BYTES {
            return Err(permanent("shot_file_too_large"));
        }
        let mut raw = Vec::new();
        response
            .take((MAX_SHOT_BODY_BYTES + 1) as u64)
            .read_to_end(&mut raw)
            .map_err(|_| temporary("shot_file_pending"))?;
        if raw.len() > MAX_SHOT_BODY_BYTES {
            return Err(permanent("shot_file_too_large"));
        }
        let parsed =
            serde_json::from_slice::<Value>(&raw).map_err(|_| temporary("shot_file_pending"))?;
        let source_shot_id = parsed
            .get("id")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty() && value.len() <= 256)
            .ok_or_else(|| permanent("shot_id_invalid"))?
            .to_string();
        if !parsed.get("data").is_some_and(Value::is_array) {
            return Err(permanent("shot_data_invalid"));
        }
        let mut body = Vec::with_capacity(raw.len() + 32);
        body.extend_from_slice(b"{\"contractVersion\":1,\"shot\":");
        body.extend_from_slice(&raw);
        body.push(b'}');
        if body.len() > MAX_SHOT_BODY_BYTES {
            return Err(permanent("shot_file_too_large"));
        }

        let id = Uuid::new_v4();
        let body_file = format!("{id}.json");
        let body_path = self.inner.queue_dir.join(&body_file);
        write_private_file_atomic(&body_path, &body)
            .map_err(|_| temporary("queue_write_failed"))?;
        let queued = QueuedShot {
            id,
            source_shot_id,
            history_path: history_path.to_string(),
            body_file: body_file.clone(),
            attempt_count: 0,
            next_attempt_at: unix_seconds(),
            last_error: None,
        };
        if let Err(error) = self.mutate_persistent_failure(|state| {
            state.queue.push(queued);
            state.history_cursor = Some(history_path.to_string());
            state.last_error = None;
            Ok(())
        }) {
            let _ = fs::remove_file(body_path);
            return Err(error);
        }
        Ok(())
    }

    fn upload_next_shot(&self) -> Result<(), RequestFailure> {
        let queued = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            state
                .persistent
                .queue
                .iter()
                .find(|item| item.next_attempt_at <= unix_seconds())
                .cloned()
        };
        let Some(queued) = queued else {
            return Ok(());
        };
        let body_path = self.inner.queue_dir.join(&queued.body_file);
        let body = match fs::read(&body_path) {
            Ok(body) => body,
            Err(_) => {
                self.drop_queue_item(queued.id, "queued_body_missing")?;
                return Err(permanent("queued_body_missing"));
            }
        };
        if body.len() > MAX_SHOT_BODY_BYTES {
            self.drop_queue_item(queued.id, "queued_body_too_large")?;
            let _ = fs::remove_file(&body_path);
            return Err(permanent("queued_body_too_large"));
        }
        let token = self.ensure_access_token()?;
        let (installation_id, key_id, key_version, private_seed, timestamp) = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            (
                state.persistent.installation_id,
                state
                    .persistent
                    .key_id
                    .ok_or_else(|| permanent("key_missing"))?,
                state
                    .persistent
                    .key_version
                    .ok_or_else(|| permanent("key_missing"))?,
                state.persistent.private_seed.clone(),
                unix_seconds() + state.volatile.clock_offset_seconds,
            )
        };
        let mut headers = signed_headers(
            key_id,
            key_version,
            &private_seed,
            timestamp,
            "POST",
            SHOT_PATH,
            &body,
        )?;
        headers.insert(
            "x-meticulous-idempotency-key",
            header_value(&idempotency_key(installation_id, &queued.source_shot_id))?,
        );
        let response = self
            .inner
            .client
            .post(self.community_url(SHOT_PATH))
            .header(CONTENT_TYPE, "application/json")
            .header(AUTHORIZATION, format!("Bearer {token}"))
            .headers(headers)
            .body(body)
            .send()
            .map_err(|_| temporary("upload_network"))?;
        self.update_server_clock(&response);
        if response.status().is_success() {
            self.complete_queue_item(queued.id, &body_path)?;
            return Ok(());
        }
        let failure = response_failure(response, "upload_failed");
        if failure.category == "invalid_access" || failure.category == "expired_request" {
            let mut state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            state.volatile.access_token = None;
            state.volatile.access_token_expires_at = 0;
        }
        if authorization_is_retired(&failure.category) {
            self.retire_local_authorization(&failure.category)?;
            return Err(failure);
        }
        self.defer_queue_item(&queued, &failure)?;
        Err(failure)
    }

    fn ensure_access_token(&self) -> Result<String, RequestFailure> {
        {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            if state.volatile.access_token_expires_at > unix_seconds() + 20
                && let Some(token) = &state.volatile.access_token
            {
                return Ok(token.clone());
            }
        }
        let (key_id, key_version, private_seed, timestamp) = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            (
                state
                    .persistent
                    .key_id
                    .ok_or_else(|| permanent("key_missing"))?,
                state
                    .persistent
                    .key_version
                    .ok_or_else(|| permanent("key_missing"))?,
                state.persistent.private_seed.clone(),
                unix_seconds() + state.volatile.clock_offset_seconds,
            )
        };
        let body = b"{\"contractVersion\":1}".to_vec();
        let headers = signed_headers(
            key_id,
            key_version,
            &private_seed,
            timestamp,
            "POST",
            TOKEN_PATH,
            &body,
        )?;
        let response = self
            .inner
            .client
            .post(self.community_url(TOKEN_PATH))
            .header(CONTENT_TYPE, "application/json")
            .headers(headers)
            .body(body)
            .send()
            .map_err(|_| temporary("token_network"))?;
        self.update_server_clock(&response);
        if !response.status().is_success() {
            let failure = response_failure(response, "token_failed");
            if authorization_is_retired(&failure.category) {
                self.retire_local_authorization(&failure.category)?;
            }
            return Err(failure);
        }
        let token = response
            .json::<TokenResponse>()
            .map_err(|_| temporary("token_response_invalid"))?
            .access_token;
        let mut state = self
            .inner
            .state
            .lock()
            .map_err(|_| temporary("state_unavailable"))?;
        state.volatile.access_token = Some(token.clone());
        state.volatile.access_token_expires_at = unix_seconds() + 240;
        Ok(token)
    }

    fn revoke_current(&self) -> Result<(), RequestFailure> {
        let token = self.ensure_access_token()?;
        let (key_id, key_version, private_seed, timestamp) = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            (
                state
                    .persistent
                    .key_id
                    .ok_or_else(|| permanent("key_missing"))?,
                state
                    .persistent
                    .key_version
                    .ok_or_else(|| permanent("key_missing"))?,
                state.persistent.private_seed.clone(),
                unix_seconds() + state.volatile.clock_offset_seconds,
            )
        };
        let body = b"{\"contractVersion\":1}".to_vec();
        let headers = signed_headers(
            key_id,
            key_version,
            &private_seed,
            timestamp,
            "DELETE",
            REVOKE_PATH,
            &body,
        )?;
        let response = self
            .inner
            .client
            .delete(self.community_url(REVOKE_PATH))
            .header(CONTENT_TYPE, "application/json")
            .header(AUTHORIZATION, format!("Bearer {token}"))
            .headers(headers)
            .body(body)
            .send()
            .map_err(|_| temporary("disconnect_network"))?;
        self.update_server_clock(&response);
        if !response.status().is_success() {
            let failure = response_failure(response, "disconnect_failed");
            if authorization_is_retired(&failure.category) {
                return Ok(());
            }
            return Err(failure);
        }
        Ok(())
    }

    fn complete_queue_item(&self, id: Uuid, body_path: &Path) -> Result<(), RequestFailure> {
        self.mutate_persistent_failure(|state| {
            state.queue.retain(|item| item.id != id);
            state.last_success_at = Some(unix_seconds());
            state.last_error = None;
            state.last_retry_at = None;
            Ok(())
        })?;
        let _ = fs::remove_file(body_path);
        Ok(())
    }

    fn defer_queue_item(
        &self,
        queued: &QueuedShot,
        failure: &RequestFailure,
    ) -> Result<(), RequestFailure> {
        self.mutate_persistent_failure(|state| {
            if let Some(item) = state.queue.iter_mut().find(|item| item.id == queued.id) {
                item.attempt_count = item.attempt_count.saturating_add(1);
                item.last_error = Some(failure.category.clone());
                let backoff = failure
                    .retry_after_seconds
                    .unwrap_or_else(|| (2_i64.pow(item.attempt_count.min(8))).min(300));
                item.next_attempt_at = if failure.permanent {
                    i64::MAX
                } else {
                    unix_seconds() + backoff
                };
            }
            state.last_error = Some(failure.category.clone());
            state.last_retry_at = Some(unix_seconds());
            Ok(())
        })
    }

    fn skip_history_path(&self, history_path: &str, category: &str) -> Result<(), RequestFailure> {
        self.mutate_persistent_failure(|state| {
            state.history_cursor = Some(history_path.to_string());
            state.last_error = Some(safe_category(category));
            state.last_retry_at = None;
            Ok(())
        })
    }

    fn drop_queue_item(&self, id: Uuid, category: &str) -> Result<(), RequestFailure> {
        self.mutate_persistent_failure(|state| {
            state.queue.retain(|item| item.id != id);
            state.last_error = Some(safe_category(category));
            state.last_retry_at = None;
            Ok(())
        })
    }

    fn retire_local_authorization(&self, category: &str) -> Result<(), RequestFailure> {
        self.mutate_persistent_failure(|state| {
            rotate_identity_preserving_queue(state)?;
            state.authorization_id = None;
            state.key_id = None;
            state.key_version = None;
            state.enrollment = None;
            state.paused = false;
            state.last_error = Some(safe_category(category));
            state.last_retry_at = None;
            Ok(())
        })?;
        let mut state = self
            .inner
            .state
            .lock()
            .map_err(|_| temporary("state_unavailable"))?;
        state.volatile.access_token = None;
        state.volatile.access_token_expires_at = 0;
        Ok(())
    }

    fn worker_is_ready(&self) -> bool {
        self.inner
            .state
            .lock()
            .map(|state| state.volatile.worker_not_before <= unix_seconds())
            .unwrap_or(false)
    }

    fn schedule_worker_after(&self, delay_seconds: i64) {
        if let Ok(mut state) = self.inner.state.lock() {
            state.volatile.worker_not_before = unix_seconds() + delay_seconds.max(1);
        }
    }

    fn clear_worker_failure_count(&self) {
        if let Ok(mut state) = self.inner.state.lock() {
            state.volatile.worker_failure_count = 0;
        }
    }

    fn record_worker_failure(&self, failure: &RequestFailure) {
        let delay = {
            let mut state = match self.inner.state.lock() {
                Ok(state) => state,
                Err(_) => return,
            };
            state.volatile.worker_failure_count =
                state.volatile.worker_failure_count.saturating_add(1);
            let backoff = (2_i64.pow(state.volatile.worker_failure_count.min(5))).min(30);
            let delay = failure.retry_after_seconds.unwrap_or(backoff).max(1);
            state.volatile.worker_not_before = unix_seconds() + delay;
            delay
        };
        self.record_retry(&failure.category, delay);
    }

    fn record_retry(&self, category: &str, delay_seconds: i64) {
        let _ = self.mutate_persistent(|state| {
            state.last_error = Some(safe_category(category));
            state.last_retry_at = Some(unix_seconds() + delay_seconds.max(1));
            Ok(())
        });
    }

    fn update_server_clock(&self, response: &Response) {
        let Some(server_time) = response
            .headers()
            .get("x-meticulous-server-time")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<i64>().ok())
        else {
            return;
        };
        if let Ok(mut state) = self.inner.state.lock() {
            state.volatile.clock_offset_seconds = server_time - unix_seconds();
        }
    }

    fn community_url(&self, path: &str) -> Url {
        let mut url = self.inner.community_base.clone();
        url.set_path(path);
        url.set_query(None);
        url
    }

    fn machine_url(&self, path: &str) -> Url {
        let mut url = self.inner.machine_base.clone();
        url.set_path(path);
        url.set_query(None);
        url
    }

    fn machine_history_file_url(&self, history_path: &str) -> Result<Url, RequestFailure> {
        let normalized = normalize_history_path(history_path)?;
        let mut url = self.inner.machine_base.clone();
        {
            let mut segments = url
                .path_segments_mut()
                .map_err(|_| permanent("machine_url_invalid"))?;
            segments.clear();
            for segment in ["api", "v1", "history", "files"] {
                segments.push(segment);
            }
            for segment in normalized.split('/') {
                segments.push(segment);
            }
        }
        Ok(url)
    }

    fn mutate_persistent<T>(
        &self,
        mutate: impl FnOnce(&mut PersistentState) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut runtime = self
            .inner
            .state
            .lock()
            .map_err(|_| "Community state unavailable".to_string())?;
        let mut next = runtime.persistent.clone();
        let result = mutate(&mut next)?;
        persist_state(&self.inner.state_path, &next).map_err(safe_error)?;
        runtime.persistent = next;
        Ok(result)
    }

    fn mutate_persistent_failure<T>(
        &self,
        mutate: impl FnOnce(&mut PersistentState) -> Result<T, String>,
    ) -> Result<T, RequestFailure> {
        self.mutate_persistent(mutate)
            .map_err(|_| temporary("state_persist_failed"))
    }
}

fn fresh_state() -> Result<PersistentState, String> {
    let mut seed = [0u8; 32];
    OsRng.fill_bytes(&mut seed);
    let signing_key = SigningKey::from_bytes(&seed);
    Ok(PersistentState {
        installation_id: Uuid::new_v4(),
        private_seed: URL_SAFE_NO_PAD.encode(seed),
        public_key: URL_SAFE_NO_PAD.encode(signing_key.verifying_key().to_bytes()),
        enrollment: None,
        authorization_id: None,
        key_id: None,
        key_version: None,
        paused: false,
        history_baselined: false,
        history_cursor: None,
        queue: Vec::new(),
        last_success_at: None,
        last_error: None,
        last_retry_at: None,
    })
}

fn rotate_identity_preserving_queue(state: &mut PersistentState) -> Result<(), String> {
    let fresh = fresh_state()?;
    state.installation_id = fresh.installation_id;
    state.private_seed = fresh.private_seed;
    state.public_key = fresh.public_key;
    Ok(())
}

fn load_or_create_state(path: &Path) -> Result<PersistentState, Box<dyn std::error::Error>> {
    if path.exists() {
        let bytes = fs::read(path)?;
        let state = serde_json::from_slice::<PersistentState>(&bytes)?;
        validate_state(&state)?;
        return Ok(state);
    }
    let state = fresh_state().map_err(std::io::Error::other)?;
    persist_state(path, &state)?;
    Ok(state)
}

fn validate_state(state: &PersistentState) -> Result<(), std::io::Error> {
    let seed = URL_SAFE_NO_PAD
        .decode(&state.private_seed)
        .map_err(std::io::Error::other)?;
    let seed: [u8; 32] = seed
        .try_into()
        .map_err(|_| std::io::Error::other("Invalid Community key seed"))?;
    let expected = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
    if URL_SAFE_NO_PAD.encode(expected) != state.public_key {
        return Err(std::io::Error::other("Community key state is inconsistent"));
    }
    Ok(())
}

fn persist_state(path: &Path, state: &PersistentState) -> Result<(), Box<dyn std::error::Error>> {
    let bytes = serde_json::to_vec(state)?;
    write_private_file_atomic(path, &bytes)?;
    Ok(())
}

fn write_private_file_atomic(path: &Path, bytes: &[u8]) -> Result<(), std::io::Error> {
    let parent = path
        .parent()
        .ok_or_else(|| std::io::Error::other("Missing parent directory"))?;
    create_private_dir(parent)?;
    let temporary_path = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("state"),
        Uuid::new_v4(),
    ));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary_path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    fs::rename(&temporary_path, path)?;
    File::open(parent)?.sync_all()?;
    Ok(())
}

fn create_private_dir(path: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

fn remove_orphaned_queue_files(
    queue_dir: &Path,
    queue: &[QueuedShot],
) -> Result<(), std::io::Error> {
    let expected = queue
        .iter()
        .map(|item| item.body_file.as_str())
        .collect::<std::collections::HashSet<_>>();
    for entry in fs::read_dir(queue_dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if entry.file_type()?.is_file() && !expected.contains(name.as_ref()) {
            fs::remove_file(entry.path())?;
        }
    }
    Ok(())
}

fn signed_headers(
    key_id: Uuid,
    key_version: u32,
    private_seed: &str,
    timestamp: i64,
    method: &str,
    path: &str,
    body: &[u8],
) -> Result<reqwest::header::HeaderMap, RequestFailure> {
    let nonce = random_nonce();
    let request_id = Uuid::new_v4();
    let digest = sha256_hex(body);
    let canonical = format!(
        "meticulous-machine-request-v1\nmethod:{}\npath:{}\naudience:{}\nkey-id:{}\nkey-version:{}\ntimestamp:{}\nnonce:{}\nrequest-id:{}\nbody-sha256:{}\n",
        method.to_uppercase(),
        path,
        AUDIENCE,
        key_id.to_string().to_lowercase(),
        key_version,
        timestamp,
        nonce,
        request_id.to_string().to_lowercase(),
        digest,
    );
    let signature = sign_message(private_seed, canonical.as_bytes())?;
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("x-meticulous-key-id", header_value(&key_id.to_string())?);
    headers.insert(
        "x-meticulous-key-version",
        header_value(&key_version.to_string())?,
    );
    headers.insert(
        "x-meticulous-timestamp",
        header_value(&timestamp.to_string())?,
    );
    headers.insert("x-meticulous-nonce", header_value(&nonce)?);
    headers.insert(
        "x-meticulous-request-id",
        header_value(&request_id.to_string())?,
    );
    headers.insert("x-meticulous-signature", header_value(&signature)?);
    Ok(headers)
}

fn enrollment_headers(
    installation_id: Uuid,
    private_seed: &str,
    timestamp: i64,
    path: &str,
    body: &[u8],
) -> Result<reqwest::header::HeaderMap, RequestFailure> {
    let nonce = random_nonce();
    let request_id = Uuid::new_v4();
    let digest = sha256_hex(body);
    let canonical = format!(
        "meticulous-enrollment-exchange-v1\nmethod:POST\npath:{}\naudience:{}\ninstallation-id:{}\ntimestamp:{}\nnonce:{}\nrequest-id:{}\nbody-sha256:{}\n",
        path,
        AUDIENCE,
        installation_id.to_string().to_lowercase(),
        timestamp,
        nonce,
        request_id.to_string().to_lowercase(),
        digest,
    );
    let signature = sign_message(private_seed, canonical.as_bytes())?;
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        "x-meticulous-installation-id",
        header_value(&installation_id.to_string())?,
    );
    headers.insert(
        "x-meticulous-timestamp",
        header_value(&timestamp.to_string())?,
    );
    headers.insert("x-meticulous-nonce", header_value(&nonce)?);
    headers.insert(
        "x-meticulous-request-id",
        header_value(&request_id.to_string())?,
    );
    headers.insert("x-meticulous-signature", header_value(&signature)?);
    Ok(headers)
}

fn sign_message(private_seed: &str, message: &[u8]) -> Result<String, RequestFailure> {
    let seed = URL_SAFE_NO_PAD
        .decode(private_seed)
        .map_err(|_| permanent("private_key_invalid"))?;
    let seed: [u8; 32] = seed
        .try_into()
        .map_err(|_| permanent("private_key_invalid"))?;
    let signature = SigningKey::from_bytes(&seed).sign(message);
    Ok(URL_SAFE_NO_PAD.encode(signature.to_bytes()))
}

fn response_failure(response: Response, fallback: &str) -> RequestFailure {
    let status = response.status();
    let retry_after_seconds = response
        .headers()
        .get(RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<i64>().ok());
    let category = response
        .json::<ErrorResponse>()
        .ok()
        .and_then(|value| value.error)
        .map(|value| safe_category(&value))
        .unwrap_or_else(|| fallback.to_string());
    RequestFailure {
        permanent: failure_is_permanent(status.as_u16(), &category),
        category,
        retry_after_seconds,
    }
}

fn failure_is_permanent(status: u16, category: &str) -> bool {
    if authorization_is_retired(category) {
        return true;
    }
    if status == 409 {
        return category != "replayed_request";
    }
    (400..500).contains(&status) && !matches!(status, 401 | 408 | 429)
}

fn authorization_is_retired(category: &str) -> bool {
    matches!(
        category,
        "not_authorized" | "retired_key" | "retired_or_revoked_access"
    )
}

fn normalize_history_path(value: &str) -> Result<String, RequestFailure> {
    let normalized = value.trim().trim_start_matches('/');
    let segments = normalized
        .split('/')
        .map(normalize_history_segment)
        .collect::<Result<Vec<_>, _>>()?;
    if segments.len() != 2 {
        return Err(permanent("history_path_invalid"));
    }
    Ok(segments.join("/"))
}

fn normalize_history_segment(value: &str) -> Result<String, RequestFailure> {
    let value = value.trim();
    if value.is_empty()
        || value == "."
        || value == ".."
        || value.contains('/')
        || value.contains('\\')
        || value.len() > 255
    {
        return Err(permanent("history_path_invalid"));
    }
    Ok(value.to_string())
}

fn idempotency_key(installation_id: Uuid, source_shot_id: &str) -> String {
    sha256_hex(
        format!(
            "meticulous-machine-shot-idempotency-v1\n{}\n{}\n",
            installation_id.to_string().to_lowercase(),
            source_shot_id,
        )
        .as_bytes(),
    )
}

fn random_nonce() -> String {
    let mut bytes = [0u8; 24];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn sha256_hex(value: &[u8]) -> String {
    format!("{:x}", Sha256::digest(value))
}

fn header_value(value: &str) -> Result<reqwest::header::HeaderValue, RequestFailure> {
    reqwest::header::HeaderValue::from_str(value).map_err(|_| permanent("header_invalid"))
}

fn temporary(category: &str) -> RequestFailure {
    RequestFailure {
        category: safe_category(category),
        retry_after_seconds: None,
        permanent: false,
    }
}

fn permanent(category: &str) -> RequestFailure {
    RequestFailure {
        category: safe_category(category),
        retry_after_seconds: None,
        permanent: true,
    }
}

fn safe_category(value: &str) -> String {
    let filtered = value
        .chars()
        .filter(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || *character == '_'
        })
        .take(64)
        .collect::<String>();
    if filtered.is_empty() {
        "unknown".to_string()
    } else {
        filtered
    }
}

fn safe_error(error: impl std::fmt::Display) -> String {
    let _ = error;
    "Community upload storage unavailable".to_string()
}

fn unix_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    const VECTOR: &str = include_str!("../test-vectors/machine-upload-v1.json");

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Vector {
        installation_id: Uuid,
        key_id: Uuid,
        key_version: u32,
        private_seed: String,
        public_key: String,
        request: VectorRequest,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct VectorRequest {
        method: String,
        path: String,
        timestamp: i64,
        nonce: String,
        request_id: Uuid,
        body: String,
        body_sha256: String,
        canonical: String,
        signature: String,
        idempotency_key: String,
    }

    #[test]
    fn matches_community_cross_language_vector() {
        let vector: Vector = serde_json::from_str(VECTOR).unwrap();
        let seed = URL_SAFE_NO_PAD.decode(&vector.private_seed).unwrap();
        let seed: [u8; 32] = seed.try_into().unwrap();
        let signing_key = SigningKey::from_bytes(&seed);
        assert_eq!(
            URL_SAFE_NO_PAD.encode(signing_key.verifying_key().to_bytes()),
            vector.public_key,
        );
        assert_eq!(
            sha256_hex(vector.request.body.as_bytes()),
            vector.request.body_sha256
        );
        let canonical = format!(
            "meticulous-machine-request-v1\nmethod:{}\npath:{}\naudience:{}\nkey-id:{}\nkey-version:{}\ntimestamp:{}\nnonce:{}\nrequest-id:{}\nbody-sha256:{}\n",
            vector.request.method,
            vector.request.path,
            AUDIENCE,
            vector.key_id,
            vector.key_version,
            vector.request.timestamp,
            vector.request.nonce,
            vector.request.request_id,
            vector.request.body_sha256,
        );
        assert_eq!(canonical, vector.request.canonical);
        assert_eq!(
            URL_SAFE_NO_PAD.encode(signing_key.sign(canonical.as_bytes()).to_bytes()),
            vector.request.signature,
        );
        assert_eq!(
            idempotency_key(vector.installation_id, "shot-vector-001"),
            vector.request.idempotency_key,
        );
    }

    #[test]
    fn wraps_raw_shot_without_reserializing_it() {
        let raw =
            br#" {"id":"shot-1","data":[{"unknown":true}],"profile":{"future":{"kept":true}}} "#;
        let mut body = Vec::new();
        body.extend_from_slice(b"{\"contractVersion\":1,\"shot\":");
        body.extend_from_slice(raw);
        body.push(b'}');
        assert!(body.windows(raw.len()).any(|window| window == raw));
        let parsed: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(parsed["shot"]["profile"]["future"]["kept"], true);
    }

    #[test]
    fn rejects_history_path_traversal() {
        assert!(normalize_history_path("2026-08-15/shot.json.zst").is_ok());
        assert!(normalize_history_path("../config/secret").is_err());
        assert!(normalize_history_path("2026-08-15/../../secret").is_err());
    }

    #[test]
    fn classifies_idempotency_conflicts_as_permanent() {
        assert!(failure_is_permanent(409, "idempotency_payload_mismatch"));
        assert!(!failure_is_permanent(409, "replayed_request"));
        assert!(failure_is_permanent(401, "retired_or_revoked_access"));
        assert!(!failure_is_permanent(401, "expired_request"));
    }

    #[test]
    fn rotates_revoked_identity_without_losing_queued_shots() {
        let mut state = fresh_state().expect("fresh state");
        let prior_installation = state.installation_id;
        let prior_public_key = state.public_key.clone();
        state.queue.push(QueuedShot {
            id: Uuid::new_v4(),
            source_shot_id: "queued-shot".to_string(),
            history_path: "2026-08-15/queued.shot.json".to_string(),
            body_file: "queued.json".to_string(),
            attempt_count: 2,
            next_attempt_at: 123,
            last_error: Some("retired_key".to_string()),
        });

        rotate_identity_preserving_queue(&mut state).expect("identity rotation");

        assert_ne!(state.installation_id, prior_installation);
        assert_ne!(state.public_key, prior_public_key);
        assert_eq!(state.queue.len(), 1);
        assert_eq!(state.queue[0].source_shot_id, "queued-shot");
    }
}
