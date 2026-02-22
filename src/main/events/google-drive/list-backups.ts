import { GoogleDriveService } from "@main/services";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const listBackups = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop
) => {
  return GoogleDriveService.listBackups(objectId, shop);
};

registerEvent("googleDriveListBackups", listBackups);
