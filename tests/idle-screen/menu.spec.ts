/**
 * A user selecting Screen off must not wake it with the release/click of that
 * same press. Button order comes from the Dial AGENTS.md contract and the real
 * SocketProviderValue event map: PRESSED, RELEASED, PUSH. Brightness 0/1 comes
 * from the backlight API. A later rotation must wake. The older fixture calls
 * idle hooks directly and cannot catch a release resetting idle, a missing menu
 * action, or a broken button mapping. Mutation: reset idle on pressUp.
 * This is simulated transport input, not physical encoder validation.
 */
import { test, expect } from '@playwright/test';
import type {} from './menu-fixture';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.route('**/*', (route) => {
    expect(new URL(route.request().url()).origin).toBe('http://127.0.0.1:1435');
    return route.continue();
  });
});

for (const clock of ['analog', 'digital']) {
  for (const delivery of ['separate', 'same-turn']) {
    test(`quick menu ${clock}/${delivery}: press tail stays dark, later rotation wakes`, async ({
      page
    }) => {
      await page.goto('/menu.html?clock=' + clock);
      await page.waitForFunction(() => window.menuProbe.buttonListenerReady());
      await expect(
        page.getByText('Screen off', { exact: true }).first()
      ).toBeVisible();
      const lastBrightness = () =>
        page.evaluate(() => window.menuProbe.brightnessRequests.at(-1));
      // The empty profile catalog exposes sleep first, then Screen off.
      await page.evaluate(() =>
        window.menuProbe.receiveButton('ENCODER_CLOCKWISE')
      );
      if (delivery === 'same-turn') {
        await page.evaluate(() => {
          for (const type of [
            'ENCODER_PRESSED',
            'ENCODER_RELEASED',
            'ENCODER_PUSH'
          ]) {
            window.menuProbe.receiveButton(type);
          }
        });
      } else {
        await page.evaluate(() =>
          window.menuProbe.receiveButton('ENCODER_PRESSED')
        );
        await expect.poll(lastBrightness).toBe(0);
        for (const type of ['ENCODER_RELEASED', 'ENCODER_PUSH']) {
          await page.evaluate(
            (type) => window.menuProbe.receiveButton(type),
            type
          );
          await expect.poll(lastBrightness).toBe(0);
        }
      }
      await expect(
        page.getByRole('img', { name: 'Screen off', exact: true })
      ).toBeVisible();
      await expect(page.getByText('Screen off', { exact: true })).toHaveCount(
        0
      );
      await expect.poll(lastBrightness).toBe(0);
      expect(
        await page.evaluate(() => window.menuProbe.brightnessRequests)
      ).toEqual([0]);
      await page.evaluate(() =>
        window.menuProbe.receiveButton('ENCODER_COUNTERCLOCKWISE')
      );
      await expect(page.getByText('Machine awake')).toBeVisible();
      await expect.poll(lastBrightness).toBe(1);
    });
  }
}
