import { test, expect, type Page, type TestInfo } from '@playwright/test';
import type { GestureType } from '../../src/types';
import type { CommunityHistoryRecovery } from '../../src/hooks/useCommunityUpload';
import type {} from './fixture';

const emit = (page: Page, gesture: GestureType) =>
  page.evaluate((gesture) => window.communityProbe.emit(gesture), gesture);
const commandCalls = (page: Page, command: string) =>
  page.evaluate(
    (command) =>
      window.communityProbe.calls.filter((call) => call.command === command),
    command
  );

async function select(page: Page, label: string) {
  const buttons = page.getByRole('button');
  const index = (await buttons.allTextContents()).indexOf(label);
  expect(index, `Action ${label} exists`).toBeGreaterThanOrEqual(0);
  for (let step = 0; step < (await buttons.count()); step++)
    await emit(page, 'left');
  for (let step = 0; step < index; step++) await emit(page, 'right');
  await expect(
    page.getByRole('button', { name: label, exact: true })
  ).toHaveAttribute('aria-current', 'true');
  await emit(page, 'pressDown');
}

async function openImport(page: Page) {
  await select(page, 'Import saved brews');
  await expect(
    page.getByRole('heading', { name: 'Import saved brews?' })
  ).toBeVisible();
}

async function setRecovery(
  page: Page,
  patch: Partial<CommunityHistoryRecovery>
) {
  await page.evaluate(
    (patch) =>
      window.communityProbe.setStatus({
        recovery: {
          state: 'running',
          added: 12,
          alreadyPresent: 34,
          preservedDeleted: 2,
          failed: 0,
          pendingCount: 3,
          lastError: null,
          ...patch
        }
      }),
    patch
  );
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  // A square viewport assertion alone misses controls clipped by the physical round display.
  const failures = await page
    .locator(
      '.community-screen h2, .community-screen p, .community-status-grid, .community-action, .community-qr'
    )
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const r = element.getBoundingClientRect();
        const corners = [
          [r.left, r.top],
          [r.right, r.top],
          [r.left, r.bottom],
          [r.right, r.bottom]
        ];
        return corners.some(([x, y]) => Math.hypot(x - 240, y - 240) > 239)
          ? [
              {
                text: element.textContent,
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height
              }
            ]
          : [];
      })
    );
  expect(failures, 'All text and controls must fit the circular Dial').toEqual(
    []
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    480
  );
  const screenshot = info.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshot });
  await info.attach(name, { path: screenshot, contentType: 'image/png' });
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.route('**/*', (route) => {
    expect(
      new URL(route.request().url()).origin,
      'No machine or Community requests'
    ).toBe('http://127.0.0.1:1435');
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
});

test('rotary navigation requires consent and cancel leaves history untouched', async ({
  page
}, info) => {
  await capture(page, info, 'overview');
  await openImport(page);
  await expect(
    page.getByText(/all saved espresso and pour-over/)
  ).toBeVisible();
  await expect(page.getByText(/private history/)).toBeVisible();
  await expect(page.getByText(/Deleted brews stay deleted/)).toBeVisible();
  await capture(page, info, 'confirmation');
  expect(
    await commandCalls(page, 'community_start_history_recovery')
  ).toHaveLength(0);
  await select(page, 'Cancel');
  await expect(
    page.getByRole('heading', { name: 'Community', exact: true })
  ).toBeVisible();
  expect(
    await commandCalls(page, 'community_start_history_recovery')
  ).toHaveLength(0);
  await select(page, 'Back');
  expect(await page.evaluate(() => window.communityProbe.dispatches)).toEqual([
    {
      type: 'screen/setBubbleDisplay',
      payload: { visible: true, component: 'settings' }
    }
  ]);
});

