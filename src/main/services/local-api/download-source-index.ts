import axios from "axios";

import type { DownloadSource, GameRepack } from "@types";
import { DownloadSourceStatus } from "@shared";

import {
  downloadSourceEntriesSublevel,
  downloadSourcesSublevel,
} from "@main/level";
import { logger } from "../logger";
import {
  type RawDownloadSourceJson,
  annotateSourcesInEntries,
  findRepacksInEntries,
  hashId,
  parseDownloadSourceEntries,
} from "./matching";

/**
 * Local ingestion and matching for download sources. A download source is a
 * public JSON file listing repacks; the third-party backend used to index and
 * search these. Here we download and parse the JSON ourselves, store the
 * entries locally and match them to games. The pure parsing/matching logic
 * lives in `matching.ts`; this module only adds the storage/network glue.
 */

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

  const entries = parseDownloadSourceEntries(parsed, id, name);

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
  const perSource = await downloadSourceEntriesSublevel.values().all();
  return findRepacksInEntries(perSource, gameTitle, allowedSourceIds);
};

/**
 * For a batch of titles, returns which source ids contain a matching repack.
 * Used to annotate catalogue search results with their available sources.
 */
export const annotateSourcesForTitles = async (
  titles: string[]
): Promise<Map<string, string[]>> => {
  const perSource = await downloadSourceEntriesSublevel.values().all();
  return annotateSourcesInEntries(perSource, titles);
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
