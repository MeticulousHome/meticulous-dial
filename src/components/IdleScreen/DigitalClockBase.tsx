import { formatTime } from './digitalClockTime';

export const DigitalClockBase = ({
  time
}: {
  time: ReturnType<typeof formatTime>;
}) => {
  return (
    <div className="clock-wrapper">
      <div className="clock">{time.hours.toString().padStart(2, '0')}</div>
      <div className="clock">{time.minutes.toString().padStart(2, '0')}</div>
      {time.midday && <div className="clock midday">{time.midday}</div>}
    </div>
  );
};
