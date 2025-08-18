import { Profile } from '@meticulous-home/espresso-profile/dist';
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo
} from 'react';
import { useLastProfile, useProfiles } from '../hooks/useProfiles';
import {
  LastProfileIdent,
  ProfileUpdate
} from '@meticulous-home/espresso-api/dist';
import { IPresetAction, IPresetSetting } from '../types';

type ProfileContextType = {
  profileQuery: ReturnType<typeof useProfiles>;
  lastProfile: LastProfileIdent | null;

  // Local profile state
  localProfileIndex: number | null;
  setLocalProfileIndex: React.Dispatch<React.SetStateAction<number | null>>;
  localProfile: ExtendedProfile | null;
  setLocalProfile: React.Dispatch<React.SetStateAction<ExtendedProfile | null>>;
  localHoverState: boolean;
  setLocalHoverState: React.Dispatch<React.SetStateAction<boolean | null>>;

  // Default profile state
  detailProfileSelected: ExtendedProfile | null;
  setDetailsProfileSelected: React.Dispatch<
    React.SetStateAction<ExtendedProfile | null>
  >;

  // Profile Editing
  settingsIndex: number;
  setSettingsIndex: React.Dispatch<React.SetStateAction<number>>;
  settingsProfile:
    | (ExtendedProfile & { settings: (IPresetSetting | IPresetAction)[] })
    | null;
  setSettingsProfile: React.Dispatch<
    React.SetStateAction<
      (ExtendedProfile & { settings: IPresetSetting[] }) | null
    >
  >;

  profileStarting: boolean;
  setProfileStarting: React.Dispatch<React.SetStateAction<boolean>>;
  // Update functions
  onProfileEvent: (profile: ProfileUpdate) => void;
  onProfileHover: (type: string, profile_id: string) => void;
  mergedProfiles: ExtendedProfile[];
};

export type ExtendedProfile = Profile & {
  isLast?: boolean;
  temporary?: boolean;
};

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
    useState<ExtendedProfile | null>(null);
  const { data: profiles } = profileQuery;
  const { data: lastProfile } = useLastProfile();
  const [localProfileIndex, setLocalProfileIndex] = useState<number>(0);
  const [localProfile, setLocalProfile] = useState<ExtendedProfile | null>(
    null
  );
  const [localHoverState, setLocalHoverState] = useState<boolean>(false);
  const [profileIdToFind, setProfileIdToFind] = useState<string | null>(null);
  const [profileEvent, setProfileEvent] = useState<ProfileUpdate | null>(null);
  const [profileStarting, setProfileStarting] = useState(false);
  const [settingsIndex, setSettingsIndex] = useState(0);
  const [settingsProfile, setSettingsProfile] = useState<
    (ExtendedProfile & { settings: IPresetSetting[] }) | null
  >(null);

  const [hasJustHandledProfileEvent, setHasJustHandledProfileEvent] =
    useState(false);

  const mergedProfiles = useMemo<ExtendedProfile[]>(() => {
    if (!profiles) return [];

    const last = lastProfile?.profile;
    if (!last) return profiles;

    const existingIndex = profiles.findIndex((p) => p.id === last.id);
    const existing = existingIndex !== -1 ? profiles[existingIndex] : null;

    const profilesExtended = profiles.map((p) => ({
      ...p,
      isLast: false,
      temporary: false
    }));

    //It exists in profiles and is identical.
    // To re-add temporary profiles use  deepEqual(existing, last)
    if (existing) {
      profilesExtended[existingIndex] = {
        ...profilesExtended[existingIndex],
        isLast: true
      };
    }
    //Else: Add to the end (different content or does not exist)
    // return [
    //   ...profilesExtended,
    //   {
    //     ...last,
    //     isLast: true,
    //     temporary: true
    //   }
    // ];
    return profilesExtended;
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
    setHasJustHandledProfileEvent(profileEvent.change !== 'load'); //We added this condition to return to the last used profile once a brew has been completed.

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
    lastProfile,

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
