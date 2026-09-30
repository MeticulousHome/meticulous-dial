import { API_URL } from '../../api/api';
import { parsePourOverProfile } from './profileContract';
import { PourOverProfile } from './types';

export const POUR_OVER_PROFILES_QUERY_KEY = 'pour-over-profiles';

export const getPourOverProfileImageUrl = (profileId: string) =>
  `${API_URL}/api/v1/pour-over/profile/image/${encodeURIComponent(profileId)}`;

class PourOverProfileRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'PourOverProfileRequestError';
  }
}

const request = async (path: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        body && typeof body.error === 'string'
          ? body.error
          : `Machine returned ${response.status}`;
      throw new PourOverProfileRequestError(response.status, message);
    }
    return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Machine profile request timed out');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

const parseInstalledProfile = (value: unknown): PourOverProfile | null => {
  const result = parsePourOverProfile(value);
  if (result.success === true) return result.dialProfile;
  const profileId =
    value && typeof value === 'object' && 'id' in value
      ? String((value as { id?: unknown }).id ?? '')
      : '';
  console.error(
    `Rejected installed Pour Over profile ${profileId || '<unknown>'}`,
    result.issues
  );
  return null;
};

export const getInstalledPourOverProfiles = async (): Promise<
  PourOverProfile[]
> => {
  let body: unknown;
  try {
    body = await request('/api/v1/pour-over/profile/list');
  } catch (error) {
    // Pour Over profiles were introduced after the original machine API. A
    // 404 means this optional catalog is unsupported, not that Home failed.
    if (error instanceof PourOverProfileRequestError && error.status === 404) {
      return [];
    }
    throw error;
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !('profiles' in body) ||
    !Array.isArray(body.profiles)
  ) {
    throw new Error('Machine returned an invalid Pour Over profile list');
  }
  return body.profiles
    .map(parseInstalledProfile)
    .filter((profile): profile is PourOverProfile => profile !== null);
};

export const getInstalledPourOverProfile = async (
  profileId: string
): Promise<PourOverProfile> => {
  const body = await request(
    `/api/v1/pour-over/profile/get/${encodeURIComponent(profileId)}?include_image=false`
  );
  const profile = parseInstalledProfile(body);
  if (!profile)
    throw new Error('Machine returned an invalid Pour Over profile');
  return profile;
};

export const deleteInstalledPourOverProfile = async (profileId: string) => {
  await request(
    `/api/v1/pour-over/profile/delete/${encodeURIComponent(profileId)}`,
    { method: 'DELETE' }
  );
};
