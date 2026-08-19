const assert = require('node:assert/strict');
const test = require('node:test');

const {
  hasRetainedPourWeight,
  plausiblePeakFlow,
  PourDetector,
  resolvedPourEndWeight
} = require('../src/features/freePour/pourDetector.ts');
const {
  BrewerRemovalConfirmation
} = require('../src/features/freePour/brewWeightFilter.ts');

const sample = (timeMs, weightG, flowGps = 0) => ({
  timeMs,
  weightG,
  flowGps
});

test('a table impact does not start the brew timer', () => {
  const detector = new PourDetector();
  const events = [
    detector.process(sample(0, 0)),
    detector.process(sample(100, 6, 0.7)),
    detector.process(sample(200, 0, 10.9)),
    detector.process(sample(400, 0, 10.9)),
    detector.process(sample(800, 0, 7.7)),
    detector.process(sample(1200, 0, 3.7)),
    detector.process(sample(1800, 0, 0.9)),
    detector.process(sample(2400, 0, 0.2)),
    detector.process(sample(3200, 0, 0))
  ].filter(Boolean);

  assert.deepEqual(events, []);
  assert.equal(detector.isPouring, false);
});

test('a real pour starts after confirmation and is backdated', () => {
  const detector = new PourDetector();
  const sequence = [
    sample(0, 0, 0),
    sample(200, 1.5, 0.2),
    sample(400, 2.5, 0.4),
    sample(600, 4.7, 1.1),
    sample(800, 5.3, 1.7),
    sample(1000, 6.4, 2.9),
    sample(1200, 8.1, 4.2)
  ];

  const events = sequence
    .map((value) => detector.process(value))
    .filter(Boolean);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'pour-start');
  assert.equal(events[0].sample.timeMs, 200);
  assert.equal(events[0].sample.weightG, 1.5);
  assert.equal(detector.isPouring, true);
});

test('the recorded dripper shake is not classified as a pour', () => {
  const detector = new PourDetector();
  const sequence = [
    sample(0, 225.9, 0),
    sample(201, 230.2, 0),
    sample(402, 234.4, 0.9),
    sample(603, 399.5, 21.5),
    sample(803, 374.6, 39.2),
    sample(1006, 377.7, 74.5),
    sample(1208, 230.1, 118.1),
    sample(1410, 223.6, 139.8),
    sample(1611, 225.5, 162.9),
    sample(2013, 225.7, 121.4),
    sample(2617, 225.9, 24.5),
    sample(3219, 225.9, 0.9),
    sample(4023, 225.9, 0)
  ];

  const events = sequence
    .map((value) => detector.process(value))
    .filter(Boolean);
  assert.deepEqual(events, []);
  assert.equal(detector.isPouring, false);
});

test('longer oscillating leveling remains movement', () => {
  const detector = new PourDetector();
  detector.process(sample(0, 226));
  const events = [];
  for (let timeMs = 200; timeMs <= 6000; timeMs += 200) {
    const phase = (timeMs / 200) % 4;
    const weightG =
      phase === 1 ? 227 : phase === 2 ? 228 : phase === 3 ? 227 : 226;
    const event = detector.process(sample(timeMs, weightG, 4));
    if (event) events.push(event);
  }

  assert.deepEqual(events, []);
  assert.equal(detector.isPouring, false);
});

test('only retained weight validates a completed pour', () => {
  assert.equal(hasRetainedPourWeight(10, 11.4), false);
  assert.equal(hasRetainedPourWeight(10, 11.5), true);
  assert.equal(hasRetainedPourWeight(234.4, 225.9), false);
  assert.equal(resolvedPourEndWeight(1.5, 36.7, 36.5), 36.5);
  assert.equal(resolvedPourEndWeight(234.4, 241.1, 225.9), null);
});

test('implausible motion flow is excluded from peak reporting', () => {
  assert.equal(plausiblePeakFlow(8.2), 8.2);
  assert.equal(plausiblePeakFlow(15), 15);
  assert.equal(plausiblePeakFlow(162.9), 0);
});

test('brewer removal requires three seconds and a stable server', () => {
  const removal = new BrewerRemovalConfirmation();
  assert.equal(removal.update(true, 0, 195.5).type, 'started');
  assert.equal(removal.update(true, 500, 95).type, 'pending');
  assert.equal(removal.update(true, 1500, 95.4).type, 'pending');
  assert.equal(removal.update(true, 2500, 95.6).type, 'pending');
  const confirmed = removal.update(true, 3000, 95.5);
  assert.equal(confirmed.type, 'confirmed');
  assert.equal(confirmed.startedAtMs, 0);
});

test('aggressive leveling cannot confirm brewer removal', () => {
  const removal = new BrewerRemovalConfirmation();
  assert.equal(removal.update(true, 0, 100).type, 'started');
  for (let timeMs = 500; timeMs <= 5000; timeMs += 500) {
    const weightG = timeMs % 1000 === 0 ? 100 : 90;
    assert.equal(removal.update(true, timeMs, weightG).type, 'pending');
  }
  assert.equal(removal.update(false, 5200, 226).type, 'cancelled');
});
