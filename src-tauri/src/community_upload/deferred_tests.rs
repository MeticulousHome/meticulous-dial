use super::*;

#[test]
fn stale_exchange_response_cannot_undo_reset_or_replace_new_enrollment() {
    for reset in [false, true] {
        for replace_enrollment in [false, true] {
            if !reset && !replace_enrollment {
                continue;
            }
            for response_status in [200, 400] {
                let service: Arc<Mutex<Option<CommunityUploadService>>> =
                    Arc::new(Mutex::new(None));
                let callback = Arc::clone(&service);
                let expected: Arc<Mutex<Option<PersistentState>>> = Arc::new(Mutex::new(None));
                let server_expected = Arc::clone(&expected);
                let server = MachineServer::start(move |url| {
                    assert_eq!(url.path(), EXCHANGE_PATH);
                    let service = callback.lock().unwrap().as_ref().unwrap().clone();
                    if reset {
                        service.factory_reset_local().unwrap();
                    }
                    if replace_enrollment {
                        service.begin_enrollment(None).unwrap();
                    }
                    *server_expected.lock().unwrap() =
                        Some(service.inner.state.lock().unwrap().persistent.clone());
                    if response_status == 200 {
                        Reply::json(json!({
                            "accessToken":"stale-exchange-token", "authorizationId":Uuid::new_v4(),
                            "keyId":Uuid::new_v4(), "keyVersion":1,
                        }))
                    } else {
                        Reply::bytes(400, r#"{"error":"invalid_enrollment"}"#)
                    }
                });
                let fixture = TestService::new(&server, false);
                fixture.service.factory_reset_local().unwrap();
                fixture.service.begin_enrollment(None).unwrap();
                *service.lock().unwrap() = Some(fixture.service.clone());
                fixture.service.try_exchange().unwrap();
                let expected = expected.lock().unwrap().as_ref().unwrap().clone();
                fixture.reload();
                let state = fixture.state();
                assert_eq!(state.installation_id, expected.installation_id);
                assert!(state.authorization_id.is_none());
                assert!(state.key_id.is_none());
                assert!(state.key_version.is_none());
                assert_eq!(
                    state.enrollment.as_ref().map(|item| &item.challenge),
                    expected.enrollment.as_ref().map(|item| &item.challenge)
                );
                assert_eq!(state.last_error, expected.last_error);
                assert!(
                    fixture
                        .service
                        .inner
                        .state
                        .lock()
                        .unwrap()
                        .volatile
                        .access_token
                        .is_none()
                );
                fixture.service.ensure_automatic_history_recovery().unwrap();
                assert!(fixture.state().recovery.is_none());
            }
        }
    }
}

#[test]
fn gateway_or_interrupted_body_stops_after_one_file_without_filling_retry_ledger() {
    for status in [200, 502, 503, 504] {
        let server = MachineServer::start(move |url| match url.path() {
            "/api/v1/history/upload-index" => index(
                &(0..200)
                    .map(|n| format!("2026-09-25/{n:04}.json"))
                    .collect::<Vec<_>>(),
            ),
            path if path.starts_with("/api/v1/history/files/") => {
                let mut reply = Reply::bytes(status, "{}");
                if status == 200 {
                    reply.declared_length = Some(500);
                }
                reply
            }
            _ => recovery_routes(url),
        });
        let fixture = TestService::new(&server, true);
        assert_eq!(
            fixture.service.observe_new_shots().unwrap_err().category,
            "shot_file_pending"
        );
        assert!(fixture.service.observe_new_pour_overs().unwrap());
        assert_eq!(
            server
                .requests()
                .iter()
                .filter(|path| path.starts_with("/api/v1/history/files/"))
                .count(),
            1
        );
        assert!(fixture.state().deferred_history.is_empty());
        assert!(fixture.state().history_cursor.is_none());
        assert_eq!(
            fixture.state().queue.len(),
            1,
            "the other method remains discoverable"
        );
    }
}

fn due(fixture: &TestService) {
    recovery_ready(fixture);
    deferred::make_due(&mut fixture.service.inner.state.lock().unwrap().persistent);
}

#[test]
fn bad_live_file_does_not_block_later_brews_and_heals_after_restart() {
    for kind in [HistoryKind::Espresso, HistoryKind::PourOver] {
        for bad_status in [404, 500, 200] {
            let populated = Arc::new(AtomicBool::new(false));
            let healthy = Arc::new(AtomicBool::new(false));
            let server_populated = Arc::clone(&populated);
            let server_healthy = Arc::clone(&healthy);
            let index_path = match kind {
                HistoryKind::Espresso => "/api/v1/history/upload-index",
                HistoryKind::PourOver => "/api/v1/history/pour-over",
            };
            const BAD: &str = "2026-09-25/0001.json.zst";
            const GOOD: &str = "2026-09-25/0002.json.zst";
            let server = MachineServer::start(move |url| match url.path() {
                "/api/v1/history/upload-index/last" => Reply::json(json!({"file":null})),
                "/api/v1/history/pour-over/last" => Reply::bytes(404, ""),
                path if path == index_path && server_populated.load(Ordering::SeqCst) => {
                    let after = url
                        .query_pairs()
                        .find(|(key, _)| key == "after")
                        .map(|(_, value)| value.into_owned());
                    index(
                        &[BAD, GOOD]
                            .into_iter()
                            .filter(|path| after.as_deref().is_none_or(|cursor| *path > cursor))
                            .map(str::to_string)
                            .collect::<Vec<_>>(),
                    )
                }
                "/api/v1/history/upload-index" | "/api/v1/history/pour-over" => index(&[]),
                path if path.ends_with(BAD) && !server_healthy.load(Ordering::SeqCst) => {
                    Reply::bytes(bad_status, "invalid history entry")
                }
                path if path.ends_with(BAD) || path.ends_with(GOOD) => {
                    let mut record = match kind {
                        HistoryKind::Espresso => espresso(),
                        HistoryKind::PourOver => pour_over(),
                    };
                    record["id"] = json!(if path.ends_with(BAD) {
                        "deferred"
                    } else {
                        "following"
                    });
                    Reply::json(record)
                }
                SHOT_PATH => Reply::json(json!({"success":true,"imported":true,"deleted":false})),
                _ => Reply::bytes(503, "unexpected route"),
            });
            let fixture = TestService::new(&server, false);
            fixture.service.worker_tick().unwrap();
            assert_eq!(
                fixture.service.status().recovery.unwrap().state,
                "completed"
            );
            populated.store(true, Ordering::SeqCst);
            due(&fixture);
            fixture.service.request_history_scan().unwrap();
            fixture.service.worker_tick().unwrap();
            fixture.reload();
            assert_eq!(fixture.state().deferred_history.len(), 1);
            assert_eq!(fixture.state().queue[0].source_shot_id, "following");
            due(&fixture);
            fixture.service.upload_next_shot().unwrap();
            // The old file remains retryable beyond the former three-attempt limit.
            for _ in 0..4 {
                fixture.reload();
                due(&fixture);
                fixture.service.retry_deferred_history().unwrap();
            }
            healthy.store(true, Ordering::SeqCst);
            fixture.reload();
            due(&fixture);
            fixture.service.worker_tick().unwrap();
            assert!(fixture.state().deferred_history.is_empty());
            assert_eq!(fixture.state().queue[0].source_shot_id, "deferred");
            let cursor = match kind {
                HistoryKind::Espresso => fixture.state().history_cursor,
                HistoryKind::PourOver => fixture.state().pour_over_history_cursor,
            };
            assert_eq!(
                cursor.as_deref(),
                Some(GOOD),
                "late retries must not rewind discovery"
            );
            due(&fixture);
            fixture.service.upload_next_shot().unwrap();
            assert_eq!(
                server
                    .requests()
                    .iter()
                    .filter(|path| *path == SHOT_PATH)
                    .count(),
                2
            );
            assert!(fixture.state().queue.is_empty());
        }
    }
}

#[test]
fn temporary_recovery_500_heals_automatically_without_resetting_job_or_counters() {
    let healthy = Arc::new(AtomicBool::new(false));
    let server_healthy = Arc::clone(&healthy);
    let server = MachineServer::start(move |url| {
        if url.path().starts_with("/api/v1/history/files/")
            && !server_healthy.load(Ordering::SeqCst)
        {
            Reply::bytes(500, "temporary file read error")
        } else {
            recovery_routes(url)
        }
    });
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .mutate_persistent(|state| {
            state.history_cursor = Some(ESPRESSO_PATH.to_string());
            state.pour_over_history_cursor = Some(POUR_PATH.to_string());
            Ok(())
        })
        .unwrap();
    fixture.service.ensure_automatic_history_recovery().unwrap();
    let id = fixture.state().recovery.unwrap().id;
    fixture.service.recover_saved_history();
    due(&fixture);
    fixture.service.upload_next_shot().unwrap();
    for _ in 0..5 {
        fixture.reload();
        due(&fixture);
        fixture.service.retry_deferred_history().unwrap();
    }
    let status = fixture.service.status().recovery.unwrap();
    assert_eq!(status.state, "running");
    assert_eq!(
        (status.added, status.failed, status.pending_count),
        (1, 0, 1)
    );
    healthy.store(true, Ordering::SeqCst);
    fixture.reload();
    due(&fixture);
    fixture.service.worker_tick().unwrap();
    assert_eq!(fixture.state().recovery.unwrap().id, id);
    assert!(fixture.state().queue[0].recovery_only);
    due(&fixture);
    fixture.service.upload_next_shot().unwrap();
    fixture.reload();
    let status = fixture.service.status().recovery.unwrap();
    assert_eq!(status.state, "completed");
    assert_eq!(
        (status.added, status.already_present, status.failed),
        (2, 0, 0)
    );
    assert!(fixture.state().deferred_history.is_empty());
}

#[test]
fn retry_ledger_is_bounded_and_full_capacity_does_not_advance_past_an_unrecorded_file() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    let authorization = fixture.state().authorization_id.unwrap();
    for n in 0..deferred::MAX_DEFERRED_HISTORY {
        fixture
            .service
            .defer_history_path(
                HistoryKind::Espresso,
                &format!("2026-09-25/{n:04}.json"),
                Checkpoint::Live,
                authorization,
                &temporary("shot_file_pending"),
            )
            .unwrap();
    }
    fixture.reload();
    let before = fixture.state().history_cursor;
    let failure = fixture
        .service
        .defer_history_path(
            HistoryKind::Espresso,
            "2026-09-25/9999.json",
            Checkpoint::Live,
            authorization,
            &temporary("shot_file_pending"),
        )
        .unwrap_err();
    assert_eq!(failure.category, "history_retry_capacity_reached");
    fixture.reload();
    assert_eq!(
        fixture.state().deferred_history.len(),
        deferred::MAX_DEFERRED_HISTORY
    );
    assert_eq!(fixture.state().history_cursor, before);
    assert_eq!(
        fixture.service.status().pending_count,
        deferred::MAX_DEFERRED_HISTORY
    );
}

