import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useDefaultProfiles } from '../../hooks/useProfiles';

const SCROLL_VALUE = 50;

export const DefaultProfileDetails = () => {
  const dispatch = useAppDispatch();

  const defaultProfileIndex = useAppSelector(
    (state) => state.presets.defaultProfilesInfo.defaultProfileActiveIndex
  );
  const { data: defaultProfiles } = useDefaultProfiles();

  const defaultProfile = defaultProfiles?.[defaultProfileIndex];
  const mainContainerRef = useRef<HTMLDivElement | null>(null);

  useHandleGestures({
    left: () => {
      mainContainerScroll(true);
    },
    right: () => {
      mainContainerScroll(false);
    },
    pressDown: async () => {
      dispatch(
        setBubbleDisplay({ visible: true, component: 'quick-settings' })
      );
    }
  });

  useEffect(() => {
    if (!defaultProfile) {
      dispatch(
        setBubbleDisplay({ visible: true, component: 'quick-settings' })
      );
    }
  }, [defaultProfile]);

  const mainContainerScroll = (up: boolean) => {
    if (!mainContainerRef.current) {
      return;
    }

    mainContainerRef.current.scrollTop += up ? -SCROLL_VALUE : SCROLL_VALUE;
  };

  if (!defaultProfile) {
    return <div></div>;
  }

  return (
    <div
      className="main-quick-settings"
      style={{
        height: 480,
        alignItems: 'normal',
        paddingTop: 100
      }}
    >
      <div
        style={{
          width: '100%',
          paddingLeft: '5px'
        }}
      >
        <p>{defaultProfile.name}</p>
        <div
          style={{
            padding: '0px 10px',
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            scrollBehavior: 'smooth',
            maxHeight: 283
          }}
          ref={mainContainerRef}
        >
          {defaultProfile.display.description}
          <div
            className={`settings-item active-setting`}
            style={{
              marginTop: 80,
              marginBottom: 80
            }}
          >
            <div
              className="settings-entry"
              style={{
                padding: '6px'
              }}
            >
              <span>Back</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
