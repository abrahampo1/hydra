import { registerEvent } from "../register-event";
import { romsSublevel } from "@main/level";
import type { RomEntry } from "@types";

const getRoms = async (_event: Electron.IpcMainInvokeEvent) => {
  const roms: RomEntry[] = [];
  for await (const value of romsSublevel.values()) {
    roms.push(value);
  }
  return roms;
};

registerEvent("getRoms", getRoms);
