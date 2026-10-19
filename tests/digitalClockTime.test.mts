// The digital sleep clock in 12-hour and 24-hour format.
//
// Regression a user would see: in the 12-hour format, noon reading 12 AM or
// midnight reading 0 AM; in the 24-hour format, an AM/PM mark or 12 instead of
// 00 after midnight; a machine that never chose a format showing the 12-hour
// clock.
// Expected values: the 12-hour clock (12 AM is midnight, 12 PM is noon) and the
// backend's default for clock_format_24_hour, true, in meticulous-backend's
// tests/contracts/settings_defaults.json.
// What the suite missed: no test reached the digital clock, so `hours <= 12`
// for the AM/PM split or a dropped `+ 1` in the 12-hour conversion passed
// every gate.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatTime,
  uses24HourClock
} from '../src/components/IdleScreen/digitalClockTime.ts';

// A day without a daylight saving change, so every local hour exists.
const at = (hour: number, minute = 30, second = 15) =>
  new Date(2026, 7, 17, hour, minute, second);

test('the 12-hour clock reads 12 AM at midnight and 12 PM at noon', () => {
  assert.deepEqual(formatTime(false, at(0, 0, 0)), {
    hours: 12,
    minutes: 0,
    seconds: 0,
    midday: 'AM'
  });
  assert.deepEqual(formatTime(false, at(12, 0, 0)), {
    hours: 12,
    minutes: 0,
    seconds: 0,
    midday: 'PM'
  });
});

test('the 12-hour clock turns to PM at noon, not after it', () => {
  const dialHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (let hour = 0; hour < 24; hour++) {
    const time = formatTime(false, at(hour));
    assert.equal(time.hours, dialHours[hour % 12], `hour ${hour}`);
    assert.equal(time.midday, hour < 12 ? 'AM' : 'PM', `hour ${hour}`);
  }
  assert.equal(formatTime(false, at(11, 59, 59)).midday, 'AM');
  assert.equal(formatTime(false, at(23, 59, 59)).hours, 11);
});

test('the 24-hour clock reads 00 to 23 without AM or PM', () => {
  for (let hour = 0; hour < 24; hour++) {
    const time = formatTime(true, at(hour));
    assert.equal(time.hours, hour);
    assert.equal(time.midday, '');
  }
});

test('minutes and seconds are the same in both formats', () => {
  for (const use24Hour of [true, false]) {
    const time = formatTime(use24Hour, at(23, 59, 58));
    assert.equal(time.minutes, 59);
    assert.equal(time.seconds, 58);
  }
});

test('without a chosen format the clock is 24-hour, as the backend defaults', () => {
  assert.equal(uses24HourClock(undefined), true);
  assert.equal(uses24HourClock(null), true);
  assert.equal(uses24HourClock({}), true);
  assert.equal(uses24HourClock({ clock_format_24_hour: true }), true);
  assert.equal(uses24HourClock({ clock_format_24_hour: false }), false);
});
