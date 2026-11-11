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

import { HOLD_ANIMATIONS, hasSparks, normalize, shortLabel } from '../../qml/Dial/Core/HoldAnimations.js';

test('the plain ring comes first and is what "default" means', () => {
  assert.deepEqual(HOLD_ANIMATIONS.map((i) => i.key), ['default', 'sparks', 'rainbow']);
  assert.equal(hasSparks('default'), false);
  assert.equal(hasSparks('sparks'), true);
  assert.equal(hasSparks('rainbow'), true);
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
