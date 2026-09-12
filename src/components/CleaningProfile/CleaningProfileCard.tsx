import { PurgePiston } from '../PurgePiston/PurgePiston';
import './cleaning.css';

export const CleaningProfileCard = () => (
  <div className="cleaning-card" aria-label="Built-in Group Flush profile">
    <div className="cleaning-card-halo" />
    <PurgePiston
      className="cleaning-card-piston"
      fixedPosition={38}
      showBlink={false}
    />
    <span className="cleaning-card-sparkle cleaning-card-sparkle-large">✦</span>
    <span className="cleaning-card-sparkle cleaning-card-sparkle-small">✦</span>
    <span className="cleaning-card-caption">FLUSH · WIPE</span>
  </div>
);
