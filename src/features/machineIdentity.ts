export interface MachineIdentity {
  alg: string;
  fingerprint: string;
  public_key: string;
}

export interface IdentityRotationResult {
  status: string;
  fingerprint: string;
  generation: number;
}

export const RESET_MACHINE_IDENTITY_OPTIONS: {
  key: 'cancel' | 'reset';
  label: string;
}[] = [
  { key: 'cancel', label: 'Cancel' },
  {
    key: 'reset',
    label: 'Reset identity & remove all paired devices'
  }
];

export const RESET_MACHINE_IDENTITY_DEFAULT_INDEX = 0;

export function formatMachineFingerprint(fingerprint?: string): string | null {
  const normalized = fingerprint?.trim();
  if (!normalized || !/^[0-9a-f]{64}$/i.test(normalized)) return null;

  const shortFingerprint = normalized.slice(0, 8).toUpperCase();
  return `${shortFingerprint.slice(0, 4)}-${shortFingerprint.slice(4)}`;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function requestMachineIdentityRotation(
  apiUrl: string,
  fetchImpl: FetchLike = fetch
): Promise<IdentityRotationResult> {
  const response = await fetchImpl(
    `${apiUrl.replace(/\/$/, '')}/api/v1/identity/rotate?confirm=true`,
    {
      method: 'POST',
      headers: { Accept: 'application/json' }
    }
  );
  const data = (await response.json()) as Partial<IdentityRotationResult> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }
  if (
    data.status !== 'success' ||
    typeof data.fingerprint !== 'string' ||
    typeof data.generation !== 'number'
  ) {
    throw new Error('Invalid response from identity reset');
  }

  return data as IdentityRotationResult;
}
