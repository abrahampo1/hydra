import { LocalBackupService } from "@main/services";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const uploadSaveGame = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  downloadOptionTitle: string | null
) => {
  return LocalBackupService.uploadSaveGame(objectId, shop, downloadOptionTitle);
};

registerEvent("localBackupUploadSaveGame", uploadSaveGame);
