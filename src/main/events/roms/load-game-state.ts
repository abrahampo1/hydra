import { RomSaveManager } from "@main/services";
import { registerEvent } from "../register-event";

const loadGameState = async (
  _event: Electron.IpcMainInvokeEvent,
  romId: string,
  slot: number
) => {
  const data = await RomSaveManager.loadGameState(romId, slot);
  if (!data) return null;
  return Array.from(data);
};

registerEvent("loadGameState", loadGameState);
