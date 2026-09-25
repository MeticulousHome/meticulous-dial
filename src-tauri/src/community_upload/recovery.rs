use super::*;

impl HistoryRecovery {
    fn new(authorization_id: Uuid) -> Self {
        Self {
            id: Uuid::new_v4(),
            authorization_id,
            interrupted: false,
            espresso: RecoveryStream::default(),
            pour_over: RecoveryStream::default(),
            added: 0,
            already_present: 0,
            preserved_deleted: 0,
            failed: 0,
            last_issue: None,
        }
    }

    fn stream(&self, kind: HistoryKind) -> &RecoveryStream {
        match kind {
            HistoryKind::Espresso => &self.espresso,
            HistoryKind::PourOver => &self.pour_over,
        }
    }
    fn stream_mut(&mut self, kind: HistoryKind) -> &mut RecoveryStream {
        match kind {
            HistoryKind::Espresso => &mut self.espresso,
            HistoryKind::PourOver => &mut self.pour_over,
        }
    }
    fn pending(&self, state: &PersistentState) -> usize {
        state
            .queue
            .iter()
            .filter(|item| item.recovery_job_id == Some(self.id))
            .count()
            + state
                .deferred_history
                .iter()
                .filter(|item| item.recovery_job_id == Some(self.id))
                .count()
    }
    fn completed(&self, state: &PersistentState) -> bool {
        self.espresso.exhausted && self.pour_over.exhausted && self.pending(state) == 0
    }
}

fn automatic_recovery_authorization(state: &PersistentState) -> Option<Uuid> {
    state.authorization_id.filter(|authorization_id| {
        state.key_id.is_some()
            && state.key_version.is_some()
            && !state
                .recovery
                .as_ref()
                .is_some_and(|job| job.authorization_id == *authorization_id && !job.interrupted)
    })
}

pub(super) fn status(state: &PersistentState) -> Option<RecoveryStatus> {
    state.recovery.as_ref().map(|job| RecoveryStatus {
        state: if job.interrupted {
            "interrupted"
        } else if job.completed(state) {
            "completed"
        } else {
            "running"
        },
        added: job.added,
        already_present: job.already_present,
        preserved_deleted: job.preserved_deleted,
        failed: job.failed,
        pending_count: job.pending(state),
        last_error: job
            .espresso
            .last_error
            .clone()
            .or_else(|| job.pour_over.last_error.clone())
            .or_else(|| {
                state
                    .queue
                    .iter()
                    .find(|item| item.recovery_job_id == Some(job.id) && item.last_error.is_some())
                    .and_then(|item| item.last_error.clone())
            })
            .or_else(|| {
                state
                    .deferred_history
                    .iter()
                    .find(|item| item.recovery_job_id == Some(job.id))
                    .map(|item| item.last_error.clone())
            })
            .or_else(|| job.last_issue.clone()),
    })
}

pub(super) fn checkpoint_allowed(state: &PersistentState, checkpoint: Checkpoint) -> bool {
    match checkpoint {
        Checkpoint::Live => true,
        Checkpoint::Recovery(id) => {
            !state.paused
                && state.recovery.as_ref().is_some_and(|job| {
                    job.id == id
                        && !job.interrupted
                        && state.authorization_id == Some(job.authorization_id)
                        && state.key_id.is_some()
                        && state.key_version.is_some()
                })
        }
    }
}

pub(super) fn advance_checkpoint(
    state: &mut PersistentState,
    checkpoint: Checkpoint,
    kind: HistoryKind,
    path: &str,
) {
    match checkpoint {
        Checkpoint::Live => match kind {
            HistoryKind::Espresso => advance_cursor(&mut state.history_cursor, path),
            HistoryKind::PourOver => advance_cursor(&mut state.pour_over_history_cursor, path),
        },
        Checkpoint::Recovery(_) => {
            let stream = state
                .recovery
                .as_mut()
                .expect("validated recovery job")
                .stream_mut(kind);
            advance_cursor(&mut stream.cursor, path);
            stream.exhausted = stream.through.as_deref().is_some_and(|through| {
                stream
                    .cursor
                    .as_deref()
                    .is_some_and(|cursor| cursor >= through)
            });
            stream.retry_path = None;
            stream.file_attempts = 0;
            stream.last_error = None;
            stream.next_scan_at = unix_seconds() + 1;
        }
    }
}

