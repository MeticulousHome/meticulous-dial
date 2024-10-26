import { useEffect, useState } from 'react';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import {
  getWiFiMode,
  getWiFiRadioStatus,
  setWiFiMode,
  setWiFiRadioStatus
} from '../TestOptions/legacyApi';
import './BooleanTestScreen.css';

type WiFiMode = 'AP' | 'CLIENT';

interface MenuItem {
  label: string;
  key: string;
  isToggle?: boolean;
  action?: () => Promise<void>;
  disabled?: boolean;
}

interface LoadingState {
  isLoading: boolean;
  message: string;
}

export function WiFiTestMenu({ onBack }: { onBack: () => void }): JSX.Element {
  const [isDeviceEnabled, setIsDeviceEnabled] = useState(false);
  const [currentMode, setCurrentMode] = useState<WiFiMode>('CLIENT');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: ''
  });

  const initializeWiFiStatus = async () => {
    try {
      setLoadingState({ isLoading: true, message: 'Loading WiFi status...' });
      const [radioStatus, mode] = await Promise.all([
        getWiFiRadioStatus(),
        getWiFiMode()
      ]);
      setIsDeviceEnabled(radioStatus);
      setCurrentMode(mode as WiFiMode);
    } catch (error) {
      console.error('Error initializing WiFi status:', error);
    } finally {
      setLoadingState({ isLoading: false, message: '' });
    }
  };

  useEffect(() => {
    initializeWiFiStatus();
  }, []);

  const toggleWiFiDevice = async () => {
    try {
      setLoadingState({
        isLoading: true,
        message: `${isDeviceEnabled ? 'Disabling' : 'Enabling'} WiFi device...`
      });
      const newStatus = await setWiFiRadioStatus(!isDeviceEnabled);
      setIsDeviceEnabled(newStatus);

      if (!newStatus && selectedIndex === 1) {
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Error toggling WiFi device:', error);
    } finally {
      setLoadingState({ isLoading: false, message: '' });
    }
  };

  const toggleWiFiMode = async () => {
    if (!isDeviceEnabled) return;

    try {
      const newMode = currentMode === 'AP' ? 'CLIENT' : 'AP';
      setLoadingState({
        isLoading: true,
        message: `Switching to ${newMode === 'AP' ? 'Access Point' : 'Client'} mode...`
      });
      await setWiFiMode(newMode);
      setCurrentMode(newMode);
    } catch (error) {
      console.error('Error toggling WiFi mode:', error);
    } finally {
      setLoadingState({ isLoading: false, message: '' });
    }
  };

  const menuItems: MenuItem[] = [
    {
      label: 'WiFi Device',
      key: 'device',
      isToggle: true,
      action: toggleWiFiDevice
    },
    {
      label: 'WiFi Mode',
      key: 'mode',
      isToggle: true,
      action: toggleWiFiMode,
      disabled: !isDeviceEnabled
    },
    {
      label: 'Back',
      key: 'back'
    }
  ];

  useHandleGestures({
    left() {
      if (!loadingState.isLoading) {
        let newIndex = selectedIndex - 1;
        while (newIndex >= 0) {
          if (!menuItems[newIndex].disabled) {
            setSelectedIndex(newIndex);
            break;
          }
          newIndex--;
        }
      }
    },
    right() {
      if (!loadingState.isLoading) {
        let newIndex = selectedIndex + 1;
        while (newIndex < menuItems.length) {
          if (!menuItems[newIndex].disabled) {
            setSelectedIndex(newIndex);
            break;
          }
          newIndex++;
        }
      }
    },
    async pressDown() {
      if (loadingState.isLoading) return;

      const currentItem = menuItems[selectedIndex];

      if (currentItem.disabled) return;

      if (currentItem.key === 'back') {
        onBack();
        return;
      }

      if (currentItem.action) {
        await currentItem.action();
      }
    }
  });

  return (
    <div className="bool-menu-screen">
      {loadingState.isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-message">{loadingState.message}</div>
        </div>
      )}
      <div className="bool-menu-items">
        {menuItems.map((item, index) => (
          <div
            key={item.key}
            className={`bool-menu-item ${selectedIndex === index ? 'selected' : ''} ${
              item.disabled ? 'disabled' : ''
            }`}
            style={{ opacity: item.disabled ? 0.5 : 1 }}
          >
            <div className="bool-menu-item-content">
              <div className="bool-menu-item-header">
                <span className="bool-menu-label">{item.label}</span>
                {item.isToggle && (
                  <div className="toggle-container">
                    {item.key === 'device' && (
                      <span
                        className={`mode-label ${!isDeviceEnabled ? 'active' : ''}`}
                      >
                        OFF
                      </span>
                    )}

                    {item.key === 'mode' && (
                      <span
                        className={`mode-label ${currentMode === 'CLIENT' ? 'active' : ''}`}
                      >
                        CLIENT
                      </span>
                    )}

                    <div
                      className={`bool-menu-toggle ${
                        item.key === 'mode' ? 'wifi-mode-toggle' : ''
                      } ${
                        (item.key === 'device' && isDeviceEnabled) ||
                        (item.key === 'mode' && currentMode === 'AP')
                          ? 'enabled'
                          : ''
                      }`}
                      style={{ opacity: item.disabled ? 0.5 : 1 }}
                    >
                      <div className="bool-menu-toggle-slider" />
                    </div>

                    {item.key === 'device' && (
                      <span
                        className={`mode-label ${isDeviceEnabled ? 'active' : ''}`}
                      >
                        ON
                      </span>
                    )}
                    {item.key === 'mode' && (
                      <span
                        className={`mode-label ${currentMode === 'AP' ? 'active' : ''}`}
                      >
                        AP
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
