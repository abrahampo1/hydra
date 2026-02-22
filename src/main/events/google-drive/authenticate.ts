import { GoogleDriveService } from "@main/services";
import { registerEvent } from "../register-event";

const authenticate = async (_event: Electron.IpcMainInvokeEvent) => {
  return GoogleDriveService.authenticate();
};

registerEvent("googleDriveAuthenticate", authenticate);
