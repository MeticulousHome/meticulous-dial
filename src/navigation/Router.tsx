import { Freeze } from 'react-freeze';
import { ScreenType } from '../components/store/features/screens/screens-slice';
import BottomStatus from '../components/BottomStatus';
import { routes } from './routes';
import { Transitioner } from './Transitioner';
import { memo } from 'react';

interface RouterProps {
  screen: ScreenType;
}

export const Router = memo(({ screen }: RouterProps): JSX.Element => {
  const route = routes[screen];
  const parentRoute = route.parent && routes[route.parent];
  const RouteComponent = route.component;
  const title = typeof route.title === 'function' ? route.title() : route.title;
  const parentTitle =
    typeof parentRoute?.title === 'function'
      ? parentRoute.title()
      : parentRoute?.title;

  return (
    <>
      <Transitioner
        direction={parentRoute ? 'in' : 'out'}
        screen={screen}
        title={title}
        parentTitle={parentTitle}
      >
        <RouteComponent {...route.props} />
      </Transitioner>
      <div
        className={`bottom__${route.bottomStatusHidden ? 'fadeOut' : 'fadeIn'}`}
      >
        <Freeze freeze={route.bottomStatusHidden}>
          <BottomStatus />
        </Freeze>
      </div>
    </>
  );
});
