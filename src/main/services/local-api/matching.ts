import crypto from "node:crypto";

import type { DownloadSourceEntry, GameRepack } from "@types";
import { formatName } from "@shared";

/**
 * Pure parsing and matching logic for download sources. A download source is a
 * public JSON file listing repacks. Everything here is dependency-free (no
 * LevelDB, network or electron) so the repack-matching core is unit-testable;
 * `download-source-index.ts` wraps these with the storage/network glue.
 */

export interface RawDownloadSourceDownload {
  title?: string;
  uris?: string[];
  fileSize?: string | null;
  uploadDate?: string | null;
}

export interface RawDownloadSourceJson {
  name?: string;
  downloads?: RawDownloadSourceDownload[];
}

export const hashId = (input: string, length: number) =>
  crypto.createHash("sha256").update(input).digest("hex").slice(0, length);

/**
 * Matches a formatted game title against a formatted repack title. The game
 * name must appear as a contiguous run of whole words inside the repack title
 * (e.g. "elden ring" matches "elden ring v1 12 fitgirl repack").
 */
export const matchesGame = (
  formattedGame: string,
  formattedEntry: string
): boolean => {
  if (!formattedGame || !formattedEntry) return false;
  if (formattedEntry === formattedGame) return true;
  return ` ${formattedEntry} `.includes(` ${formattedGame} `);
};

/**
 * Converts the raw `downloads` array of a download source JSON into stored
 * entries, precomputing the formatted title used for matching.
 */
export const parseDownloadSourceEntries = (
  parsed: RawDownloadSourceJson,
  sourceId: string,
  sourceName: string
): DownloadSourceEntry[] => {
  if (!parsed || !Array.isArray(parsed.downloads)) return [];

  return parsed.downloads
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
        sourceId,
        sourceName,
        title: download.title as string,
        formattedTitle: formatName(download.title as string),
        uris: (download.uris ?? []).filter(Boolean),
        fileSize: download.fileSize ?? null,
        uploadDate,
        uploadDateMs: Number.isNaN(uploadDateMs) ? 0 : uploadDateMs,
      };
    });
};

/**
 * Finds every repack matching a game title across the given per-source entry
 * lists, optionally restricted to a set of allowed source ids.
 */
export const findRepacksInEntries = (
  perSource: DownloadSourceEntry[][],
  gameTitle: string,
  allowedSourceIds?: string[]
): GameRepack[] => {
  const formattedGame = formatName(gameTitle);
  if (!formattedGame) return [];

  const allowed = allowedSourceIds?.length ? new Set(allowedSourceIds) : null;

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
export const annotateSourcesInEntries = (
  perSource: DownloadSourceEntry[][],
  titles: string[]
): Map<string, string[]> => {
  const formatted = titles.map((title) => ({
    title,
    formattedGame: formatName(title),
  }));

  const result = new Map<string, string[]>();
  for (const { title } of formatted) result.set(title, []);

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