fn advance_cursor(cursor: &mut Option<String>, path: &str) {
    if cursor.as_deref().is_none_or(|previous| path > previous) {
        *cursor = Some(path.to_string());
    }
}

pub(super) fn interrupt(state: &mut PersistentState) {
    let Some(job) = state.recovery.as_mut() else {
        return;
    };
    if job.interrupted {
        return;
    }
    job.interrupted = true;
    job.last_issue = Some("recovery_authorization_changed".to_string());
    state
        .deferred_history
        .retain(|item| item.recovery_job_id != Some(job.id));
    state
        .queue
        .retain(|item| item.recovery_job_id != Some(job.id) || !item.recovery_only);
    for item in &mut state.queue {
        if item.recovery_job_id == Some(job.id) {
            item.recovery_job_id = None;
        }
    }
}

pub(super) fn next_due_item(state: &mut RuntimeState, now: i64) -> Option<QueuedShot> {
    let live = state
        .persistent
        .queue
        .iter()
        .find(|item| !item.recovery_only && item.next_attempt_at <= now);
    let recovery = state.persistent.queue.iter().find(|item| {
        item.recovery_only
            && item.next_attempt_at <= now
            && state.volatile.recovery_upload_not_before <= now
    });
    let next = if state.volatile.live_upload_streak >= 3 {
        recovery.or(live)
    } else {
        live.or(recovery)
    }
    .cloned();
    if let Some(item) = &next {
        state.volatile.live_upload_streak = if item.recovery_only {
            0
        } else {
            state.volatile.live_upload_streak.saturating_add(1)
        };
    }
    next
}

pub(super) fn record_outcome(
    state: &mut PersistentState,
    id: Uuid,
    receipt: Option<&UploadReceipt>,
    failure: Option<&str>,
) {
    let Some(item) = state.queue.iter().find(|item| item.id == id) else {
        return;
    };
    let Some(job) = state.recovery.as_mut() else {
        return;
    };
    if item.recovery_job_id != Some(job.id)
        || job.interrupted
        || state.authorization_id != Some(job.authorization_id)
    {
        return;
    }
    if let Some(category) = failure {
        job.failed = job.failed.saturating_add(1);
        job.last_issue = Some(safe_category(category));
    } else if let Some(receipt) = receipt {
        if receipt.excluded {
            // The server's ownership cutoff excludes older machine history.
            // It is neither an imported/existing brew nor a failed upload.
        } else if receipt.deleted {
            job.preserved_deleted = job.preserved_deleted.saturating_add(1);
        } else if receipt.imported {
            job.added = job.added.saturating_add(1);
        } else {
            job.already_present = job.already_present.saturating_add(1);
        }
    }
}

