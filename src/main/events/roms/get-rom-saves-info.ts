import { RomSaveManager } from "@main/services";
import { registerEvent } from "../register-event";

const getRomSavesInfo = async (_event: Electron.IpcMainInvokeEvent) => {
  return RomSaveManager.getSavesSize();
};

registerEvent("getRomSavesInfo", getRomSavesInfo);
