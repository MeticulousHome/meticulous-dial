/**
 * The shot graph of a machine whose scale reports nothing.
 *
 * 1. What a user would see without it: after a shot on a machine whose scale
 *    gives no readings, the brew-complete graph (and the profile's shot
 *    history) turns the screen black and the Dial stops answering the knob
 *    and the buttons. The backend sends a missing reading as the string "NaN";
 *    the graph called .toFixed on it, and the exception unmounted the UI.
 * 2. Where the expected values come from: the samples are what the backend
 *    sends (tests/shot-graph/shot.ts); a missing reading ("NaN" or null)
 *    counts as 0, the fallback the graph already meant for an absent value
 *    (`|| 0.0`), and every value is printed with its series' `precision` in
 *    src/types/dataTypes.ts.
 * 3. What the suite missed: nothing rendered the graph with backend-shaped
 *    samples. Revert the fix and every test here fails on
 *    "toFixed is not a function".
 */
import { test, expect, type Page } from '@playwright/test';
import { dataTypes, type DataTypeKey } from '../../src/types/dataTypes';
import {
  FLOW,
  NAN_PRESSURE_SAMPLE,
  NULL_PRESSURE_SAMPLE,
  PRESSURE_STEP,
  SAMPLES
} from './shot';
import type {} from './fixture';

const MISSING = 0;
const shown = (key: DataTypeKey, value: number) =>
  value.toFixed(dataTypes[key].precision);

const label = (page: Page, key: DataTypeKey) =>
  page
    .getByText(key, { exact: true })
    .locator('xpath=following-sibling::span[1]');

async function expectLabels(page: Page, values: Record<DataTypeKey, number>) {
  for (const key of Object.keys(values) as DataTypeKey[]) {
    await expect(label(page, key)).toHaveText(shown(key, values[key]));
  }
}

// With 51 samples one step of the knob moves the selection by one sample.
const turnRight = (page: Page, steps: number) =>
  page.evaluate(
    (steps) =>
      window.shotGraphProbe.emit(
        ...Array.from({ length: steps }, () => 'right' as const)
      ),
    steps
  );

const renderErrors = (page: Page) =>
  page.evaluate(() => window.shotGraphProbe.errors);

const points = (d: string) =>
  d
    .slice(1)
    .split(' L')
    .map((point) => point.split(' ').map(Number));

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const { origin } = new URL(route.request().url());
    expect(origin, 'fixture must never contact a machine/service').toBe(
      'http://127.0.0.1:1435'
    );
    return route.continue();
  });
  await page.goto('/');
  await page.waitForFunction(
    () =>
      window.shotGraphProbe?.ready || window.shotGraphProbe?.errors.length > 0
  );
  expect(await renderErrors(page)).toEqual([]);
});

test.afterEach(async ({ page }) => {
  expect(await renderErrors(page)).toEqual([]);
});

test('a shot without scale readings renders its values and lines', async ({
  page
}, testInfo) => {
  await expectLabels(page, { pressure: 0, flow: FLOW, weight: MISSING });
  await page.screenshot({ path: testInfo.outputPath('shot-graph.png') });

  // The final weight at the top right of the graph, from the last sample.
  const finalWeight = page.locator('svg text', {
    has: page.locator('tspan', { hasText: /^g$/ })
  });
  await expect(finalWeight.locator('tspan').first()).toHaveText(
    shown('weight', MISSING)
  );

  const lines = page.locator('svg path[fill="transparent"]');
  await expect(lines).toHaveCount(3);
  const paths = Object.fromEntries(
    await lines.evaluateAll((elements) =>
      elements.map((path) => [
        path.getAttribute('stroke'),
        path.getAttribute('d')
      ])
    )
  );
  for (const key of ['flow', 'pressure', 'weight'] as DataTypeKey[]) {
    const d = paths[dataTypes[key].color];
    expect(d, `${key} line`).toMatch(/^M/);
    expect(d, `${key} line`).not.toContain('NaN');
  }
  // No weight reading at all: a flat line on zero, where the pressure line
  // starts (its first sample is 0 bar).
  const zero = points(paths[dataTypes.pressure.color])[0][1];
  const weightLine = points(paths[dataTypes.weight.color]);
  expect(weightLine).toHaveLength(SAMPLES);
  expect(new Set(weightLine.map(([, y]) => y))).toEqual(new Set([zero]));
});

test('turning the knob over "NaN" and null readings keeps the screen alive', async ({
  page
}) => {
  const stops: [number, Record<DataTypeKey, number>][] = [
    [5, { pressure: 5 * PRESSURE_STEP, flow: FLOW, weight: MISSING }],
    [
      NAN_PRESSURE_SAMPLE,
      { pressure: MISSING, flow: MISSING, weight: MISSING }
    ],
    [15, { pressure: 15 * PRESSURE_STEP, flow: FLOW, weight: MISSING }],
    [
      NULL_PRESSURE_SAMPLE,
      { pressure: MISSING, flow: MISSING, weight: MISSING }
    ],
    [30, { pressure: 30 * PRESSURE_STEP, flow: FLOW, weight: MISSING }],
    // The bench machine's last sample: 0 bar, 0 ml/s, weight "NaN".
    [SAMPLES - 1, { pressure: 0, flow: 0, weight: MISSING }]
  ];
  let selected = 0;
  for (const [sample, values] of stops) {
    await turnRight(page, sample - selected);
    selected = sample;
    await expectLabels(page, values);
  }
});
