import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLocalClockTime,
  getTimezoneOffsetMs
} from '../src/components/IdleScreen/analogClockTime.ts';

const TEST_TIME = Date.UTC(2026, 7, 17, 12, 34, 56, 500);

function restoreTimezone(timezone: string | undefined) {
  if (timezone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = timezone;
  }
}

test('reads a timezone change made after the clock starts', () => {
  const originalTimezone = process.env.TZ;

  try {
    process.env.TZ = 'UTC';
    assert.equal(getTimezoneOffsetMs(TEST_TIME), 0);

    process.env.TZ = 'Europe/Zurich';
    const zurichOffsetMs = getTimezoneOffsetMs(TEST_TIME);
    assert.equal(zurichOffsetMs, -2 * 60 * 60 * 1000);

    const time = getLocalClockTime(TEST_TIME, zurichOffsetMs);
    assert.equal(Math.floor(time.hours), 2);
    assert.equal(Math.floor(time.minutes), 34);
    assert.equal(time.seconds, 56.5);
  } finally {
    restoreTimezone(originalTimezone);
  }
});

test('reads the offset for the current daylight-saving period', () => {
  const originalTimezone = process.env.TZ;

  try {
    process.env.TZ = 'Europe/Zurich';
    assert.equal(
      getTimezoneOffsetMs(Date.UTC(2026, 0, 17, 12)),
      -1 * 60 * 60 * 1000
    );
    assert.equal(
      getTimezoneOffsetMs(Date.UTC(2026, 7, 17, 12)),
      -2 * 60 * 60 * 1000
    );
  } finally {
    restoreTimezone(originalTimezone);
  }
});

test('wraps local time correctly for timezones west of UTC', () => {
  const fiveHoursWest = 5 * 60 * 60 * 1000;
  const time = getLocalClockTime(
    Date.UTC(2026, 7, 17, 2, 15, 0),
    fiveHoursWest
  );

  assert.equal(Math.floor(time.hours), 9);
  assert.equal(Math.floor(time.minutes), 15);
  assert.equal(time.seconds, 0);
});
