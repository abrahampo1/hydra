import { GoogleDriveService } from "@main/services";
import { registerEvent } from "../register-event";

const deleteBackup = async (
  _event: Electron.IpcMainInvokeEvent,
  fileId: string
) => {
  return GoogleDriveService.deleteBackup(fileId);
};

registerEvent("googleDriveDeleteBackup", deleteBackup);
