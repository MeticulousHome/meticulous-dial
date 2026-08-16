import { API_URL } from '../../api/api';
import { FreePourSession } from './types';

interface PourOverHistoryMetadata {
  id: string;
  file: string;
  completedAt: string;
}

interface PourOverSaveResponse {
  status: 'created' | 'existing';
  history: PourOverHistoryMetadata;
}

interface PourOverHistoryResponse {
  history: PourOverHistoryMetadata[];
}

const apiError = async (response: Response, fallback: string) => {
  let message = fallback;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // The HTTP status below is sufficient when the body is not JSON.
  }
  return new Error(`${message} (${response.status})`);
};

export const persistFreePourSession = async (session: FreePourSession) => {
  const response = await fetch(`${API_URL}/api/v1/history/pour-over`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session)
  });
  if (!response.ok) {
    throw await apiError(response, 'Could not save Pour Over history');
  }
  return (await response.json()) as PourOverSaveResponse;
};

const fetchBackendSession = async (metadata: PourOverHistoryMetadata) => {
  const encodedPath = metadata.file
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const recordResponse = await fetch(
    `${API_URL}/api/v1/history/pour-over/files/${encodedPath}`
  );
  if (!recordResponse.ok) {
    throw await apiError(recordResponse, 'Could not read Pour Over record');
  }
  return (await recordResponse.json()) as FreePourSession;
};

export const getLatestBackendFreePourSession = async () => {
  const latestResponse = await fetch(
    `${API_URL}/api/v1/history/pour-over/last`
  );
  if (latestResponse.status === 404) return null;
  if (!latestResponse.ok) {
    throw await apiError(latestResponse, 'Could not read Pour Over history');
  }
  return fetchBackendSession(
    (await latestResponse.json()) as PourOverHistoryMetadata
  );
};

export const getLatestBackendFreePourOnlySession = async () => {
  const response = await fetch(
    `${API_URL}/api/v1/history/pour-over?mode=free_pour&max_results=1`
  );
  if (!response.ok) {
    throw await apiError(response, 'Could not read Free Pour history');
  }
  const metadata = ((await response.json()) as PourOverHistoryResponse)
    .history[0];
  return metadata ? fetchBackendSession(metadata) : null;
};
