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
    (sharedTitleTransition || previous.parentTitle === title);

  const shouldTransitionParentTitle =
    Boolean(previous) && previous.title === parentTitle;

  const titleDirection =
    sharedTitleTransition && (previous.parentTitle || parentTitle)
      ? direction === 'in'
        ? 'out'
        : 'in'
      : direction;

  const animationSize =
    shouldTransitionTitle || shouldTransitionParentTitle ? 'small' : 'large';

  return (
    <>
      <div
        key={screen}
        className={`main-layout route route-${screen} ${
          previous ? `enter ${direction} ${animationSize}` : ''
        }`}
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
          {!(titleDirection === direction
            ? shouldTransitionTitle
            : shouldTransitionParentTitle) &&
            previous.parentTitle && (
              <Title parent>{previous.parentTitle}</Title>
            )}
          {!(titleDirection === direction
            ? direction === 'in' || shouldTransitionParentTitle
            : shouldTransitionTitle) &&
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
