import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { GestureType } from '../../src/types';
import type { ScreenType } from '../../src/components/store/features/screens/screens-slice';
import type {} from './fixture';

const emit = (page: Page, ...gestures: GestureType[]) =>
  page.evaluate((gestures) => window.scaleProbe.emit(...gestures), gestures);
const actions = (page: Page) =>
  page.evaluate(() =>
    window.scaleProbe.events
      .filter((event) => event.kind === 'socket.emit')
      .map((event) => event.data)
  );
const underlying = (page: Page) =>
  page.evaluate(() =>
    window.scaleProbe.events
      .filter((event) => event.kind === 'underlying')
      .map((event) => event.data)
  );
const visibility = (page: Page, value: string) =>
  expect
    .poll(() => page.evaluate(() => window.scaleProbe.visibility))
    .toBe(value);
const clear = (page: Page) => page.evaluate(() => window.scaleProbe.clear());

async function openFullScale(page: Page) {
  await emit(page, 'tareDown');
  await visibility(page, 'full');
  await emit(page, 'tareUp');
  await expect(page.locator('.scale-container--full')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)'
  );
  await expect(page.locator('.scale-container--full .weight')).toBeInViewport({
    ratio: 1
  });
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.route('**/*', (route) => {
    const { origin } = new URL(route.request().url());
    expect(origin, 'fixture must never contact a machine/service').toBe(
      'http://127.0.0.1:1434'
    );
    return route.continue();
  });
  await page.goto('/');
  await page.waitForFunction(() => window.scaleProbe?.ready);
  await expect(page.getByText('Push to brew', { exact: true })).toBeVisible();
  await clear(page);
});

test.afterEach(async ({ page }, testInfo) => {
  const events = await page.evaluate(() => window.scaleProbe?.events);
  const eventsPath = testInfo.outputPath('events.json');
  await writeFile(eventsPath, JSON.stringify(events, null, 2));
  await testInfo.attach('events', {
    path: eventsPath,
    contentType: 'application/json'
  });
});

test('fullscreen dismissal consumes the whole press, then next press brews', async ({
  page
}, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath('01-push-to-brew.png') });
  await openFullScale(page);
  await page.screenshot({ path: testInfo.outputPath('02-fullscreen.png') });
  await clear(page);
  await emit(page, 'pressDown');
  await page.waitForTimeout(100);
  await emit(page, 'pressUp');
  // Match the separate firmware click notification, after the UI has rendered.
  await page.waitForTimeout(280);
  await emit(page, 'click');
  await visibility(page, 'closed');
  await expect(page.locator('.scale-container--full')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('03-dismissed.png') });
  expect(await actions(page)).toEqual([]);
  expect(await underlying(page)).toEqual([]);
  await emit(page, 'pressDown', 'pressUp', 'click');
  expect(await actions(page)).toEqual([['action', 'continue']]);
  expect(await underlying(page)).toEqual(['pressDown', 'pressUp', 'click']);
});

test('batched release and click cannot leak after dismissal', async ({
  page
}) => {
  await openFullScale(page);
  await clear(page);
  await emit(page, 'pressDown');
  await visibility(page, 'full');
  await emit(page, 'pressUp', 'click');
  await visibility(page, 'closed');
  expect(await actions(page)).toEqual([]);
  expect(await underlying(page)).toEqual([]);
  await emit(page, 'pressDown', 'pressUp', 'click');
  expect(await actions(page)).toEqual([['action', 'continue']]);
});

for (const [name, tail] of [
  ['double press', ['pressUp', 'pressDown', 'pressUp', 'doubleClick']],
  ['long press', ['longEncoder', 'pressUp']],
  ['release before long notification', ['pressUp', 'longEncoder']]
] as const) {
  test(`${name} stays consumed through its terminal event and release`, async ({
    page
  }) => {
    await openFullScale(page);
    await clear(page);
    await emit(page, 'pressDown');
    await visibility(page, 'full');
    for (const gesture of tail.slice(0, -1)) {
      await emit(page, gesture);
      await visibility(page, 'full');
    }
    await emit(page, tail.at(-1));
    await visibility(page, 'closed');
    expect(await underlying(page)).toEqual([]);
    expect(await actions(page)).toEqual([]);
    await emit(page, 'pressDown', 'pressUp', 'click');
    expect(await actions(page)).toEqual([['action', 'continue']]);
  });
}

test('raw press and release without a terminal keep fullscreen for the next valid gesture', async ({
  page
}) => {
  await openFullScale(page);
  await clear(page);
  await emit(page, 'pressDown', 'pressUp');
  await visibility(page, 'full');
  expect(await underlying(page)).toEqual([]);
  expect(await actions(page)).toEqual([]);
  await emit(page, 'pressDown', 'pressUp', 'click');
  await visibility(page, 'closed');
  expect(await underlying(page)).toEqual([]);
  expect(await actions(page)).toEqual([]);
  await emit(page, 'pressDown', 'pressUp', 'click');
  expect(await underlying(page)).toEqual(['pressDown', 'pressUp', 'click']);
  expect(await actions(page)).toEqual([['action', 'continue']]);
});

