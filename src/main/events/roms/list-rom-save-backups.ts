import { RomSaveManager } from "@main/services";
import { registerEvent } from "../register-event";

const listRomSaveBackups = async (_event: Electron.IpcMainInvokeEvent) => {
  return RomSaveManager.listSaveBackups();
};

registerEvent("listRomSaveBackups", listRomSaveBackups);
