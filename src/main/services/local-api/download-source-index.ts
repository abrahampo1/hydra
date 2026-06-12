import { BrowserWindow, app, net } from "electron";

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
 * Last-resort fetch for hosts behind a Cloudflare JS challenge: load the URL
 * in a small visible window so the challenge can render and, if interactive,
 * the user can complete it. The window's session shares cookies with the rest
 * of the app, so once the challenge clears, the body is the raw JSON.
 *
 * The load is deliberately not awaited: the challenge page navigates several
 * times before settling, which can leave `loadURL` pending indefinitely.
 */
const fetchSourceViaChallengeWindow = async (
  url: string
): Promise<RawDownloadSourceJson> => {
  const window = new BrowserWindow({
    width: 460,
    height: 580,
    title: "Security verification",
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  window.webContents.setUserAgent(browserLikeUserAgent());

  let closedByUser = false;
  window.on("closed", () => {
    closedByUser = true;
  });

  window.loadURL(url).catch(() => undefined);

  try {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (closedByUser) {
        throw new Error("Security verification window was closed");
      }

      await new Promise((resolve) => setTimeout(resolve, 1_500));

      if (closedByUser || window.isDestroyed()) {
        throw new Error("Security verification window was closed");
      }

      const text: string = await window.webContents
        .executeJavaScript("document.body ? document.body.innerText : ''", true)
        .catch(() => "");

      try {
        return parseSourceJson(text);
      } catch {
        // Challenge still running; the page reloads itself once cleared.
      }
    }

    throw new Error("Cloudflare challenge was not solved in time");
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
};

/**
 * Fetches a download source JSON through Chromium's network stack
 * (`net.fetch`) with a browser-like UA \u2014 Node's TLS fingerprint (plain axios)
 * gets rejected by Cloudflare regardless of headers. Falls back to a hidden
 * window when the host still serves a JS challenge.
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

  if (response.ok) {
    return parseSourceJson(await response.text());
  }

  if (response.status === 403 || response.status === 503) {
    logger.info(
      "Download source fetch was challenged, retrying in a visible window",
      { url, status: response.status }
    );
    return fetchSourceViaChallengeWindow(url);
  }

  throw new Error(`Failed to fetch download source (HTTP ${response.status})`);
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
