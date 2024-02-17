import './quick-settings.css';
import { useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch } from '../store/hooks';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useSocket } from '../store/SocketManager';

const settings = [
  {
    key: 'wifi',
    label: 'wifi'
  },
  {
    key: 'power',
    label: 'power'
  },
  {
    key: 'idle',
    label: 'idle'
  },
  {
    key: 'setting',
    label: 'setting'
  },
  {
    key: 'sleep',
    label: 'sleep'
  }
] as const;

export function QuickSettings(): JSX.Element {
  const dispatch = useAppDispatch();

  const [activeIndex, setActiveIndex] = useState(0);
  const socket = useSocket();

  useHandleGestures({
    longTare() {
      dispatch(setBubbleDisplay({ visible: false, component: null }));
    },
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
    },
    click() {
      socket.emit('action', settings[activeIndex].key);
      dispatch(setBubbleDisplay({ visible: false, component: null }));
    }
  });

  return (
    <div className="main-quick-settings">
      <div className="quick-settings">
        {settings.map((setting, key) => {
          const isActive = key === activeIndex;
          return (
            <label className={`settings-item ${isActive ? 'active' : ''}`}>
              {setting.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
