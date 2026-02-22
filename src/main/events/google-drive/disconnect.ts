import { GoogleDriveService } from "@main/services";
import { registerEvent } from "../register-event";

const disconnect = async (_event: Electron.IpcMainInvokeEvent) => {
  return GoogleDriveService.disconnect();
};

registerEvent("googleDriveDisconnect", disconnect);
