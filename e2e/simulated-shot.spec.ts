import { expect, test, type APIRequestContext } from '@playwright/test';

interface Profile {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface HistoryEntry {
  id: string;
  profile: Profile;
}

const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:18080';

async function getJson<T>(api: APIRequestContext, path: string): Promise<T> {
  const response = await api.get(`${backendUrl}${path}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<T>;
}

async function postJson<T>(
  api: APIRequestContext,
  path: string,
  data?: unknown
): Promise<T> {
  const response = await api.post(`${backendUrl}${path}`, { data });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<T>;
}

test('runs a profile from Dial through the emulated backend', async ({
  page,
  request
}) => {
  await expect
    .poll(
      async () => {
        try {
          return (await request.get(`${backendUrl}/api/v1/machine`)).ok();
        } catch {
          return false;
        }
      },
      { timeout: 60_000 }
    )
    .toBeTruthy();

  const defaults = await getJson<Record<string, Profile[]>>(
    request,
    '/api/v1/profile/defaults'
  );
  const profile = Object.values(defaults).find((group) => group.length)?.[0];
  if (!profile) {
    throw new Error('Backend returned no default profile to execute');
  }

  const profiles = await getJson<Profile[]>(
    request,
    '/api/v1/profile/list?full=true'
  );
  if (!profiles.some((candidate) => candidate.id === profile.id)) {
    await postJson(request, '/api/v1/profile/save', profile);
  }

  const initialHistory = await getJson<{ history: HistoryEntry[] }>(
    request,
    '/api/v1/history?dump_data=false'
  );
  const initialIds = new Set(initialHistory.history.map((entry) => entry.id));
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('https://*.ingest.sentry.io/**', (route) => route.abort());

  await page.goto('/');
  const profileHome = page.locator('.route-profileHome');
  await expect(profileHome).toBeVisible();
  await expect(
    profileHome.getByText(profile.name, { exact: true }).first()
  ).toBeVisible();

  await page.keyboard.press('Space', { delay: 100 });
  await expect(page.getByText('Hold to start', { exact: true })).toBeVisible();

  await page.keyboard.down('Space');
  await expect(page.locator('.route-barometer')).toBeVisible({
    timeout: 30_000
  });
  await page.keyboard.up('Space');
  await expect(page.getByText('Pressure', { exact: true })).toBeVisible();

  let completed: HistoryEntry | undefined;
  await expect
    .poll(
      async () => {
        const history = await getJson<{ history: HistoryEntry[] }>(
          request,
          '/api/v1/history?dump_data=false'
        );
        completed = history.history.find((entry) => !initialIds.has(entry.id));
        return completed?.profile.id;
      },
      { timeout: 60_000 }
    )
    .toBe(profile.id);

  await expect(page.locator('.route-profileHome')).toBeVisible({
    timeout: 30_000
  });
  expect(pageErrors).toEqual([]);
});
