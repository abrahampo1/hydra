import { app, BrowserWindow, net, protocol } from "electron";
import updater from "electron-updater";
import i18n from "i18next";
import path from "node:path";
import url from "node:url";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import {
  logger,
  clearGamesPlaytime,
  WindowManager,
  Lock,
  Aria2,
} from "@main/services";
import resources from "@locales";
import { PythonRPC } from "./services/python-rpc";
import { db, gamesSublevel, levelKeys } from "./level";
import { GameShop, UserPreferences } from "@types";
import { launchGame } from "./helpers";
import { loadState } from "./main";

const { autoUpdater } = updater;

autoUpdater.setFeedURL({
  provider: "github",
  owner: "abrahampo1",
  repo: "hydra",
});

autoUpdater.logger = logger;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

if (process.platform !== "linux") {
  app.commandLine.appendSwitch("--no-sandbox");
}

i18n.init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

const PROTOCOL = "hydralauncher";

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "emulator-data",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: "emulator-rom",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId("gg.hydralauncher.hydra");

  protocol.handle("local", (request) => {
    const filePath = request.url.slice("local:".length);
    return net.fetch(url.pathToFileURL(decodeURI(filePath)).toString());
  });

  protocol.handle("emulator-data", async (request) => {
    const parsed = new URL(request.url);

    if (parsed.pathname === "/__player__") {
      const core = parsed.searchParams.get("core") || "";
      const romUrl = parsed.searchParams.get("romUrl") || "";
      const gameName = parsed.searchParams.get("gameName") || "";
      const romId = parsed.searchParams.get("romId") || "";
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; overflow: hidden; background: #000; }
    #game { width: 100vw; height: 100vh; }
    /* Hide all EmulatorJS UI */
    .ejs_menu_bar,
    .ejs_menu_bar *,
    .ejs--bar,
    .ejs--bar *,
    .ejs_context_menu,
    .ejs_start_button,
    .ejs_loading_text,
    .ejs_cheat_menu,
    .ejs_settings_menu,
    [class*="ejs_menu"],
    [class*="ejs_button"],
    [class*="ejs--controls"] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
      height: 0 !important;
      width: 0 !important;
      overflow: hidden !important;
    }
    #game > div > div:last-child {
      display: none !important;
    }
    #game canvas {
      width: 100vw !important;
      height: 100vh !important;
      object-fit: contain;
    }
    /* Toast notification */
    #save-toast {
      position: fixed;
      top: 16px;
      right: 16px;
      background: rgba(22, 177, 149, 0.9);
      color: #fff;
      padding: 8px 16px;
      border-radius: 6px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    #save-toast.visible { opacity: 1; }
  </style>
