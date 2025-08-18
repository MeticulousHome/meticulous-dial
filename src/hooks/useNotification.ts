import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../components/store/hooks';
import {
  loadNotifications,
  notificationSelector
} from '../components/store/features/notifications/notification-slice';
import {
  setScreen,
  setBubbleDisplay
} from '../components/store/features/screens/screens-slice';
import { routes } from '../navigation/routes';
export const useNotification = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(loadNotifications());
  }, [dispatch]);
};

export const useNotificationHandler = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(notificationSelector.selectAll);
  const screen = useAppSelector((state) => state.screen);

  useEffect(() => {
    const handleScreenChange = () => {
      if (notifications.length > 0 && screen.value !== 'notifications') {
        dispatch(setScreen('notifications'));
        dispatch(setBubbleDisplay({ visible: false, component: undefined }));
      }

      if (notifications.length === 0 && screen.value === 'notifications') {
        const targetScreen =
          !screen.prev || routes[screen.prev]?.ignoreAsPrevious
            ? 'profileHome'
            : screen.prev;

        dispatch(setScreen(targetScreen));
      }
    };

    handleScreenChange();
  }, [notifications, screen.value, dispatch, screen.prev]);
};
