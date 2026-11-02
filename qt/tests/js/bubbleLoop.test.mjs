// Protects: the heating screen's water bubbles loop without a visible restart. A barista watching the screen
// waits minutes at a time; when every bubble stops at the same moment at each wrap (every ~8.6 s), the field
// freezes and jumps.
//
// Expected values: the loop frames are BubbleAnimation.qml's loop segment; the bubble size at a frame is what
// the asset's keys and easing give (lottie's cubic-bezier keyframes, as rlottie draws them). Seamless means
// the size at both loop ends is equal, the speed continues across the wrap, the intro arrives at the loop and
// the drain leaves it at the loop's speed, and the field's mean per-frame change near the wrap stays above
// half its median over the loop.
//
// Catches: the asset baked from the React art, where all 60 bubbles hold the same size with flat easing at
// frames 62 and 312 (per-frame change near the wrap falls to a fraction of the median); and a fix that closes
// the loop but leaves the intro and drain easing as they were, so the picture jumps entering and leaving it.
// Runs from the repo root.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const qml = fs.readFileSync('qt/qml/Dial/screens/brew/BubbleAnimation.qml', 'utf8');
const [START, END] = qml.match(/queue = \[\[(\d+), (\d+)\]\]/).slice(1).map(Number);
const asset = JSON.parse(fs.readFileSync('qt/qml/Dial/assets/lottie/brew-water-bubbles.json', 'utf8'));
const holes = asset.layers[0].shapes[0].it.filter((i) => i.ty === 'el').map((h) => h.s.k);

const first = (v) => (Array.isArray(v) ? v[0] : v);
const bezier = (s, a, b) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;
function ease(a, u) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (bezier(m, first(a.o.x), first(a.i.x)) < u) lo = m;
    else hi = m;
  }
  return bezier((lo + hi) / 2, first(a.o.y), first(a.i.y));
}
function size(keys, t) {
  if (t <= keys[0].t) return keys[0].s[0];
  for (let i = 0; i + 1 < keys.length; i++) {
    const [a, b] = [keys[i], keys[i + 1]];
    if (t >= a.t && t <= b.t) return a.s[0] + (b.s[0] - a.s[0]) * (a.i ? ease(a, (t - a.t) / (b.t - a.t)) : (t - a.t) / (b.t - a.t));
  }
  return keys.at(-1).s[0];
}

test('every bubble has the same size at both ends of the loop', () => {
  for (const keys of holes) assert.ok(Math.abs(size(keys, START) - size(keys, END)) < 1e-3);
});

test('every bubble keeps its speed across the wrap', () => {
  const e = 0.05;
  for (const keys of holes) {
    const before = (size(keys, END) - size(keys, END - e)) / e;
    const after = (size(keys, START + e) - size(keys, START)) / e;
    assert.ok(Math.abs(before - after) < 0.02 + 0.02 * Math.abs(before), `${before} then ${after}`);
  }
});

test('the intro arrives at the loop, and the drain leaves it, at the loop speed', () => {
  const e = 0.05;
  const speed = (keys, from, to) => (size(keys, to) - size(keys, from)) / e;
  for (const keys of holes) {
    for (const [at, inside] of [[START, speed(keys, START, START + e)], [END, speed(keys, END - e, END)]]) {
      const outside = at === START ? speed(keys, START - e, START) : speed(keys, END, END + e);
      assert.ok(Math.abs(outside - inside) < 0.02 + 0.02 * Math.abs(inside), `${outside} against ${inside} at ${at}`);
    }
  }
});

test('the field keeps moving through the wrap', () => {
  const n = END - START;
  const frames = Array.from({ length: n + 40 }, (_, i) => START + (i % n));
  const motion = frames.slice(1).map((f, i) =>
    holes.reduce((sum, keys) => sum + Math.abs(size(keys, f) - size(keys, frames[i])), 0) / holes.length);
  const median = [...motion.slice(0, n)].sort((a, b) => a - b)[n >> 1];
  const lowest = Math.min(...motion.slice(n - 12, n + 12));
  assert.ok(lowest > median / 2, `${lowest} against a median of ${median}`);
});
