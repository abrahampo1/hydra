import path from "node:path";
import fs from "node:fs";

import { getDownloadsPath } from "../helpers/get-downloads-path";
import { logger } from "@main/services";
import { registerEvent } from "../register-event";
import { GameShop } from "@types";
import { downloadsSublevel, gamesSublevel, levelKeys } from "@main/level";

const deleteGameInstaller = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
): Promise<{ ok: boolean; reason?: string }> => {
  const gameKey = levelKeys.game(shop, objectId);
  const download = await downloadsSublevel.get(gameKey);

  if (!download || !download.folderName) {
    return { ok: false, reason: "no_installer" };
  }

  const installerPath = path.join(
    download.downloadPath ?? (await getDownloadsPath()),
    download.folderName
  );

  if (!fs.existsSync(installerPath)) {
    const game = await gamesSublevel.get(gameKey);
    if (game) {
      await gamesSublevel.put(gameKey, {
        ...game,
        installerSizeInBytes: null,
      });
    }
    return { ok: true };
  }

  const game = await gamesSublevel.get(gameKey);
  if (!game) {
    return { ok: false, reason: "no_game" };
  }

  // Check if the game executable is inside the installer folder
  if (game.executablePath) {
    const normalizedExePath = path.normalize(game.executablePath);
    const normalizedInstallerPath = path.normalize(installerPath);

    if (
      normalizedExePath
        .toLowerCase()
        .startsWith(normalizedInstallerPath.toLowerCase() + path.sep) ||
      normalizedExePath.toLowerCase() === normalizedInstallerPath.toLowerCase()
    ) {
      return { ok: false, reason: "executable_inside_installer" };
    }
  }

  try {
    await fs.promises.rm(installerPath, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });

    const metaPath = `${installerPath}.meta`;
    if (fs.existsSync(metaPath)) {
      await fs.promises.rm(metaPath, { force: true });
    }

    await gamesSublevel.put(gameKey, {
      ...game,
      installerSizeInBytes: null,
    });

    logger.info(`Deleted installer for ${game.title} at ${installerPath}`);

    return { ok: true };
  } catch (err) {
    logger.error(`Failed to delete installer for ${game.title}`, err);
    return { ok: false, reason: "delete_failed" };
  }
};

registerEvent("deleteGameInstaller", deleteGameInstaller);
