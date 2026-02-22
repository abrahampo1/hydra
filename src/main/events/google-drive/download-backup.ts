import { GoogleDriveService } from "@main/services";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const downloadBackup = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  fileId: string
) => {
  return GoogleDriveService.downloadBackup(objectId, shop, fileId);
};

registerEvent("googleDriveDownloadBackup", downloadBackup);
