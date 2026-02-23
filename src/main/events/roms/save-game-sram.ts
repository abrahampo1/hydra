import { RomSaveManager } from "@main/services";
import { registerEvent } from "../register-event";

const saveGameSRAM = async (
  _event: Electron.IpcMainInvokeEvent,
  romId: string,
  data: number[]
) => {
  await RomSaveManager.saveGameSRAM(romId, Buffer.from(data));
};

registerEvent("saveGameSRAM", saveGameSRAM);
