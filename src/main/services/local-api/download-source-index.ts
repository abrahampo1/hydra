import { app, net } from "electron";

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

/** Browser-like UA: the `Electron`/app tokens raise Cloudflare's bot score. */
const browserLikeUserAgent = () =>
  app.userAgentFallback.replace(/\s(Electron|hydralauncher|Hydra)\/\S+/gi, "");

const parseSourceJson = (text: string): RawDownloadSourceJson =>
  JSON.parse(text.replace(/^\uFEFF/, ""));

/**
 * Fetches a download source JSON through Chromium's network stack
 * (`net.fetch`) with a browser-like UA \u2014 Node's TLS fingerprint (plain axios)
 * gets rejected by Cloudflare regardless of headers.
 *
 * This stays silent and never opens a window: hosts that serve a JS challenge
 * (e.g. Cloudflare) simply throw here, and the caller falls back to adding the
 * source through the real backend, which fetches it server-side \u2014 the way it
 * worked before the local index existed.
 */
const fetchDownloadSourceJson = async (
  url: string
): Promise<RawDownloadSourceJson> => {
  const response = await net.fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": browserLikeUserAgent(),
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch download source (HTTP ${response.status})`
    );
  }

  return parseSourceJson(await response.text());
};

/**
 * Downloads and parses a download source JSON file, persisting its entries
 * locally so repacks can be resolved offline.
 */
export const ingestDownloadSource = async (
  url: string
): Promise<DownloadSource> => {
  const parsed = await fetchDownloadSourceJson(url);

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

/** Source ids that have entries indexed in the local repack index. */
export const getIndexedSourceIds = async (): Promise<string[]> =>
  downloadSourceEntriesSublevel.keys().all();

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
 * Maps download source fingerprints (what the catalogue filter sends) to the
 * locally stored source ids used by the entries index.
 */
export const getSourceIdsByFingerprints = async (
  fingerprints: string[]
): Promise<Set<string>> => {
  if (!fingerprints.length) return new Set();

  const wanted = new Set(fingerprints);
  const sources = await downloadSourcesSublevel.values().all();

  return new Set(
    sources
      .filter((source) => source.fingerprint && wanted.has(source.fingerprint))
      .map((source) => source.id)
  );
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
