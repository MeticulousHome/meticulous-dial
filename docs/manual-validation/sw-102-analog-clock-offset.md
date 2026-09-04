# Analog clock timezone consolidation

## Source and scope

- Nightly base: `bdd0f6a0ac2df842356f7296f81b780ec1186236`.
- Implementation: `d9bcf6290a4f923dc056c68b29c6b06784b0b640`.
- AluUriel proposal [#573](https://github.com/MeticulousHome/meticulous-dial/pull/573): `342687cb1cae11ef467f92a7d75baa5cc00fccde`.
- royYYZSFO proposal [#579](https://github.com/MeticulousHome/meticulous-dial/pull/579): `f9d3b7e48c2c7d4fc5204c58bc601ffe469c6a67`.

Both proposals were open drafts with conflicts, no reviews, and no check runs
when revalidated on September 3, 2026. The consolidation starts from current
Nightly, preserves its other native commands, and does not integrate #582 or
change Pour Over. Author attribution is retained in the implementation commit.
The existing CI workflow now also runs on PRs targeting Nightly.

## Why native time is necessary

Nightly captures the JavaScript timezone offset when the analog module loads.
That cannot follow later OS timezone changes. Refreshing the offset is still
insufficient when the embedded runtime has different timezone rules from the OS.

On machine 002006, JavaScriptCore reported `America/Mexico_City`, UTC-5,
`18:44:39` on September 3, while the OS reported UTC-6, `17:44:40`.
This was a direct evaluation using the machine's installed JavaScriptCore library,
not a Node test or an inference from the configured timezone string.

The analog clock and the live Settings date/time readout therefore share native
OS-local calendar/time samples. They retry one second after each completed
request, including initial failure, without overlapping requests. The analog
hands use monotonic interpolation and existing cached transform strings between
samples. Until the first successful read, hands are hidden and Settings shows
placeholders. After a transient failure, the analog clock continues from the
last native sample. Plain browser development uses browser-local time.

The separate digital idle face and manual date/time editors still use JavaScript
Date and are outside this consolidation. The live Settings readout is the
Settings surface covered by this change.

## Exact build and automated validation

- ARM64 package SHA-256: `7c06108bb5e9e2721ab76640e863b83aed8c1c61e305137d04037245a85696a4`.
- Packaged and installed binary SHA-256: `5e67f5d87809ab4d502766ce89ea46a498af98339dba38461b0b1403dde76a18`.
- Package metadata: `meticulous-dial`, version `0.1.0`, architecture `arm64`;
  dependencies include WebKitGTK 4.1 and GTK 3. ELF machine type verified as AArch64.
- `npm test`: 12 passed (11 clock tests plus the existing Free Pour test file).
- `npm run types`, `npm run format:check`, focused test-file Prettier check,
  `npm run lint`, and `npm run build`: passed on Linux with Node 22.
  Lint retains the two existing QR import warnings. Build retains the existing
  Lottie eval and large-chunk warnings.
- `rustfmt --check --edition 2024 src/local_time.rs`: passed.
- `cargo tauri build --target aarch64-unknown-linux-gnu --bundles deb`: passed.
- `cargo test --locked --release --target aarch64-unknown-linux-gnu --lib --no-run`:
  passed; the resulting native test executable ran on machine 002006 with
  `local_time::tests:: --nocapture`: 5 passed, 18 unrelated tests filtered out.

Clock tests cover runtime automatic/manual sample changes, both European DST
transitions, midnight and negative-day wrapping, smooth interpolation, absence
of Date work per frame, initial rejection and recovery, later failures, slow
requests, cleanup with pending responses, native source selection, and browser
fallback. Native tests cover 30 fixed instants across London, Zurich, and Mexico
City using OS tzdata, including summer/winter rules and midnight boundaries.
These tests do not by themselves establish embedded-webview behavior.

## Physical validation

Machine 002006 uses a lab-certification image (image identifier dated June 24,
2026), Debian bookworm identification, and WebKitGTK `2.50.6-1~deb12u1`.
The original binary hash was
`ea373a70e7c231ac9acd4db11cfea1b247f283b4864c5e61ae9af64dd8706d8c`.
The original timezone was America/Mexico_City, manual mode, with NTP active and
synchronized and the digital idle face selected.

The candidate executable was extracted from the verified ARM64 package and
installed temporarily, preserving the package database. The final candidate
started with PID 3425. Capture records include OS timestamps bracketing each
Wayland screenshot, the active timezone settings, and the Dial PID.

The final build passed the following captures, all with Dial PID 3425:

| Scenario                                                               | OS-local time at capture                  | Analog result |
| ---------------------------------------------------------------------- | ----------------------------------------- | ------------- |
| [London, manual](clock-captures/final-london.png)                      | Sep 4, 00:56:38 BST                       | Agrees        |
| [Zurich, manual](clock-captures/final-zurich.png)                      | Sep 4, 01:56:42 CEST                      | Agrees        |
| [Mexico City, manual](clock-captures/final-mexico.png)                 | Sep 3, 17:56:46 CST                       | Agrees        |
| [Automatic detection after London](clock-captures/final-automatic.png) | Sep 3, 17:56:54 CST; detected Mexico City | Agrees        |
| [Before London spring DST](clock-captures/final-spring-dst-before.png) | Mar 29, 00:59:58 GMT                      | Agrees        |
| [After London spring DST](clock-captures/final-spring-dst-after.png)   | Mar 29, 02:00:03 BST                      | Agrees        |

The raw Wayland screenshots are rotated with the framebuffer; view them rotated
90 degrees clockwise. Adjacent JSON files record OS timestamps before/after
capture, timezone settings, and the unchanged PID. The hands continued moving
between captures; this is not a quantitative frame-time or memory benchmark.

The artificial jump to the autumn date triggered the lab image's existing
`meticulous-restart.timer` (03:00 daily), which explicitly restarts backend and
Dial. The timer's service journal confirms that run. This interrupted the
remaining boundary exercise; autumn-DST and midnight **physical** checks are
not marked passed. Their native fixtures passed on hardware. A future physical
boundary run must temporarily suspend and then restore that scheduled timer.

The live Settings date/time screen was not independently captured, so the
three-way analog/Settings/OS visual acceptance check remains open. The Settings
readout now uses the same native source, but source review is not a substitute
for that screen check. Initial-retrieval failure/recovery is automated coverage;
it was not injected into the release webview.

After testing, the original binary, Weston launch configuration, and complete
machine configuration matched their saved SHA-256 checksums. The original
package version remained `0.1.0`; backend, Dial, and Weston were active.
America/Mexico_City, manual timezone selection, the digital idle face, and
synchronized NTP were restored. Temporary screenshot debugging was removed.
The baseline configuration checksum was
`ad4075b9c5c115a6478ed1f92fe0c2c8e96184405dcdf7d9da6dcd38a8bec490`.

[CI for the implementation commit passed](https://github.com/MeticulousHome/meticulous-dial/actions/runs/33819388283).
Subsequent changes only stabilize a test and record evidence; the production
sources remain identical to the physically tested implementation commit.

## Earlier #573 evidence

The [earlier validation record](https://github.com/MeticulousHome/meticulous-dial/blob/342687cb1cae11ef467f92a7d75baa5cc00fccde/docs/manual-validation/sw-102-analog-clock-offset.md)
applies only to commit `feb683cea8f66aaee03ea5aa1e7397ad827f72dd`, package
`0940183be2cfc2c962c260cb16d95a52b3c46a61bf55e1348c42584f3589655a`, and binary
`c8bd0e1913143ed438967978dbdf9e04e729a70f210c6b973b908e189db25e7a`.
It demonstrated the analog correction in Mexico City on `2026M1358-stable`.
It did not validate this consolidated build; its digital face remained an hour
out and complete rollback verification was missing.

## Backend and rollout

Backend [#394](https://github.com/MeticulousHome/meticulous-backend/pull/394), head
`dd1372f965f293b3a6159d13048a2f654fa0873e`, remains a separate open draft.
It persists automatic timezone detection across restarts and handles the
late-automatic/manual-selection race. The Dial fix only reads the active OS
local time and does not depend on that persistence change. Without #394, a
backend restart can still restore stale configuration; the clock will follow
whatever timezone the OS actually applies.

That backend PR is mergeable but still requires review. Its latest checked CI
run had 226 tests pass and two redaction performance/RSS budget failures;
this is not a green companion PR.

Use the consolidated replacement PR for integration. Keep #573 and #579 open
until integration is approved and complete, then close both as superseded.
The new branch avoids their excluded branch prefixes without rewriting either
author's published history. #582 remains independent.

Prefer Nightly before Beta. A Beta backport must include only the clock change,
not all current Nightly changes: Nightly also contains unrelated Pour Over and
Community work. Merge, superseded-PR closure, and release deployment require
explicit approval.
