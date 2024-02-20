import { useAppSelector } from '../store/hooks';
import './bubble.css';

export const durationAnimation = 450;
const animationStyle = { animationDuration: `${durationAnimation / 1000}s` };

export default function Bubble() {
  const Bubble = useAppSelector((state) => state.screen.bubbleDisplay);
  if (!Bubble || !Bubble.component) return <></>;

  return (
    <div
      className={`main-bubble main-layout ${
        Bubble && Bubble.visible
          ? 'bubble-enter-animation'
          : 'bubble-leave-animation'
      } large`}
      style={animationStyle}
    >
      <div className="bubble-container">
        <Bubble.component />
      </div>
    </div>
  );
}
