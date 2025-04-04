import {
  useEffect,
  useState,
  useRef,
  createElement,
  createContext,
  useContext,
  RefObject
} from 'react';
import { useHandleGestures } from '../../../src/hooks/useHandleGestures';
import { memoizedRoutes } from '../../../src/utils';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import './bubble.less';

type BubbleContextType = {
  bubbleContainerRef: RefObject<HTMLDivElement> | null;
};

export const BubbleContext = createContext<BubbleContextType | undefined>(
  undefined
);

//We use a context to give the children of the Bubble component access to certain properties—in this particular case, to give them access to a DOM element so they can modify its styles.
export const useBubbleContext = () => {
  const context = useContext(BubbleContext);
  if (!context)
    throw new Error(
      'useBubbleContext must be used within <BubbleContext.Provider>'
    );
  return context;
};

export default function Bubble() {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [animationState, setAnimationState] = useState({
    isVisible: false,
    isAnimating: false
  });

  const prevComponentRef = useRef<string | null>(null);
  const bubbleContainerRef = useRef<HTMLDivElement>(null);

  if (bubbleDisplay.component) {
    prevComponentRef.current = bubbleDisplay.component;
  }

  useEffect(() => {
    if (bubbleDisplay.visible)
      setAnimationState({
        isVisible: true,
        isAnimating: false
      });

    if (!bubbleDisplay.visible && animationState.isVisible)
      setAnimationState((prev) => ({ ...prev, isAnimating: true }));
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
    <BubbleContext.Provider value={{ bubbleContainerRef }}>
      <div
        className={`main-bubble main-layout ${
          !animationState.isAnimating
            ? 'bubble-enter-animation'
            : 'bubble-leave-animation'
        } large`}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className="bubble-container" ref={bubbleContainerRef}>
          {ActiveComponent && createElement(ActiveComponent)}
        </div>
      </div>
    </BubbleContext.Provider>
  );
}
