# Community saved-brew recovery

Recovery is an explicit import of all espresso and pour-over brews still saved
on the machine. Pairing and firmware updates do not start it automatically.
Brews are imported into the connected account's private history. Existing
Community brews stay unchanged and deleted brews stay deleted.

## On the Dial

1. Open Settings → Community and confirm that it says Connected.
2. Select **Import saved brews**. Review the scope, then select **Import all**.
3. Check progress under **View saved import**. **Pause uploads** pauses both
   recovery and new-brew uploads; **Resume uploads** continues them.
4. You can leave this screen and keep brewing. Recovery resumes after a Dial
   restart while the same Community authorization remains active.
5. If the import finishes with issues, inspect the displayed error. After fixing
   the connection, storage, or saved-record problem, use **Import again**.
   Repeating the scan does not restore deleted brews or overwrite existing ones.
6. Open or refresh Brew Diary in Community to see the imported history.

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
- Start recovery and verify the missing brews appear once, privately, with their
  original timestamps and data. Verify the existing and deleted brews stay as
  they were, no rating-alert burst occurs, and an armed Next Brew stays armed.
- Pause while work is pending, restart the Dial, and resume. Confirm progress
  continues without duplicates or a false completion message.
- Make a new brew during recovery. Confirm ordinary upload still works and
  retains its normal notification/Next Brew behavior.
- Briefly disconnect the machine from the internet. Pending work must remain
  visible and resume when connectivity returns.
- Repeat the completed import. No additional Community brews should appear.
- Check rotary selection, confirmation, Back, Pause/Resume, and Disconnect on
  the physical round display. Browser tests cannot prove native knob timing,
  flash-storage durability, or an ARM64 firmware installation.

Record the exact Dial, backend, Community, and migration versions with the
results. Passing automated tests is not evidence of firmware deployment or a
completed physical-machine check.
