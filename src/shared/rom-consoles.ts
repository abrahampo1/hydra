import type { RomConsole, RomConsoleInfo } from "@types";

export const ROM_CONSOLES: Record<RomConsole, RomConsoleInfo> = {
  nes: {
    name: "Nintendo (NES)",
    core: "nes",
    extensions: [".nes", ".unf", ".unif"],
    color: "#e60012",
    libretroSystem: "Nintendo - Nintendo Entertainment System",
    folderNames: ["nes", "famicom", "fc"],
  },
  snes: {
    name: "Super Nintendo (SNES)",
    core: "snes",
    extensions: [".smc", ".sfc", ".fig"],
    color: "#7b7db5",
    libretroSystem: "Nintendo - Super Nintendo Entertainment System",
    folderNames: ["snes", "super nintendo", "sfc", "super famicom"],
  },
  gb: {
    name: "Game Boy",
    core: "gambatte",
    extensions: [".gb"],
    color: "#8bac0f",
    libretroSystem: "Nintendo - Game Boy",
    folderNames: ["gb", "gameboy", "game boy"],
  },
  gbc: {
    name: "Game Boy Color",
    core: "gambatte",
    extensions: [".gbc"],
    color: "#6638a8",
    libretroSystem: "Nintendo - Game Boy Color",
    folderNames: ["gbc", "game boy color", "gameboycolor"],
  },
  gba: {
    name: "Game Boy Advance",
    core: "mgba",
    extensions: [".gba"],
    color: "#4a03ad",
    libretroSystem: "Nintendo - Game Boy Advance",
    folderNames: ["gba", "game boy advance", "gameboyadvance"],
  },
  n64: {
    name: "Nintendo 64",
    core: "mupen64plus_next",
    extensions: [".n64", ".z64", ".v64"],
    color: "#008000",
    libretroSystem: "Nintendo - Nintendo 64",
    folderNames: ["n64", "nintendo 64", "nintendo64"],
  },
  nds: {
    name: "Nintendo DS",
    core: "desmume2015",
    extensions: [".nds"],
    color: "#c8c8c8",
    libretroSystem: "Nintendo - Nintendo DS",
    folderNames: ["nds", "ds", "nintendo ds"],
  },
  psx: {
    name: "PlayStation",
    core: "pcsx_rearmed",
    extensions: [".bin", ".cue", ".img", ".pbp", ".chd"],
    color: "#003087",
    libretroSystem: "Sony - PlayStation",
    folderNames: ["psx", "ps1", "playstation", "psone"],
  },
  genesis: {
    name: "Genesis / Mega Drive",
    core: "genesis_plus_gx",
    extensions: [".gen", ".md", ".smd"],
    color: "#1a1a2e",
    libretroSystem: "Sega - Mega Drive - Genesis",
    folderNames: ["genesis", "megadrive", "mega drive", "md", "sega genesis"],
  },
  gg: {
    name: "Game Gear",
    core: "genesis_plus_gx",
    extensions: [".gg"],
    color: "#1a1a1a",
    libretroSystem: "Sega - Game Gear",
    folderNames: ["gg", "gamegear", "game gear"],
  },
  sms: {
    name: "Master System",
    core: "genesis_plus_gx",
    extensions: [".sms"],
    color: "#c00",
    libretroSystem: "Sega - Master System - Mark III",
    folderNames: ["sms", "mastersystem", "master system"],
  },
  atari2600: {
    name: "Atari 2600",
    core: "stella2014",
    extensions: [".a26", ".bin"],
    color: "#6b3a1f",
    libretroSystem: "Atari - 2600",
    folderNames: ["atari2600", "atari 2600", "2600", "atari"],
  },
  arcade: {
    name: "Arcade",
    core: "mame2003",
    extensions: [".zip"],
    color: "#ff6600",
    libretroSystem: "MAME",
    folderNames: ["arcade", "mame", "fba", "fbneo"],
  },
};

export const EXTENSION_TO_CONSOLE: Record<string, RomConsole> = {};

for (const [consoleId, info] of Object.entries(ROM_CONSOLES)) {
  for (const ext of info.extensions) {
    /* .bin and .zip are ambiguous; first match wins (psx, arcade) */
    if (!EXTENSION_TO_CONSOLE[ext]) {
      EXTENSION_TO_CONSOLE[ext] = consoleId as RomConsole;
    }
  }
}

/** Maps lowercase folder names to console IDs for folder-based detection */
export const FOLDER_TO_CONSOLE: Record<string, RomConsole> = {};

for (const [consoleId, info] of Object.entries(ROM_CONSOLES)) {
  for (const folderName of info.folderNames) {
    FOLDER_TO_CONSOLE[folderName] = consoleId as RomConsole;
  }
}

const LIBRETRO_THUMBNAILS_BASE = "https://thumbnails.libretro.com";

/** Build a libretro thumbnail URL for a given ROM title and console */
export const getLibretroThumbnailUrl = (
  consoleId: RomConsole,
  title: string
): string => {
  const info = ROM_CONSOLES[consoleId];
  if (!info) return "";

  /* libretro uses the game name with some chars replaced */
  const safeName = title
    .replace(/&/g, "_")
    .replace(/\//g, "_")
    .replace(/\\/g, "_")
    .replace(/:/g, "_")
    .replace(/\*/g, "_")
    .replace(/\?/g, "_")
    .replace(/"/g, "_")
    .replace(/</g, "_")
    .replace(/>/g, "_")
    .replace(/\|/g, "_");

  const encodedSystem = encodeURIComponent(info.libretroSystem);
  const encodedName = encodeURIComponent(safeName);

  return `${LIBRETRO_THUMBNAILS_BASE}/${encodedSystem}/Named_Boxarts/${encodedName}.png`;
};

/** Build a libretro snapshot URL for a given ROM title and console */
export const getLibretroSnapshotUrl = (
  consoleId: RomConsole,
  title: string
): string => {
  const info = ROM_CONSOLES[consoleId];
  if (!info) return "";

  const safeName = title
    .replace(/&/g, "_")
    .replace(/\//g, "_")
    .replace(/\\/g, "_")
    .replace(/:/g, "_")
    .replace(/\*/g, "_")
    .replace(/\?/g, "_")
    .replace(/"/g, "_")
    .replace(/</g, "_")
    .replace(/>/g, "_")
    .replace(/\|/g, "_");

  const encodedSystem = encodeURIComponent(info.libretroSystem);
  const encodedName = encodeURIComponent(safeName);

  return `${LIBRETRO_THUMBNAILS_BASE}/${encodedSystem}/Named_Snaps/${encodedName}.png`;
};

/** Build a libretro title screen URL for a given ROM title and console */
export const getLibretroTitleScreenUrl = (
  consoleId: RomConsole,
  title: string
): string => {
  const info = ROM_CONSOLES[consoleId];
  if (!info) return "";

  const safeName = title
    .replace(/&/g, "_")
    .replace(/\//g, "_")
    .replace(/\\/g, "_")
    .replace(/:/g, "_")
    .replace(/\*/g, "_")
    .replace(/\?/g, "_")
    .replace(/"/g, "_")
    .replace(/</g, "_")
    .replace(/>/g, "_")
    .replace(/\|/g, "_");

  const encodedSystem = encodeURIComponent(info.libretroSystem);
  const encodedName = encodeURIComponent(safeName);

  return `${LIBRETRO_THUMBNAILS_BASE}/${encodedSystem}/Named_Titles/${encodedName}.png`;
};