#[test]
fn retry_backoff_persists_and_pause_or_retirement_stops_deferred_downloads() {
    let server = MachineServer::start(|_| Reply::bytes(500, "temporary"));
    let fixture = TestService::new(&server, true);
    let authorization = fixture.state().authorization_id.unwrap();
    fixture
        .service
        .defer_history_path(
            HistoryKind::Espresso,
            ESPRESSO_PATH,
            Checkpoint::Live,
            authorization,
            &temporary("shot_file_pending"),
        )
        .unwrap();
    for attempt in 2..=12 {
        due(&fixture);
        fixture.service.retry_deferred_history().unwrap();
        fixture.reload();
        let serialized = serde_json::to_value(fixture.state()).unwrap();
        let entry = &serialized["deferredHistory"][0];
        assert_eq!(entry["attemptCount"].as_u64(), Some(attempt));
        let delay = entry["nextAttemptAt"].as_i64().unwrap() - unix_seconds();
        assert!((4..=900).contains(&delay));
        let requests = server.requests().len();
        fixture.service.retry_deferred_history().unwrap();
        assert_eq!(
            server.requests().len(),
            requests,
            "future retry must not hit the server"
        );
    }
    due(&fixture);
    fixture.service.set_paused(true).unwrap();
    let requests = server.requests().len();
    fixture.service.retry_deferred_history().unwrap();
    assert_eq!(server.requests().len(), requests);
    fixture
        .service
        .retire_local_authorization("retired_key")
        .unwrap();
    fixture.reload();
    assert!(fixture.state().deferred_history.is_empty());
}

