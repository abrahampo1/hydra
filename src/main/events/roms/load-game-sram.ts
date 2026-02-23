import { RomSaveManager } from "@main/services";
import { registerEvent } from "../register-event";

const loadGameSRAM = async (
  _event: Electron.IpcMainInvokeEvent,
  romId: string
) => {
  const data = await RomSaveManager.loadGameSRAM(romId);
  if (!data) return null;
  return Array.from(data);
};

registerEvent("loadGameSRAM", loadGameSRAM);
