import { RomSaveManager } from "@main/services";
import { registerEvent } from "../register-event";

const downloadRomSaves = async (
  _event: Electron.IpcMainInvokeEvent,
  artifactId: string
) => {
  return RomSaveManager.downloadSaves(artifactId);
};

registerEvent("downloadRomSaves", downloadRomSaves);
