// POST /api/v1/settings without the Dial's API client, so it can be tested in
// isolation. The espresso-api client resolves HTTP 400 (validateStatus), so a
// setting the backend refuses arrives as `{ status: 'error', error: '...' }`
// in the response body, not as a thrown axios error.

export const SETTINGS_UPDATE_ERROR = 'Error updating settings.';
export const SETTINGS_UPDATE_NETWORK_ERROR =
  'Network error while updating settings.';

type ErrorBody = { error?: unknown; message?: unknown };

function messageFrom(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const { error, message } = body as ErrorBody;
  if (typeof error === 'string' && error) return error;
  if (typeof message === 'string' && message) return message;
  return undefined;
}

export async function applySettingsUpdate<S, U>(
  post: (update: U) => Promise<{ data: unknown }>,
  update: U
): Promise<S> {
  let data: unknown;
  try {
    ({ data } = await post(update));
  } catch (error) {
    const response = (error as { response?: { data?: unknown } })?.response;
    if (response) {
      console.error('Error updating settings: ', response.data);
      throw new Error(messageFrom(response.data) ?? SETTINGS_UPDATE_ERROR);
    }
    console.error(
      'Network error while updating settings:',
      (error as Error)?.message
    );
    throw new Error(SETTINGS_UPDATE_NETWORK_ERROR);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    console.error('Error updating settings: ', data);
    throw new Error(messageFrom(data) ?? SETTINGS_UPDATE_ERROR);
  }
  return data as S;
}
