import { useEffect, useState, cloneElement, ReactElement } from 'react';
import { ScreenType } from '../components/store/features/screens/screens-slice';
import { VisibilityProvider } from './VisibilityContext';
import './navigation.less';

interface TransitionerProps {
  screen: ScreenType;
  children: ReactElement;
  direction: 'in' | 'out';
  parentTitle?: string;
  title?: string;
  bottomTitle?: string;
  titleShared?: boolean;
}

export const durationAnimation = 450;
const animationStyle = { animationDuration: `${durationAnimation / 1000}s` };

interface TitleProps {
  children: string;
  shared?: boolean;
  parent?: boolean;
  animation?: 'enter' | 'leave';
  direction?: 'in' | 'out';
  position?: 'top' | 'bottom';
  customClass?: string;
}

export const Title = ({
  children,
  parent,
  shared,
  animation,
  direction,
  position,
  customClass
}: TitleProps) => (
  <div
    className={[
      'navigation-title',
      parent && 'parent',
      shared && 'shared',
      position && position,
      animation,
      direction,
      customClass
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
        previous,
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
      }, durationAnimation);
      return () => clearTimeout(timer);
    }
  }, [previous?.screen]);

  const {
    screen,
    direction,
    parentTitle,
    title,
    titleShared,
    children,
    bottomTitle
  } = current || props;

  return (
    <>
      <div
        key={screen}
        className={`main-layout route route-${screen} ${
          previous ? `enter ${direction} ${animationSize}` : ''
        }`}
        style={animationStyle}
      >
        <VisibilityProvider value={true}>
          {cloneElement(children, { transitioning: !!previous })}
        </VisibilityProvider>
        {!shouldTransitionParentTitle && parentTitle && (
          <Title parent>{parentTitle}</Title>
        )}
        {!shouldTransitionTitle && (title || typeof title === 'string') && (
          <Title shared={titleShared}>{title}</Title>
        )}
        {!shouldTransitionTitle && bottomTitle && (
          <Title position="bottom">{bottomTitle}</Title>
        )}
      </div>
      {previous && (
        <div
          key={previous.screen}
          className={`main-layout route route-${previous.screen} leave ${direction} ${animationSize}`}
          style={animationStyle}
        >
          <VisibilityProvider value={false}>
            {cloneElement(previous.children, { transitioning: true })}
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
            (title || typeof previous.title === 'string') && (
              <Title shared={previous.titleShared}>{previous.title}</Title>
            )}
        </div>
      )}
      {shouldTransitionParentTitle && parentTitle && (
        <Title parent animation="enter" direction={titleDirection}>
          {parentTitle}
        </Title>
      )}
      {shouldTransitionTitle && (title || typeof title === 'string') && (
        <Title
          shared={titleShared || previous?.titleShared}
          animation="enter"
          direction={titleDirection}
        >
          {title}
        </Title>
      )}
      {shouldTransitionTitle && bottomTitle && (
        <Title
          shared={titleShared || previous?.titleShared}
          animation="enter"
          direction={titleDirection}
          position="bottom"
        >
          {bottomTitle}
        </Title>
      )}
    </>
  );
};
