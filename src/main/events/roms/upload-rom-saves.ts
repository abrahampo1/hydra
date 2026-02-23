import { RomSaveManager } from "@main/services";
import { registerEvent } from "../register-event";

const uploadRomSaves = async (_event: Electron.IpcMainInvokeEvent) => {
  return RomSaveManager.uploadSaves();
};

registerEvent("uploadRomSaves", uploadRomSaves);
