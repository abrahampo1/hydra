import { registerEvent } from "../register-event";
import { romsSublevel } from "@main/level";

const deleteRom = async (_event: Electron.IpcMainInvokeEvent, id: string) => {
  await romsSublevel.del(id);
};

registerEvent("deleteRom", deleteRom);
