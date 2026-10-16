import { Profile } from '@meticulous-home/espresso-profile';
import { API_URL } from './api';

/**
 * Turns the brew the machine has just finished into a stored profile.
 *
 * Called with `fetch` rather than through the generated client because
 * `@meticulous-home/espresso-api` does not expose this endpoint yet and the
 * package is deliberately not modified here.
 */
export async function createProfileFromManualBrew(name?: string) {
  const response = await fetch(`${API_URL}/api/v1/profile/from_manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(name ? { name } : {})
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error ?? response.statusText);
  }
  return body as { profile: Profile; change_id?: string };
}
