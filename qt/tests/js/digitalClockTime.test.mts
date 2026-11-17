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
  startDigitalClock,
  uses24HourClock
} from '../src/components/IdleScreen/digitalClockTime.ts';
import type { LocalTimeSample } from '../src/utils/localTime.ts';

// Milliseconds since local midnight, as the clock gets them from the OS time.
const at = (hour: number, minute = 30, second = 15) =>
  ((hour * 60 + minute) * 60 + second) * 1000;

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

// The digital sleep clock shows the OS local time, like the analog clock and
// Time & Date, because JavaScriptCore on the machine keeps stale timezone data.
//
// Regression a user would see: after a timezone change the digital sleep clock
// shows a different hour than the analog clock and Time & Date, or turns to the
// next minute only on the next native read.
// Expected values: the OS sample that `get_os_local_time` returns (readTime
// here), in the format above.
// What the suite missed: `DigitalClock` formatted `new Date()`, so a stale
// JavaScript timezone reached the display, and no test covered it.
const sample = (hour: number, minute: number, second = 0, millisecond = 0) => ({
  year: 2026,
  month: 10,
  day: 19,
  hour,
  minute,
  second,
  millisecond
});
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function digitalClock(readTime: () => LocalTimeSample) {
  let now = 0;
  let nextId = 0;
  const refreshes = new Map<number, () => void>();
  const reads = new Map<number, () => void>();
  const shown: number[] = [];
  const errors: unknown[] = [];
  const stop = startDigitalClock({
    readTime,
    renderTime: (milliseconds) => shown.push(milliseconds),
    onError: (error) => errors.push(error),
    now: () => now,
    requestFrame: (callback) => {
      refreshes.set(++nextId, () => callback(now));
      return nextId;
    },
    cancelFrame: (id) => {
      refreshes.delete(id);
    },
    setTimer: (callback) => {
      reads.set(++nextId, callback);
      return nextId;
    },
    clearTimer: (id) => {
      reads.delete(id);
    }
  });
  const run = (callbacks: Map<number, () => void>) => {
    assert.equal(callbacks.size, 1);
    const [id, callback] = callbacks.entries().next().value!;
    callbacks.delete(id);
    callback();
  };
  return {
    stop,
    errors,
    refresh: (elapsed: number) => {
      now += elapsed;
      run(refreshes);
    },
    read: () => run(reads),
    shown: (use24Hour: boolean) => formatTime(use24Hour, shown.at(-1)!)
  };
}

test('shows the OS hour after a timezone change while JavaScript time is stale', async () => {
  const OriginalDate = globalThis.Date;
  try {
    // JavaScriptCore still on UTC: 12:05:30 whatever the OS says.
    globalThis.Date = class extends OriginalDate {
      getHours() {
        return 12;
      }
      getMinutes() {
        return 5;
      }
      getSeconds() {
        return 30;
      }
    } as DateConstructor;
    // Automatic UTC to Zurich change, then manual London to Mexico City.
    let native = sample(14, 5, 30);
    const c = digitalClock(() => native);
    await flush();
    c.refresh(0);
    assert.deepEqual(c.shown(true), {
      hours: 14,
      minutes: 5,
      seconds: 30,
      midday: ''
    });
    assert.deepEqual(c.shown(false), {
      hours: 2,
      minutes: 5,
      seconds: 30,
      midday: 'PM'
    });
    native = sample(7, 5, 31);
    c.read();
    await flush();
    c.refresh(0);
    assert.deepEqual(c.shown(true), {
      hours: 7,
      minutes: 5,
      seconds: 31,
      midday: ''
    });
    assert.deepEqual(c.shown(false), {
      hours: 7,
      minutes: 5,
      seconds: 31,
      midday: 'AM'
    });
    assert.deepEqual(c.errors, []);
    c.stop();
  } finally {
    globalThis.Date = OriginalDate;
  }
});

test('turns to the next minute between native reads', async () => {
  let reads = 0;
  const c = digitalClock(() => {
    reads++;
    return sample(23, 59, 59, 900);
  });
  await flush();
  c.refresh(0);
  assert.deepEqual(c.shown(false), {
    hours: 11,
    minutes: 59,
    seconds: 59,
    midday: 'PM'
  });
  c.refresh(250);
  assert.equal(reads, 1);
  assert.deepEqual(c.shown(false), {
    hours: 12,
    minutes: 0,
    seconds: 0,
    midday: 'AM'
  });
  c.stop();
});
