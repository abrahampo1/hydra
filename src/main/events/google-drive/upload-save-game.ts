import { GoogleDriveService } from "@main/services";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const uploadSaveGame = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  downloadOptionTitle: string | null
) => {
  return GoogleDriveService.uploadSaveGame(objectId, shop, downloadOptionTitle);
};

registerEvent("googleDriveUploadSaveGame", uploadSaveGame);
