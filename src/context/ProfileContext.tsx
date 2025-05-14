import { Profile } from '@meticulous-home/espresso-profile/dist';
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo
} from 'react';
import { useLastProfile, useProfiles } from '../hooks/useProfiles';
import { ProfileUpdate } from '@meticulous-home/espresso-api/dist';
import { IPresetAction, IPresetSetting } from '../types';

type ProfileContextType = {
  profileQuery: ReturnType<typeof useProfiles>;

  // Local profile state
  localProfileIndex: number | null;
  setLocalProfileIndex: React.Dispatch<React.SetStateAction<number | null>>;
  localProfile: Profile | null;
  setLocalProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  localHoverState: boolean;
  setLocalHoverState: React.Dispatch<React.SetStateAction<boolean | null>>;

  // Default profile state
  detailProfileSelected: Profile | null;
  setDetailsProfileSelected: React.Dispatch<
    React.SetStateAction<Profile | null>
  >;

  // Profile Editing
  settingsIndex: number;
  setSettingsIndex: React.Dispatch<React.SetStateAction<number>>;
  settingsProfile:
    | (Profile & { settings: (IPresetSetting | IPresetAction)[] })
    | null;
  setSettingsProfile: React.Dispatch<
    React.SetStateAction<(Profile & { settings: IPresetSetting[] }) | null>
  >;

  profileStarting: boolean;
  setProfileStarting: React.Dispatch<React.SetStateAction<boolean>>;
  // Update functions
  onProfileEvent: (profile: ProfileUpdate) => void;
  onProfileHover: (type: string, profile_id: string) => void;
  mergedProfiles: ExtendedProfile[];
};

export type ExtendedProfile = Profile & { isLast?: boolean };

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfileContext = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return context;
};

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const profileQuery = useProfiles();
  const [defaultProfileSelected, setDefaultProfileSelected] =
    useState<Profile | null>(null);
  const { data: profiles } = profileQuery;
  const { data: lastProfile } = useLastProfile();
  const [localProfileIndex, setLocalProfileIndex] = useState<number>(0);
  const [localProfile, setLocalProfile] = useState<Profile | null>(null);
  const [localHoverState, setLocalHoverState] = useState<boolean>(false);
  const [profileIdToFind, setProfileIdToFind] = useState<string | null>(null);
  const [profileEvent, setProfileEvent] = useState<ProfileUpdate | null>(null);
  const [profileStarting, setProfileStarting] = useState(false);
  const [settingsIndex, setSettingsIndex] = useState(0);
  const [settingsProfile, setSettingsProfile] = useState<
    (Profile & { settings: IPresetSetting[] }) | null
  >(null);

  const [hasJustHandledProfileEvent, setHasJustHandledProfileEvent] =
    useState(false);
  // const hasJustHandledProfileEvent = useRef(false);

  const mergedProfiles = useMemo<ExtendedProfile[]>(() => {
    if (!profiles) return [];

    const last = lastProfile?.profile;
    if (!last) return profiles;

    const exists = profiles.some((p) => p.id === last.id);

    const enhanced = profiles.map((p) => ({
      ...p,
      isLast: p.id === last.id
    }));

    if (!exists) {
      enhanced.push({
        ...last,
        isLast: true
      });
    }

    return enhanced;
  }, [profiles, lastProfile?.profile]);

  // If the last profile changes scroll to the last profile
  useEffect(() => {
    if (hasJustHandledProfileEvent) {
      setHasJustHandledProfileEvent(false);
      return;
    }
    if (!mergedProfiles || mergedProfiles.length === 0) return;

    const profileIndex = mergedProfiles.findIndex((profile) => profile.isLast);

    if (profileIndex !== -1) {
      setLocalProfileIndex(profileIndex);
      setLocalProfile(mergedProfiles[profileIndex]);
    } else {
      setLocalProfileIndex(0);
      setLocalProfile(mergedProfiles[0]);
    }
    setLocalHoverState(true);
  }, [mergedProfiles]);

  // If the profile index changes, update the local profile
  useEffect(() => {
    if (!mergedProfiles) {
      return;
    }
    if (profileIdToFind) {
      const profileIndex = mergedProfiles.findIndex(
        (profile) => profile.id === profileIdToFind
      );
      if (profileIndex !== -1) {
        setLocalProfileIndex(profileIndex);
        setLocalProfile(mergedProfiles[profileIndex]);
        setProfileIdToFind(null);
        return;
      }
    }

    if (localProfileIndex > mergedProfiles.length) {
      setLocalProfileIndex(mergedProfiles.length);
      setLocalProfile(null);
    } else if (localProfileIndex < mergedProfiles.length) {
      setLocalProfile(mergedProfiles[localProfileIndex]);
    }
  }, [localProfileIndex, profileIdToFind, mergedProfiles]);

  // When the profile event is received, refetch the profiles and if necessary update the local state
  useEffect(() => {
    if (!profileEvent) return;

    profileQuery.refetch();
    setProfileEvent(null);
    setHasJustHandledProfileEvent(true);

    if (!mergedProfiles || mergedProfiles.length === 0) {
      console.error('No profiles available');
      return;
    }
    const profile_id = profileEvent.profile_id || '';
    const index = mergedProfiles.findIndex(
      (profile) => profile.id === profile_id
    );

    switch (profileEvent.change) {
      case 'update': {
        if (index !== -1) {
          setLocalProfileIndex(index);
        } else {
          // Queue the profile id to find
          // This is needed because the profile list is not updated yet
          setProfileIdToFind(profile_id);
        }
        break;
      }
      case 'delete': {
        if (index !== -1 && index < localProfileIndex) {
          setLocalProfileIndex((prev) => Math.max(prev - 1, 0));
        }
        // We dont handle the else case because not finding a deleted profile is good
        // and we do boundary checks above
        break;
      }
      case 'create': {
        if (index !== -1) {
          setLocalProfileIndex(index);
        } else {
          // Queue the profile id to find
          // This is needed because the profile list is not updated yet
          setProfileIdToFind(profile_id);
        }
        break;
      }
      default:
        break;
    }
  }, [mergedProfiles, profileEvent, profileQuery]);

  const onProfileHover = (type: string, profile_id: string) => {
    setLocalHoverState(type === 'focus');
    setProfileIdToFind(profile_id);
  };

  const onProfileEvent = (event: ProfileUpdate) => {
    setProfileEvent(event);
  };

  const value: ProfileContextType = {
    profileQuery,

    localProfileIndex,
    setLocalProfileIndex,
    localProfile,
    setLocalProfile,
    localHoverState,
    setLocalHoverState,

    detailProfileSelected: defaultProfileSelected,
    setDetailsProfileSelected: setDefaultProfileSelected,

    settingsIndex,
    setSettingsIndex,
    settingsProfile,
    setSettingsProfile,

    profileStarting,
    setProfileStarting,
    onProfileEvent,
    onProfileHover,
    mergedProfiles
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
};
