import crypto from "node:crypto";
import fs from "node:fs";
import { net } from "electron";

import {
  ROM_CONSOLES,
  getLibretroThumbnailUrl,
  getLibretroSnapshotUrl,
  getLibretroTitleScreenUrl,
} from "@shared";
import type { RomConsole } from "@types";
import { logger } from "@main/services/logger";

/* In-memory cache: consoleId → Map<md5, canonicalName> */
const datCache = new Map<RomConsole, Map<string, string>>();

/** Compute MD5 hash of the file content using streams */
export const computeFileHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
};

/** Verify if an image URL exists (HTTP HEAD → 200) */
const verifyImageUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await net.fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
};

/** Parse clrmamepro DAT file and extract md5 → game-name mapping */
const parseDatFile = (content: string): Map<string, string> => {
  const map = new Map<string, string>();

  const gameRegex =
    /game\s*\(\s*name\s+"([^"]+)"[\s\S]*?rom\s*\([^)]*md5\s+([A-Fa-f0-9]+)/g;
  let match: RegExpExecArray | null;
  while ((match = gameRegex.exec(content)) !== null) {
    const name = match[1];
    const md5 = match[2].toLowerCase();
    map.set(md5, name);
  }

  return map;
};

/** Fetch and parse the Libretro DAT file for a console (cached) */
const fetchDatFile = async (
  consoleId: RomConsole
): Promise<Map<string, string>> => {
  if (datCache.has(consoleId)) return datCache.get(consoleId)!;

  const info = ROM_CONSOLES[consoleId];
  if (!info) return new Map();

  const url = `https://raw.githubusercontent.com/libretro/libretro-database/master/dat/${encodeURIComponent(info.libretroSystem)}.dat`;

  try {
    logger.info(`Fetching Libretro DAT for ${info.libretroSystem}`);
    const response = await net.fetch(url);
    if (!response.ok) {
      logger.warn(
        `DAT file not found for ${info.libretroSystem}: ${response.status}`
      );
      return new Map();
    }

    const text = await response.text();
    const md5Map = parseDatFile(text);
    logger.info(`Parsed ${md5Map.size} entries for ${info.libretroSystem}`);
    datCache.set(consoleId, md5Map);
    return md5Map;
  } catch (err) {
    logger.error(`Failed to fetch DAT for ${info.libretroSystem}`, err);
    return new Map();
  }
};

/** Identify a ROM by its content MD5 hash using the Libretro database */
export const identifyByHash = async (
  md5: string,
  consoleId: RomConsole
): Promise<string | null> => {
  const md5Map = await fetchDatFile(consoleId);
  return md5Map.get(md5.toLowerCase()) ?? null;
};

export interface ScrapeResult {
  title: string;
  coverUrl: string;
  screenshotUrl: string;
  titleScreenUrl: string;
}

/**
 * Try to find a verified cover for a ROM.
 *
 * Strategy:
 *  1. If fileHash is available, look up the canonical name in the Libretro DB
 *  2. Try the given title as-is
 *  3. Try the title with common region suffixes
 *
 * Returns null if no verified cover was found.
 */
export const scrapeRom = async (
  title: string,
  consoleId: RomConsole,
  fileHash: string | null
): Promise<ScrapeResult | null> => {
  /* 1. Checksum-based identification */
  if (fileHash) {
    const canonicalName = await identifyByHash(fileHash, consoleId);
    if (canonicalName) {
      const coverUrl = getLibretroThumbnailUrl(consoleId, canonicalName);
      if (await verifyImageUrl(coverUrl)) {
        return {
          title: canonicalName,
          coverUrl,
          screenshotUrl: getLibretroSnapshotUrl(consoleId, canonicalName),
          titleScreenUrl: getLibretroTitleScreenUrl(consoleId, canonicalName),
        };
      }
    }
  }

  /* 2. Exact title match */
  const exactUrl = getLibretroThumbnailUrl(consoleId, title);
  if (await verifyImageUrl(exactUrl)) {
    return {
      title,
      coverUrl: exactUrl,
      screenshotUrl: getLibretroSnapshotUrl(consoleId, title),
      titleScreenUrl: getLibretroTitleScreenUrl(consoleId, title),
    };
  }

  /* 3. Try common region variations */
  const regions = ["(USA)", "(USA, Europe)", "(Europe)", "(Japan)", "(World)"];
  for (const region of regions) {
    const nameWithRegion = `${title} ${region}`;
    const url = getLibretroThumbnailUrl(consoleId, nameWithRegion);
    if (await verifyImageUrl(url)) {
      return {
        title: nameWithRegion,
        coverUrl: url,
        screenshotUrl: getLibretroSnapshotUrl(consoleId, nameWithRegion),
        titleScreenUrl: getLibretroTitleScreenUrl(consoleId, nameWithRegion),
      };
    }
  }

  return null;
};
