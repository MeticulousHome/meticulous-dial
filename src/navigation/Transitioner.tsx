import { ReactNode, useEffect, useState } from 'react';
import { ScreenType } from '../components/store/features/screens/screens-slice';
import { VisibilityProvider } from './VisibilityContext';
import './navigation.less';

interface TransitionerProps {
  screen: ScreenType;
  children: ReactNode;
  direction: 'in' | 'out';
  parentTitle?: string;
  title?: string;
  titleShared?: boolean;
}

const duration = 800;

export const Transitioner = (props: TransitionerProps): JSX.Element => {
  const [states, setStates] = useState<{
    current: TransitionerProps | null;
    previous: TransitionerProps | null;
  }>({ current: props, previous: null });
  const { current, previous } = states;

  useEffect(() => {
    setStates((prev) => ({
      current: props,
      previous: current.screen !== props.screen ? prev.current : prev.previous
    }));
  }, [current?.screen, props]);

  useEffect(() => {
    if (previous) {
      const timer = setTimeout(() => {
        setStates(({ current }) => ({
          current,
          previous: null
        }));
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [previous]);

  const { screen, direction, parentTitle, title, titleShared, children } =
    current || props;

  const sharedTitleTransition =
    Boolean(previous) &&
    previous.title === title &&
    (titleShared || previous.titleShared);

  const shouldTransitionTitle =
    Boolean(previous) &&
    (sharedTitleTransition ||
      previous.title === parentTitle ||
      previous.parentTitle === title);

  const titleDirection =
    sharedTitleTransition && (previous.parentTitle || parentTitle)
      ? direction === 'in'
        ? 'out'
        : 'in'
      : direction;

  const animationStyle = { animationDuration: `${duration / 1000}s` };

  return (
    <>
      <div
        key={screen}
        className={`main-layout route enter ${direction}`}
        style={animationStyle}
      >
        <VisibilityProvider value={true}>{children}</VisibilityProvider>
        {!shouldTransitionTitle && title && (
          <>
            {!titleShared && parentTitle && (
              <div className="navigation-title parent">{parentTitle}</div>
            )}
            <div className={`navigation-title${titleShared ? ' shared' : ''}`}>
              {title}
            </div>
          </>
        )}
      </div>
      {previous && previous.screen !== screen && (
        <div
          key={previous.screen}
          className={`main-layout route leave ${direction}`}
          style={animationStyle}
        >
          <VisibilityProvider value={false}>
            {previous.children}
          </VisibilityProvider>
          {!shouldTransitionTitle && previous.title && (
            <>
              {!previous.titleShared && previous.parentTitle && (
                <div className="navigation-title parent">
                  {previous.parentTitle}
                </div>
              )}
              <div
                className={`navigation-title${
                  previous.titleShared ? ' shared' : ''
                }`}
              >
                {previous.title}
              </div>
            </>
          )}
        </div>
      )}
      {shouldTransitionTitle && title && (
        <div key={`${title}-title`} className={`main-layout`}>
          {titleDirection === 'in'
            ? previous?.parentTitle && (
                <div
                  className={`navigation-title parent leave ${titleDirection}`}
                >
                  {previous.parentTitle}
                </div>
              )
            : previous?.title && (
                <div className={`navigation-title leave ${titleDirection}`}>
                  {previous.title}
                </div>
              )}
          {!titleShared && parentTitle && (
            <div
              className={`navigation-title parent enter ${
                // TODO: this logic is broken, see preset settings
                shouldTransitionTitle ? '' : titleDirection
              }`}
            >
              {parentTitle}
            </div>
          )}
          <div
            className={`navigation-title ${
              titleShared || previous?.titleShared ? 'shared ' : ''
            }enter ${titleDirection}`}
          >
            {title}
          </div>
        </div>
      )}
    </>
  );
};
