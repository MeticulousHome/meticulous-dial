# SW-102 analog clock offset validation

## Result

Passed for the analog clock on an authorized machine running
`2026M1358-stable`. The installed baseline reproduced the offset, and the exact
candidate corrected the analog face to agree with the NTP-synchronized OS-local
wall clock.

The validation oracle was OS-local time reported by `timedatectl` and `date`.
The backend `time_zone` setting was stale (`Etc/UTC`) and was not used as an
oracle.

## Candidate provenance

- Commit: `c09f59180a6e818cb18afba0c8bb661e6ee07b99`
- ARM64 Debian package SHA-256:
  `b9ec2078cfc3da0ec218ad520c09df9c68d56aa382285efa2b3c3ef8b15927ad`
- Installed candidate binary SHA-256:
  `c8bd0e1913143ed438967978dbdf9e04e729a70f210c6b973b908e189db25e7a`

## Before/after evidence

| Observation      | Installed baseline          | Corrected candidate               |
| ---------------- | --------------------------- | --------------------------------- |
| Machine image    | `2026M1358-stable`          | `2026M1358-stable`                |
| OS timezone      | `America/Mexico_City`       | `America/Mexico_City`             |
| NTP synchronized | Yes                         | Yes                               |
| OS-local time    | `05:19`                     | `05:26` (`05:26:22` at capture)   |
| Analog face      | Approximately `06:19`       | Approximately `05:26`             |
| Analog result    | Offset reproduced (+1 hour) | Passed; agreed with OS-local time |

The candidate kept `meticulous-dial.service` active, and its journal had no
candidate-related startup errors. After validation, rollback restored the
original Dial package and package version. The restored package manifest and
`/usr/bin/meticulous-dial` checksums matched their recorded pre-install values,
and `meticulous-dial.service` was active.

## Separate non-blocking observation

The candidate digital face read approximately `06:26` while OS-local time was
approximately `05:26`, a +1-hour discrepancy also seen with the baseline. The
digital clock still obtains time from JavaScript `Date`; SW-102 did not change
or validate that implementation. This observation is not described as fixed
and does not change the passed analog result.

## Implementation covered by this validation

The analog clock obtains `chrono::Local::now()` through the Tauri
`get_os_local_time` command, advances that native sample with monotonic elapsed
time, and resynchronizes every 30 seconds. It does not derive the analog reading
from JavaScript `Date` or the backend `time_zone` setting.

## Checks not performed

- Date-boundary behavior was not physically observed.
- Complete Weston configuration or service restoration evidence was not
  collected, so no Weston restoration claim is made.

These checks were not acceptance gates for the analog correction and remain
unverified by this run.

## Regression procedure

1. Record the machine image, configured OS timezone, NTP state, complete
   `timedatectl` output, and `date --iso-8601=seconds`.
2. Record the candidate commit plus package and installed binary SHA-256 values.
3. Back up the installed package or binary, install the candidate, and confirm
   `meticulous-dial.service` is active without candidate-related startup errors.
4. Select the analog idle clock and capture it beside a contemporaneous OS-local
   time reading. Confirm the hour, minute, and second hands agree with OS-local
   time. Treat the digital face as informational unless independently corrected
   and validated against the same oracle.
5. Restore the original package or binary and verify the recorded package
   version, manifest checksum, binary checksum, and Dial service state.
