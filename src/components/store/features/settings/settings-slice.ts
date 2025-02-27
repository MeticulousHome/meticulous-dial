import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type InitialSettings = {
  countryLetter: string | null;
  country: string | null;
};

export const initialState: InitialSettings = {
  countryLetter: null,
  country: null
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
    }
  }
});

export const { setCountryLetter, setCountry } = settingsSlice.actions;
export default settingsSlice.reducer;
