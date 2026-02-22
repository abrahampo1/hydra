import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

import { CloudSync } from "@main/services";
import { logger } from "@main/services/logger";
import { addTrailingSlash } from "@main/helpers";
import { publicProfilePath } from "@main/constants";
import type { LudusaviBackupMapping } from "@types";

export const transformLudusaviBackupPathIntoWindowsPath = (
  backupPath: string,
  winePrefixPath?: string | null
) => {
  return backupPath
    .replace(winePrefixPath ? addTrailingSlash(winePrefixPath) : "", "")
    .replace("drive_c", "C:");
};

export const addWinePrefixToWindowsPath = (
  windowsPath: string,
  winePrefixPath?: string | null
) => {
  if (!winePrefixPath) {
    return windowsPath;
  }

  return path.join(winePrefixPath, windowsPath.replace("C:", "drive_c"));
};

export const restoreLudusaviBackup = async (
  backupPath: string,
  title: string,
  homeDir: string,
  winePrefixPath?: string | null,
  artifactWinePrefixPath?: string | null
) => {
  const gameBackupPath = path.join(backupPath, title);
  const mappingYamlPath = path.join(gameBackupPath, "mapping.yaml");

  const data = await fs.promises.readFile(mappingYamlPath, "utf8");
  const manifest = YAML.parse(data) as {
    backups: LudusaviBackupMapping[];
    drives: Record<string, string>;
  };

  const userProfilePath =
    CloudSync.getWindowsLikeUserProfilePath(winePrefixPath);

  for (const backup of manifest.backups) {
    const fileOps = Object.keys(backup.files).map(async (key) => {
      const sourcePathWithDrives = Object.entries(manifest.drives).reduce(
        (prev, [driveKey, driveValue]) => {
          return prev.replace(driveValue, driveKey);
        },
        key
      );

      const sourcePath = path.join(gameBackupPath, sourcePathWithDrives);

      const destinationPath = transformLudusaviBackupPathIntoWindowsPath(
        key,
        artifactWinePrefixPath
      )
        .replace(
          homeDir,
          addWinePrefixToWindowsPath(userProfilePath, winePrefixPath)
        )
        .replace(
          publicProfilePath,
          addWinePrefixToWindowsPath(publicProfilePath, winePrefixPath)
        );

      logger.info(`Moving ${sourcePath} to ${destinationPath}`);

      await fs.promises.mkdir(path.dirname(destinationPath), {
        recursive: true,
      });

      await fs.promises.unlink(destinationPath).catch(() => {});

      await fs.promises.rename(sourcePath, destinationPath);
    });

    await Promise.all(fileOps);
  }
};
