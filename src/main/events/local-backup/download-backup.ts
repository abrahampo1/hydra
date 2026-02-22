import { LocalBackupService } from "@main/services";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const downloadBackup = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  fileName: string
) => {
  return LocalBackupService.downloadBackup(objectId, shop, fileName);
};

registerEvent("localBackupDownloadBackup", downloadBackup);
