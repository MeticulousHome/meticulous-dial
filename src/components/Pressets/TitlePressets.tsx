import { useAppSelector } from '../store/hooks';
import './pressets.less';

export const getTitlePressets = () => <TitlePressets />;

export const TitlePressets = () => {
  const presets = useAppSelector((state) => state.presets);

  return (
    <div className="pressets-title">
      <div id="pressets-title-content">
        <div>Catalog</div>
        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {presets.activePreset.name}
        </div>
      </div>
    </div>
  );
};
