import axios from "axios";
import crypto from "node:crypto";

import type { DownloadSource, DownloadSourceEntry, GameRepack } from "@types";
import { DownloadSourceStatus, formatName } from "@shared";

import {
  downloadSourceEntriesSublevel,
  downloadSourcesSublevel,
} from "@main/level";
import { logger } from "../logger";

/**
 * Local ingestion and matching for download sources. A download source is a
 * public JSON file listing repacks; the third-party backend used to index and
 * search these. Here we download and parse the JSON ourselves, store the
 * entries locally and match them to games using the same `formatName`
 * normalization the renderer relies on.
 */

interface RawDownloadSourceDownload {
  title?: string;
  uris?: string[];
  fileSize?: string | null;
  uploadDate?: string | null;
}

interface RawDownloadSourceJson {
  name?: string;
  downloads?: RawDownloadSourceDownload[];
}

const hashId = (input: string, length: number) =>
  crypto.createHash("sha256").update(input).digest("hex").slice(0, length);

/**
 * Matches a formatted game title against a formatted repack title. The game
 * name must appear as a contiguous run of whole words inside the repack title
 * (e.g. "elden ring" matches "elden ring v1 12 fitgirl repack").
 */
const matchesGame = (
  formattedGame: string,
  formattedEntry: string
): boolean => {
  if (!formattedGame || !formattedEntry) return false;
  if (formattedEntry === formattedGame) return true;
  return ` ${formattedEntry} `.includes(` ${formattedGame} `);
};

/**
 * Downloads and parses a download source JSON file, persisting its entries
 * locally so repacks can be resolved offline.
 */
export const ingestDownloadSource = async (
  url: string
): Promise<DownloadSource> => {
  const { data } = await axios.get<RawDownloadSourceJson | string>(url, {
    responseType: "json",
    timeout: 60_000,
  });

  const parsed: RawDownloadSourceJson =
    typeof data === "string" ? JSON.parse(data) : data;

  if (!parsed || !Array.isArray(parsed.downloads)) {
    throw new Error("Invalid download source format");
  }

  const id = hashId(url, 24);
  const name = parsed.name?.trim() || new URL(url).hostname;

  const entries: DownloadSourceEntry[] = parsed.downloads
    .filter(
      (download): download is RawDownloadSourceDownload =>
        !!download &&
        typeof download.title === "string" &&
        Array.isArray(download.uris)
    )
    .map((download) => {
      const uploadDate = download.uploadDate ?? null;
      const uploadDateMs = uploadDate ? new Date(uploadDate).getTime() : 0;

      return {
        sourceId: id,
        sourceName: name,
        title: download.title as string,
        formattedTitle: formatName(download.title as string),
        uris: (download.uris ?? []).filter(Boolean),
        fileSize: download.fileSize ?? null,
        uploadDate,
        uploadDateMs: Number.isNaN(uploadDateMs) ? 0 : uploadDateMs,
      };
    });

  await downloadSourceEntriesSublevel.put(id, entries);

  return {
    id,
    name,
    url,
    status: DownloadSourceStatus.Matched,
    downloadCount: entries.length,
    fingerprint: hashId(`${name}:${entries.length}`, 16),
    createdAt: new Date().toISOString(),
  };
};

/**
 * Finds every repack matching a game title across the locally stored sources.
 */
export const findRepacks = async (
  gameTitle: string,
  allowedSourceIds?: string[]
): Promise<GameRepack[]> => {
  const formattedGame = formatName(gameTitle);
  if (!formattedGame) return [];

  const allowed = allowedSourceIds?.length ? new Set(allowedSourceIds) : null;

  const perSource = await downloadSourceEntriesSublevel.values().all();
  const repacks: GameRepack[] = [];

  for (const entries of perSource) {
    if (!entries.length) continue;
    if (allowed && !allowed.has(entries[0].sourceId)) continue;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!matchesGame(formattedGame, entry.formattedTitle)) continue;

      repacks.push({
        id: `${entry.sourceId}:${i}`,
        title: entry.title,
        fileSize: entry.fileSize,
        uris: entry.uris,
        unavailableUris: [],
        uploadDate: entry.uploadDate,
        downloadSourceId: entry.sourceId,
        downloadSourceName: entry.sourceName,
        createdAt: entry.uploadDate ?? new Date(0).toISOString(),
      });
    }
  }

  return repacks;
};

/**
 * For a batch of titles, returns which source ids contain a matching repack.
 * Used to annotate catalogue search results with their available sources.
 */
export const annotateSourcesForTitles = async (
  titles: string[]
): Promise<Map<string, string[]>> => {
  const formatted = titles.map((title) => ({
    title,
    formattedGame: formatName(title),
  }));

  const result = new Map<string, string[]>();
  for (const { title } of formatted) result.set(title, []);

  const perSource = await downloadSourceEntriesSublevel.values().all();

  for (const entries of perSource) {
    if (!entries.length) continue;
    const sourceId = entries[0].sourceId;

    for (const { title, formattedGame } of formatted) {
      if (!formattedGame) continue;
      const sources = result.get(title);
      if (!sources || sources.includes(sourceId)) continue;

      if (
        entries.some((entry) =>
          matchesGame(formattedGame, entry.formattedTitle)
        )
      ) {
        sources.push(sourceId);
      }
    }
  }

  return result;
};

/**
 * Ensures every registered download source has its entries indexed locally.
 * Sources added through the old remote backend keep their original id and have
 * no local entries; here we (re)ingest them and realign their stored id to the
 * url-derived id so repack filtering by source id keeps working.
 */
export const reconcileDownloadSourceEntries = async () => {
  const sources = await downloadSourcesSublevel.values().all();
  const indexedSourceIds = new Set(
    await downloadSourceEntriesSublevel.keys().all()
  );

  for (const source of sources) {
    if (indexedSourceIds.has(source.id)) continue;

    try {
      const ingested = await ingestDownloadSource(source.url);

      if (ingested.id !== source.id) {
        await downloadSourcesSublevel.del(source.id);
      }

      await downloadSourcesSublevel.put(ingested.id, {
        ...source,
        ...ingested,
        createdAt: source.createdAt ?? ingested.createdAt,
      });
    } catch (err) {
      logger.error("Failed to reconcile download source entries:", err);
    }
  }
};

export const removeDownloadSourceEntries = async (sourceId: string) => {
  await downloadSourceEntriesSublevel.del(sourceId).catch(() => undefined);
};

export const clearAllDownloadSourceEntries = async () => {
  await downloadSourceEntriesSublevel.clear();
};
