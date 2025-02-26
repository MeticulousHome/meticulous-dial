import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type InitialSettings = {
  countryLetter: string | null;
  country: string | null;
  motorHot: boolean;
};

export const initialState: InitialSettings = {
  countryLetter: null,
  country: null,
  motorHot: false
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setCountryLetter: (state, action: PayloadAction<string>) => {
      state.countryLetter = action.payload;
    },
    setCountry: (state, action: PayloadAction<string>) => {
      state.country = action.payload;
    },
    setMotorHot: (state, action: PayloadAction<boolean>) => {
      state.motorHot = action.payload;
    }
  }
});

export const { setCountryLetter, setCountry, setMotorHot } =
  settingsSlice.actions;
export default settingsSlice.reducer;
