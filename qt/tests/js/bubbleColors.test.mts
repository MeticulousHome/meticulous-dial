// The heating bubbles' four colours (qt/qml/Dial/screens/brew/BrewLogic.js bubbleColors).
//
// Regression a user at the machine would see without it: the bubbles show the wrong heat. The gradient across
// the four sensors invisible during a heat-up (they differ by 1-5 °C on a 30 °C scale), the hottest sensor
// painted anything but its real colour (orange must mean "at target"), the top coloured with the bottom
// sensor's reading, a missing or broken reading painting the bubbles purple or orange, or colour left on the
// bubbles when the tank is empty or when nothing valid is known.
// Expected values come from the Dial's own palette (the CSS stops of LottieBubbleAnimation.tsx: #280B54 at
// 0.17, #F44D19 at 0.92, linear in RGB between its stops, worked by hand) and from the rule in BrewLogic.js:
// the hottest reading keeps its colour, each colder one is shown hottest + 4 * (reading - hottest), rounded
// once, on a scale of 30 °C up to the target (90 when there is none); grey #808080 without water or when
// neither the sensor nor the temperature holds a valid reading.
// The suite missed it: the e2e test only runs against a live Dial, and nothing else exercised the colours.
import assert from 'node:assert/strict';
import test from 'node:test';

import { bubbleColors } from '../../qml/Dial/screens/brew/BrewLogic';

const PURPLE = '#280B54';
const ORANGE = '#F44D19';
const GREY = '#808080';
const bars = (up, mu, md, down) => ({ t_bar_up: up, t_bar_mu: mu, t_bar_md: md, t_bar_down: down });

test('a heat-up with the sensors 2 °C apart shows a plain gradient, the hottest at its true colour', () => {
  // shown 88, 80, 72, 64 on 60..90: palette positions 0.87, 0.67, 0.47, 0.27
  assert.deepEqual(bubbleColors(bars(88, 86, 84, 82), 80, 90, true), ['#ED5824', '#BB3755', '#771C6D', '#300B5A']);
});

test('the hottest sensor keeps its real colour wherever it sits among the four', () => {
  for (let hot = 0; hot < 4; hot++) {
    const readings = [74, 74, 74, 74];
    readings[hot] = 75;
    const colors = bubbleColors(bars(...readings), 70, 90, true);
    assert.equal(colors[hot], '#922667', String(hot));
    colors.forEach((c, i) => i !== hot && assert.notEqual(c, '#922667', String(hot)));
  }
});

test('the top sensor colours the top and the bottom sensor the bottom', () => {
  assert.deepEqual(bubbleColors(bars(60, 60, 60, 90), 80, 90, true), [PURPLE, PURPLE, PURPLE, ORANGE]);
  const colors = bubbleColors(bars(90, 60, 60, 60), 80, 90, true);
  assert.deepEqual(colors, [ORANGE, PURPLE, PURPLE, PURPLE]);
});

test('the scale ends in orange at the target and in purple 30 °C below', () => {
  assert.deepEqual(bubbleColors(bars(60, 60, 60, 60), 60, 90, true), Array(4).fill(PURPLE));
  assert.deepEqual(bubbleColors(bars(90, 90, 90, 90), 90, 90, true), Array(4).fill(ORANGE));
  assert.deepEqual(bubbleColors(bars(63, 63, 63, 63), 63, 93, true), Array(4).fill(PURPLE));
  assert.deepEqual(bubbleColors(bars(93, 93, 93, 93), 93, 93, true), Array(4).fill(ORANGE));
  assert.equal(bubbleColors(bars(75, 75, 75, 75), 75, 90, true)[0], '#922667');
});

test('beyond the scale the colour stays at its end', () => {
  assert.deepEqual(bubbleColors(bars(20, 30, 200, 400), 80, 90, true), [PURPLE, PURPLE, PURPLE, ORANGE]);
});

test('no target behaves as 90, and a low target neither divides by zero nor goes wrong', () => {
  assert.deepEqual(bubbleColors(bars(90, 60, 90, 60), 80, 0, true), [ORANGE, PURPLE, ORANGE, PURPLE]);
  assert.deepEqual(bubbleColors(bars(40, 10, 40, 10), 40, 40, true), [ORANGE, PURPLE, ORANGE, PURPLE]);
  assert.deepEqual(bubbleColors(bars(10, 10, 40, 70), 40, 40, true), [PURPLE, PURPLE, PURPLE, ORANGE]);
});

test('a reading that is missing or broken falls back to the temperature, sensor by sensor', () => {
  for (const bad of [0, 600, 501, -3, undefined, NaN, 'NaN', null]) {
    const colors = bubbleColors(bars(bad, 90, bad, 60), 90, 90, true);
    assert.deepEqual(colors, [ORANGE, ORANGE, ORANGE, PURPLE], String(bad));
  }
  assert.deepEqual(bubbleColors({}, 90, 90, true), Array(4).fill(ORANGE));
  assert.deepEqual(bubbleColors(undefined, 60, 90, true), Array(4).fill(PURPLE));
  assert.equal(bubbleColors(bars(500, 500, 500, 500), 60, 90, true)[0], ORANGE);
});

test('a bad temperature leaves a bad reading grey and does not touch the valid ones', () => {
  for (const bad of [1000, 0, NaN, undefined]) {
    assert.deepEqual(bubbleColors(bars(0, 0, 0, 0), bad, 90, true), Array(4).fill(GREY), String(bad));
    assert.deepEqual(bubbleColors(bars(90, 0, 60, 'NaN'), bad, 90, true), [ORANGE, GREY, PURPLE, GREY], String(bad));
  }
  assert.deepEqual(bubbleColors(bars(90, 60, 90, 60), 1000, 90, true), [ORANGE, PURPLE, ORANGE, PURPLE]);
});

test('four equal readings stay flat at their true colour, taken to the whole degree', () => {
  const eighty = bubbleColors(bars(80, 80, 80, 80), 70, 90, true)[0];
  assert.deepEqual(bubbleColors(bars(79.9, 79.9, 79.9, 79.9), 70, 90, true), Array(4).fill(eighty));
  assert.deepEqual(bubbleColors(bars(80.2, 80.2, 80.2, 80.2), 70, 90, true), Array(4).fill(eighty));
  assert.notEqual(bubbleColors(bars(79.4, 79.4, 79.4, 79.4), 70, 90, true)[0], bubbleColors(bars(79.6, 79.6, 79.6, 79.6), 70, 90, true)[0]);
});

test('the rounding comes after the boost, so a 0.1 °C difference stays a one-degree step', () => {
  // 80.5 shows as 81 (0.695: #C33C4F) and 80.4 as round(80.5 - 0.4) = 80 (0.67: #BB3755); rounding the readings
  // first would give 81 and 80 and then 81 - 4 = 77.
  assert.deepEqual(bubbleColors(bars(80.5, 80.4, 80.4, 80.4), 70, 90, true), ['#C33C4F', '#BB3755', '#BB3755', '#BB3755']);
});

test('without water all four are grey', () => {
  assert.deepEqual(bubbleColors(bars(90, 80, 70, 60), 80, 90, false), Array(4).fill(GREY));
});
