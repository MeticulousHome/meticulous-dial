import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { RootState } from '../../store';

export interface ProfileImageItem {
  presetId: number;
  image: string;
  borderColor: string;
}

export const imageProfileAdapter = createEntityAdapter<ProfileImageItem>({
  selectId: (preset) => preset.presetId
});

const profileImageSlice = createSlice({
  name: 'tmp-profile-images',
  initialState: imageProfileAdapter.getInitialState(),
  reducers: {
    addNewImageProfile: imageProfileAdapter.addOne
  }
});

export const { addNewImageProfile } = profileImageSlice.actions;

export const { selectById: selectByProfileId } =
  imageProfileAdapter.getSelectors<RootState>((state) => state.images);

export default profileImageSlice.reducer;
