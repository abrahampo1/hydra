import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { RomConsole, RomEntry } from "@types";

export interface RomsState {
  roms: RomEntry[];
  searchQuery: string;
  selectedConsole: RomConsole | null;
  isScanning: boolean;
  romsPath: string | null;
}

const initialState: RomsState = {
  roms: [],
  searchQuery: "",
  selectedConsole: null,
  isScanning: false,
  romsPath: null,
};

export const romsSlice = createSlice({
  name: "roms",
  initialState,
  reducers: {
    setRoms: (state, action: PayloadAction<RomEntry[]>) => {
      state.roms = action.payload;
    },
    setRomsSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSelectedConsole: (state, action: PayloadAction<RomConsole | null>) => {
      state.selectedConsole = action.payload;
    },
    setIsScanning: (state, action: PayloadAction<boolean>) => {
      state.isScanning = action.payload;
    },
    setRomsPath: (state, action: PayloadAction<string | null>) => {
      state.romsPath = action.payload;
    },
  },
});

export const {
  setRoms,
  setRomsSearchQuery,
  setSelectedConsole,
  setIsScanning,
  setRomsPath,
} = romsSlice.actions;
