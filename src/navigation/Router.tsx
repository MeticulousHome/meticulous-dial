import { Freeze } from 'react-freeze';
import { ScreenType } from '../components/store/features/screens/screens-slice';
import BottomStatus from '../components/BottomStatus';
import { Transitioner } from './Transitioner';
import { memo, useEffect } from 'react';
import { useAppSelector } from '../components/store/hooks';
import Bubble from '../../src/components/Bubble/Bubble';
import { memoizedRoutes } from '../../src/utils';
import { routes } from './routes';
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
    const RouteComponent = route.component;
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
          title={title}
          titleShared={route.titleShared}
          parentTitle={parentTitle}
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
