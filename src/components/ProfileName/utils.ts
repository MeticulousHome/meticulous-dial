import { ScreenName } from './../../types/screens';

export const getStyling = (screenName: ScreenName) => {
  switch (screenName) {
    case ScreenName.INFO:
      return {
        top: '80px',
        fontSize: '25px'
      };
    case ScreenName.PROFILE_SETTING:
      return {
        top: '76px',
        fontSize: '40px'
      };
    default:
      return {
        top: '80px'
      };
  }
};
