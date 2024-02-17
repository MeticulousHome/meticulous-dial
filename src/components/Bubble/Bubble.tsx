import { useAppSelector } from '../store/hooks';
import './bubble.css';

export const durationAnimation = 450;
const animationStyle = { animationDuration: `${durationAnimation / 1000}s` };

export default function Bubble() {
  const Bubble = useAppSelector((state) => state.screen.bubbleDisplay);

  return (
    <div
      className={`main-bubble main-layout route enter ${
        Bubble.visible ? 'in' : 'out'
      } large`}
      style={animationStyle}
    >
      <div className="bubble-container">
        <Bubble.component />
      </div>
    </div>
  );
}
