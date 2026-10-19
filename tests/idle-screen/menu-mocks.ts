// Unrelated machine/catalog boundaries. Menu selection, gestures, idle state,
// Redux, visibility and Socket.IO event handling use production components.
const unexpected = () => {
  throw new Error('Unexpected machine/catalog operation in screen fixture');
};
const profileContext = {
  profileQuery: { data: [] },
  localProfile: null,
  homeMode: 'espresso',
  selectedPourOverProfileId: null,
  setHomeMode: unexpected,
  setSelectedPourOverProfileId: unexpected,
  setSettingsIndex: unexpected,
  setIsCreatingProfile: unexpected,
  setSettingsProfile: unexpected,
  setProfileStarting: unexpected,
  onProfileEvent: unexpected,
  onProfileHover: unexpected
};
export const useProfileContext = () => profileContext;
export const useDeletePreset = () => ({ mutate: unexpected });
export const useDeletePourOverProfile = () => ({ mutate: unexpected });
export const useManualBrew = () => ({ isManualProfile: false });
export const createProfileFromManualBrew = unexpected;
export const LASTS_PROFILE_QUERY_KEY = 'last-profiles';
export const OS_UPDATE_STATUS = 'os-status';
export const useOSStatus = () => ({ data: { status: 'IDLE', progress: 0 } });
export const useDeviceInfo = () => ({
  data: { image_version: 'fixture' },
  isPending: false
});
export const dispatchedReports = {
  enqueue: unexpected,
  syncPending: unexpected,
  onOutcome: () => () => {}
};
export const describeDispatchedReportOutcome = unexpected;