</head>
<body>
  <div id="game"></div>
  <div id="save-toast"></div>
  <script>
    EJS_player = "#game";
    EJS_core = "${core}";
    EJS_gameUrl = "${romUrl}";
    EJS_gameName = "${gameName}";
    EJS_pathtodata = "emulator-data://data/";
    EJS_color = "#16b195";
    EJS_startOnLoaded = true;
    EJS_Buttons = {
      playPause: false,
      restart: false,
      mute: false,
      settings: false,
      fullscreen: false,
      saveState: false,
      loadState: false,
      screenRecord: false,
      gamepad: false,
      cheat: false,
      volume: false,
      saveSavFiles: false,
      loadSavFiles: false,
      quickSave: false,
      quickLoad: false,
      screenshot: false,
      cacheManager: false
    };

    const ROM_ID = "${romId}";
    let currentSlot = 1;
    let toastTimer = null;

    function showToast(msg) {
      const el = document.getElementById("save-toast");
      el.textContent = msg;
      el.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove("visible"), 2000);
    }

    function postToParent(type, payload) {
      window.parent.postMessage({ source: "emulator", type, ...payload }, "*");
    }

    /* Save state action (used by both button and keyboard) */
    function doSaveState(slot) {
      const emu = window.EJS_emulator;
      if (!emu || !emu.gameManager) return;
      try {
        const state = emu.gameManager.getState();
        if (state) {
          postToParent("save-state", {
            romId: ROM_ID,
            slot: slot,
            data: Array.from(state)
          });
          showToast("Saved (slot " + slot + ")");
        }
      } catch(err) {
        showToast("Save failed");
        console.error(err);
      }
    }

    /* Load state action (used by both button and keyboard) */
    function doLoadState(slot) {
      postToParent("load-state", { romId: ROM_ID, slot: slot });
    }

    /* Listen for messages from parent (SRAM/state data + button triggers) */
    window.addEventListener("message", function(e) {
      if (!e.data || e.data.source !== "hydra-host") return;
      const emu = window.EJS_emulator;
      if (!emu || !emu.gameManager) return;

      /* Button-triggered save state from parent */
      if (e.data.type === "request-save-state" && typeof e.data.slot === "number") {
        currentSlot = e.data.slot;
        doSaveState(currentSlot);
        return;
      }

      /* Button-triggered load state from parent */
      if (e.data.type === "request-load-state" && typeof e.data.slot === "number") {
        currentSlot = e.data.slot;
        doLoadState(currentSlot);
        return;
      }

      /* Slot change from parent */
      if (e.data.type === "set-slot" && typeof e.data.slot === "number") {
        currentSlot = e.data.slot;
        showToast("Slot " + currentSlot);
        return;
      }

      if (e.data.type === "load-sram-response" && e.data.data) {
        try {
          const arr = new Uint8Array(e.data.data);
          const savePath = emu.gameManager.getSaveFilePath();
          if (savePath) {
            emu.gameManager.FS.writeFile(savePath, arr);
            emu.gameManager.loadSaveFiles();
          }
        } catch(err) { console.error("Failed to load SRAM", err); }
      }

      if (e.data.type === "load-state-response" && e.data.data) {
        try {
          emu.gameManager.loadState(new Uint8Array(e.data.data));
          showToast("Loaded (slot " + e.data.slot + ")");
        } catch(err) { console.error("Failed to load state", err); }
      }
    });

    /* Called when game starts */
    EJS_onGameStart = function() {
      /* Request SRAM from parent on start */
      postToParent("load-sram", { romId: ROM_ID });

      const emu = window.EJS_emulator;

      /* Auto-save SRAM every 30 seconds */
      setInterval(function() {
        if (!emu || !emu.gameManager) return;
        try {
          const saveData = emu.gameManager.getSaveFile(true);
          if (saveData && saveData.length > 0) {
            postToParent("save-sram", {
              romId: ROM_ID,
              data: Array.from(saveData)
            });
          }
        } catch(err) {}
      }, 30000);

      /* Keyboard shortcuts */
      document.addEventListener("keydown", function(e) {
        if (!emu || !emu.gameManager) return;

        /* Shift + 1-9: Change slot */
        if (e.shiftKey && e.key >= "1" && e.key <= "9") {
          currentSlot = parseInt(e.key);
          showToast("Slot " + currentSlot);
          postToParent("slot-changed", { slot: currentSlot });
          e.preventDefault();
          return;
        }

        /* F2: Save state */
        if (e.key === "F2") {
          e.preventDefault();
          doSaveState(currentSlot);
          return;
        }

        /* F4: Load state */
        if (e.key === "F4") {
          e.preventDefault();
          doLoadState(currentSlot);
          return;
        }

        /* F5: Quick save (slot 1) */
        if (e.key === "F5" && !e.ctrlKey) {
          e.preventDefault();
          doSaveState(1);
          return;
        }

        /* F9: Quick load (slot 1) */
        if (e.key === "F9") {
          e.preventDefault();
          doLoadState(1);
          return;
        }
      });
    };

    /* Save SRAM before page unloads */
    window.addEventListener("beforeunload", function() {
      const emu = window.EJS_emulator;
      if (!emu || !emu.gameManager) return;
      try {
        emu.gameManager.saveSaveFiles();
        const saveData = emu.gameManager.getSaveFile(false);
        if (saveData && saveData.length > 0) {
          postToParent("save-sram", {
            romId: ROM_ID,
            data: Array.from(saveData)
          });
        }
      } catch(err) {}
    });
  </script>
  <script src="emulator-data://data/loader.js"></script>
