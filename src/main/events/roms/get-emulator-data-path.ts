import path from "node:path";
import { app } from "electron";
import { registerEvent } from "../register-event";

const getEmulatorDataPath = async (_event: Electron.IpcMainInvokeEvent) => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "emulatorjs-data");
  }

  return path.join(
    __dirname,
    "..",
    "..",
    "node_modules",
    "@emulatorjs",
    "emulatorjs",
    "data"
  );
};

registerEvent("getEmulatorDataPath", getEmulatorDataPath);
