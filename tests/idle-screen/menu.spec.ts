/**
 * A user selecting Screen off must not wake it with the release/click of that
 * same press. Button order comes from the Dial AGENTS.md contract and the real
 * SocketProviderValue event map: PRESSED, RELEASED, PUSH. Brightness 0/1 comes
 * from the backlight API. A later rotation must wake. The older fixture calls
 * idle hooks directly and cannot catch a release resetting idle, a missing menu
 * action, or a broken button mapping. Mutation: reset idle on pressUp.
 * This is simulated transport input, not physical encoder validation.
 * Wake inputs additionally follow the requested encoder/context/tare contract:
 * the first interaction wakes, and none of its tail may reach action handlers.
 * Mutation: remove the consume return at the production socket boundary. The
 * earlier entry/rotation tests do not check that a wake gesture is swallowed.
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

const wakeCases = [
  ['clockwise', ['ENCODER_CLOCKWISE'], ['right']],
  ['counterclockwise', ['ENCODER_COUNTERCLOCKWISE'], ['left']],
  [
    'encoder',
    ['ENCODER_PRESSED', 'ENCODER_RELEASED', 'ENCODER_PUSH'],
    ['pressDown', 'pressUp', 'click']
  ],
  [
    'encoder double',
    [
      'ENCODER_PRESSED',
      'ENCODER_RELEASED',
      'ENCODER_PRESSED',
      'ENCODER_RELEASED',
      'ENCODER_DOUBLE'
    ],
    ['pressDown', 'pressUp', 'pressDown', 'pressUp', 'doubleClick']
  ],
  [
    'encoder long',
    ['ENCODER_PRESSED', 'ENCODER_LONG', 'ENCODER_RELEASED'],
    ['pressDown', 'longEncoder', 'pressUp']
  ],
  ['context', ['CONTEXT_PRESSED', 'CONTEXT_RELEASED', 'CONTEXT'], ['context']],
  [
    'tare',
    ['TARE_PRESSED', 'TARE_RELEASED', 'TARE'],
    ['tareDown', 'tareUp', 'singleTare']
  ],
  [
    'tare long',
    ['TARE_PRESSED', 'TARE_LONG', 'TARE_SUPER_LONG', 'TARE_RELEASED'],
    ['tareDown', 'longTare', 'tareUp']
  ],
  ['decoded legacy click', ['ENCODER_PUSH'], ['click']]
] as const;

for (const [name, events, normalGestures] of wakeCases) {
  test(`wake input ${name}: wake consumes the whole gesture, next interaction works`, async ({
    page
  }) => {
    await page.goto('/menu.html');
    await page.waitForFunction(() => window.menuProbe.buttonListenerReady());
    await page.evaluate(() => {
      for (const type of [
        'ENCODER_CLOCKWISE',
        'ENCODER_PRESSED',
        'ENCODER_RELEASED',
        'ENCODER_PUSH'
      ])
        window.menuProbe.receiveButton(type);
    });
    await expect(
      page.getByRole('img', { name: 'Screen off', exact: true })
    ).toBeVisible();
    await page.evaluate(() => {
      window.menuProbe.gestures.length = 0;
    });
    await page.evaluate(
      (type) => window.menuProbe.receiveButton(type),
      events[0]
    );
    await expect(page.getByText('Machine awake')).toBeVisible();
    await page.evaluate((tail) => {
      for (const type of tail) window.menuProbe.receiveButton(type);
    }, events.slice(1));
    expect(await page.evaluate(() => window.menuProbe.gestures)).toEqual([]);
    expect(
      await page.evaluate(() => window.menuProbe.brightnessRequests.at(-1))
    ).toBe(1);
    await page.evaluate(
      (events) => {
        for (const type of events) window.menuProbe.receiveButton(type);
      },
      [...events]
    );
    expect(await page.evaluate(() => window.menuProbe.gestures)).toEqual([
      ...normalGestures
    ]);
  });
}

test('holding context to wake does not consume the next context click', async ({
  page
}) => {
  // Firmware registers only attachClick for context. OneButton's long-press
  // state can therefore end with raw release and no decoded CONTEXT event.
  // The nine wake cases above all have a decoded terminal (or only rotation).
  await page.goto('/menu.html');
  await page.waitForFunction(() => window.menuProbe.buttonListenerReady());
  await page.evaluate(() => {
    for (const type of [
      'ENCODER_CLOCKWISE',
      'ENCODER_PRESSED',
      'ENCODER_RELEASED',
      'ENCODER_PUSH'
    ])
      window.menuProbe.receiveButton(type);
  });
  await expect(
    page.getByRole('img', { name: 'Screen off', exact: true })
  ).toBeVisible();
  await page.evaluate(() => {
    window.menuProbe.gestures.length = 0;
    window.menuProbe.receiveButton('CONTEXT_PRESSED');
    window.menuProbe.receiveButton('CONTEXT_RELEASED');
  });
  await expect(page.getByText('Machine awake')).toBeVisible();
  expect(await page.evaluate(() => window.menuProbe.gestures)).toEqual([]);
  await page.evaluate(() => {
    for (const type of ['CONTEXT_PRESSED', 'CONTEXT_RELEASED', 'CONTEXT'])
      window.menuProbe.receiveButton(type);
  });
  expect(await page.evaluate(() => window.menuProbe.gestures)).toEqual([
    'context'
  ]);
});