test('start is single flight, results poll, pause resumes, and leaving does not restart', async ({
  page
}, info) => {
  await openImport(page);
  await page.evaluate(() => {
    window.communityProbe.holdStart = true;
  });
  await select(page, 'Import all');
  await expect(page.getByRole('button', { name: 'Working...' })).toBeDisabled();
  await emit(page, 'pressDown');
  await capture(page, info, 'starting');
  expect(
    await commandCalls(page, 'community_start_history_recovery')
  ).toHaveLength(1);
  await page.evaluate(() => window.communityProbe.releaseStart?.());
  await expect(
    page.getByRole('heading', { name: 'Importing saved brews' })
  ).toBeVisible();
  await setRecovery(page, {});
  await expect(page.locator('.community-recovery-counts')).toContainText('12');
  await capture(page, info, 'running');
  await select(page, 'Pause uploads');
  await expect(
    page.getByRole('heading', { name: 'Import paused' })
  ).toBeVisible();
  await capture(page, info, 'paused');
  await select(page, 'Resume uploads');
  await expect(
    page.getByRole('heading', { name: 'Importing saved brews' })
  ).toBeVisible();
  await select(page, 'Back');
  await select(page, 'View saved import');
  await expect(
    page.getByRole('heading', { name: 'Importing saved brews' })
  ).toBeVisible();
  expect(
    await commandCalls(page, 'community_start_history_recovery')
  ).toHaveLength(1);
  expect(await commandCalls(page, 'community_set_upload_paused')).toEqual([
    { command: 'community_set_upload_paused', args: { paused: true } },
    { command: 'community_set_upload_paused', args: { paused: false } }
  ]);
});

test('failed start stays on consent screen, exposes safe error and supports retry', async ({
  page
}, info) => {
  await openImport(page);
  await page.evaluate(() => {
    window.communityProbe.startError =
      'state_persist_failed /private/sensitive-path';
  });
  await select(page, 'Import all');
  await expect(page.getByRole('alert')).toHaveText(
    'Could not save import progress. Check machine storage.'
  );
  await expect(
    page.getByRole('heading', { name: 'Import saved brews?' })
  ).toBeVisible();
  await capture(page, info, 'start-failed');
  await page.evaluate(() => {
    window.communityProbe.startError = null;
  });
  await select(page, 'Import all');
  await expect(
    page.getByRole('heading', { name: 'Importing saved brews' })
  ).toBeVisible();
});

for (const state of ['completed', 'interrupted'] as const) {
  test(`${state} shows actual results and requires fresh consent to import again`, async ({
    page
  }, info) => {
    await setRecovery(page, {
      state,
      added: 98765,
      alreadyPresent: 123456,
      preservedDeleted: 1234,
      pendingCount: 0
    });
    await expect(
      page.getByRole('button', { name: 'View saved import' })
    ).toBeVisible();
    await select(page, 'View saved import');
    await expect(
      page.getByRole('heading', {
        name: state === 'completed' ? 'Import complete' : 'Import interrupted'
      })
    ).toBeVisible();
    await capture(page, info, state);
    await select(page, 'Import again');
    await expect(
      page.getByRole('heading', { name: 'Import saved brews?' })
    ).toBeVisible();
    expect(
      await commandCalls(page, 'community_start_history_recovery')
    ).toHaveLength(0);
  });
}

