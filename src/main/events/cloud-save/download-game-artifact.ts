import { HydraApi, logger, WindowManager } from "@main/services";
import fs from "node:fs";
import * as tar from "tar";
import { registerEvent } from "../register-event";
import axios from "axios";
import path from "node:path";
import { backupsPath } from "@main/constants";
import type { GameShop } from "@types";

import { normalizePath } from "@main/helpers";
import { restoreLudusaviBackup } from "@main/helpers/restore-backup";
import { SystemPath } from "@main/services/system-path";
import { gamesSublevel, levelKeys } from "@main/level";

const downloadGameArtifact = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  gameArtifactId: string
) => {
  try {
    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));

    const {
      downloadUrl,
      objectKey,
      homeDir,
      winePrefixPath: artifactWinePrefixPath,
    } = await HydraApi.post<{
      downloadUrl: string;
      objectKey: string;
      homeDir: string;
      winePrefixPath: string | null;
    }>(`/profile/games/artifacts/${gameArtifactId}/download`);

    const zipLocation = path.join(SystemPath.getPath("userData"), objectKey);
    const backupPath = path.join(backupsPath, `${shop}-${objectId}`);

    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, {
        recursive: true,
        force: true,
      });
    }

    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      onDownloadProgress: (progressEvent) => {
        WindowManager.mainWindow?.webContents.send(
          `on-backup-download-progress-${objectId}-${shop}`,
          progressEvent
        );
      },
    });

    const writer = fs.createWriteStream(zipLocation);

    response.data.pipe(writer);

    writer.on("error", (err) => {
      logger.error("Failed to write tar file", err);
      throw err;
    });

    fs.mkdirSync(backupPath, { recursive: true });

    writer.on("close", async () => {
      await tar.x({
        file: zipLocation,
        cwd: backupPath,
      });

      await restoreLudusaviBackup(
        backupPath,
        objectId,
        normalizePath(homeDir),
        game?.winePrefixPath,
        artifactWinePrefixPath
      );

      WindowManager.mainWindow?.webContents.send(
        `on-backup-download-complete-${objectId}-${shop}`,
        true
      );
    });
  } catch (err) {
    logger.error("Failed to download game artifact", err);

    WindowManager.mainWindow?.webContents.send(
      `on-backup-download-complete-${objectId}-${shop}`,
      false
    );
  }
};

registerEvent("downloadGameArtifact", downloadGameArtifact);
