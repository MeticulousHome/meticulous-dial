# SW-102 analog clock offset validation

Use a machine initially running image `2026M1358-stable`. Keep the Dial process
running during timezone and date-boundary checks so periodic resynchronization
is exercised.

The pass/fail oracle is the NTP-synchronized OS local time reported by
`timedatectl` and `date`. Do not use the digital clock as an oracle unless it has
been independently changed and validated against the same OS-local source.

## Recorded before-fix reproduction

Physical validation on the authorized machine reproduced the issue on
`2026M1358-stable`:

- OS timezone: `America/Mexico_City`; NTP synchronized.
- OS time: `23:17 CST`; installed Dial analog reading: `12:17 AM`.
- Prior PR candidate `05483f2`: OS time `23:24 CST`; analog reading `12:24 AM`.
- The backend `time_zone` setting was `Etc/UTC`, so it was not used as the
  authoritative clock source.
- Prior candidate package SHA-256 prefix: `e210b02c8970`.
- The original package, binary, Weston configuration, and services were restored
  after the failed candidate test.

## Test record

Complete the candidate column during corrected-package validation. Capture the
physical analog face; service status alone is not visual evidence.

| Field                                       | Before fix                                 | Corrected candidate |
| ------------------------------------------- | ------------------------------------------ | ------------------- |
| Machine image                               | `2026M1358-stable`                         | Pending             |
| Candidate commit                            | `05483f2`                                  | Pending             |
| ARM64 package SHA-256                       | Prefix `e210b02c8970`                      | Pending             |
| Package size / embedded binary architecture | Non-empty / AArch64                        | Pending             |
| Configured OS timezone                      | `America/Mexico_City`                      | Pending             |
| NTP synchronized                            | Yes                                        | Pending             |
| `timedatectl` / `date` local time           | `23:24 CST`                                | Pending             |
| Captured analog reading                     | `12:24 AM`                                 | Pending             |
| `meticulous-dial.service`                   | Restored and active after rollback         | Pending             |
| Rollback restoration                        | Package, binary, Weston, services restored | Pending             |

Record the full corrected commit and package SHA-256 before installation.
Preserve the installed package or binary and write down the rollback command
before replacing it.

## Corrected-package procedure

1. Record the machine image, installed Dial package/version, configured OS
   timezone, NTP state, complete `timedatectl` output, and
   `date --iso-8601=seconds`.
2. Build a fresh ARM64 Debian package from the candidate commit. Require a
   non-empty package, verify its embedded `/usr/bin/meticulous-dial` is an ELF
   64-bit ARM AArch64 binary, and record the package SHA-256.
3. Back up the installed package or binary, install the candidate without
   changing the timezone, and verify `meticulous-dial.service` is active with no
   candidate-related startup errors.
4. Select the analog idle clock and photograph it beside a contemporaneous
   `timedatectl` or `date` reading. Confirm the hour, minute, and second hands
   agree with OS local time. The digital face is informational only.
5. Through the supported OS timezone flow, select `UTC` without restarting Dial.
   Wait at least 30 seconds and confirm the analog clock resynchronizes to OS UTC.
6. Restore `America/Mexico_City` without restarting Dial. Wait at least 30
   seconds and confirm the analog clock resynchronizes to OS local time.
7. Validate a date boundary using a safe supported system-time flow or natural
   observation. Confirm the analog clock wraps through midnight without adding
   or losing an hour and agrees with the OS on both sides of the boundary.
8. Restore the original timezone and time synchronization settings. Reinstall
   the original Dial package or binary and verify its checksum, Weston
   configuration, and relevant services match the recorded pre-test state.

## Expected result

- The analog clock agrees with NTP-synchronized OS local time on
  `2026M1358-stable`, including after runtime timezone changes and across a date
  boundary.
- Seconds move smoothly; minute and hour hands include fractional progress.
- No JavaScript timezone conversion or backend `time_zone` setting determines
  the analog reading.
- The corrected package is traceable to its commit and full SHA-256, and rollback
  restoration is recorded.

## Corrected-package result

Pending physical validation. Replace this paragraph with the corrected commit,
full package checksum, image and timezone evidence, OS outputs, analog capture,
service health, date-boundary result, and rollback confirmation.
