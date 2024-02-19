import { useAppSelector } from '../store/hooks';
import './bubble.css';

export const durationAnimation = 450;
const animationStyle = { animationDuration: `${durationAnimation / 1000}s` };

export default function Bubble() {
  const Bubble = useAppSelector((state) => state.screen.bubbleDisplay);

  console.log('Bubble.visible ', Bubble.visible);

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
        {Bubble && Bubble.component && <Bubble.component />}
      </div>
    </div>
  );
}
