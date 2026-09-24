use super::*;

pub(super) const MAX_DEFERRED_HISTORY: usize = 128;
const MAX_RETRY_SECONDS: i64 = 15 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DeferredHistory {
    pub(super) authorization_id: Uuid,
    history_kind: HistoryKind,
    history_path: String,
    pub(super) recovery_job_id: Option<Uuid>,
    recovery_only: bool,
    attempt_count: u32,
    next_attempt_at: i64,
    pub(super) last_error: String,
}

pub(super) fn retryable_file_failure(failure: &RequestFailure) -> bool {
    matches!(
        failure.category.as_str(),
        "shot_file_missing" | "shot_file_invalid" | "shot_file_unreadable"
    )
}

fn retry_delay(attempt: u32) -> i64 {
    (5_i64 * (1_i64 << attempt.saturating_sub(1).min(8))).min(MAX_RETRY_SECONDS)
}

// Called in the same state mutation that queues the body. A restart must see
// either the deferred identity or the durable body, never neither.
pub(super) fn complete_queueing(
    state: &mut PersistentState,
    kind: HistoryKind,
    path: &str,
) -> Option<Uuid> {
    let index = state.deferred_history.iter().position(|item| {
        Some(item.authorization_id) == state.authorization_id
            && item.history_kind == kind
            && item.history_path == path
    })?;
    state.deferred_history.remove(index).recovery_job_id
}

impl CommunityUploadService {
    pub(super) fn defer_history_path(
        &self,
        kind: HistoryKind,
        path: &str,
        checkpoint: Checkpoint,
        authorization_id: Uuid,
        failure: &RequestFailure,
    ) -> Result<(), RequestFailure> {
        let stored = self.mutate_persistent_failure(|state| {
            if state.authorization_id != Some(authorization_id)
                || state.paused
                || !recovery::checkpoint_allowed(state, checkpoint)
            {
                return Ok(true);
            }
            let existing = state.deferred_history.iter().position(|item| {
                item.authorization_id == authorization_id
                    && item.history_kind == kind
                    && item.history_path == path
            });
            if let Some(index) = existing {
                let item = &mut state.deferred_history[index];
                match checkpoint {
                    Checkpoint::Live => item.recovery_only = false,
                    Checkpoint::Recovery(id) => item.recovery_job_id = Some(id),
                }
            } else {
                if state.deferred_history.len() >= MAX_DEFERRED_HISTORY {
                    // Backpressure preserves the discovery cursor and every
                    // unresolved identity when the bounded ledger is full.
                    return Ok(false);
                }
                state.deferred_history.push(DeferredHistory {
                    authorization_id,
                    history_kind: kind,
                    history_path: path.to_string(),
                    recovery_job_id: match checkpoint {
                        Checkpoint::Live => None,
                        Checkpoint::Recovery(id) => Some(id),
                    },
                    recovery_only: matches!(checkpoint, Checkpoint::Recovery(_)),
                    attempt_count: 1,
                    next_attempt_at: unix_seconds() + retry_delay(1),
                    last_error: safe_category(&failure.category),
                });
            }
            recovery::advance_checkpoint(state, checkpoint, kind, path);
            state.last_error = Some(safe_category(&failure.category));
            Ok(true)
        })?;
        if stored {
            Ok(())
        } else {
            Err(temporary("history_retry_capacity_reached"))
        }
    }

    pub(super) fn retry_deferred_history(&self) -> Result<(), RequestFailure> {
        let item = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            if state.persistent.paused || state.persistent.key_id.is_none() {
                return Ok(());
            }
            state
                .persistent
                .deferred_history
                .iter()
                .filter(|item| {
                    Some(item.authorization_id) == state.persistent.authorization_id
                        && item.next_attempt_at <= unix_seconds()
                })
                .min_by_key(|item| item.next_attempt_at)
                .cloned()
        };
        let Some(item) = item else {
            return Ok(());
        };
        let checkpoint = if item.recovery_only {
            let Some(id) = item.recovery_job_id else {
                return Ok(());
            };
            Checkpoint::Recovery(id)
        } else {
            Checkpoint::Live
        };
        let result = self.queue_history_path_for_authorization(
            item.history_kind,
            &item.history_path,
            checkpoint,
            item.authorization_id,
        );
        let Err(failure) = result else {
            return Ok(());
        };
        self.mutate_persistent_failure(|state| {
            if state.authorization_id != Some(item.authorization_id) || state.paused {
                return Ok(());
            }
            let Some(index) = state.deferred_history.iter().position(|entry| {
                entry.authorization_id == item.authorization_id
                    && entry.history_kind == item.history_kind
                    && entry.history_path == item.history_path
            }) else {
                return Ok(());
            };
            if failure.permanent {
                let removed = state.deferred_history.remove(index);
                if let Some(job) = state.recovery.as_mut().filter(|job| {
                    Some(job.id) == removed.recovery_job_id
                        && !job.interrupted
                        && job.authorization_id == removed.authorization_id
                }) {
                    job.failed = job.failed.saturating_add(1);
                    job.last_issue = Some(safe_category(&failure.category));
                }
            } else {
                let entry = &mut state.deferred_history[index];
                let capacity = matches!(
                    failure.category.as_str(),
                    "queue_capacity_reached" | "recovery_queue_capacity_reached"
                );
                if !capacity {
                    entry.attempt_count = entry.attempt_count.saturating_add(1);
                }
                entry.next_attempt_at = unix_seconds()
                    + if capacity {
                        5
                    } else {
                        retry_delay(entry.attempt_count)
                    };
                entry.last_error = safe_category(&failure.category);
            }
            state.last_error = Some(safe_category(&failure.category));
            Ok(())
        })
    }
}

#[cfg(test)]
pub(super) fn make_due(state: &mut PersistentState) {
    for item in &mut state.deferred_history {
        item.next_attempt_at = 0;
    }
}
