import { GoogleDriveService } from "@main/services";
import { registerEvent } from "../register-event";

const getConnectionStatus = async (_event: Electron.IpcMainInvokeEvent) => {
  return GoogleDriveService.getConnectionStatus();
};

registerEvent("googleDriveGetConnectionStatus", getConnectionStatus);
