import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { api } from '../../api/api';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';

const API_URL = window.env.SERVER_URL || 'http://localhost:8080';

const SCROLL_VALUE = 50;

export const DefaultProfileDetails = () => {
  const dispatch = useAppDispatch();

  const defaultProfile = useAppSelector(
    (state) => state.presets.defaultProfilesInfo.defaultProfileSelected
  );

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

  const mainContainerScroll = (up: boolean) => {
    if (!mainContainerRef.current) {
      return;
    }

    mainContainerRef.current.scrollTop += up ? -SCROLL_VALUE : SCROLL_VALUE;
  };

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
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <img
            src={`${API_URL}${api.getProfileImageUrl(
              defaultProfile.display.image
            )}`}
            alt="No image"
            width="50"
            height="50"
            className="profile-image image-prev"
            style={{
              border: `8px solid ${
                defaultProfile.display.accentColor ?? '#e0dcd0'
              }`,
              display: 'block',
              position: 'relative'
            }}
          />
        </div>
        <p>{defaultProfile.name}</p>
        <p
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
        </p>
      </div>
    </div>
  );
};
