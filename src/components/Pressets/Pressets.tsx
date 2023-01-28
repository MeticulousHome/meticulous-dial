import PresetIcon from './PresetIcon';
import PresetStatus from './PresetStatus';

import './pressets.css';

function Pressets(): JSX.Element {
  return (
    <div className="main-layout">
      <div className="title-main-1">presets</div>

      <div className="main-layout-content">
        <div className="pressets-conainer">
          <PresetIcon />
        </div>
      </div>

      <PresetStatus />
    </div>
  );
}

export default Pressets;
