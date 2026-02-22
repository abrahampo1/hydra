import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import * as tar from "tar";

import { db, gamesSublevel, levelKeys } from "@main/level";
import { backupsPath } from "@main/constants";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import { Ludusavi } from "./ludusavi";
import { CloudSync } from "./cloud-sync";
import type {
  GameShop,
  UserPreferences,
  GoogleDriveBackupArtifact,
} from "@types";

export class LocalBackupService {
  private static async getLocalBackupPath(): Promise<string> {
    const userPreferences = await db
      .get<string, UserPreferences | null>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => null);

    if (!userPreferences?.localBackupPath) {
      throw new Error("Local backup path is not configured");
    }

    return userPreferences.localBackupPath;
  }

  public static async uploadSaveGame(
    objectId: string,
    shop: GameShop,
    downloadOptionTitle: string | null,
    label?: string
  ) {
    const localBackupPath = await this.getLocalBackupPath();

    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));

    const backupDir = path.join(backupsPath, `${shop}-${objectId}`);

    await fs.promises
      .rm(backupDir, { recursive: true, force: true })
      .catch(() => {});

    await Ludusavi.backupGame(
      shop,
      objectId,
      backupDir,
      game?.winePrefixPath ?? null
    );

    const timestamp = Date.now();
    const fileName = `${shop}-${objectId}-${timestamp}.tar`;
    const destPath = path.join(localBackupPath, fileName);

    await fs.promises.mkdir(localBackupPath, { recursive: true });

    // Write tar directly to destination instead of temp + copy
    await tar.create(
      {
        gzip: false,
        file: destPath,
        cwd: backupDir,
      },
      ["."]
    );

    const metadata: Record<string, string> = {
      shop,
      objectId,
      hostname: os.hostname(),
      homeDir: CloudSync.getWindowsLikeUserProfilePath(
        game?.winePrefixPath ?? null
      ),
      platform: process.platform,
    };

    if (game?.winePrefixPath) {
      metadata.winePrefixPath = await fs.promises.realpath(game.winePrefixPath);
    }

    if (downloadOptionTitle) {
      metadata.downloadOptionTitle = downloadOptionTitle;
    }

    if (label) {
      metadata.label = label;
    }

    const metaPath = path.join(localBackupPath, `${fileName}.meta.json`);
    await fs.promises.writeFile(metaPath, JSON.stringify(metadata));

    // Clean up backup dir in background
    fs.promises
      .rm(backupDir, { recursive: true, force: true })
      .catch((error) => {
        logger.error("Failed to remove backup path", { backupDir, error });
      });

    WindowManager.mainWindow?.webContents.send(
      `on-upload-complete-${objectId}-${shop}`,
      true
    );
  }

  public static async listBackups(
    objectId: string,
    shop: GameShop
  ): Promise<GoogleDriveBackupArtifact[]> {
    const localBackupPath = await this.getLocalBackupPath();

    const prefix = `${shop}-${objectId}-`;

    let files: string[];
    try {
      files = await fs.promises.readdir(localBackupPath);
    } catch {
      return [];
    }

    const tarFiles = files.filter(
      (f) => f.startsWith(prefix) && f.endsWith(".tar")
    );

    if (tarFiles.length === 0) return [];

    // Process all files in parallel instead of sequentially
    const results = await Promise.all(
      tarFiles.map(async (tarFile) => {
        const metaPath = path.join(localBackupPath, `${tarFile}.meta.json`);
        const tarPath = path.join(localBackupPath, tarFile);

        const [metaResult, statResult] = await Promise.allSettled([
          fs.promises.readFile(metaPath, "utf-8"),
          fs.promises.stat(tarPath),
        ]);

        if (statResult.status === "rejected") return null;

        const stat = statResult.value;
        let parsedMeta: Record<string, string> = {};
        if (metaResult.status === "fulfilled") {
          try {
            parsedMeta = JSON.parse(metaResult.value);
          } catch {
            // Invalid JSON, use defaults
          }
        }

        const artifact: GoogleDriveBackupArtifact = {
          id: tarFile,
          name: tarFile,
          size: stat.size,
          createdAt: new Date(stat.mtimeMs).toISOString(),
          modifiedAt: new Date(stat.mtimeMs).toISOString(),
          gameObjectId: parsedMeta.objectId ?? objectId,
          gameShop: parsedMeta.shop ?? shop,
          label: parsedMeta.label ?? null,
        };

        return artifact;
      })
    );

    return results
      .filter((r): r is GoogleDriveBackupArtifact => r !== null)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  public static async downloadBackup(
    objectId: string,
    shop: GameShop,
    fileName: string
  ) {
    const localBackupPath = await this.getLocalBackupPath();

    const tarPath = path.join(localBackupPath, fileName);
    const metaPath = path.join(localBackupPath, `${fileName}.meta.json`);
    const backupDir = path.join(backupsPath, `${shop}-${objectId}`);

    let metadata: Record<string, string> = {};
    try {
      const metaContent = await fs.promises.readFile(metaPath, "utf-8");
      metadata = JSON.parse(metaContent);
    } catch {
      // Meta file may not exist
    }

    await fs.promises
      .rm(backupDir, { recursive: true, force: true })
      .catch(() => {});
    await fs.promises.mkdir(backupDir, { recursive: true });

    await tar.x({
      file: tarPath,
      cwd: backupDir,
    });

    const { restoreLudusaviBackup } = await import(
      "@main/helpers/restore-backup"
    );
    const { normalizePath } = await import("@main/helpers");

    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));

    await restoreLudusaviBackup(
      backupDir,
      objectId,
      normalizePath(metadata.homeDir ?? ""),
      game?.winePrefixPath,
      metadata.winePrefixPath ?? null
    );

    WindowManager.mainWindow?.webContents.send(
      `on-backup-download-complete-${objectId}-${shop}`,
      true
    );
  }

  public static async deleteBackup(fileName: string) {
    const localBackupPath = await this.getLocalBackupPath();

    const tarPath = path.join(localBackupPath, fileName);
    const metaPath = path.join(localBackupPath, `${fileName}.meta.json`);

    await Promise.allSettled([
      fs.promises.unlink(tarPath),
      fs.promises.unlink(metaPath),
    ]);
  }
}
