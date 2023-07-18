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

const duration = 1000;
const animationStyle = { animationDuration: `${duration / 1000}s` };

interface TitleProps {
  children: string;
  shared?: boolean;
  parent?: boolean;
  animation?: 'enter' | 'leave';
  direction?: 'in' | 'out';
}

const Title = ({
  children,
  parent,
  shared,
  animation,
  direction
}: TitleProps) => (
  <div
    className={[
      'navigation-title',
      parent && 'parent',
      shared && 'shared',
      animation,
      direction
    ]
      .filter(Boolean)
      .join(' ')}
    style={animation && animationStyle}
  >
    {children}
  </div>
);

export const Transitioner = (props: TransitionerProps): JSX.Element => {
  const [states, setStates] = useState<{
    current: TransitionerProps | null;
    previous: TransitionerProps | null;
    shouldTransitionTitle: boolean;
    shouldTransitionParentTitle: boolean;
    titleDirection: 'in' | 'out';
    animationSize: 'large' | 'small';
  }>({
    current: props,
    previous: null,
    shouldTransitionTitle: false,
    shouldTransitionParentTitle: false,
    titleDirection: props.direction,
    animationSize: 'large'
  });

  useEffect(() => {
    setStates((prev) => {
      if (prev.current.screen === props.screen) {
        return { ...prev, current: props };
      }
      const current = props;
      const previous = prev.current;

      const sharedTitleTransition =
        previous.title === current.title &&
        (current.titleShared || previous.titleShared);

      const shouldTransitionTitle =
        sharedTitleTransition || previous.parentTitle === current.title;

      const shouldTransitionParentTitle =
        previous.title === current.parentTitle;

      const titleDirection =
        sharedTitleTransition && (previous.parentTitle || current.parentTitle)
          ? current.direction === 'in'
            ? 'out'
            : 'in'
          : current.direction;

      const animationSize =
        shouldTransitionTitle || shouldTransitionParentTitle
          ? 'small'
          : 'large';

      return {
        current: props,
        previous: current.screen !== props.screen ? current : previous,
        shouldTransitionTitle,
        shouldTransitionParentTitle,
        titleDirection,
        animationSize
      };
    });
  }, [props]);

  const { current, previous, titleDirection, animationSize } = states;
  const animating = !!previous;
  const shouldTransitionTitle = animating && states.shouldTransitionTitle;
  const shouldTransitionParentTitle =
    animating && states.shouldTransitionParentTitle;

  useEffect(() => {
    if (previous) {
      const timer = setTimeout(() => {
        setStates((prev) => ({
          ...prev,
          previous: null
        }));
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [previous?.screen]);

  const { screen, direction, parentTitle, title, titleShared, children } =
    current || props;

  return (
    <>
      <div
        key={screen}
        className={`main-layout route route-${screen} ${`enter ${direction} ${animationSize}`}`}
        style={animationStyle}
      >
        <VisibilityProvider value={true}>{children}</VisibilityProvider>
        {!shouldTransitionParentTitle && parentTitle && (
          <Title parent>{parentTitle}</Title>
        )}
        {!shouldTransitionTitle && title && (
          <Title shared={titleShared}>{title}</Title>
        )}
      </div>
      {previous && (
        <div
          key={previous.screen}
          className={`main-layout route route-${previous.screen} leave ${direction} ${animationSize}`}
          style={animationStyle}
        >
          <VisibilityProvider value={false}>
            {previous.children}
          </VisibilityProvider>
          {!(direction === 'in'
            ? shouldTransitionParentTitle
            : shouldTransitionTitle) &&
            previous.parentTitle && (
              <Title parent>{previous.parentTitle}</Title>
            )}
          {!(titleShared || previous.titleShared
            ? shouldTransitionTitle
            : shouldTransitionParentTitle) &&
            previous.title && (
              <Title shared={previous.titleShared}>{previous.title}</Title>
            )}
        </div>
      )}
      <div className={`main-layout`}>
        {shouldTransitionParentTitle && parentTitle && (
          <Title parent animation="enter" direction={titleDirection}>
            {parentTitle}
          </Title>
        )}
        {shouldTransitionTitle && title && (
          <Title
            shared={titleShared || previous?.titleShared}
            animation="enter"
            direction={titleDirection}
          >
            {title}
          </Title>
        )}
      </div>
    </>
  );
};
