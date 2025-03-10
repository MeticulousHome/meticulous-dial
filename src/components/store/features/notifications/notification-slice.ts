import {
  createEntityAdapter,
  createSlice,
  PayloadAction,
  createAsyncThunk
} from '@reduxjs/toolkit';
import { RootState } from '../../store';
import { api } from '../../../../api/api';
import { APIError } from '@meticulous-home/espresso-api/dist';

type ResponseOption = 'Update' | 'Auto Update' | 'Skip';

export const MOTOR_HOT_KEY = 'motor_hot';
export const MOTOR_COLD_KEY = 'motor_cold';

export interface NotificationItem {
  id: string;
  message: string;
  image?: string;
  responses: ResponseOption[];
  timestamp: Date;
}

export const loadNotifications = createAsyncThunk(
  'notificationData/loadNotifications',
  async () => {
    const notifications = (await api.getNotifications(false)).data;

    if ((notifications as APIError)?.error) {
      throw new Error((notifications as APIError).error);
    }

    if (notifications == undefined) {
      throw new Error('No notifications found');
    }

    return notifications as unknown as NotificationItem[];
  }
);

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
    /*When the firmware is updated, two notifications are sent. 
      It is literally impossible to click "Accept" on the first one because the mechanism responsible for gestures is not active.
      When the second notification is displayed, the first one disappears but is not removed, leaving it lagging behind and keeping it in the notifications array.
      To avoid that, before adding a new notification, we will clear any previous ones that may have been left behind.
    */
    addOneNotification: (state, action) => {
      notificationAdapter.removeAll(state);
      notificationAdapter.upsertOne(state, action.payload);
    },
    removeOneNotification: notificationAdapter.removeOne,
    removeAllNotications: notificationAdapter.removeAll,
    setMotorHot: (state, action: PayloadAction<boolean>) => {
      state.motorHot = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(loadNotifications.fulfilled, (state, action) => {
      notificationAdapter.setAll(state, action.payload);
    });
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
