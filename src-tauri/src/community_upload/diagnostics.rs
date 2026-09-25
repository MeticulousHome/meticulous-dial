//! Allowlisted diagnostics only: never serialize persistent uploader state.
use super::{unix_seconds, write_private_file_atomic};
use serde_json::{Value, json};
use std::path::Path;
use std::sync::{Mutex, OnceLock};

const CATEGORIES: &[&str] = &[
    "upload_network",
    "token_network",
    "exchange_network",
    "disconnect_network",
    "machine_history_unavailable",
    "machine_pour_over_history_unavailable",
    "machine_history_invalid",
    "machine_history_too_large",
    "machine_history_incomplete",
    "machine_pour_over_history_invalid",
    "machine_pour_over_history_too_large",
    "machine_pour_over_history_incomplete",
    "response_read_failed",
    "response_too_large",
    "state_unavailable",
    "state_persist_failed",
    "queue_write_failed",
    "queue_capacity_reached",
    "queued_body_missing",
    "queued_body_too_large",
    "shot_file_pending",
    "shot_file_too_large",
    "shot_data_invalid",
    "shot_id_invalid",
    "history_path_invalid",
    "key_missing",
    "private_key_invalid",
    "header_invalid",
    "enrollment_missing",
    "pairing_code_expired",
    "invalid_exchange_body",
    "invalid_json",
    "invalid_payload",
    "expired_request",
    "replayed_request",
    "retired_or_revoked_access",
    "idempotency_payload_mismatch",
    "community_pour_over_not_ready",
    "pour_over_replay_scheduled",
    "pour_over_samples_invalid",
    "pour_over_duration_invalid",
    "pour_over_mode_invalid",
    "pour_over_pours_invalid",
    "pour_over_schema_invalid",
    "pour_over_targets_invalid",
    "pour_over_type_invalid",
    "upload_failed",
    "token_failed",
    "exchange_failed",
    "rate_limited",
    "other_error",
];

fn category(value: &str) -> &str {
    if CATEGORIES.contains(&value) {
        value
    } else {
        "other_error"
    }
}

#[derive(Default)]
struct Events {
    last: Option<Value>,
    last_emitted: i64,
}

impl Events {
    fn failure(&mut self, event: Value, now: i64) -> bool {
        // A request UUID changes on every retry; it must not defeat suppression.
        let same = self.last.as_ref().is_some_and(|last| {
            last["category"] == event["category"] && last["httpStatus"] == event["httpStatus"]
        });
        let emit = !same || now - self.last_emitted >= 300;
        if !same || event["requestId"].is_string() {
            self.last = Some(event);
        }
        if emit {
            self.last_emitted = now;
        }
        emit
    }
}

fn events() -> &'static Mutex<Events> {
    static EVENTS: OnceLock<Mutex<Events>> = OnceLock::new();
    EVENTS.get_or_init(|| Mutex::new(Events::default()))
}

pub(super) fn failure(
    code: &str,
    status: Option<u16>,
    retry: Option<i64>,
    request_id: Option<&str>,
) {
    let event = json!({
        "category": category(code), "httpStatus": status, "occurredAt": unix_seconds(),
        "retryAfterSeconds": retry.map(|n| n.max(0)),
        "requestId": request_id.and_then(|id| uuid::Uuid::parse_str(id).ok()).map(|id| id.to_string()),
    });
    if let Ok(mut events) = events().lock() {
        if events.failure(event.clone(), unix_seconds()) {
            log::warn!("[CommunityUpload] failure {}", event);
        }
    }
}

pub(super) fn recovered() {
    if let Ok(mut events) = events().lock() {
        if events.last.take().is_some() {
            log::info!("[CommunityUpload] upload_resumed");
        }
    }
}