#[test]
fn live_download_cannot_attach_or_queue_for_a_changed_authorization() {
    for reuse_source in [false, true] {
        let during_download: Arc<Mutex<Option<CommunityUploadService>>> =
            Arc::new(Mutex::new(None));
        let callback = Arc::clone(&during_download);
        let server = MachineServer::start(move |_| {
            callback
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .mutate_persistent(|state| {
                    state.authorization_id = Some(Uuid::new_v4());
                    if !reuse_source {
                        state.queue.clear();
                    }
                    Ok(())
                })
                .unwrap();
            Reply::json(espresso())
        });
        let fixture = TestService::new(&server, true);
        *during_download.lock().unwrap() = Some(fixture.service.clone());
        if reuse_source {
            let mut queued: QueuedShot = serde_json::from_value(json!({
                "id":Uuid::new_v4(),"sourceShotId":"espresso-1","historyPath":"other/file.json",
                "historyKind":"espresso","bodyFile":"existing.json","attemptCount":0,
                "nextAttemptAt":0,"lastError":null
            }))
            .unwrap();
            queued.recovery_only = false;
            fixture
                .service
                .mutate_persistent(|state| {
                    state.queue.push(queued);
                    Ok(())
                })
                .unwrap();
        }
        fixture
            .service
            .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
            .unwrap();
        fixture.reload();
        assert!(fixture.state().history_cursor.is_none());
        assert_eq!(fixture.state().queue.len(), usize::from(reuse_source));
        assert_eq!(
            fs::read_dir(&fixture.service.inner.queue_dir)
                .unwrap()
                .count(),
            0
        );
    }
}

