import type { CrackWatchStatus } from "@types";

import { db } from "../level";
import { levelKeys } from "./keys";

export const crackwatchCacheSublevel = db.sublevel<
  string,
  CrackWatchStatus & { updatedAt: number }
>(levelKeys.crackwatchCache, {
  valueEncoding: "json",
});
