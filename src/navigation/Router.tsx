import { Freeze } from 'react-freeze';
import { ScreenType } from '../components/store/features/screens/screens-slice';
import { BottomStatus } from '../components/BottomStatus/BottomStatus';
import { Transitioner } from './Transitioner';
import { memo, useEffect } from 'react';
import { useAppSelector } from '../components/store/hooks';
import Bubble from '../../src/components/Bubble/Bubble';
import { memoizedRoutes } from '../../src/utils';
import { routes } from './routes';
import { useProfileContext } from '../context/ProfileContext';
import { getActiveProfilesTitle } from '../components/ProfileHomeScreen/ProfileTitle';
const routeKeys = Object.keys(routes);
export interface RouteProps {
  transitioning: boolean;
}

interface RouterProps {
  currentScreen: ScreenType;
  previousScreen?: ScreenType;
}

export const Router = memo(
  ({ currentScreen, previousScreen }: RouterProps): JSX.Element => {
    const route = memoizedRoutes[currentScreen];
    if (!route || !route.component) {
      console.error('Route not found:', currentScreen);
      return <div>Error: Route not found "{currentScreen}"</div>;
    }
    const RouteComponent = route.component;
    const { isCreatingProfile } = useProfileContext();
    const hideProfileTitle =
      isCreatingProfile &&
      (currentScreen === 'pressetSettings' ||
        route.parent === 'pressetSettings');
    const title = useAppSelector((state) =>
      typeof route.title === 'function' ? route.title(state) : route.title
    );

    const parentTitle = useAppSelector((state) =>
      route.parentTitle
        ? typeof route.parentTitle === 'function'
          ? route.parentTitle(state)
          : route.parentTitle
        : null
    );

    const calculatedDirection =
      !previousScreen ||
      routeKeys.indexOf(currentScreen) >= routeKeys.indexOf(previousScreen)
        ? 'in'
        : 'out';

    const directionMap = routes[currentScreen].animationDirectionFrom;
    const direction =
      (previousScreen && directionMap && directionMap[previousScreen]) ||
      calculatedDirection;

    useEffect(() => {
      console.log(
        'Router',
        previousScreen,
        '->',
        currentScreen,
        `${direction}(${calculatedDirection})`
      );
    }, [currentScreen, previousScreen]);

    return (
      <>
        <Bubble />
        <Transitioner
          direction={direction}
          screen={currentScreen}
          title={
            hideProfileTitle && route.title === getActiveProfilesTitle
              ? undefined
              : title
          }
          titleShared={route.titleShared}
          parentTitle={
            hideProfileTitle && route.parentTitle === getActiveProfilesTitle
              ? undefined
              : parentTitle
          }
          bottomTitle={route.bottomTitle}
        >
          <RouteComponent {...route.props} />
        </Transitioner>
        <Freeze freeze={route.bottomStatusHidden}>
          <BottomStatus hidden={route.bottomStatusHidden} />
        </Freeze>
      </>
    );
  }
);
