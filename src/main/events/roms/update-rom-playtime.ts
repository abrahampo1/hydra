import { registerEvent } from "../register-event";
import { romsSublevel } from "@main/level";

const updateRomPlaytime = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string,
  deltaInMilliseconds: number
) => {
  const rom = await romsSublevel.get(id).catch(() => null);
  if (!rom) return;

  await romsSublevel.put(id, {
    ...rom,
    playTimeInMilliseconds: rom.playTimeInMilliseconds + deltaInMilliseconds,
    lastTimePlayed: new Date().toISOString(),
  });
};

registerEvent("updateRomPlaytime", updateRomPlaytime);
