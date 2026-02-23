import { registerEvent } from "../register-event";
import { romsSublevel } from "@main/level";
import { scrapeRom } from "@main/services";

const scrapeRomEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string,
  searchTitle: string
) => {
  const rom = await romsSublevel.get(id).catch(() => null);
  if (!rom) return null;

  const result = await scrapeRom(
    searchTitle,
    rom.console,
    rom.fileHash ?? null
  );
  if (!result) return null;

  const updated = {
    ...rom,
    coverUrl: result.coverUrl,
    screenshotUrl: result.screenshotUrl,
    titleScreenUrl: result.titleScreenUrl,
  };

  await romsSublevel.put(id, updated);
  return updated;
};

registerEvent("scrapeRom", scrapeRomEvent);
