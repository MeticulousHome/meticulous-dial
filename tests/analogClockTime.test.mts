import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceLocalTime,
  millisecondsSinceMidnight,
  startAnalogClock
} from '../src/components/IdleScreen/analogClockTime.ts';
import {
  getBrowserLocalTime,
  readLocalTime,
  type LocalTimeSample
} from '../src/utils/localTime.ts';

const sample = (hour: number, minute = 0, second = 0, millisecond = 0) => ({
  year: 2026,
  month: 8,
  day: 17,
  hour,
  minute,
  second,
  millisecond
});
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function clock(readTime: () => LocalTimeSample | Promise<LocalTimeSample>) {
  let now = 0;
  let nextId = 0;
  const frames = new Map<number, () => void>();
  const timers = new Map<number, () => void>();
  const rendered: number[] = [];
  const errors: unknown[] = [];
  const stop = startAnalogClock({
    readTime,
    renderTime: (time) => rendered.push(time),
    onError: (error) => errors.push(error),
    now: () => now,
    requestFrame: (callback) => {
      frames.set(++nextId, () => callback(now));
      return nextId;
    },
    cancelFrame: (id) => {
      frames.delete(id);
    },
    setTimer: (callback, delay) => {
      assert.equal(delay, 1000);
      timers.set(++nextId, callback);
      return nextId;
    },
    clearTimer: (id) => {
      timers.delete(id);
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
    frames,
    timers,
    rendered,
    errors,
    setNow: (time: number) => {
      now = time;
    },
    frame: () => run(frames),
    sync: () => run(timers)
  };
}

test('follows automatic UTC to Zurich and manual London to Mexico City changes', async () => {
  let native = sample(12, 34, 56, 500);
  const c = clock(() => native);
  await flush();
  c.frame();
  assert.equal(c.rendered.at(-1), millisecondsSinceMidnight(native));
  // These are OS samples. No JavaScript timezone offset participates.
  for (const hour of [14, 13, 6]) {
    native = sample(hour, 34, 56, 500);
    c.sync();
    await flush();
    c.frame();
    assert.equal(c.rendered.at(-1), millisecondsSinceMidnight(native));
  }
  c.stop();
});

test('resynchronizes across both London and Zurich DST jumps', async () => {
  for (const [before, after] of [
    [0, 2],
    [1, 3],
    [1, 1],
    [2, 2]
  ]) {
    let native = sample(before, 59, 59, 900);
    const c = clock(() => native);
    await flush();
    c.setNow(200);
    c.frame();
    assert.equal(c.rendered.at(-1), millisecondsSinceMidnight(native) + 200);
    native = sample(after, 0, 0, 100);
    c.sync();
    await flush();
    c.frame();
    assert.equal(c.rendered.at(-1), millisecondsSinceMidnight(native));
    c.stop();
  }
});

test('wraps midnight and negative local-day arithmetic', () => {
  assert.equal(
    advanceLocalTime(millisecondsSinceMidnight(sample(23, 59, 59, 900)), 200),
    100
  );
  assert.equal(advanceLocalTime(-3_600_000, 0), 23 * 3_600_000);
  assert.equal(advanceLocalTime(0, 3 * 86_400_000 + 500), 500);
});

test('animates smoothly between reads without allocating or reading Date per frame', async () => {
  let reads = 0;
  const c = clock(() => {
    reads++;
    return sample(12);
  });
  await flush();
  const OriginalDate = globalThis.Date;
  try {
    globalThis.Date = class extends OriginalDate {
      constructor() {
        throw new Error('Date allocation in animation');
      }
      static now(): number {
        throw new Error('Wall time read in animation');
      }
    } as DateConstructor;
    for (let frame = 1; frame <= 60; frame++) {
      c.setNow((frame * 1000) / 60);
      c.frame();
    }
    assert.equal(reads, 1);
    assert.equal(c.rendered.length, 60);
    assert.equal(c.rendered.at(-1), 12 * 3_600_000 + 1000);
    assert.ok(c.rendered[0] > 12 * 3_600_000);
  } finally {
    globalThis.Date = OriginalDate;
    c.stop();
  }
});

test('initial rejection retries, avoids a false time, and recovers', async () => {
  let fail = true;
  const c = clock(async () => {
    if (fail) throw new Error('IPC unavailable');
    return sample(6, 15);
  });
  await flush();
  c.frame();
  assert.deepEqual(c.rendered, []);
  c.sync();
  await flush();
  assert.equal(c.errors.length, 1);
  fail = false;
  c.sync();
  await flush();
  c.frame();
  assert.equal(c.rendered.at(-1), millisecondsSinceMidnight(sample(6, 15)));
  fail = true;
  c.setNow(1500);
  c.sync();
  await flush();
  c.frame();
  assert.equal(c.errors.length, 2);
  assert.equal(
    c.rendered.at(-1),
    millisecondsSinceMidnight(sample(6, 15)) + 1500
  );
  c.stop();
});

test('synchronous retrieval failures follow the same recovery path', async () => {
  let fail = true;
  const c = clock(() => {
    if (fail) throw new Error('Unavailable');
    return sample(8);
  });
  assert.equal(c.errors.length, 1);
  fail = false;
  c.sync();
  await flush();
  c.frame();
  assert.equal(c.rendered.at(-1), 8 * 3_600_000);
  c.stop();
});

test('serializes slow reads and compensates for IPC latency without mutating the sample', async () => {
  let resolve!: (value: LocalTimeSample) => void;
  let reads = 0;
  const c = clock(() => {
    reads++;
    return new Promise((r) => {
      resolve = r;
    });
  });
  c.setNow(200);
  c.frame();
  assert.equal(c.timers.size, 0);
  const native = Object.freeze(sample(8));
  resolve(native);
  await flush();
  c.frame();
  assert.equal(reads, 1);
  assert.equal(c.rendered.at(-1), 8 * 3_600_000 + 100);
  assert.equal(native.millisecond, 0);
  c.stop();
});

test('cleanup cancels frames and retries and ignores pending success or failure', async () => {
  for (const reject of [false, true]) {
    let settle!: () => void;
    const c = clock(
      () =>
        new Promise((resolve, fail) => {
          settle = () =>
            reject ? fail(new Error('Late failure')) : resolve(sample(8));
        })
    );
    c.stop();
    settle();
    await flush();
    assert.equal(c.frames.size, 0);
    assert.equal(c.timers.size, 0);
    assert.deepEqual(c.rendered, []);
    assert.deepEqual(c.errors, []);
  }
  const c = clock(() => sample(9));
  await flush();
  assert.equal(c.timers.size, 1);
  c.stop();
  assert.equal(c.timers.size, 0);
  assert.equal(c.frames.size, 0);
});

test('browser development samples the current browser timezone on every read', () => {
  const OriginalDate = globalThis.Date;
  let hour = 12;
  try {
    globalThis.Date = class extends OriginalDate {
      getHours() {
        return hour;
      }
      getMinutes() {
        return 34;
      }
      getSeconds() {
        return 56;
      }
      getMilliseconds() {
        return 500;
      }
      getFullYear() {
        return 2026;
      }
      getMonth() {
        return 7;
      }
      getDate() {
        return 17;
      }
    };
    assert.deepEqual(getBrowserLocalTime(), sample(12, 34, 56, 500));
    hour = 14;
    assert.deepEqual(getBrowserLocalTime(), sample(14, 34, 56, 500));
  } finally {
    globalThis.Date = OriginalDate;
  }
});

test('Tauri reads native calendar and time even when JavaScript local time is wrong', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const OriginalDate = globalThis.Date;
  const native = { ...sample(0, 0, 0), year: 2027, month: 1, day: 1 };
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __TAURI_INTERNALS__: {
          invoke: async (command: string) => {
            assert.equal(command, 'get_os_local_time');
            return native;
          }
        }
      }
    });
    globalThis.Date = class extends OriginalDate {
      constructor() {
        throw new Error('Embedded JavaScript time must not be used');
      }
    } as DateConstructor;
    assert.deepEqual(await readLocalTime(), native);
  } finally {
    globalThis.Date = OriginalDate;
    if (previousWindow)
      Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('plain-browser selection works without Tauri internals', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {}
    });
    const before = getBrowserLocalTime();
    const actual = await readLocalTime();
    const after = getBrowserLocalTime();
    assert.ok(
      JSON.stringify(actual) === JSON.stringify(before) ||
        JSON.stringify(actual) === JSON.stringify(after)
    );
  } finally {
    if (previousWindow)
      Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
