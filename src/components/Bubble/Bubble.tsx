import { useHandleGestures } from '../../../src/hooks/useHandleGestures';
import { memoizedRoutes } from '../../../src/utils';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import './bubble.less';
import * as Styled from '@styles/layout.styled';

export const durationAnimation = 450;
const animationStyle = { animationDuration: `${durationAnimation / 1000}s` };

export default function Bubble() {
  const dispatch = useAppDispatch();
  const Bubble = useAppSelector((state) => state.screen.bubbleDisplay);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const route = memoizedRoutes[Bubble.component];

  useHandleGestures({
    context() {
      dispatch(
        setBubbleDisplay({
          visible: !bubbleDisplay.visible,
          component: !bubbleDisplay.visible ? 'quick-settings' : null
        })
      );
    }
  });

  if (!Bubble || !Bubble.component) return <></>;

  return (
    <Styled.MainLayout
      className={`main-bubble ${
        Bubble && Bubble.visible
          ? 'bubble-enter-animation'
          : 'bubble-leave-animation'
      } large`}
      style={animationStyle}
    >
      <div className="bubble-container">
        <route.component />
      </div>
    </Styled.MainLayout>
  );
}