#[test]
fn stale_live_scan_cannot_advance_new_authorization_after_invalid_file_or_baseline() {
    for baseline in [false, true] {
        let during_download: Arc<Mutex<Option<CommunityUploadService>>> =
            Arc::new(Mutex::new(None));
        let callback = Arc::clone(&during_download);
        let server = MachineServer::start(move |url| {
            if (baseline && url.path().ends_with("/last"))
                || url.path().starts_with("/api/v1/history/files/")
            {
                callback
                    .lock()
                    .unwrap()
                    .as_ref()
                    .unwrap()
                    .mutate_persistent(|state| {
                        state.authorization_id = Some(Uuid::new_v4());
                        Ok(())
                    })
                    .unwrap();
                if !baseline {
                    return Reply::json(json!({"id":"bad","data":"invalid"}));
                }
            }
            recovery_routes(url)
        });
        let fixture = TestService::new(&server, !baseline);
        *during_download.lock().unwrap() = Some(fixture.service.clone());
        fixture.service.observe_new_shots().unwrap();
        fixture.reload();
        assert!(fixture.state().history_cursor.is_none());
        assert_eq!(fixture.state().history_baselined, !baseline);
        assert!(fixture.state().queue.is_empty());
        assert!(fixture.state().deferred_history.is_empty());
    }
}

#[test]
fn post_rename_state_sync_failure_preserves_body_and_visible_snapshot() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    let job = fixture.state().recovery.unwrap().id;
    FAIL_DIRECTORY_SYNC_ONCE
        .with(|fault| *fault.borrow_mut() = Some(fixture.service.inner.state_path.clone()));
    assert_eq!(
        fixture
            .service
            .queue_history_path_for(
                HistoryKind::Espresso,
                ESPRESSO_PATH,
                Checkpoint::Recovery(job)
            )
            .unwrap_err()
            .category,
        "state_persist_failed"
    );
    assert_eq!(
        fixture.state().queue.len(),
        1,
        "memory must adopt the already renamed snapshot"
    );
    assert!(
        fixture
            .service
            .inner
            .queue_dir
            .join(&fixture.state().queue[0].body_file)
            .is_file()
    );
    fixture
        .service
        .mutate_persistent(|state| {
            state.last_error = Some("retrying".to_string());
            Ok(())
        })
        .unwrap();
    fixture.reload();
    assert_eq!(fixture.state().queue.len(), 1);
    due(&fixture);
    fixture.service.upload_next_shot().unwrap();
    fixture.reload();
    assert_eq!(fixture.state().recovery.unwrap().added, 1);
    assert!(fixture.state().queue.is_empty());
}

