# Pour-over improvements — machine acceptance plan

Use an idle machine with no espresso shot or pour-over in progress. Keep power
connected throughout installation and testing. Record pass/fail plus a photo or
short video for each visual/gesture test.

## 0. Package and installation gate

1. Run `shasum -a 256 -c SHA256SUMS` in this package. Every line must report
   `OK`.
2. Run `./install-dial-build.sh --preflight-only`. It must report the expected
   serial and firmware, active Dial/backend services, two distinct 64-character
   Dial hashes, and `No files or machine data were changed.`
3. Run `./install-dial-build.sh`, review the two backup paths and hashes, then
   type the exact confirmation. It must finish with
   `DIAL BUILD INSTALLATION VERIFIED`.
4. Reboot the machine once. The home carousel must load normally and both the
   Dial and backend services must remain healthy.

## 1. Home carousel and supplied artwork

1. Rotate through every home card.
2. Confirm the **Free Pour** card uses the supplied kettle-and-carafe artwork,
   fills the square cleanly, is neither stretched nor clipped unexpectedly, and
   has no broken-image flash.
3. Confirm there is no **Repeat last pour** card, including after a completed
   Free Pour exists in history.
4. Confirm every installed guided pour-over profile appears as its own card and
   all espresso profile cards still appear.

Pass: card ordering is stable, artwork is crisp at Dial distance, no repeat
card exists, and carousel rotation does not jump or select a neighboring card.

## 2. Stability messaging and press gating

Perform this at **empty server**, **add brewer**, and **add coffee**. For coffee,
use a dose between 5 g and 40 g.

1. Keep touching or changing the load so readings vary. Confirm the status has
   a light-yellow background and tells you to wait for a stable weight.
2. Press while the reading is unstable. The stage must not advance and the
   displayed weight must not be recorded.
3. Stop touching the setup and wait at least one second. Confirm the status
   changes to a light-green background and says the weight is stable and the
   dial can be pressed to record.
4. Press once. Confirm `SAVING WEIGHT`, then the tare/zero state, then the next
   setup stage. Do not see a double advance or stale prior weight.
5. On the brewer stage, also try a load under 3 g; on the coffee stage, try
   under 5 g and over 40 g. Confirm recording remains blocked with useful text.

Pass: yellow means wait, green alone enables recording, invalid loads are
rejected, and each successful record produces exactly one tare and one advance.

## 3. Review and re-enter setup weights in both directions

1. Record the empty server, then reach **Add brewer**. Turn the dial backward;
   confirm **Setup review** opens on the recorded server weight. Return without
   changing it. Repeat using a forward turn.
2. Record server and brewer, then reach **Add coffee**. Enter review in each
   direction and rotate across the recorded server/brewer weights and the
   **Continue setup** item.
3. Press a recorded weight. Confirm the warning explains that re-entry restarts
   from the empty server, and confirm the flow actually returns to **Weigh empty
   server** rather than retaining dependent tare values.
4. Re-record server, brewer, and coffee. At **Ready**, enter review once from
   each direction, traverse all three recorded weights, and return to the brew.
5. Start pouring. Turning the dial must no longer open setup review or alter any
   recorded setup weight.

Pass: either rotation direction can enter/navigate review before brewing,
re-entry safely rebuilds the full tare chain, and live brewing is unaffected.

## 4. Abort guidance and gesture

1. Confirm **Double-press the dial to abort** is visible on temperature, each
   setup stage, setup review, live pouring/waiting, and the post-brew screens.
2. Double-press during setup. Confirm an immediate return to the home carousel,
   no espresso action starts, and no partial pour-over history item is created.
3. Start again and double-press during live pouring. Confirm the pour-over exits
   cleanly to home and the context bubble is not left open.
4. Open the context menu during a pour-over and double-press there. Confirm the
   same clean abort behavior.

Pass: hint remains readable without obscuring primary controls and double-press
aborts consistently from both the main screen and context menu.

## 5. Guided-profile retention after a completed brew

1. Note a guided pour-over profile name and the espresso profile currently next
   to it. Start the guided profile.
2. Complete setup, all instructed pours, brewer removal, final weight, and the
   result/history flow normally—do not use abort for this test.
3. Return to home.

Pass: the same guided pour-over profile card remains selected. No different
espresso profile becomes selected. Starting another brew immediately loads the
same guided profile and its targets.

## 6. Delete guided profile (intentional profile-data mutation)

Only use a disposable or separately backed-up guided profile. Deletion is the
one feature test here that intentionally changes the installed profile catalog.

1. Select the disposable guided pour-over profile and open its context menu.
2. Confirm it offers **Last pour-over** and **Delete profile**, using the same
   hold-to-confirm interaction as espresso deletion.
3. Briefly press/release Delete before the hold completes. Confirm nothing is
   deleted.
4. Reopen the menu and complete the hold. Confirm the card disappears and home
   selection moves to a valid neighboring card without a crash or blank card.
5. Reboot and confirm the deleted profile remains absent. Confirm Free Pour and
   the remaining espresso/guided profiles are unchanged.

Pass: only the selected disposable guided profile is deleted, cancellation is
safe, and the catalog/selection reconcile immediately and after reboot.

## 7. Regression and evidence capture

1. Start and abort one ordinary espresso profile. Confirm its normal card,
   context menu, and start flow still work.
2. Complete one Free Pour and confirm its history opens from **Last pour-over**.
   Return home and confirm **Repeat last pour** is still absent.
3. Run `SINCE='2 hours ago' ./collect-machine-logs.sh`. Confirm the output has
   non-empty Dial/backend logs and `service-status.txt` shows both services
   active with no unexpected restart loop.
4. If any critical failure occurs, stop brewing and run
   `./rollback-dial-build.sh`; verify it reports the exact prior Dial restored.

Final acceptance: all critical flows pass, no unexpected settings change,
backend and Dial stay healthy, and no profile except the deliberately disposable
delete-test profile changes.

