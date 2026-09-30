type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

async function parseResponse(response: Response): Promise<unknown> {
  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }
  return data;
}

export async function requestFactoryReset(
  apiUrl: string,
  fetchImpl: FetchLike = fetch
): Promise<unknown> {
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/machine/factory_reset?confirm=true`;
  let response = await fetchImpl(url, { method: 'POST' });

  // Old backend versions implemented this action as GET. Only fall back when
  // the server explicitly reports that POST is unsupported; current backends
  // never receive a state-changing GET.
  if (response.status === 405) {
    response = await fetchImpl(url, { method: 'GET' });
  }

  return parseResponse(response);
}
