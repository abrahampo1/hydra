import { RomSaveManager } from "@main/services";
import { registerEvent } from "../register-event";

const saveGameState = async (
  _event: Electron.IpcMainInvokeEvent,
  romId: string,
  slot: number,
  data: number[]
) => {
  await RomSaveManager.saveGameState(romId, slot, Buffer.from(data));
};

registerEvent("saveGameState", saveGameState);