test('a fresh press discards a long gesture whose release was lost', async ({
  page
}) => {
  await openFullScale(page);
  await clear(page);
  await emit(page, 'pressDown', 'longEncoder');
  await visibility(page, 'full');
  await emit(page, 'pressDown', 'pressUp');
  await visibility(page, 'full');
  expect(await underlying(page)).toEqual([]);
  await emit(page, 'click');
  await visibility(page, 'closed');
  expect(await underlying(page)).toEqual([]);
  expect(await actions(page)).toEqual([]);
  await emit(page, 'pressDown', 'pressUp', 'click');
  expect(await actions(page)).toEqual([['action', 'continue']]);
});

test('a recognized click can close even if its raw release was omitted', async ({
  page
}) => {
  await openFullScale(page);
  await clear(page);
  await emit(page, 'pressDown', 'click');
  await visibility(page, 'closed');
  expect(await underlying(page)).toEqual([]);
  expect(await actions(page)).toEqual([]);
  await emit(page, 'pressDown', 'pressUp', 'click');
  expect(await underlying(page)).toEqual(['pressDown', 'pressUp', 'click']);
  expect(await actions(page)).toEqual([['action', 'continue']]);
});

test('missing long notification does not make the following long press leak', async ({
  page
}) => {
  await openFullScale(page);
  await clear(page);
  await emit(page, 'pressDown', 'pressUp');
  await visibility(page, 'full');
  await emit(page, 'pressDown', 'longEncoder');
  await visibility(page, 'full');
  await emit(page, 'pressUp');
  await visibility(page, 'closed');
  expect(await underlying(page)).toEqual([]);
  expect(await actions(page)).toEqual([]);
  await emit(page, 'pressDown', 'pressUp', 'click');
  expect(await actions(page)).toEqual([['action', 'continue']]);
});

test('closing by tare clears a pending long gesture before reopening', async ({
  page
}) => {
  await openFullScale(page);
  await emit(page, 'pressDown', 'longEncoder');
  await visibility(page, 'full');
  await emit(page, 'doubleTare');
  await visibility(page, 'closed');
  await openFullScale(page);
  await clear(page);
  await emit(page, 'pressUp');
  await visibility(page, 'full');
  await emit(page, 'pressDown', 'pressUp', 'click');
  await visibility(page, 'closed');
  expect(await underlying(page)).toEqual([]);
  expect(await actions(page)).toEqual([]);
});

test('small scale stays nonmodal and tare behavior is preserved', async ({
  page
}) => {
  await emit(page, 'singleTare');
  await visibility(page, 'small');
  expect(await actions(page)).toEqual([['action', 'tare']]);
  await emit(page, 'singleTare');
  expect(await actions(page)).toEqual([
    ['action', 'tare'],
    ['action', 'tare']
  ]);
  await clear(page);
  await emit(page, 'pressDown');
  await visibility(page, 'closed');
  await emit(page, 'pressUp', 'click');
  expect(await underlying(page)).toEqual(['pressDown', 'pressUp', 'click']);
  expect(await actions(page)).toEqual([['action', 'continue']]);
  await clear(page);
  await emit(page, 'singleTare');
  await visibility(page, 'small');
  expect(await actions(page)).toEqual([]); // Reopening a warm scale does not tare.
});

test('tare hold can be cancelled and double tare still closes fullscreen', async ({
  page
}) => {
  await emit(page, 'tareDown');
  await visibility(page, 'small');
  await emit(page, 'tareUp');
  await page.waitForTimeout(800); // Wait beyond the pull animation's completion.
  await visibility(page, 'small');
  await openFullScale(page);
  await emit(page, 'singleTare');
  expect(await actions(page)).toEqual([['action', 'tare']]);
  await emit(page, 'right');
  expect(await underlying(page)).toEqual([]);
  await emit(page, 'doubleTare');
  await visibility(page, 'closed');
  await clear(page);
  await emit(page, 'pressDown', 'pressUp', 'click');
  expect(await actions(page)).toEqual([['action', 'continue']]);
});

test('becoming ready during dismissal does not turn that press into brew', async ({
  page
}) => {
  await page.evaluate(() => window.scaleProbe.setStatus('heating'));
  await openFullScale(page);
  await clear(page);
  await emit(page, 'pressDown');
  await visibility(page, 'full');
  await page.evaluate(() => window.scaleProbe.setStatus('click to start'));
  await expect(page.getByText('Push to brew', { exact: true })).toBeVisible();
  await emit(page, 'pressUp', 'click');
  await visibility(page, 'closed');
  expect(await actions(page)).toEqual([]);
});

for (const screen of [
  'calibrateScale',
  'freePour',
  'guidedPourOver',
  'freePourHistory'
] satisfies ScreenType[]) {
  test(`${screen} retains tare without opening scale overlay`, async ({
    page
  }) => {
    await page.evaluate(
      (screen) => window.scaleProbe.setScreen(screen),
      screen
    );
    await emit(page, 'tareDown');
    await page.waitForTimeout(1000);
    await emit(page, 'tareUp');
    await visibility(page, 'closed');
    expect(await actions(page)).toEqual([['action', 'tare']]);
  });
}
