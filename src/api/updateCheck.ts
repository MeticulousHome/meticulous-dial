export type UpdateCheckResult = 'accepted' | 'update-active' | 'failed';

async function requestUpdateCheck(
  apiUrl: string,
  fetchRequest: typeof fetch
): Promise<UpdateCheckResult> {
  try {
    const response = await fetchRequest(`${apiUrl}/api/v1/update/check`, {
      method: 'POST'
    });

    if (response.ok) {
      return 'accepted';
    }

    if (response.status === 409) {
      return 'update-active';
    }

    return 'failed';
  } catch {
    return 'failed';
  }
}

export function createUpdateCheck(
  apiUrl: string,
  fetchRequest: typeof fetch = fetch
) {
  let pendingRequest: Promise<UpdateCheckResult> | null = null;

  return () => {
    if (!pendingRequest) {
      pendingRequest = requestUpdateCheck(apiUrl, fetchRequest).finally(() => {
        pendingRequest = null;
      });
    }

    return pendingRequest;
  };
}
