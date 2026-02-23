import { RomSaveManager } from "@main/services";
import { registerEvent } from "../register-event";

const deleteRomSaveBackup = async (
  _event: Electron.IpcMainInvokeEvent,
  fileName: string
) => {
  return RomSaveManager.deleteBackup(fileName);
};

registerEvent("deleteRomSaveBackup", deleteRomSaveBackup);