test('partial import and service delay remain visible without pretending completion', async ({
  page
}, info) => {
  await setRecovery(page, { lastError: 'recovery_server_upgrade_required' });
  await expect(
    page.getByRole('button', { name: 'View saved import' })
  ).toBeVisible();
  await select(page, 'View saved import');
  await expect(page.getByRole('alert')).toHaveText(
    'Waiting for the Community update. Import will resume automatically.'
  );
  await capture(page, info, 'waiting-for-service');
  await setRecovery(page, {
    state: 'completed',
    failed: 2,
    pendingCount: 0,
    lastError: 'machine_history_invalid'
  });
  await expect(
    page.getByRole('heading', { name: 'Import finished with issues' })
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText(
    'Some saved history could not be read.'
  );
  await capture(page, info, 'partial-results');
});

test('status failure does not pretend completion or reconnect and can retry', async ({
  page
}, info) => {
  await openImport(page);
  await select(page, 'Import all');
  await expect(
    page.getByRole('heading', { name: 'Importing saved brews' })
  ).toBeVisible();
  await page.evaluate(() => {
    window.communityProbe.statusError = true;
  });
  await expect(page.getByRole('alert')).toHaveText(
    'Could not refresh progress. Please retry.'
  );
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true })
  ).toBeVisible();
  await capture(page, info, 'refresh-failed');
  await page.evaluate(() => {
    window.communityProbe.statusError = false;
    window.communityProbe.setStatus({ recovery: null });
  });
  await select(page, 'Retry');
  await expect(page.getByText('Waiting for import progress…')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Import complete' })
  ).toHaveCount(0);
  await capture(page, info, 'missing-progress');
  await setRecovery(page, {});
  await select(page, 'Retry');
  await expect(
    page.getByRole('heading', { name: 'Importing saved brews' })
  ).toBeVisible();
  expect(await commandCalls(page, 'community_begin_enrollment')).toHaveLength(
    0
  );
});

test('disconnect confirmation and QR enrollment still work', async ({
  page
}, info) => {
  await select(page, 'Disconnect');
  await expect(
    page.getByRole('heading', { name: 'Disconnect Community?' })
  ).toBeVisible();
  await capture(page, info, 'disconnect-confirmation');
  await select(page, 'Cancel');
  expect(await commandCalls(page, 'community_disconnect')).toHaveLength(0);
  await select(page, 'Disconnect');
  await select(page, 'Disconnect');
  await expect(page.locator('.community-qr svg')).toBeVisible();
  await capture(page, info, 'qr-enrollment');
  expect(await commandCalls(page, 'community_disconnect')).toHaveLength(1);
  await page.evaluate(() =>
    window.communityProbe.setStatus({ state: 'connected', connected: true })
  );
  await expect(
    page.getByRole('heading', { name: 'Connected to Community' })
  ).toBeVisible();
  await capture(page, info, 'connected-success');
});

test('initial status failure has retry and cannot create a pairing code', async ({
  page
}, info) => {
  await page.goto('/?initial=status-error');
  await expect(
    page.getByText('Could not load the connection. Please try again.')
  ).toBeVisible();
  expect(await commandCalls(page, 'community_begin_enrollment')).toHaveLength(
    0
  );
  await capture(page, info, 'initial-load-failed');
  await page.evaluate(() => {
    window.communityProbe.statusError = false;
  });
  await select(page, 'Retry');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
});

test('starting while paused keeps both historical and new brew uploads paused', async ({
  page
}, info) => {
  await select(page, 'Pause uploads');
  await expect(page.getByText('Upload paused', { exact: true })).toBeVisible();
  await openImport(page);
  await expect(
    page.getByText('Uploads are paused. Resume them to begin importing.')
  ).toBeVisible();
  await capture(page, info, 'paused-confirmation');
  await select(page, 'Import all');
  await expect(
    page.getByRole('heading', { name: 'Import paused' })
  ).toBeVisible();
  expect(await commandCalls(page, 'community_set_upload_paused')).toEqual([
    { command: 'community_set_upload_paused', args: { paused: true } }
  ]);
});

test('status refresh failure keeps a rotary selection when overview actions shrink', async ({
  page
}, info) => {
  await emit(page, 'right');
  await emit(page, 'right');
  await emit(page, 'right');
  await expect(
    page.getByRole('button', { name: 'Disconnect', exact: true })
  ).toHaveAttribute('aria-current', 'true');
  await page.evaluate(() => {
    window.communityProbe.statusError = true;
  });
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true })
  ).toHaveAttribute('aria-current', 'true');
  await capture(page, info, 'overview-refresh-failed');
  await emit(page, 'left');
  await expect(
    page.getByRole('button', { name: 'Back', exact: true })
  ).toHaveAttribute('aria-current', 'true');
});