#[test]
fn post_rename_ack_sync_failure_does_not_double_count_or_resend() {
    let server = MachineServer::start(recovery_routes);
    let fixture = TestService::new(&server, true);
    fixture.service.start_history_recovery().unwrap();
    fixture.service.recover_saved_history();
    due(&fixture);
    FAIL_DIRECTORY_SYNC_ONCE
        .with(|fault| *fault.borrow_mut() = Some(fixture.service.inner.state_path.clone()));
    assert_eq!(
        fixture.service.upload_next_shot().unwrap_err().category,
        "state_persist_failed"
    );
    assert_eq!(fixture.state().recovery.unwrap().added, 1);
    fixture.reload();
    due(&fixture);
    fixture.service.upload_next_shot().unwrap();
    assert_eq!(fixture.state().recovery.unwrap().added, 2);
    assert_eq!(
        server
            .requests()
            .iter()
            .filter(|path| *path == RECOVERY_PATH)
            .count(),
        2
    );
}

#[test]
fn excluded_history_receipt_finishes_without_counting_existing_or_failed_brews() {
    for promoted in [false, true] {
        for conflict in [false, true] {
            let server = MachineServer::start(move |url| {
                if matches!(url.path(), RECOVERY_PATH | SHOT_PATH) {
                    Reply::json(
                        json!({"success":true,"imported":conflict,"deleted":false,"excluded":true}),
                    )
                } else {
                    recovery_routes(url)
                }
            });
            let fixture = TestService::new(&server, true);
            fixture.service.start_history_recovery().unwrap();
            fixture.service.recover_saved_history();
            if promoted {
                fixture
                    .service
                    .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
                    .unwrap();
                fixture
                    .service
                    .queue_history_path(HistoryKind::PourOver, POUR_PATH)
                    .unwrap();
                assert!(
                    fixture
                        .state()
                        .queue
                        .iter()
                        .all(|item| !item.recovery_only && item.recovery_job_id.is_some())
                );
            }
            for _ in 0..2 {
                due(&fixture);
                let result = fixture.service.upload_next_shot();
                if promoted && conflict {
                    assert_eq!(result.unwrap_err().category, "upload_receipt_invalid");
                } else {
                    result.unwrap();
                }
            }
            fixture.reload();
            let progress = fixture.service.status().recovery.unwrap();
            assert_eq!(
                (progress.added, progress.already_present, progress.failed),
                (0, 0, 0)
            );
            assert_eq!(
                progress.state,
                if conflict { "running" } else { "completed" }
            );
            assert_eq!(fixture.state().queue.len(), if conflict { 2 } else { 0 });
            if conflict {
                assert_eq!(
                    progress.last_error.as_deref(),
                    Some("upload_receipt_invalid")
                );
            }
        }
    }
}

#[test]
fn normal_legacy_queue_acknowledges_excluded_history_without_retry() {
    let server = MachineServer::start(|url| {
        if url.path() == SHOT_PATH {
            Reply::json(json!({"success":true,"imported":false,"deleted":false,"excluded":true}))
        } else {
            recovery_routes(url)
        }
    });
    let fixture = TestService::new(&server, true);
    fixture
        .service
        .queue_history_path(HistoryKind::Espresso, ESPRESSO_PATH)
        .unwrap();
    assert!(fixture.state().queue[0].recovery_job_id.is_none());
    let body = fixture
        .service
        .inner
        .queue_dir
        .join(&fixture.state().queue[0].body_file);
    due(&fixture);
    fixture.service.upload_next_shot().unwrap();
    fixture.reload();
    due(&fixture);
    fixture.service.upload_next_shot().unwrap();
    assert!(fixture.state().queue.is_empty());
    assert!(fixture.state().recovery.is_none());
    assert!(!body.exists());
    assert_eq!(
        server
            .requests()
            .iter()
            .filter(|path| *path == SHOT_PATH)
            .count(),
        1
    );
}
