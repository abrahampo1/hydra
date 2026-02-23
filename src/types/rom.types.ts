export type RomConsole =
  | "nes"
  | "snes"
  | "gb"
  | "gbc"
  | "gba"
  | "n64"
  | "nds"
  | "psx"
  | "genesis"
  | "gg"
  | "sms"
  | "atari2600"
  | "arcade";

export type EmulatorCore =
  | "nes"
  | "snes"
  | "gambatte"
  | "mgba"
  | "mupen64plus_next"
  | "desmume2015"
  | "pcsx_rearmed"
  | "genesis_plus_gx"
  | "mame2003"
  | "stella2014";

export interface RomConsoleInfo {
  name: string;
  core: EmulatorCore;
  extensions: string[];
  color: string;
  libretroSystem: string;
  folderNames: string[];
}

export interface RomEntry {
  id: string;
  title: string;
  filePath: string;
  console: RomConsole;
  fileSize: number;
  playTimeInMilliseconds: number;
  lastTimePlayed: string | null;
  favorite: boolean;
  thumbnailUrl: string | null;
  coverUrl: string | null;
  screenshotUrl: string | null;
  titleScreenUrl: string | null;
  fileHash: string | null;
}
