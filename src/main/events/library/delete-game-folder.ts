import path from "node:path";
import fs from "node:fs";

import { getDownloadsPath } from "../helpers/get-downloads-path";
import { logger } from "@main/services";
import { registerEvent } from "../register-event";
import { GameShop } from "@types";
import { downloadsSublevel, gamesSublevel, levelKeys } from "@main/level";

const deleteGameFolder = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
): Promise<void> => {
  const gameKey = levelKeys.game(shop, objectId);

  const deleteFile = async (filePath: string, isDirectory = false) => {
    if (fs.existsSync(filePath)) {
      await new Promise<void>((resolve, reject) => {
        fs.rm(
          filePath,
          {
            recursive: isDirectory,
            force: true,
            maxRetries: 5,
            retryDelay: 200,
          },
          (error) => {
            if (error) {
              logger.error(error);
              reject();
            }
            resolve();
          }
        );
      });
    }
  };

  const download = await downloadsSublevel.get(gameKey);

  if (download?.folderName) {
    const folderPath = path.join(
      download.downloadPath ?? (await getDownloadsPath()),
      download.folderName
    );

    const metaPath = `${folderPath}.meta`;

    await deleteFile(folderPath, true);
    await deleteFile(metaPath);
  }

  if (download) {
    await downloadsSublevel.del(gameKey);
  }

  const game = await gamesSublevel.get(gameKey);
  if (!game) return;

  if (game.executablePath) {
    const installedDir = path.dirname(game.executablePath);
    await deleteFile(installedDir, true);
  }

  await gamesSublevel.put(gameKey, {
    ...game,
    installerSizeInBytes: null,
    installedSizeInBytes: null,
    executablePath: null,
  });
};

registerEvent("deleteGameFolder", deleteGameFolder);
