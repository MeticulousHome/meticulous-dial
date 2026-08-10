# SW-102 analog clock offset validation

Use a machine initially running image `2026M1284-STABLE`. Keep the Dial process
running during the timezone-change checks so the test detects a timezone value
that was cached when the application started.

## Test record

Complete this table during machine validation. Do not infer clock readings from
service status or logs; read both clock faces on the physical display.

| Field                     | Before fix         | Branch build |
| ------------------------- | ------------------ | ------------ |
| Machine identifier        | Not run            | Not run      |
| Image version             | `2026M1284-STABLE` | Not run      |
| Dial version/package      | Not run            | Not run      |
| Configured timezone       | Not run            | Not run      |
| `timedatectl` local time  | Not run            | Not run      |
| `date --iso-8601=seconds` | Not run            | Not run      |
| Analog-clock reading      | Not run            | Not run      |
| Digital-clock reading     | Not run            | Not run      |

Record the branch commit and package checksum before installation. Preserve the
installed package or binary and write down the rollback command before replacing
it.

## Procedure

1. On `2026M1284-STABLE`, record every field in the **Before fix** column.
   Capture the configured timezone independently of the displayed system time.
2. Install the ARM64 package built from this branch, without changing the
   machine timezone. Record every field in the **Branch build** column and
   confirm the service is active without relying on that as visual validation.
3. Select the analog idle clock. Confirm its hour, minute, and second hands agree
   with `timedatectl`, `date`, and the digital idle clock in local time.
4. Through the supported Dial time-zone settings flow, select `UTC`. Do not
   restart Dial. Return to the analog clock and confirm it updates to UTC and
   agrees with the system and digital clocks.
5. Through the same settings flow, select a timezone with a non-zero current UTC
   offset. Do not restart Dial. Record the timezone and offset, then confirm the
   analog clock updates and agrees with the system and digital clocks rather
   than retaining the UTC reading.
6. Observe the clocks across an hour boundary. Confirm the minute hand reaches
   12, the hour hand advances smoothly to the next marker, and all three clocks
   agree after the boundary.
7. Validate the 12-hour wrap by setting the system through the supported flow to
   just before local noon or midnight, or by observing the natural boundary.
   Confirm the hour hand moves from 12 toward 1 and does not add or lose an hour.
8. Restore the machine's original timezone and confirm the analog clock updates
   again without restarting Dial.

## Expected result

- The analog clock matches current system and digital local time before and
  after every timezone change.
- Seconds move smoothly; the minute and hour hands include fractional progress.
- No fixed offset is applied, and no old timezone offset survives a supported
  runtime timezone change.
- Hour-boundary and 12-hour-wrap hand positions remain correct.

## Result

Machine validation has not yet been run. Replace this sentence with the tested
image version, Dial version/commit, timezone pair, timestamp, and pass/fail result
after completing the procedure.
