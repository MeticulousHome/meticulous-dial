import { Freeze } from 'react-freeze';
import { ScreenType } from '../components/store/features/screens/screens-slice';
import BottomStatus from '../components/BottomStatus';
import { routes } from './routes';
import { Transitioner } from './Transitioner';
import { memo } from 'react';
import { useAppSelector } from '../components/store/hooks';
import Bubble from '../../src/components/Bubble/Bubble';

const routeKeys = Object.keys(routes);
const memoizedRoutes = Object.fromEntries(
  Object.entries(routes).map(([key, { component, ...route }]) => [
    key,
    { ...route, component: memo(component) }
  ])
);

export interface RouteProps {
  transitioning: boolean;
}

interface RouterProps {
  currentScreen: ScreenType;
  previousScreen?: ScreenType;
}

export const Router = memo(
  ({ currentScreen, previousScreen }: RouterProps): JSX.Element => {
    const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
    const route = memoizedRoutes[currentScreen];
    const parentRoute = route.parent && memoizedRoutes[route.parent];
    const RouteComponent = route.component;
    const title = useAppSelector((state) =>
      typeof route.title === 'function' ? route.title(state) : route.title
    );

    const parentTitle = useAppSelector((state) =>
      route.parentTitle
        ? typeof route.parentTitle === 'function'
          ? route.parentTitle(state)
          : route.parentTitle
        : parentRoute?.titleShared
        ? null
        : typeof parentRoute?.title === 'function'
        ? parentRoute.title(state)
        : parentRoute?.title
    );

    const direction =
      !previousScreen ||
      routeKeys.indexOf(currentScreen) > routeKeys.indexOf(previousScreen)
        ? 'in'
        : 'out';

    return (
      <>
        {bubbleDisplay.visible && <Bubble />}
        <Transitioner
          direction={direction}
          screen={currentScreen}
          title={title}
          titleShared={route.titleShared}
          parentTitle={parentTitle}
        >
          <RouteComponent {...route.props} />
        </Transitioner>
        <Freeze freeze={route.bottomStatusHidden}>
          <BottomStatus
            hidden={route.bottomStatusHidden || bubbleDisplay.visible}
          />
        </Freeze>
      </>
    );
  }
);
