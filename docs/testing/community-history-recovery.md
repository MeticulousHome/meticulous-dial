# Community saved-brew recovery

Recovery automatically imports all espresso and pour-over brews still saved
on a machine connected to Community. It starts after pairing and after updating
an already connected Dial. No settings visit, import button, or confirmation is
required. Brews go into the connected account's private history. Existing
Community brews stay unchanged and deleted brews stay deleted.

## On the Dial

Once Community is connected, saved-brew sync runs in the background. Users can
keep brewing or leave Settings closed. An existing pause is respected; recovery
does not turn uploads back on. Network and service failures retry automatically.

Settings → Community → **Saved brew sync** shows progress and any unresolved
issues. **Pause uploads** pauses both recovery and new-brew uploads;
**Resume uploads** continues them. Recovery resumes after a Dial restart with
the same authorization. A completed job stays completed across worker ticks,
restarts, and key rotation. Reconnecting with a new authorization starts a new
job after discarding historical work associated with the previous authorization.

After a completed scan, **Recheck history** is an optional diagnostic action,
for example after repairing an unreadable saved record. It is never required to
start the initial recovery. Repeating the scan does not restore deleted brews or
overwrite existing ones. Open or refresh Brew Diary in Community to see results.

Progress reports server-confirmed outcomes, not a percentage of an unknown
history total. If a server commit succeeds but its response is lost, a retry
can count that brew as already present. A completed scan is not complete while
its queued uploads are still waiting for acknowledgement.

An individually missing, malformed, or unreadable file receives three attempts
before it is counted as an issue and the scan continues. The original machine
file is not deleted. Connection failures and service outages remain retryable.

## Release order

1. Review and apply the Community quiet-recovery migration through that
   repository's protected migration workflow, with its exact-batch approval.
2. Deploy Community support for
   `POST /api/machine-uploads/v1/history-recovery`.
3. Release the Dial uploader and recovery UI together. The companion machine
   backend lightweight latest-history endpoint improves baseline discovery;
   the Dial retains its legacy endpoint fallback.

The dedicated recovery endpoint keeps the same raw body and deterministic
idempotency key as normal upload. The signed request uses the recovery path.
An older Community server returns 404 before importing a brew. The Dial keeps
the recovery item and retries after the server update. Missing database support
also fails before a quiet import can fall back to ordinary ingestion.

Recovery-only uploads do not create per-brew rating notifications or consume
Next Brew plans. They also omit the live events that announce new brews in an
open Community browser. A brew already queued by normal live discovery retains its
ordinary upload behavior.

## Physical-machine release check

Use a test account and machine with known, saved records. Do not reset or alter
a customer's machine history to manufacture test data.

- Include an espresso, a Free Pour, and a profile-driven pour-over made before
  pairing; leave one already in Community and one previously deleted there.
- Pair the machine and, without opening Community Settings or starting an import,
  verify the missing brews appear once, privately, with their original timestamps
  and data. Verify existing and deleted brews stay as they were, no rating-alert
  burst occurs, and an armed Next Brew stays armed.
- Update a previously connected machine with no recovery job. Verify recovery
  starts without user action. Repeat with uploads paused: pause must stay in effect
  until the user resumes uploads, and no recovery network requests may occur.
- Pause while work is pending, restart the Dial, and resume. Confirm progress
  continues without duplicates or a false completion message.
- Make a new brew during recovery. Confirm ordinary upload still works and
  retains its normal notification/Next Brew behavior.
- Briefly disconnect the machine from the internet. Pending work must remain
  visible and resume when connectivity returns.
- Reboot after completion and verify the completed job is retained. Optionally
  recheck the history; no additional Community brews should appear.
- Check rotary selection, optional recheck confirmation, Back, Pause/Resume, and Disconnect on
  the physical round display. Browser tests cannot prove native knob timing,
  flash-storage durability, or an ARM64 firmware installation.

Record the exact Dial, backend, Community, and migration versions with the
results. Passing automated tests is not evidence of firmware deployment or a
completed physical-machine check.
