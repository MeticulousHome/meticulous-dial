import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { RootState } from '../../store';

type ResponseOption = 'Update' | 'Auto Update' | 'Skip';

export interface NotificationItem {
  id: string;
  message: string;
  image?: string;
  responses: ResponseOption[];
  timestamp: Date;
}

const notificationAdapter = createEntityAdapter<NotificationItem>({
  selectId: (notification) => notification.id
});

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: notificationAdapter.getInitialState(),
  reducers: {
    addOneNotification: notificationAdapter.upsertOne,
    removeOneNotification: notificationAdapter.removeOne,
    removeAllNotications: notificationAdapter.removeAll
  }
});

export const {
  addOneNotification,
  removeOneNotification,
  removeAllNotications
} = notificationSlice.actions;

export const notificationSelector = notificationAdapter.getSelectors<RootState>(
  (state) => state.notifications
);

export default notificationSlice.reducer;
