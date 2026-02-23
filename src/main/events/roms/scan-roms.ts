import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

import { registerEvent } from "../register-event";
import { romsSublevel } from "@main/level";
import { logger, computeFileHash, scrapeRom } from "@main/services";
import { EXTENSION_TO_CONSOLE } from "@shared";
import type { RomEntry } from "@types";

const cleanTitle = (fileName: string): string => {
  const name = path.basename(fileName, path.extname(fileName));
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const scanDirectory = async (dirPath: string): Promise<string[]> => {
  const files: string[] = [];

  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await scanDirectory(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }

  return files;
};

const scanRoms = async (
  _event: Electron.IpcMainInvokeEvent,
  romsPath: string
) => {
  logger.info("Scanning ROMs in", romsPath);

  const existingRoms = new Map<string, RomEntry>();
  for await (const [key, value] of romsSublevel.iterator()) {
    existingRoms.set(key, value);
  }

  const files = await scanDirectory(romsPath);
  const foundIds = new Set<string>();

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const consoleId = EXTENSION_TO_CONSOLE[ext];

    if (!consoleId) continue;

    const id = crypto.createHash("md5").update(filePath).digest("hex");

    foundIds.add(id);

    const existing = existingRoms.get(id);

    if (existing) {
      /* Compute hash if missing */
      let fileHash = existing.fileHash ?? null;
      if (!fileHash) {
        try {
          fileHash = await computeFileHash(filePath);
        } catch {
          /* hash computation failed, continue without it */
        }
      }

      /* If the ROM still has no verified cover, try to scrape */
      let { coverUrl, screenshotUrl, titleScreenUrl, title } = existing;

      if (!coverUrl) {
        const result = await scrapeRom(existing.title, consoleId, fileHash);
        if (result) {
          title = result.title;
          coverUrl = result.coverUrl;
          screenshotUrl = result.screenshotUrl;
          titleScreenUrl = result.titleScreenUrl;
        }
      }

      await romsSublevel.put(id, {
        ...existing,
        filePath,
        title,
        console: consoleId,
        fileHash,
        coverUrl,
        screenshotUrl,
        titleScreenUrl,
      });
    } else {
      const stats = await fs.promises.stat(filePath);
      const title = cleanTitle(path.basename(filePath));

      let fileHash: string | null = null;
      try {
        fileHash = await computeFileHash(filePath);
      } catch {
        /* hash computation failed */
      }

      /* Try to scrape cover art */
      const scrapeResult = await scrapeRom(title, consoleId, fileHash);

      const entry: RomEntry = {
        id,
        title: scrapeResult?.title ?? title,
        filePath,
        console: consoleId,
        fileSize: stats.size,
        playTimeInMilliseconds: 0,
        lastTimePlayed: null,
        favorite: false,
        thumbnailUrl: null,
        coverUrl: scrapeResult?.coverUrl ?? null,
        screenshotUrl: scrapeResult?.screenshotUrl ?? null,
        titleScreenUrl: scrapeResult?.titleScreenUrl ?? null,
        fileHash,
      };

      await romsSublevel.put(id, entry);
    }
  }

  /* Remove entries whose files no longer exist in the scanned folder */
  for (const [key] of existingRoms) {
    if (!foundIds.has(key)) {
      const entry = existingRoms.get(key)!;
      if (entry.filePath.startsWith(romsPath)) {
        await romsSublevel.del(key);
      }
    }
  }

  const roms: RomEntry[] = [];
  for await (const value of romsSublevel.values()) {
    roms.push(value);
  }

  logger.info(`ROM scan complete: ${roms.length} ROMs found`);
  return roms;
};

registerEvent("scanRoms", scanRoms);
