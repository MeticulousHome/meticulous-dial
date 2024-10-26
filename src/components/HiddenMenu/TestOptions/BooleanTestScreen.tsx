import { useState } from 'react';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import './BooleanTestScreen.css';

interface BooleanTestScreenProps {
  title: string;
  initialValue: boolean;
  onToggle: (value: boolean) => Promise<void>;
  onBack: () => void;
}

export function BooleanTestScreen({
  title,
  initialValue,
  onToggle,
  onBack
}: BooleanTestScreenProps): JSX.Element {
  const [isEnabled, setIsEnabled] = useState(initialValue);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuItems = [
    { label: title, isToggle: true },
    { label: 'Back', isToggle: false }
  ];

  useHandleGestures({
    left() {
      if (!isProcessing) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
    },
    right() {
      if (!isProcessing) {
        setSelectedIndex((prev) => Math.min(menuItems.length - 1, prev + 1));
      }
    },
    async pressDown() {
      if (isProcessing) return;

      const currentItem = menuItems[selectedIndex];

      if (currentItem.isToggle) {
        try {
          setIsProcessing(true);
          const newValue = !isEnabled;
          setIsEnabled(newValue);
          await onToggle(newValue);
        } catch (error) {
          console.error(`Error toggling ${title}:`, error);
          setIsEnabled(isEnabled);
        } finally {
          setIsProcessing(false);
        }
      } else {
        onBack();
      }
    }
  });

  return (
    <div className="bool-menu-screen">
      <div className="bool-menu-items">
        {menuItems.map((item, index) => (
          <div
            key={item.label}
            className={`bool-menu-item ${selectedIndex === index ? 'selected' : ''}`}
          >
            <div className="bool-menu-item-content">
              <div className="bool-menu-item-header">
                <span className="bool-menu-label">{item.label}</span>
                {item.isToggle && (
                  <div className="toggle-container">
                    <span
                      className={`mode-label ${!isEnabled ? 'active' : ''}`}
                    >
                      OFF
                    </span>
                    <div
                      className={`bool-menu-toggle ${isEnabled ? 'enabled' : ''}`}
                    >
                      <div className="bool-menu-toggle-slider" />
                    </div>
                    <span className={`mode-label ${isEnabled ? 'active' : ''}`}>
                      ON
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {isProcessing && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-message">Processing...</div>
        </div>
      )}
    </div>
  );
}
