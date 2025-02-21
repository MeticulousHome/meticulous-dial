import { useEffect, useState, useRef } from 'react';
import { useHandleGestures } from '../../../src/hooks/useHandleGestures';
import { memoizedRoutes } from '../../../src/utils';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import './bubble.less';

export default function Bubble() {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [animationState, setAnimationState] = useState({
    isVisible: false,
    isAnimating: false
  });

  const componentRef = useRef(null);

  useEffect(() => {
    if (bubbleDisplay.component) componentRef.current = bubbleDisplay.component;
  }, [bubbleDisplay.component]);

  useEffect(() => {
    if (bubbleDisplay.visible)
      setAnimationState({
        isVisible: true,
        isAnimating: false
      });

    if (!bubbleDisplay.visible && animationState.isVisible)
      setAnimationState((prev) => ({ ...prev, isAnimating: true }));
  }, [bubbleDisplay.visible]);

  const route = componentRef.current
    ? memoizedRoutes[componentRef.current]
    : null;

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

  if (!animationState.isVisible && !animationState.isAnimating) return null;

  const handleAnimationEnd = () => {
    if (!animationState.isAnimating) return;

    setAnimationState({
      isVisible: false,
      isAnimating: false
    });

    if (bubbleDisplay.component)
      dispatch(
        setBubbleDisplay({
          visible: false,
          component: null
        })
      );
  };

  return (
    <div
      className={`main-bubble main-layout ${
        !animationState.isAnimating
          ? 'bubble-enter-animation'
          : 'bubble-leave-animation'
      } large`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="bubble-container">{route && <route.component />}</div>
    </div>
  );
}
