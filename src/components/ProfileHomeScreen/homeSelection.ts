export type HomeMode = 'espresso' | 'pour_over_profile' | 'free_pour' | 'new';

export type HomeSelection = {
  mode: HomeMode;
  profileIndex: number | null;
  pourOverProfileIndex: number | null;
};

export type HomeLayout = {
  profileCount: number;
  pourOverProfileCount: number;
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

type PourOverCatalogSelection = {
  mode: HomeMode;
  selectedProfileId: string | null;
};

export const reconcilePourOverCatalogSelection = ({
  mode,
  selectedProfileId,
  installedProfileIds,
  catalogResolved
}: PourOverCatalogSelection & {
  installedProfileIds: ReadonlyArray<string>;
  catalogResolved: boolean;
}): PourOverCatalogSelection => {
  if (mode !== 'pour_over_profile' || !catalogResolved) {
    return { mode, selectedProfileId };
  }
  if (selectedProfileId && installedProfileIds.includes(selectedProfileId)) {
    return { mode, selectedProfileId };
  }
  if (installedProfileIds.length > 0) {
    return {
      mode: 'pour_over_profile',
      selectedProfileId: installedProfileIds[0]
    };
  }
  return { mode: 'free_pour', selectedProfileId: null };
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

export const getFreePourOptionIndex = ({
  profileCount,
  pourOverProfileCount
}: HomeLayout) => profileCount + pourOverProfileCount;

export const getNewOptionIndex = (layout: HomeLayout) =>
  getFreePourOptionIndex(layout) + 1;

export const getActiveHomeOption = ({
  mode,
  profileIndex,
  pourOverProfileIndex,
  profileCount,
  pourOverProfileCount
}: ActiveHomeOption) => {
  const layout = { profileCount, pourOverProfileCount };

  if (mode === 'pour_over_profile' && pourOverProfileCount > 0) {
    return getPourOverProfileOptionIndex(pourOverProfileIndex ?? 0, layout);
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
  type: 'focus' | 'scroll'
): DialProfileHover | null => {
  const selection = getHomeSelection(option, {
    profileCount: profiles.length,
    pourOverProfileCount
  });
  if (selection.mode !== 'espresso' || selection.profileIndex === null) {
    return null;
  }

  const id = profiles[selection.profileIndex]?.id;
  return id ? { id, from: 'dial', type } : null;
};
