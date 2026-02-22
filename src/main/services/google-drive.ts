import { google } from "googleapis";
import { BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import * as tar from "tar";
import { Readable } from "node:stream";

import { db } from "@main/level";
import { levelKeys } from "@main/level/sublevels";
import { gamesSublevel } from "@main/level";
import { backupsPath } from "@main/constants";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import { Ludusavi } from "./ludusavi";
import { CloudSync } from "./cloud-sync";
import type {
  GameShop,
  GoogleDriveTokens,
  GoogleDriveUserInfo,
  GoogleDriveBackupArtifact,
} from "@types";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const FOLDER_NAME = "Hydra Launcher Backups";
const REDIRECT_URI = "http://localhost:65432/oauth2callback";

export class GoogleDriveService {
  private static oauth2Client: InstanceType<
    (typeof google.auth)["OAuth2"]
  > | null = null;
  private static backupFolderId: string | null = null;

  public static async setup() {
    const clientId = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.info("Google Drive: Missing client credentials, skipping setup");
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      REDIRECT_URI
    );

    const tokens = await this.loadTokens();
    if (tokens) {
      this.oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expiry_date: tokens.expiryDate,
      });

      this.oauth2Client.on("tokens", async (newTokens) => {
        const existing = await this.loadTokens();
        if (existing) {
          await this.saveTokens({
            accessToken: newTokens.access_token ?? existing.accessToken,
            refreshToken: newTokens.refresh_token ?? existing.refreshToken,
            expiryDate: newTokens.expiry_date ?? existing.expiryDate,
          });
        }
      });
    }
  }

  private static async loadTokens(): Promise<GoogleDriveTokens | null> {
    try {
      return await db.get<string, GoogleDriveTokens | null>(
        levelKeys.googleDriveTokens,
        { valueEncoding: "json" }
      );
    } catch {
      return null;
    }
  }

  private static async saveTokens(tokens: GoogleDriveTokens) {
    await db.put(levelKeys.googleDriveTokens, tokens, {
      valueEncoding: "json",
    });
  }

  private static async loadUserInfo(): Promise<GoogleDriveUserInfo | null> {
    try {
      return await db.get<string, GoogleDriveUserInfo | null>(
        levelKeys.googleDriveUserInfo,
        { valueEncoding: "json" }
      );
    } catch {
      return null;
    }
  }

  private static async saveUserInfo(userInfo: GoogleDriveUserInfo) {
    await db.put(levelKeys.googleDriveUserInfo, userInfo, {
      valueEncoding: "json",
    });
  }

  public static async authenticate(): Promise<GoogleDriveUserInfo> {
    if (!this.oauth2Client) {
      throw new Error("Google Drive not configured");
    }

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });

    const code = await this.openAuthWindow(authUrl);

    const { tokens } = await this.oauth2Client.getToken(code);

    this.oauth2Client.setCredentials(tokens);

    await this.saveTokens({
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiryDate: tokens.expiry_date!,
    });

    this.oauth2Client.on("tokens", async (newTokens) => {
      const existing = await this.loadTokens();
      if (existing) {
        await this.saveTokens({
          accessToken: newTokens.access_token ?? existing.accessToken,
          refreshToken: newTokens.refresh_token ?? existing.refreshToken,
          expiryDate: newTokens.expiry_date ?? existing.expiryDate,
        });
      }
    });

    const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const userInfo: GoogleDriveUserInfo = {
      email: data.email!,
      displayName: data.name ?? data.email!,
      photoUrl: data.picture ?? null,
    };

    await this.saveUserInfo(userInfo);

    return userInfo;
  }

  private static openAuthWindow(authUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { createServer } =
        require("node:http") as typeof import("node:http");

      const server = createServer((req, res) => {
        const reqUrl = new URL(req.url!, `http://localhost:65432`);
        const code = reqUrl.searchParams.get("code");
        const error = reqUrl.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Authentication failed. You can close this window.</h2></body></html>"
          );
          server.close();
          authWindow?.close();
          reject(new Error(`Google auth error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Authentication successful! You can close this window.</h2></body></html>"
          );
          server.close();
          authWindow?.close();
          resolve(code);
        }
      });

      server.listen(65432);

      let authWindow: BrowserWindow | null = null;

      if (WindowManager.mainWindow) {
        authWindow = new BrowserWindow({
          width: 600,
          height: 700,
          backgroundColor: "#1c1c1c",
          parent: WindowManager.mainWindow,
          modal: true,
          show: false,
          maximizable: false,
          resizable: false,
          minimizable: false,
          webPreferences: {
            sandbox: true,
          },
        });

        authWindow.removeMenu();
        authWindow.loadURL(authUrl);

        authWindow.once("ready-to-show", () => {
          authWindow?.show();
        });

        authWindow.on("closed", () => {
          server.close();
        });
      }
    });
  }

  public static async disconnect() {
    try {
      if (this.oauth2Client) {
        await this.oauth2Client.revokeCredentials().catch(() => {});
        this.oauth2Client.setCredentials({});
      }
    } catch {
      // Ignore revoke errors
    }

    try {
      await db.del(levelKeys.googleDriveTokens);
    } catch {
      // Key may not exist
    }

    try {
      await db.del(levelKeys.googleDriveUserInfo);
    } catch {
      // Key may not exist
    }

    this.backupFolderId = null;
  }

  public static async getConnectionStatus(): Promise<{
    connected: boolean;
    userInfo: GoogleDriveUserInfo | null;
  }> {
    const tokens = await this.loadTokens();
    const userInfo = await this.loadUserInfo();

    return {
      connected: tokens !== null && userInfo !== null,
      userInfo,
    };
  }

  private static async getOrCreateBackupFolder(): Promise<string> {
    if (this.backupFolderId) return this.backupFolderId;

    if (!this.oauth2Client) throw new Error("Google Drive not configured");

    const drive = google.drive({ version: "v3", auth: this.oauth2Client });

    const response = await drive.files.list({
      q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (response.data.files && response.data.files.length > 0) {
      this.backupFolderId = response.data.files[0].id!;
      return this.backupFolderId;
    }

    const folder = await drive.files.create({
      requestBody: {
        name: FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    this.backupFolderId = folder.data.id!;
    return this.backupFolderId;
  }

  public static async uploadSaveGame(
    objectId: string,
    shop: GameShop,
    downloadOptionTitle: string | null,
    label?: string
  ) {
    if (!this.oauth2Client) throw new Error("Google Drive not configured");

    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));

    const backupPath = path.join(backupsPath, `${shop}-${objectId}`);

    if (fs.existsSync(backupPath)) {
      try {
        await fs.promises.rm(backupPath, { recursive: true });
      } catch (error) {
        logger.error("Failed to remove backup path", { backupPath, error });
      }
    }

    await Ludusavi.backupGame(
      shop,
      objectId,
      backupPath,
      game?.winePrefixPath ?? null
    );

    const tarLocation = path.join(backupsPath, `${crypto.randomUUID()}.tar`);

    await tar.create(
      {
        gzip: false,
        file: tarLocation,
        cwd: backupPath,
      },
      ["."]
    );

    const folderId = await this.getOrCreateBackupFolder();

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
      metadata.winePrefixPath = fs.realpathSync(game.winePrefixPath);
    }

    if (downloadOptionTitle) {
      metadata.downloadOptionTitle = downloadOptionTitle;
    }

    if (label) {
      metadata.label = label;
    }

    const fileName = `${shop}-${objectId}-${Date.now()}.tar`;

    const drive = google.drive({ version: "v3", auth: this.oauth2Client });

    const fileStream = fs.createReadStream(tarLocation);

    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        description: JSON.stringify(metadata),
      },
      media: {
        mimeType: "application/x-tar",
        body: fileStream,
      },
      fields: "id",
    });

    WindowManager.mainWindow?.webContents.send(
      `on-upload-complete-${objectId}-${shop}`,
      true
    );

    try {
      await fs.promises.unlink(tarLocation);
    } catch (error) {
      logger.error("Failed to remove tar file", { tarLocation, error });
    }

    try {
      await fs.promises.rm(backupPath, { recursive: true });
    } catch (error) {
      logger.error("Failed to remove backup path", { backupPath, error });
    }
  }

  public static async listBackups(
    objectId: string,
    shop: GameShop
  ): Promise<GoogleDriveBackupArtifact[]> {
    if (!this.oauth2Client) throw new Error("Google Drive not configured");

    const folderId = await this.getOrCreateBackupFolder();
    const drive = google.drive({ version: "v3", auth: this.oauth2Client });

    const response = await drive.files.list({
      q: `'${folderId}' in parents and name contains '${shop}-${objectId}' and trashed=false`,
      fields: "files(id, name, size, createdTime, modifiedTime, description)",
      orderBy: "createdTime desc",
      spaces: "drive",
    });

    return (response.data.files ?? []).map((file) => {
      let parsedMeta: Record<string, string> = {};
      try {
        parsedMeta = JSON.parse(file.description || "{}");
      } catch {
        // Ignore parse errors
      }

      return {
        id: file.id!,
        name: file.name!,
        size: Number(file.size ?? 0),
        createdAt: file.createdTime!,
        modifiedAt: file.modifiedTime!,
        gameObjectId: parsedMeta.objectId ?? objectId,
        gameShop: parsedMeta.shop ?? shop,
        label: parsedMeta.label ?? null,
      };
    });
  }

  public static async downloadBackup(
    objectId: string,
    shop: GameShop,
    fileId: string
  ) {
    if (!this.oauth2Client) throw new Error("Google Drive not configured");

    const drive = google.drive({ version: "v3", auth: this.oauth2Client });

    const fileMeta = await drive.files.get({
      fileId,
      fields: "description",
    });

    let metadata: Record<string, string> = {};
    try {
      metadata = JSON.parse(fileMeta.data.description || "{}");
    } catch {
      // Ignore parse errors
    }

    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    const tarLocation = path.join(backupsPath, `${crypto.randomUUID()}.tar`);
    const backupPath = path.join(backupsPath, `${shop}-${objectId}`);

    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }

    fs.mkdirSync(backupPath, { recursive: true });

    const writer = fs.createWriteStream(tarLocation);
    const stream = response.data as Readable;

    await new Promise<void>((resolve, reject) => {
      stream.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    await tar.x({
      file: tarLocation,
      cwd: backupPath,
    });

    const { restoreLudusaviBackup } = await import(
      "@main/helpers/restore-backup"
    );
    const { normalizePath } = await import("@main/helpers");

    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));

    await restoreLudusaviBackup(
      backupPath,
      objectId,
      normalizePath(metadata.homeDir ?? ""),
      game?.winePrefixPath,
      metadata.winePrefixPath ?? null
    );

    WindowManager.mainWindow?.webContents.send(
      `on-backup-download-complete-${objectId}-${shop}`,
      true
    );

    try {
      await fs.promises.unlink(tarLocation);
    } catch (error) {
      logger.error("Failed to remove tar file", { tarLocation, error });
    }
  }

  public static async deleteBackup(fileId: string) {
    if (!this.oauth2Client) throw new Error("Google Drive not configured");

    const drive = google.drive({ version: "v3", auth: this.oauth2Client });
    await drive.files.delete({ fileId });
  }
}
