// Which "Hold to start" animation the Dial shows for the value it has stored
// (qt/qml/Dial/Core/HoldAnimations.js).
//
// Regression a user at the machine would see without it: after a rollback to an image whose Dial does not
// know a newer animation (or with a damaged storage file), holding a card shows no ring at all, or sparks
// nobody asked for, and Advanced Settings shows "undefined" as the animation.
// Expected values come from HOLD_ANIMATIONS itself (the three keys the setting screen stores) and from the
// rule that the plain ring of the React Dial is the default.
// The suite missed it: the end-to-end tests only store values the menu offers.
import assert from 'node:assert/strict';
import test from 'node:test';

import { HOLD_ANIMATIONS, hasSparks, normalize, shortLabel, spec } from '../../qml/Dial/Core/HoldAnimations.js';

test('the plain ring comes first and is what "default" means', () => {
  assert.deepEqual(HOLD_ANIMATIONS.map((i) => i.key),
    ['default', 'sparks', 'rainbow', 'heat', 'steam', 'pressure', 'espresso']);
  const plain = spec('default');
  assert.deepEqual([plain.particles, plain.waves, plain.start], ['', false, '']);
  // The React Dial's ring: 5 px, white, one colour.
  assert.deepEqual(plain.ring, { width: 5, color: 'white', scheme: 'solid', glow: 0 });
});

test('each animation draws what its name says', () => {
  // [key, what flies off the ring (SparkRing's styles), pressure waves, start effect, ring scheme]
  const expected = [
    ['sparks', 'sparks', false, '', 'solid'],
    ['rainbow', 'sparkles', false, '', 'rainbow'],
    ['heat', '', false, 'glow', 'heat'],
    ['steam', 'steam', false, '', 'solid'],
    ['pressure', '', true, '', 'solid'],
    ['espresso', 'drops', false, '', 'crema']
  ];
  for (const [key, particles, waves, start, scheme] of expected) {
    const s = spec(key);
    assert.deepEqual([s.particles, s.waves, s.start, s.ring.scheme], [particles, waves, start, scheme], key);
    assert.equal(hasSparks(key), particles !== '', key);
  }
});

test('every scheme, particle and start effect is one the QML knows', () => {
  // Arc.qml's scheme map, SparkRing.qml's style map, HoldStartWave.qml's effects.
  for (const item of HOLD_ANIMATIONS) {
    assert.ok(['solid', 'rainbow', 'heat', 'crema'].includes(item.ring.scheme), item.key);
    assert.ok(['', 'sparks', 'sparkles', 'steam', 'drops'].includes(item.particles), item.key);
    assert.ok(['', 'glow'].includes(item.start), item.key);
    assert.ok(item.ring.width > 0 && item.ring.glow >= 0, item.key);
  }
});

test('a value the Dial does not know is the plain ring', () => {
  for (const stored of [undefined, null, '', 'fireworks', 3, {}]) {
    assert.equal(normalize(stored), 'default');
    assert.equal(hasSparks(stored), false);
    assert.equal(shortLabel(stored), 'Ring');
  }
});

test('every animation has the labels the menus show', () => {
  for (const item of HOLD_ANIMATIONS) {
    assert.equal(normalize(item.key), item.key);
    assert.ok(item.label.length > 0);
    assert.equal(shortLabel(item.key), item.shortLabel);
  }
});
