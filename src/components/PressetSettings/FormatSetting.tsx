import { IPresetSetting } from '../../types';

interface FormatSettingProps {
  setting: IPresetSetting;
  isActive: boolean;
}

export const FormatSetting = ({ setting, isActive }: FormatSettingProps) => {
  const { label, value } = setting;
  let mValue = '';
  let mLabel = label;
  let activeClass = isActive ? 'active' : '';
  const isValidType = typeof value === 'number' || typeof value === 'string';

  if ((value || label) && isValidType) {
    mLabel = `${label}${isActive ? ': ' : ''}`;
    mValue = `${value || 0}`;
  }

  if (label === 'delete profile') activeClass = '';

  return (
    <div>
      <span className={`capitalize presset-option-label ${activeClass}`}>
        {mLabel}
      </span>
      <span className={`presset-option-value ${activeClass}`}>{mValue}</span>
      <span className={`presset-option-unit ${activeClass}`}>
        {(setting as any)?.unit}
      </span>
    </div>
  );
};