</body>
</html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    const filePath = decodeURIComponent(parsed.pathname.slice(1));
    const basePath = app.isPackaged
      ? path.join(process.resourcesPath, "emulatorjs-data")
      : path.join(
          __dirname,
          "..",
          "..",
          "node_modules",
          "@emulatorjs",
          "emulatorjs",
          "data"
        );

    return net.fetch(
      url.pathToFileURL(path.join(basePath, filePath)).toString()
    );
  });

  protocol.handle("emulator-rom", async (request) => {
    const parsed = new URL(request.url);
    const filePath = decodeURIComponent(parsed.pathname.slice(1));

    const response = await net.fetch(url.pathToFileURL(filePath).toString());
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  protocol.handle("gradient", (request) => {
    const gradientCss = decodeURIComponent(
      request.url.slice("gradient:".length)
    );

    // Parse gradient CSS safely without regex to prevent ReDoS
    let direction = "45deg";
    let color1 = "#4a90e2";
    let color2 = "#7b68ee";

    // Simple string parsing approach - more secure than regex
    if (
      gradientCss.startsWith("linear-gradient(") &&
      gradientCss.endsWith(")")
    ) {
      const content = gradientCss.slice(16, -1); // Remove "linear-gradient(" and ")"
      const parts = content.split(",").map((part) => part.trim());

      if (parts.length >= 3) {
        direction = parts[0];
        color1 = parts[1];
        color2 = parts[2];
      }
    }

    let x1 = "0%",
      y1 = "0%",
      x2 = "100%",
      y2 = "100%";

    if (direction === "to right") {
      y2 = "0%";
    } else if (direction === "to bottom") {
      x2 = "0%";
    } else if (direction === "45deg") {
      y1 = "100%";
      y2 = "0%";
    } else if (direction === "225deg") {
      x1 = "100%";
      x2 = "0%";
    } else if (direction === "315deg") {
      x1 = "100%";
      y1 = "100%";
      x2 = "0%";
      y2 = "0%";
    }
    // Note: "135deg" case removed as it uses all default values

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <defs>
          <linearGradient id="grad" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
            <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
    `;

    return new Response(svgContent, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  });

  await loadState();

  const language = await db
    .get<string, string>(levelKeys.language, {
      valueEncoding: "utf8",
    })
    .catch(() => "en");

  if (language) i18n.changeLanguage(language);

  // Check if starting from a "run" deep link - don't show main window in that case
  const deepLinkArg = process.argv.find((arg) =>
    arg.startsWith("hydralauncher://")
  );
  const isRunDeepLink = deepLinkArg?.startsWith("hydralauncher://run");

  if (!process.argv.includes("--hidden") && !isRunDeepLink) {
    WindowManager.createMainWindow();
  }

  WindowManager.createNotificationWindow();
  WindowManager.createSystemTray(language || "en");

  if (deepLinkArg) {
    handleDeepLinkPath(deepLinkArg);
  }
});

app.on("browser-window-created", (_, window) => {
  optimizer.watchWindowShortcuts(window);
});

const handleRunGame = async (shop: GameShop, objectId: string) => {
  const gameKey = levelKeys.game(shop, objectId);
  const game = await gamesSublevel.get(gameKey);

  if (!game?.executablePath) {
    logger.error("Game not found or no executable path", { shop, objectId });
    return;
  }

  const userPreferences = await db.get<string, UserPreferences | null>(
    levelKeys.userPreferences,
    { valueEncoding: "json" }
  );

  // Only open main window if setting is disabled
  if (!userPreferences?.hideToTrayOnGameStart) {
    WindowManager.createMainWindow();
  }

  await launchGame({
    shop,
    objectId,
    executablePath: game.executablePath,
    launchOptions: game.launchOptions,
  });
};

const handleDeepLinkPath = (uri?: string) => {
  if (!uri) return;

  try {
    const url = new URL(uri);

    if (url.host === "run") {
      const shop = url.searchParams.get("shop") as GameShop | null;
      const objectId = url.searchParams.get("objectId");

      if (shop && objectId) {
        handleRunGame(shop, objectId);
      }

      return;
    }

    if (url.host === "install-source") {
      WindowManager.redirect(`settings${url.search}`);
      return;
    }

    if (url.host === "profile") {
      const userId = url.searchParams.get("userId");

      if (userId) {
        WindowManager.redirect(`profile/${userId}`);
      }

      return;
    }

    if (url.host === "install-theme") {
      const themeName = url.searchParams.get("theme");
      const authorId = url.searchParams.get("authorId");
      const authorName = url.searchParams.get("authorName");

      if (themeName && authorId && authorName) {
        WindowManager.redirect(
          `settings?theme=${themeName}&authorId=${authorId}&authorName=${authorName}`
        );
      }
    }
  } catch (error) {
    logger.error("Error handling deep link", uri, error);
  }
};

app.on("second-instance", (_event, commandLine) => {
  const deepLink = commandLine.find((arg) =>
    arg.startsWith("hydralauncher://")
  );

  // Check if this is a "run" deep link - don't show main window in that case
  const isRunDeepLink = deepLink?.startsWith("hydralauncher://run");

  if (!isRunDeepLink) {
    if (WindowManager.mainWindow) {
      if (WindowManager.mainWindow.isMinimized())
        WindowManager.mainWindow.restore();

      WindowManager.mainWindow.focus();
    } else {
      WindowManager.createMainWindow();
    }
  }

  handleDeepLinkPath(deepLink);
});

app.on("open-url", (_event, url) => {
  handleDeepLinkPath(url);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  WindowManager.mainWindow = null;
});

let canAppBeClosed = false;

app.on("before-quit", async (e) => {
  await Lock.releaseLock();

  if (!canAppBeClosed) {
    e.preventDefault();
    /* Disconnects libtorrent */
    PythonRPC.kill();
    Aria2.kill();
    await clearGamesPlaytime();
    canAppBeClosed = true;
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    WindowManager.createMainWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
