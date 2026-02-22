import { LocalBackupService } from "@main/services";
import { registerEvent } from "../register-event";

const deleteBackup = async (
  _event: Electron.IpcMainInvokeEvent,
  fileName: string
) => {
  return LocalBackupService.deleteBackup(fileName);
};

registerEvent("localBackupDeleteBackup", deleteBackup);
