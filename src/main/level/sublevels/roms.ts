import type { RomEntry } from "@types";

import { db } from "../level";
import { levelKeys } from "./keys";

export const romsSublevel = db.sublevel<string, RomEntry>(levelKeys.roms, {
  valueEncoding: "json",
});
