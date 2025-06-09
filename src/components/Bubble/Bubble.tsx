import { useEffect, useState, useRef, createElement } from 'react';
import { useHandleGestures } from '../../../src/hooks/useHandleGestures';
import { memoizedRoutes } from '../../../src/utils';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { CSSTransition } from 'react-transition-group';
import './bubble.less';

export default function Bubble() {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const [showBubble, setShowBubble] = useState(false);
  const prevComponentRef = useRef<string | null>(null);

  if (bubbleDisplay.component) {
    prevComponentRef.current = bubbleDisplay.component;
  }

  useEffect(() => {
    setShowBubble(bubbleDisplay.visible);
  }, [bubbleDisplay.visible]);

  const ActiveComponent =
    memoizedRoutes[bubbleDisplay.component || prevComponentRef.current]
      ?.component;

  useHandleGestures({
    context() {
      dispatch(
        setBubbleDisplay({
          visible: !bubbleDisplay.visible,
          component: !bubbleDisplay.visible
            ? 'quick-settings'
            : bubbleDisplay.component
        })
      );
    }
  });

  const handleExited = () => {
    dispatch(
      setBubbleDisplay({
        visible: false,
        component: null
      })
    );
  };
  return (
    <CSSTransition
      in={showBubble}
      timeout={450}
      classNames="bubble"
      unmountOnExit
      onExited={handleExited}
    >
      <div className="main-bubble main-layout large">
        <div className="bubble-container">
          {ActiveComponent && createElement(ActiveComponent)}
        </div>
      </div>
    </CSSTransition>
  );
}
