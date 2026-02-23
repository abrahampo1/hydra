import type { GameRepack } from "@types";

import { db } from "../level";
import { levelKeys } from "./keys";

export const repackCacheSublevel = db.sublevel<string, GameRepack[]>(
  levelKeys.repackCache,
  {
    valueEncoding: "json",
  }
);