pub(super) fn snapshot(status: &Value, now: i64) -> Value {
    let mut result = json!({"schemaVersion": 1, "capturedAt": now});
    for key in ["connected", "paused"] {
        result[key] = status[key]
            .as_bool()
            .map(Value::Bool)
            .unwrap_or(Value::Null);
    }
    for key in ["pendingCount", "lastSuccessAt", "lastRetryAt"] {
        result[key] = status[key].as_u64().map(Value::from).unwrap_or(Value::Null);
    }
    result["lastError"] = status["lastError"]
        .as_str()
        .map(|s| Value::from(category(s)))
        .unwrap_or(Value::Null);
    // Compatible with recovery-enabled Dial versions without copying arbitrary fields.
    result["recovery"] = if status["recovery"].is_object() {
        let source = &status["recovery"];
        let mut recovery = json!({"available": true});
        recovery["state"] = source["state"]
            .as_str()
            .filter(|s| {
                [
                    "idle",
                    "pending",
                    "scanning",
                    "uploading",
                    "completed",
                    "paused",
                    "failed",
                    "interrupted",
                    "running",
                ]
                .contains(s)
            })
            .map(Value::from)
            .unwrap_or(Value::Null);
        for key in [
            "added",
            "alreadyPresent",
            "preservedDeleted",
            "failed",
            "pendingCount",
        ] {
            recovery[key] = source[key].as_u64().map(Value::from).unwrap_or(Value::Null);
        }
        recovery["lastError"] = source["lastError"]
            .as_str()
            .map(|s| Value::from(category(s)))
            .unwrap_or(Value::Null);
        recovery
    } else {
        json!({"available": false})
    };
    result
}

#[derive(Default)]
pub(super) struct Reporter {
    last_write: Option<i64>,
    write_failed: bool,
}

impl Reporter {
    pub(super) fn observe(&mut self, status: Value, path: &Path) {
        let now = unix_seconds();
        // Bounded disk writes even when retries/status updates happen every tick.
        if self.last_write.is_some_and(|last| now - last < 30) {
            return;
        }
        self.last_write = Some(now);
        let mut output = snapshot(&status, now);
        if let Ok(events) = events().lock() {
            output["lastFailure"] = events.last.clone().unwrap_or(Value::Null);
        }
        let failed = serde_json::to_vec(&output)
            .ok()
            .is_none_or(|bytes| write_private_file_atomic(path, &bytes).is_err());
        if failed && !self.write_failed {
            log::warn!("[CommunityUpload] diagnostics_write_failed");
        } else if !failed && self.write_failed {
            log::info!("[CommunityUpload] diagnostics_write_recovered");
        }
        self.write_failed = failed;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn snapshot_excludes_secrets_and_unknown_fields() {
        let value = snapshot(
            &json!({"connected": true, "paused": false, "pendingCount": 2,
            "privateSeed": "SECRET", "accessToken": "SECRET", "lastError": "SECRET",
            "recovery": {"state": "running", "added": 3, "privateSeed": "SECRET"}}),
            42,
        );
        assert!(!value.to_string().contains("SECRET"));
        assert_eq!(value["lastError"], "other_error");
        assert_eq!(value["recovery"]["added"], 3);
        assert_eq!(value["pendingCount"], 2);
    }
    #[test]
    fn reporter_writes_private_sanitized_file_and_limits_writes() {
        let root =
            std::env::temp_dir().join(format!("upload-diagnostics-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("diagnostics.json");
        let mut reporter = Reporter::default();
        reporter.observe(json!({"pendingCount": 2, "accessToken": "SECRET"}), &path);
        let first = std::fs::read_to_string(&path).unwrap();
        assert!(!first.contains("SECRET"));
        assert_eq!(
            serde_json::from_str::<Value>(&first).unwrap()["pendingCount"],
            2
        );
        reporter.observe(json!({"pendingCount": 3}), &path);
        assert_eq!(std::fs::read_to_string(&path).unwrap(), first);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn repeated_requests_do_not_flood_logs() {
        let mut events = Events::default();
        let event = json!({"category":"upload_network", "httpStatus":null,"requestId":null});
        assert!(events.failure(event.clone(), 1));
        assert!(!events.failure(event.clone(), 2));
        assert!(events.failure(event, 301));
        assert!(events.failure(json!({"category":"token_network","httpStatus":401}), 302));
    }
}
