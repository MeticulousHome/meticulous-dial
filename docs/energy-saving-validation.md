# Screen-off validation

This change implements sustained screen off, not system standby or a measured
power target. The SoM, network and ESP32 continue running.

## Comparable UI evidence

The real IdleScreen and IdleTimerProvider were rendered at 480 × 480 with the
same simulated clock, settings and backlight API. Both captures are at the
existing five-minute idle deadline plus ten minutes on the clock screen.
These are component screenshots, not photographs of the physical backlight.

| Beta before this change | Candidate |
| --- | --- |
| ![Clock still rendered](assets/energy-saving/before-15-minutes.png) | ![Clock unmounted and black screen](assets/energy-saving/after-15-minutes.png) |

## Regression evidence

`npm run test:idle-screen` exercises five clock variants, manual and automatic
entry, twenty minutes without relighting, wake to full brightness and cancellation
of the old timeout when idle is left. Expected values come from the existing
five- and ten-minute timers and the backlight API's 0–1 range.

Restoring beta's IdleScreen and DigitalClock makes the automatic test fail:
at fifteen minutes the latest requested brightness is 0.33 instead of 0.
Restoring DigitalClock alone makes the digital test reject its extra full-brightness
request while entering screen off. Candidate sources are restored after each
mutation and the suite is rerun.

The existing scale-overlay component suite, unit tests, formatting, types, lint,
production frontend build, CI test-file coverage and backend contract are also
checked. ARM64 packaging, physical menu navigation and physical wake must be
validated separately; a simulated backlight cannot establish watts or compliance.
