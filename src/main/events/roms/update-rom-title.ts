import { registerEvent } from "../register-event";
import { romsSublevel } from "@main/level";

const updateRomTitle = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string,
  newTitle: string
) => {
  const rom = await romsSublevel.get(id).catch(() => null);
  if (!rom) return null;

  const updated = { ...rom, title: newTitle };
  await romsSublevel.put(id, updated);
  return updated;
};

registerEvent("updateRomTitle", updateRomTitle);
