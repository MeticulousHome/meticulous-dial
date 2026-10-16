const settings = { auto_start_shot: false };
const profileContext = { lastProfile: null, profileStarting: false };

export const useSettings = () => ({ data: settings });
export const useProfileContext = () => profileContext;
export const SocketProviderValue = () => {
  throw new Error('The scale fixture must never open a machine connection');
};
export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
