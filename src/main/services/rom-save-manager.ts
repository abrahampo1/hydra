import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import * as tar from "tar";
import crypto from "node:crypto";

import { backupsPath } from "@main/constants";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import { SystemPath } from "./system-path";
import { db, levelKeys } from "@main/level";
import type { UserPreferences, GoogleDriveBackupArtifact } from "@types";

const ROM_SAVES_PREFIX = "rom-saves";

export class RomSaveManager {
  /** Returns the base directory for per-game save files */
  private static getGameSavesDir(romId: string): string {
    const userData = SystemPath.getPath("userData");
    return path.join(userData, "rom-saves", romId);
  }

  /** Save SRAM data for a specific game */
  public static async saveGameSRAM(romId: string, data: Buffer): Promise<void> {
    const dir = this.getGameSavesDir(romId);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, "sram.sav"), data);
  }

  /** Load SRAM data for a specific game */
  public static async loadGameSRAM(romId: string): Promise<Buffer | null> {
    const savePath = path.join(this.getGameSavesDir(romId), "sram.sav");
    try {
      return await fs.promises.readFile(savePath);
    } catch {
      return null;
    }
  }

  /** Save a state snapshot for a specific game and slot */
  public static async saveGameState(
    romId: string,
    slot: number,
    data: Buffer
  ): Promise<void> {
    const dir = this.getGameSavesDir(romId);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, `state-${slot}.state`), data);
  }

  /** Load a state snapshot for a specific game and slot */
  public static async loadGameState(
    romId: string,
    slot: number
  ): Promise<Buffer | null> {
    const statePath = path.join(
      this.getGameSavesDir(romId),
      `state-${slot}.state`
    );
    try {
      return await fs.promises.readFile(statePath);
    } catch {
      return null;
    }
  }

  /** Returns the path where Electron stores IndexedDB for the emulator-data:// origin */
  public static getEmulatorSavesPath(): string {
    const userData = SystemPath.getPath("userData");
    return path.join(
      userData,
      "IndexedDB",
      "emulator-data_data_0.indexeddb.leveldb"
    );
  }

  /** Returns total size of emulator save data in bytes */
  public static async getSavesSize(): Promise<{
    sizeInBytes: number;
    lastModified: string | null;
  }> {
    const savesPath = this.getEmulatorSavesPath();

    try {
      const stat = await fs.promises.stat(savesPath);
      if (!stat.isDirectory()) {
        return { sizeInBytes: 0, lastModified: null };
      }

      const files = await fs.promises.readdir(savesPath);
      let totalSize = 0;
      let latestMtime = 0;

      for (const file of files) {
        const fileStat = await fs.promises.stat(path.join(savesPath, file));
        totalSize += fileStat.size;
        if (fileStat.mtimeMs > latestMtime) {
          latestMtime = fileStat.mtimeMs;
        }
      }

      return {
        sizeInBytes: totalSize,
        lastModified:
          latestMtime > 0 ? new Date(latestMtime).toISOString() : null,
      };
    } catch {
      return { sizeInBytes: 0, lastModified: null };
    }
  }

  /** Creates a TAR archive of the emulator IndexedDB files */
  public static async exportSaves(): Promise<string> {
    const savesPath = this.getEmulatorSavesPath();

    if (!fs.existsSync(savesPath)) {
      throw new Error("No emulator save data found");
    }

    const tarLocation = path.join(
      backupsPath,
      `${ROM_SAVES_PREFIX}-${crypto.randomUUID()}.tar`
    );
    await fs.promises.mkdir(backupsPath, { recursive: true });

    await tar.create(
      {
        gzip: false,
        file: tarLocation,
        cwd: savesPath,
      },
      ["."]
    );

    return tarLocation;
  }

  /** Extracts a TAR archive back to the emulator IndexedDB directory */
  public static async importSaves(tarPath: string): Promise<void> {
    const savesPath = this.getEmulatorSavesPath();
    await fs.promises.mkdir(savesPath, { recursive: true });

    await tar.x({
      file: tarPath,
      cwd: savesPath,
    });
  }

  /** Upload ROM saves to local backup */
  public static async uploadSaves(): Promise<void> {
    const localBackupPath = await this.getLocalBackupPath();
    if (!localBackupPath) {
      throw new Error("Local backup path is not configured");
    }

    const tarLocation = await this.exportSaves();

    const timestamp = Date.now();
    const fileName = `${ROM_SAVES_PREFIX}-${timestamp}.tar`;
    const destPath = path.join(localBackupPath, fileName);

    await fs.promises.mkdir(localBackupPath, { recursive: true });
    await fs.promises.copyFile(tarLocation, destPath);

    const metadata = {
      type: ROM_SAVES_PREFIX,
      hostname: os.hostname(),
      platform: process.platform,
      timestamp,
    };

    const metaPath = path.join(localBackupPath, `${fileName}.meta.json`);
    await fs.promises.writeFile(metaPath, JSON.stringify(metadata));

    // Clean up temp tar
    await fs.promises.unlink(tarLocation).catch((err) => {
      logger.error("Failed to remove temp tar", { tarLocation, error: err });
    });

    WindowManager.mainWindow?.webContents.send("on-rom-saves-upload-complete");
  }

  /** Download and restore ROM saves from a backup */
  public static async downloadSaves(artifactId: string): Promise<void> {
    const localBackupPath = await this.getLocalBackupPath();
    if (!localBackupPath) {
      throw new Error("Local backup path is not configured");
    }

    const tarPath = path.join(localBackupPath, artifactId);
    await this.importSaves(tarPath);

    WindowManager.mainWindow?.webContents.send(
      "on-rom-saves-download-complete"
    );
  }

  /** List ROM save backups */
  public static async listSaveBackups(): Promise<GoogleDriveBackupArtifact[]> {
    const localBackupPath = await this.getLocalBackupPath();
    if (!localBackupPath) return [];

    let files: string[];
    try {
      files = await fs.promises.readdir(localBackupPath);
    } catch {
      return [];
    }

    const tarFiles = files.filter(
      (f) => f.startsWith(ROM_SAVES_PREFIX) && f.endsWith(".tar")
    );

    if (tarFiles.length === 0) return [];

    const results = await Promise.all(
      tarFiles.map(async (tarFile) => {
        const metaPath = path.join(localBackupPath, `${tarFile}.meta.json`);
        const filePath = path.join(localBackupPath, tarFile);

        const [metaResult, statResult] = await Promise.allSettled([
          fs.promises.readFile(metaPath, "utf-8"),
          fs.promises.stat(filePath),
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
          gameObjectId: ROM_SAVES_PREFIX,
          gameShop: "rom",
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

  /** Delete a ROM save backup */
  public static async deleteBackup(fileName: string): Promise<void> {
    const localBackupPath = await this.getLocalBackupPath();
    if (!localBackupPath) {
      throw new Error("Local backup path is not configured");
    }

    const tarPath = path.join(localBackupPath, fileName);
    const metaPath = path.join(localBackupPath, `${fileName}.meta.json`);

    await Promise.allSettled([
      fs.promises.unlink(tarPath),
      fs.promises.unlink(metaPath),
    ]);
  }

  private static async getLocalBackupPath(): Promise<string | null> {
    const userPreferences = await db
      .get<string, UserPreferences | null>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => null);

    return userPreferences?.localBackupPath ?? null;
  }
}
