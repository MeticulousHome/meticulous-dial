import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DISPLAY_DIAMETER,
  HISTORY_TITLE_EDGE_INSET,
  HISTORY_TITLE_LEFT,
  HISTORY_TITLE_LINE_HEIGHT,
  HISTORY_TITLE_TOP,
  HISTORY_TITLE_WIDTH,
  POST_BREW_EXIT_TIMEOUT_MS,
  safeCircleChordWidth
} from '../src/features/freePour/historyLayout.ts';

test('completed pour-over screens leave after two minutes of inactivity', () => {
  assert.equal(POST_BREW_EXIT_TIMEOUT_MS, 120_000);
});

test('the history title is centered inside the circular chord at its full height', () => {
  const center = DISPLAY_DIAMETER / 2;
  const radius = center - HISTORY_TITLE_EDGE_INSET;

  assert.equal(HISTORY_TITLE_LEFT + HISTORY_TITLE_WIDTH / 2, center);
  assert.equal(
    HISTORY_TITLE_WIDTH,
    safeCircleChordWidth(
      DISPLAY_DIAMETER,
      HISTORY_TITLE_TOP,
      HISTORY_TITLE_LINE_HEIGHT,
      HISTORY_TITLE_EDGE_INSET
    )
  );

  for (const x of [HISTORY_TITLE_LEFT, HISTORY_TITLE_LEFT + HISTORY_TITLE_WIDTH]) {
    for (const y of [HISTORY_TITLE_TOP, HISTORY_TITLE_TOP + HISTORY_TITLE_LINE_HEIGHT]) {
      assert.ok(
        Math.hypot(x - center, y - center) <= radius + 1e-9,
        `title corner (${x}, ${y}) must stay inside the ${radius}px safe radius`
      );
    }
  }
});

test('the chord helper returns no width outside the safe circle', () => {
  assert.equal(safeCircleChordWidth(480, 0, 22, 8), 0);
});
