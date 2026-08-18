export type HomeMode =
  | 'espresso'
  | 'pour_over_profile'
  | 'repeat_pour'
  | 'free_pour'
  | 'new';

export type HomeSelection = {
  mode: HomeMode;
  profileIndex: number | null;
  pourOverProfileIndex: number | null;
};

export type HomeLayout = {
  profileCount: number;
  pourOverProfileCount: number;
  hasRepeatPour: boolean;
};

type ActiveHomeOption = HomeLayout & {
  mode: HomeMode;
  profileIndex: number | null;
  pourOverProfileIndex: number | null;
};

export type DialProfileHover = {
  id: string;
  from: 'dial';
  type: 'focus' | 'scroll';
};

export const getPourOverProfileOptionIndex = (
  pourOverProfileIndex: number,
  { profileCount, pourOverProfileCount }: HomeLayout
) => {
  if (pourOverProfileCount <= 0) return profileCount;
  return (
    profileCount +
    Math.min(Math.max(pourOverProfileIndex, 0), pourOverProfileCount - 1)
  );
};

export const getRepeatPourOptionIndex = ({
  profileCount,
  pourOverProfileCount,
  hasRepeatPour
}: HomeLayout) => (hasRepeatPour ? profileCount + pourOverProfileCount : null);

export const getFreePourOptionIndex = ({
  profileCount,
  pourOverProfileCount,
  hasRepeatPour
}: HomeLayout) => profileCount + pourOverProfileCount + (hasRepeatPour ? 1 : 0);

export const getNewOptionIndex = (layout: HomeLayout) =>
  getFreePourOptionIndex(layout) + 1;

export const getActiveHomeOption = ({
  mode,
  profileIndex,
  pourOverProfileIndex,
  profileCount,
  pourOverProfileCount,
  hasRepeatPour
}: ActiveHomeOption) => {
  const layout = { profileCount, pourOverProfileCount, hasRepeatPour };

  if (mode === 'pour_over_profile' && pourOverProfileCount > 0) {
    return getPourOverProfileOptionIndex(pourOverProfileIndex ?? 0, layout);
  }
  if (mode === 'repeat_pour' && hasRepeatPour) {
    return getRepeatPourOptionIndex(layout) as number;
  }
  if (mode === 'free_pour') {
    return getFreePourOptionIndex(layout);
  }
  if (mode === 'new') {
    return getNewOptionIndex(layout);
  }
  if (profileCount === 0) {
    if (pourOverProfileCount > 0) {
      return getPourOverProfileOptionIndex(0, layout);
    }
    return getFreePourOptionIndex(layout);
  }

  return Math.min(Math.max(profileIndex ?? 0, 0), profileCount - 1);
};

export const getHomeSelection = (
  option: number,
  layout: HomeLayout
): HomeSelection => {
  const { profileCount, pourOverProfileCount } = layout;
  const newOptionIndex = getNewOptionIndex(layout);
  const repeatPourOptionIndex = getRepeatPourOptionIndex(layout);
  const freePourOptionIndex = getFreePourOptionIndex(layout);
  const boundedOption = Math.min(Math.max(option, 0), newOptionIndex);

  if (boundedOption < profileCount) {
    return {
      mode: 'espresso',
      profileIndex: boundedOption,
      pourOverProfileIndex: null
    };
  }

  const pourOverProfileIndex = boundedOption - profileCount;
  if (
    pourOverProfileIndex >= 0 &&
    pourOverProfileIndex < pourOverProfileCount
  ) {
    return {
      mode: 'pour_over_profile',
      profileIndex: null,
      pourOverProfileIndex
    };
  }
  if (boundedOption === repeatPourOptionIndex) {
    return {
      mode: 'repeat_pour',
      profileIndex: null,
      pourOverProfileIndex: null
    };
  }
  if (boundedOption === freePourOptionIndex) {
    return {
      mode: 'free_pour',
      profileIndex: null,
      pourOverProfileIndex: null
    };
  }
  if (boundedOption === newOptionIndex) {
    return {
      mode: 'new',
      profileIndex: null,
      pourOverProfileIndex: null
    };
  }

  return {
    mode: 'free_pour',
    profileIndex: null,
    pourOverProfileIndex: null
  };
};

export const createDialProfileHover = (
  option: number,
  profiles: ReadonlyArray<{ id?: string }>,
  pourOverProfileCount: number,
  hasRepeatPour: boolean,
  type: 'focus' | 'scroll'
): DialProfileHover | null => {
  const selection = getHomeSelection(option, {
    profileCount: profiles.length,
    pourOverProfileCount,
    hasRepeatPour
  });
  if (selection.mode !== 'espresso' || selection.profileIndex === null) {
    return null;
  }

  const id = profiles[selection.profileIndex]?.id;
  return id ? { id, from: 'dial', type } : null;
};
