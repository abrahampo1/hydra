import { db } from "../level";
import { levelKeys } from "./keys";
import type { DownloadSourceEntry } from "@types";

/**
 * Stores the parsed entries of each download source, keyed by the source id.
 * The value is the full list of entries for that source, which lets the local
 * catalogue match repacks for a game without relying on a remote backend.
 */
export const downloadSourceEntriesSublevel = db.sublevel<
  string,
  DownloadSourceEntry[]
>(levelKeys.downloadSourceEntries, {
  valueEncoding: "json",
});
