export type HomeMode = 'espresso' | 'free_pour' | 'pour_over_profile' | 'new';

export type HomeSelection = {
  mode: HomeMode;
  profileIndex: number | null;
};

type HomeLayout = {
  profileCount: number;
  hasRepeatPour: boolean;
};

type ActiveHomeOption = HomeLayout & {
  mode: HomeMode;
  profileIndex: number | null;
};

export type DialProfileHover = {
  id: string;
  from: 'dial';
  type: 'focus' | 'scroll';
};

const getPourOverOptionCount = (hasRepeatPour: boolean) =>
  hasRepeatPour ? 2 : 1;

export const getRepeatPourOptionIndex = ({
  profileCount,
  hasRepeatPour
}: HomeLayout) => (hasRepeatPour ? profileCount : null);

export const getFreePourOptionIndex = ({
  profileCount,
  hasRepeatPour
}: HomeLayout) => profileCount + (hasRepeatPour ? 1 : 0);

export const getNewOptionIndex = ({
  profileCount,
  hasRepeatPour
}: HomeLayout) => profileCount + getPourOverOptionCount(hasRepeatPour);

export const getActiveHomeOption = ({
  mode,
  profileIndex,
  profileCount,
  hasRepeatPour
}: ActiveHomeOption) => {
  if (mode === 'free_pour') {
    return getFreePourOptionIndex({ profileCount, hasRepeatPour });
  }
  if (mode === 'pour_over_profile') {
    return (
      getRepeatPourOptionIndex({ profileCount, hasRepeatPour }) ??
      getFreePourOptionIndex({ profileCount, hasRepeatPour })
    );
  }
  if (mode === 'new') {
    return getNewOptionIndex({ profileCount, hasRepeatPour });
  }
  if (profileCount === 0) {
    return getFreePourOptionIndex({ profileCount, hasRepeatPour });
  }

  const boundedProfileIndex = Math.min(
    Math.max(profileIndex ?? 0, 0),
    profileCount - 1
  );
  return boundedProfileIndex;
};

export const getHomeSelection = (
  option: number,
  { profileCount, hasRepeatPour }: HomeLayout
): HomeSelection => {
  const newOptionIndex = getNewOptionIndex({
    profileCount,
    hasRepeatPour
  });
  const repeatPourOptionIndex = getRepeatPourOptionIndex({
    profileCount,
    hasRepeatPour
  });
  const freePourOptionIndex = getFreePourOptionIndex({
    profileCount,
    hasRepeatPour
  });
  const boundedOption = Math.min(Math.max(option, 0), newOptionIndex);

  if (boundedOption < profileCount) {
    return { mode: 'espresso', profileIndex: boundedOption };
  }
  if (boundedOption === repeatPourOptionIndex) {
    return { mode: 'pour_over_profile', profileIndex: null };
  }
  if (boundedOption === freePourOptionIndex) {
    return { mode: 'free_pour', profileIndex: null };
  }
  if (boundedOption === newOptionIndex) {
    return { mode: 'new', profileIndex: null };
  }

  return { mode: 'free_pour', profileIndex: null };
};

export const createDialProfileHover = (
  option: number,
  profiles: ReadonlyArray<{ id?: string }>,
  hasRepeatPour: boolean,
  type: 'focus' | 'scroll'
): DialProfileHover | null => {
  const selection = getHomeSelection(option, {
    profileCount: profiles.length,
    hasRepeatPour
  });
  if (selection.mode !== 'espresso' || selection.profileIndex === null) {
    return null;
  }

  const id = profiles[selection.profileIndex]?.id;
  return id ? { id, from: 'dial', type } : null;
};
