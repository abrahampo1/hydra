import { registerEvent } from "../register-event";
import { romsSublevel } from "@main/level";

const toggleRomFavorite = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string
) => {
  const rom = await romsSublevel.get(id).catch(() => null);
  if (!rom) return;

  await romsSublevel.put(id, {
    ...rom,
    favorite: !rom.favorite,
  });

  return !rom.favorite;
};

registerEvent("toggleRomFavorite", toggleRomFavorite);
