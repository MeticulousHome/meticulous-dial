import {
  createEntityAdapter,
  createSlice,
  PayloadAction
} from '@reduxjs/toolkit';
import { RootState } from '../../store';

type ResponseOption = 'Update' | 'Auto Update' | 'Skip';

export const MOTOR_HOT_KEY = 'motor_hot;';
export const MOTOR_COLD_KEY = 'motor_cold;';

export interface NotificationItem {
  id: string;
  message: string;
  image?: string;
  responses: ResponseOption[];
  timestamp: Date;
}

const notificationAdapter = createEntityAdapter({
  selectId: (notification: NotificationItem) => notification.id
});

interface NotificationState
  extends ReturnType<typeof notificationAdapter.getInitialState> {
  motorHot: boolean;
}

const initialState: NotificationState = {
  ...notificationAdapter.getInitialState(),
  motorHot: false
};

export const cleanMessage = (message: string, key: string | null): string =>
  key ? message.replace(key, '').trim() : message;

export const processNotification = (
  notification: NotificationItem
): {
  updatedNotification: NotificationItem;
  isMotorHot: boolean | null;
  detectedKey: string | null;
} => {
  const motorStateMap: Record<string, boolean> = {
    [MOTOR_HOT_KEY]: true,
    [MOTOR_COLD_KEY]: false
  };

  const keys = Object.keys(motorStateMap);

  const detectedKey =
    keys.find((key) => notification.message.includes(key)) || null;

  const isMotorHot = detectedKey ? motorStateMap[detectedKey] : null;

  const updatedNotification: NotificationItem = {
    ...notification,
    message: cleanMessage(notification.message, detectedKey)
  };

  return { updatedNotification, isMotorHot, detectedKey };
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addOneNotification: notificationAdapter.upsertOne,
    removeOneNotification: notificationAdapter.removeOne,
    removeAllNotications: notificationAdapter.removeAll,
    setMotorHot: (state, action: PayloadAction<boolean>) => {
      state.motorHot = action.payload;
    }
  }
});

export const {
  addOneNotification,
  removeOneNotification,
  removeAllNotications,
  setMotorHot
} = notificationSlice.actions;

export const notificationSelector = {
  ...notificationAdapter.getSelectors<RootState>(
    (state) => state.notifications
  ),
  selectMotorHot: (state: RootState) => state.notifications.motorHot,
  selectHasNotifications: (state: RootState) =>
    notificationAdapter
      .getSelectors<RootState>((s) => s.notifications)
      .selectTotal(state) > 0
};

export default notificationSlice.reducer;
