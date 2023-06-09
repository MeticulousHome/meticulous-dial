import { ReactNode, useEffect, useRef, useState } from 'react';
import { ScreenType } from '../components/store/features/screens/screens-slice';
import { VisibilityProvider } from './VisibilityContext';

interface TransitionerProps {
  screen: ScreenType;
  children: ReactNode;
  direction: 'in' | 'out';
  parentTitle?: string;
  title?: string;
}

export const Transitioner = (props: TransitionerProps): JSX.Element => {
  const { screen, direction, parentTitle, title, children } = props;
  const [previousProps, setPreviousProps] = useState<TransitionerProps | null>(
    null
  );
  const previousPropsRef = useRef<TransitionerProps | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (
      previousPropsRef.current &&
      previousPropsRef.current.screen !== screen
    ) {
      setPreviousProps(previousPropsRef.current);
      timer = setTimeout(() => {
        setPreviousProps(null);
      }, 1200);
    }
    previousPropsRef.current = props;

    if (timer) {
      return () => clearTimeout(timer);
    }
  }, [screen, children]);

  const shouldTransitionTitle =
    direction === 'in'
      ? previousProps?.title === parentTitle
      : previousProps?.parentTitle === title;

  return (
    <>
      <div
        key={screen}
        className={`main-layout route-${
          direction === 'in' ? 'child' : 'parent'
        }__fadeIn`}
      >
        <VisibilityProvider value={true}>{children}</VisibilityProvider>
      </div>
      {previousProps && previousProps.screen !== screen && (
        <div
          key={previousProps.screen}
          className={`main-layout route-${
            direction === 'out' ? 'child' : 'parent'
          }__fadeOut`}
        >
          {previousProps.title && !shouldTransitionTitle && (
            <>
              {previousProps.parentTitle && (
                <div className="title-main-1 title__Small">
                  {previousProps.parentTitle}
                </div>
              )}
              <div className="title-main-2 title__Big">
                {previousProps.title}
              </div>
            </>
          )}

          <VisibilityProvider value={false}>
            {previousProps.children}
          </VisibilityProvider>
        </div>
      )}
      {title && (
        <div
          key={`${title}-title`}
          className={`main-layout route-${
            direction === 'in' ? 'child' : 'parent'
          }__fadeIn`}
        >
          {parentTitle && (
            <div
              key={`${parentTitle}-title`}
              className="title-main-1 title__Small"
            >
              {parentTitle}
            </div>
          )}
          <div
            className="title-main-2 title__Big"
            style={{
              fontWeight: 'bold'
            }}
          >
            {title}
          </div>
        </div>
      )}
    </>
  );
};
