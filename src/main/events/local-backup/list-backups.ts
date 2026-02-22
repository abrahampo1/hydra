import { LocalBackupService } from "@main/services";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const listBackups = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop
) => {
  return LocalBackupService.listBackups(objectId, shop);
};

registerEvent("localBackupListBackups", listBackups);
