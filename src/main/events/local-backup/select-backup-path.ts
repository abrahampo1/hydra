import { dialog } from "electron";
import { db, levelKeys } from "@main/level";
import { WindowManager } from "@main/services";
import { registerEvent } from "../register-event";
import type { UserPreferences } from "@types";

const selectBackupPath = async (_event: Electron.IpcMainInvokeEvent) => {
  const result = await dialog.showOpenDialog(WindowManager.mainWindow!, {
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  const selectedPath = result.filePaths[0];

  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  await db.put(
    levelKeys.userPreferences,
    { ...userPreferences, localBackupPath: selectedPath },
    { valueEncoding: "json" }
  );

  return selectedPath;
};

registerEvent("localBackupSelectPath", selectBackupPath);
