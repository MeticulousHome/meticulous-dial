import { IPresetNumericalUnit, IPresetSetting } from '../../types';
import { api } from '../../api/api';

interface FormatSettingProps {
  setting: IPresetSetting;
  isActive: boolean;
}

const API_URL = window.env?.SERVER_URL || 'http://localhost:8080';

export const FormatSetting = ({ setting, isActive }: FormatSettingProps) => {
  const { label, value } = setting;
  let mValue = '';
  let mLabel = label;
  const activeClass = isActive ? 'active' : '';
  const isValidType = typeof value === 'number' || typeof value === 'string';

  if ((value || label) && isValidType) {
    mLabel = `${label}${isActive ? ': ' : ''}`;
    mValue = `${value || 0}`;
  }

  const animateClass = mValue.length > 11 && activeClass;

  return (
    <div className="text-container">
      <span>
        <span
          className={animateClass ? 'animate-marquee' : ''}
          style={
            setting.type === 'image'
              ? {
                  display: 'flex',
                  flexDirection: 'row'
                }
              : {}
          }
        >
          <span
            style={
              setting.type === 'image'
                ? {
                    display: 'block'
                  }
                : {}
            }
            className={`capitalize presset-option-label ${activeClass}`}
          >
            {mLabel}
          </span>
          {setting.type === 'image' ? (
            <span
              style={{
                width: 70,
                height: 70,
                marginLeft: 10,
                position: 'relative',
                visibility: isActive ? 'visible' : 'hidden'
              }}
            >
              <img
                src={`${API_URL}${api.getProfileImageUrl(setting.value)}`}
                alt="No image"
                width="50"
                height="50"
                className="profile-image image-prev"
                style={{
                  border: '8px solid #e0dcd0',
                  display: 'block',
                  position: 'absolute',
                  left: 0,
                  top: 0
                }}
              />
            </span>
          ) : (
            <span className={`presset-option-value ${activeClass}`}>
              {mValue}
            </span>
          )}
          <span className={`presset-option-unit ${activeClass}`}>
            {(setting as IPresetNumericalUnit)?.unit}
          </span>
        </span>
      </span>
    </div>
  );
};
