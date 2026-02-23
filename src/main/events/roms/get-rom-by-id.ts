import { registerEvent } from "../register-event";
import { romsSublevel } from "@main/level";

const getRomById = async (_event: Electron.IpcMainInvokeEvent, id: string) => {
  return romsSublevel.get(id).catch(() => null);
};

registerEvent("getRomById", getRomById);
