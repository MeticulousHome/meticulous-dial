import { ScreenName } from './../../types/screens';

export const getStyling = (screenName: ScreenName) => {
  switch (screenName) {
    case ScreenName.INFO:
      return {
        top: '80px'
      };
    case ScreenName.PROFILE_SETTING:
      return { top: '46px' };
    default:
      return {
        top: '80px'
      };
  }
};