impl CommunityUploadService {
    pub(super) fn ensure_automatic_history_recovery(&self) -> Result<(), RequestFailure> {
        let needed = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            automatic_recovery_authorization(&state.persistent).is_some()
        };
        if !needed {
            return Ok(());
        }
        // Check again under the persistence lock: pairing or a manual retry can
        // change the authorization/job between the read and the durable write.
        self.mutate_persistent_failure(|state| {
            if let Some(authorization_id) = automatic_recovery_authorization(state) {
                state.recovery = Some(HistoryRecovery::new(authorization_id));
            }
            Ok(())
        })
    }

    pub fn start_history_recovery(&self) -> Result<(), String> {
        self.interrupt_mismatched_recovery()
            .map_err(|failure| failure.to_string())?;
        self.mutate_persistent(|state| {
            let authorization_id = state
                .authorization_id
                .filter(|_| state.key_id.is_some() && state.key_version.is_some())
                .ok_or_else(|| "Connect Community before importing saved brews".to_string())?;
            if state
                .recovery
                .as_ref()
                .is_some_and(|job| !job.interrupted && !job.completed(state))
            {
                return Ok(());
            }
            state.recovery = Some(HistoryRecovery::new(authorization_id));
            Ok(())
        })
    }

    pub(super) fn interrupt_mismatched_recovery(&self) -> Result<(), RequestFailure> {
        let mismatch = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?;
            state.persistent.recovery.as_ref().is_some_and(|job| {
                !job.interrupted && state.persistent.authorization_id != Some(job.authorization_id)
            })
        };
        if !mismatch {
            return Ok(());
        }
        let files = self.mutate_persistent_failure(|state| {
            if !state
                .recovery
                .as_ref()
                .is_some_and(|job| state.authorization_id != Some(job.authorization_id))
            {
                return Ok(Vec::new());
            }
            let files = state
                .queue
                .iter()
                .filter(|item| item.recovery_only)
                .map(|item| item.body_file.clone())
                .collect::<Vec<_>>();
            interrupt(state);
            Ok(files)
        })?;
        for file in files {
            let _ = fs::remove_file(self.inner.queue_dir.join(file));
        }
        Ok(())
    }

    pub(super) fn queued_upload_allowed(
        &self,
        queued: &QueuedShot,
    ) -> Result<bool, RequestFailure> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| temporary("state_unavailable"))?;
        if state.persistent.paused
            || !state
                .persistent
                .queue
                .iter()
                .any(|item| item.id == queued.id)
        {
            return Ok(false);
        }
        Ok(!queued.recovery_only
            || queued
                .recovery_job_id
                .is_some_and(|id| checkpoint_allowed(&state.persistent, Checkpoint::Recovery(id))))
    }

    pub(super) fn ensure_recovery_capacity(
        &self,
        additional_bytes: u64,
    ) -> Result<(), RequestFailure> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| temporary("state_unavailable"))?;
        let items = state
            .persistent
            .queue
            .iter()
            .filter(|item| item.recovery_only)
            .collect::<Vec<_>>();
        let bytes = items.iter().fold(0_u64, |total, item| {
            total.saturating_add(
                fs::metadata(self.inner.queue_dir.join(&item.body_file))
                    .map(|m| m.len())
                    .unwrap_or(0),
            )
        });
        if items.len() >= MAX_RECOVERY_ITEMS
            || bytes.saturating_add(additional_bytes) > MAX_RECOVERY_BYTES
        {
            return Err(temporary("recovery_queue_capacity_reached"));
        }
        Ok(())
    }

    pub(super) fn attach_queued_history(
        &self,
        kind: HistoryKind,
        path: &str,
        source_id: Option<&str>,
        checkpoint: Checkpoint,
        authorization_id: Uuid,
    ) -> Result<bool, RequestFailure> {
        // Avoid persisting a no-op for each lookup; perform the actual lookup
        // again under mutate_persistent's lock before attaching/checkpointing.
        let exists = self
            .inner
            .state
            .lock()
            .map_err(|_| temporary("state_unavailable"))?
            .persistent
            .queue
            .iter()
            .any(|item| {
                (item.history_kind == kind && item.history_path == path)
                    || source_id == Some(item.source_shot_id.as_str())
            });
        if !exists {
            return Ok(false);
        }
        self.mutate_persistent_failure(|state| {
            if state.authorization_id != Some(authorization_id)
                || state.paused
                || !checkpoint_allowed(state, checkpoint)
            {
                return Ok(true);
            }
            let Some(index) = state.queue.iter().position(|item| {
                (item.history_kind == kind && item.history_path == path)
                    || source_id == Some(item.source_shot_id.as_str())
            }) else {
                return Ok(false);
            };
            let deferred_job = deferred::complete_queueing(state, kind, path);
            let item = &mut state.queue[index];
            item.recovery_job_id = item.recovery_job_id.or(deferred_job);
            match checkpoint {
                Checkpoint::Live => item.recovery_only = false,
                Checkpoint::Recovery(id) => item.recovery_job_id = Some(id),
            }
            advance_checkpoint(state, checkpoint, kind, path);
            Ok(true)
        })
    }

    pub(super) fn recover_saved_history(&self) {
        // Stream failures are persisted locally and never become worker-wide
        // backoff: the other method and live discovery remain independently useful.
        for kind in [HistoryKind::Espresso, HistoryKind::PourOver] {
            if let Err(failure) = self.recover_stream(kind) {
                log::warn!(
                    "[CommunityUpload] recovery_deferred kind={kind:?} category={}",
                    failure.category
                );
            }
        }
    }

    fn recovery_snapshot(
        &self,
        kind: HistoryKind,
    ) -> Result<Option<(Uuid, RecoveryStream)>, RequestFailure> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| temporary("state_unavailable"))?;
        Ok(state
            .persistent
            .recovery
            .as_ref()
            .filter(|job| {
                checkpoint_allowed(&state.persistent, Checkpoint::Recovery(job.id))
                    && !job.stream(kind).exhausted
                    && job.stream(kind).next_scan_at <= unix_seconds()
            })
            .map(|job| (job.id, job.stream(kind).clone())))
    }

    fn recover_stream(&self, kind: HistoryKind) -> Result<(), RequestFailure> {
        let Some((id, mut stream)) = self.recovery_snapshot(kind)? else {
            return Ok(());
        };
        if self.ensure_recovery_capacity(0).is_err() {
            return Ok(());
        }
        let operation = (|| {
            if !stream.initialized {
                let through = match kind {
                    HistoryKind::Espresso => {
                        let (through, complete) =
                            self.fetch_recovery_espresso_bound(stream.through.as_deref())?;
                        if !complete {
                            self.mutate_persistent_failure(|state| {
                                if checkpoint_allowed(state, Checkpoint::Recovery(id)) {
                                    let stream = state.recovery.as_mut().unwrap().stream_mut(kind);
                                    stream.through = through;
                                    stream.next_scan_at = unix_seconds() + 1;
                                    stream.last_error = None;
                                }
                                Ok(())
                            })?;
                            return Ok(());
                        }
                        through
                    }
                    HistoryKind::PourOver => self.fetch_last_pour_over_history_path()?,
                };
                // The legacy last endpoint returns 404 for both unsupported and
                // empty histories. An actual empty index proves an empty snapshot.
                if through.is_none() {
                    let page = match kind {
                        HistoryKind::Espresso => self.fetch_history_paths(None)?,
                        HistoryKind::PourOver => self.fetch_pour_over_history_paths(None)?,
                    };
                    if !page.paths.is_empty() {
                        return Err(temporary("recovery_snapshot_invalid"));
                    }
                }
                let committed = self.mutate_persistent_failure(|state| {
                    if !checkpoint_allowed(state, Checkpoint::Recovery(id)) {
                        return Ok(false);
                    }
                    let stream = state.recovery.as_mut().unwrap().stream_mut(kind);
                    stream.initialized = true;
                    stream.through = through.clone();
                    stream.exhausted = through.is_none();
                    stream.last_error = None;
                    Ok(true)
                })?;
                if !committed || through.is_none() {
                    return Ok(());
                }
                stream.initialized = true;
                stream.through = through;
            }
            let page = match kind {
                HistoryKind::Espresso => self.fetch_history_paths(stream.cursor.as_deref())?,
                HistoryKind::PourOver => {
                    self.fetch_pour_over_history_paths(stream.cursor.as_deref())?
                }
            };
            let path = page
                .paths
                .into_iter()
                .find(|path| stream.cursor.as_ref().is_none_or(|cursor| path > cursor));
            let Some(path) = path.filter(|path| {
                stream
                    .through
                    .as_ref()
                    .is_some_and(|through| path <= through)
            }) else {
                self.mutate_persistent_failure(|state| {
                    if checkpoint_allowed(state, Checkpoint::Recovery(id)) {
                        let stream = state.recovery.as_mut().unwrap().stream_mut(kind);
                        stream.exhausted = true;
                        stream.last_error = None;
                    }
                    Ok(())
                })?;
                return Ok(());
            };
            match self.queue_history_path_for(kind, &path, Checkpoint::Recovery(id)) {
                Ok(()) => Ok(()),
                Err(failure)
                    if matches!(
                        failure.category.as_str(),
                        "queue_capacity_reached" | "recovery_queue_capacity_reached"
                    ) =>
                {
                    Ok(())
                }
                Err(failure) => {
                    self.record_recovery_scan_error(id, kind, Some(&path), &failure)?;
                    Ok(())
                }
            }
        })();
        if let Err(failure) = operation {
            self.record_recovery_scan_error(id, kind, None, &failure)?;
        }
        Ok(())
    }

    fn fetch_recovery_espresso_bound(
        &self,
        after: Option<&str>,
    ) -> Result<(Option<String>, bool), RequestFailure> {
        if after.is_none() {
            let response = self
                .inner
                .client
                .get(self.machine_url("/api/v1/history/upload-index/last"))
                .send()
                .map_err(|_| temporary("machine_history_unavailable"))?;
            if response.status().is_success() {
                return parse_latest_history_path(response, "machine_history")
                    .map(|path| (path, true));
            }
            if !matches!(response.status().as_u16(), 404 | 405) {
                return Err(temporary("machine_history_unavailable"));
            }
        }
        // Legacy /history orders by brew time, whereas upload-index orders by
        // filename. Establish the recovery bound in the same order as its scan.
        // While uninitialized, through stores this bounded discovery checkpoint;
        // the live cursor and the recovery import cursor stay untouched.
        let page = self.fetch_history_paths(after)?;
        Ok((
            page.paths
                .last()
                .cloned()
                .or_else(|| after.map(str::to_string)),
            page.complete,
        ))
    }

    fn record_recovery_scan_error(
        &self,
        id: Uuid,
        kind: HistoryKind,
        path: Option<&str>,
        failure: &RequestFailure,
    ) -> Result<(), RequestFailure> {
        if let Some(path) = path.filter(|_| deferred::retryable_file_failure(failure)) {
            let authorization = self
                .inner
                .state
                .lock()
                .map_err(|_| temporary("state_unavailable"))?
                .persistent
                .recovery
                .as_ref()
                .filter(|job| job.id == id && !job.interrupted)
                .map(|job| job.authorization_id);
            if let Some(authorization_id) = authorization {
                return self.defer_history_path(
                    kind,
                    path,
                    Checkpoint::Recovery(id),
                    authorization_id,
                    failure,
                );
            }
            return Ok(());
        }
        self.mutate_persistent_failure(|state| {
            if !checkpoint_allowed(state, Checkpoint::Recovery(id)) {
                return Ok(());
            }
            let job = state.recovery.as_mut().unwrap();
            let stream = job.stream_mut(kind);
            stream.last_error = Some(failure.category.clone());
            stream.next_scan_at = unix_seconds() + failure.retry_after_seconds.unwrap_or(5).max(1);
            if let Some(path) = path {
                if failure.permanent {
                    advance_checkpoint(state, Checkpoint::Recovery(id), kind, path);
                    let job = state.recovery.as_mut().unwrap();
                    job.failed = job.failed.saturating_add(1);
                    job.last_issue = Some(failure.category.clone());
                }
            }
            Ok(())
        })
    }
}
