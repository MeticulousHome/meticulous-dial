/**
 * Customer regressions: periodic relighting, digital-clock cleanup relighting,
 * and a departed idle timer darkening the active screen. Expected brightness
 * comes from the backlight API's 0..1 range; timeouts are the existing five-minute
 * IdleTimerProvider and ten-minute IdleScreen contract. Reinstating the old
 * brightness cycle or digital cleanup must fail these component tests.
 */
import { test, expect, type Page } from '@playwright/test';
import type {} from './fixture';

const requests = (page: Page) =>
  page.evaluate(() => window.idleProbe.brightnessRequests);
const lastBrightness = async (page: Page) => (await requests(page)).at(-1);

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.route('**/*', (route) => {
    expect(new URL(route.request().url()).origin).toBe('http://127.0.0.1:1435');
    return route.continue();
  });
  await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-19T12:00:01Z'));
});

async function open(page: Page, clock = 'analog') {
  await page.goto('/?clock=' + clock);
  await page.waitForFunction(() => window.idleProbe?.ready);
}

for (const clock of ['analog', 'digital', 'baristaBarista', 'dvd', 'metCat']) {
  test(`${clock}: manual screen off stays dark and wake restores brightness`, async ({
    page
  }, info) => {
    await open(page, clock);
    await page.evaluate(() => window.idleProbe.sleep());
    await expect.poll(() => lastBrightness(page)).toBe(0.33);
    await page.screenshot({ path: info.outputPath('01-clock.png') });
    const beforeOff = (await requests(page)).length;
    await page.evaluate(() => window.idleProbe.screenOff());
    await expect(
      page.getByRole('img', { name: 'Screen off', exact: true })
    ).toBeVisible();
    await expect.poll(() => lastBrightness(page)).toBe(0);
    expect((await requests(page)).slice(beforeOff)).toEqual([0]);
    const count = (await requests(page)).length;
    await page.clock.fastForward(20 * 60 * 1000);
    expect((await requests(page)).slice(count)).toEqual([]);
    await page.screenshot({ path: info.outputPath('02-screen-off.png') });
    await page.evaluate(() => window.idleProbe.wake());
    await expect(page.getByText('Machine awake')).toBeVisible();
    await expect.poll(() => lastBrightness(page)).toBe(1);
  });
}

test('automatic screen off is sustained after five plus ten minutes', async ({
  page
}, info) => {
  await open(page);
  await page.clock.fastForward(5 * 60 * 1000);
  await expect.poll(() => lastBrightness(page)).toBe(0.33);
  await page.clock.fastForward(10 * 60 * 1000 - 1);
  expect(await lastBrightness(page)).toBe(0.33);
  await page.clock.fastForward(1);
  await page.screenshot({ path: info.outputPath('automatic-15-minutes.png') });
  await expect.poll(() => lastBrightness(page)).toBe(0);
  const count = (await requests(page)).length;
  await page.clock.fastForward(10 * 60 * 1000);
  expect((await requests(page)).slice(count)).toEqual([]);
});

test('manual screen off skips the clock and resets on the next sleep', async ({
  page
}) => {
  await open(page);
  await page.evaluate(() => window.idleProbe.screenOff());
  await expect.poll(() => lastBrightness(page)).toBe(0);
  expect(await requests(page)).not.toContain(0.33);
  await page.evaluate(() => window.idleProbe.wake());
  await expect.poll(() => lastBrightness(page)).toBe(1);
  await page.evaluate(() => window.idleProbe.sleep());
  await expect.poll(() => lastBrightness(page)).toBe(0.33);
});

test('leaving idle cancels its old screen-off deadline', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.idleProbe.sleep());
  await expect.poll(() => lastBrightness(page)).toBe(0.33);
  await page.clock.fastForward(9 * 60 * 1000);
  await page.evaluate(() => window.idleProbe.leave());
  await expect.poll(() => lastBrightness(page)).toBe(1);
  const count = (await requests(page)).length;
  await page.clock.fastForward(2 * 60 * 1000);
  expect((await requests(page)).slice(count)).toEqual([]);
});
