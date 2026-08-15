import { invoke } from '@tauri-apps/api/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const COMMUNITY_UPLOAD_STATUS_QUERY_KEY = 'community-upload-status';

export type CommunityConnectionState =
  | 'not_connected'
  | 'connected'
  | 'upload_paused';

export interface CommunityUploadStatus {
  state: CommunityConnectionState;
  connected: boolean;
  paused: boolean;
  pendingCount: number;
  lastSuccessAt: number | null;
  lastError: string | null;
  lastRetryAt: number | null;
  enrollmentExpiresAt: number | null;
}

export interface CommunityEnrollment {
  qrUrl: string;
  expiresAt: number;
}

export function useCommunityUploadStatus() {
  return useQuery({
    queryKey: [COMMUNITY_UPLOAD_STATUS_QUERY_KEY],
    queryFn: () => invoke<CommunityUploadStatus>('community_upload_status'),
    refetchInterval: 1000,
    retry: false
  });
}

export function useBeginCommunityEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (machineSerial?: string) =>
      invoke<CommunityEnrollment>('community_begin_enrollment', {
        machineSerial: machineSerial || null
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [COMMUNITY_UPLOAD_STATUS_QUERY_KEY]
      })
  });
}

export function useSetCommunityUploadPaused() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paused: boolean) =>
      invoke<void>('community_set_upload_paused', { paused }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [COMMUNITY_UPLOAD_STATUS_QUERY_KEY]
      })
  });
}

export function useDisconnectCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => invoke<void>('community_disconnect'),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [COMMUNITY_UPLOAD_STATUS_QUERY_KEY]
      })
  });
}
