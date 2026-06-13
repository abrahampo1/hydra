import { describe, it, expect } from "vitest";
import { formatName } from "@shared";

import { findRepacksInEntries, parseDownloadSourceEntries } from "./matching";

/**
 * Regression coverage against the REAL FitGirl source format. These titles are
 * verbatim from a live `fitgirl.json`, paired with the canonical Steam store
 * name the catalogue search returns. They guard the download-source detection
 * against the real-world decorations FitGirl adds (" – vX", "Digital Deluxe
 * Edition", "+ N DLCs", "Build NNNN", "Bundle", "Complete", subtitles after
 * ":", trademark symbols, en-dashes, roman numerals, casing).
 */
const REPACK_TITLES = [
  "Town to City: Deluxe Bundle – v1.0 (10230) + 2 Bonus DLCs",
  "Persona 3 Portable – v1.01",
  "Tormented Souls 2: Digital Deluxe Edition – v1.5.0.7 + 2 DLCs/Bonuses",
  "Little Nightmares III – Build 22781237 + 6 DLCs",
  "STARBITES: Digital Deluxe Edition – v1.00.0 + 2 Bonus DLCs",
  "Where the Forest Ends",
  "Starship Troopers: Terran Command – Complete Bundle, v6.4.0 + 3 DLCs",
  "Madden NFL 21 – v1.0.59.48236",
  "Terrinoth: Heroes of Descent – v1.0.8593.47804",
  "Teardown: Deluxe Edition, v2.0.3 + 6 DLCs",
  "Far Cry: New Dawn – Deluxe Edition, v1.0.8 HV + All DLCs + HD Texture Pack",
  "The Planet Crafter: Deluxe Bundle, v2.008 + 3 DLCs/Bonuses",
  "WILD HEARTS: Karakuri Edition – v1.3.3 + 6 DLCs",
  "F1 Manager 2022 – v1.13.0.105950",
  "Metal Gear Solid V: The Phantom Pain – v1.15 Build 6239679 + All Offline DLCs",
  "Headquarters: World War II – Complete, v1.04.13 + 3 DLCs/Bonuses",
  "PEAK – v1.61.b",
  "007 First Light",
];

// Canonical Steam store names (with their real ™/® and subtitles) that the
// catalogue search / browse list returns for each of the repacks above.
const STEAM_TITLES_THAT_MUST_MATCH: { steam: string; repack: string }[] = [
  { steam: "Town to City", repack: REPACK_TITLES[0] },
  { steam: "Persona 3 Portable", repack: REPACK_TITLES[1] },
  { steam: "Tormented Souls 2", repack: REPACK_TITLES[2] },
  { steam: "Little Nightmares III", repack: REPACK_TITLES[3] },
  { steam: "STARBITES", repack: REPACK_TITLES[4] },
  { steam: "Where the forest ends", repack: REPACK_TITLES[5] },
  { steam: "Starship Troopers: Terran Command", repack: REPACK_TITLES[6] },
  { steam: "Madden NFL 21", repack: REPACK_TITLES[7] },
  { steam: "Terrinoth®: Heroes of Descent", repack: REPACK_TITLES[8] },
  { steam: "Teardown", repack: REPACK_TITLES[9] },
  { steam: "Far Cry® New Dawn", repack: REPACK_TITLES[10] },
  { steam: "The Planet Crafter", repack: REPACK_TITLES[11] },
  { steam: "WILD HEARTS™", repack: REPACK_TITLES[12] },
  { steam: "F1® Manager 2022", repack: REPACK_TITLES[13] },
  { steam: "METAL GEAR SOLID V: THE PHANTOM PAIN", repack: REPACK_TITLES[14] },
  { steam: "Headquarters: World War II", repack: REPACK_TITLES[15] },
  { steam: "PEAK", repack: REPACK_TITLES[16] },
  { steam: "007 First Light", repack: REPACK_TITLES[17] },
];

const entries = parseDownloadSourceEntries(
  {
    name: "FitGirl",
    downloads: REPACK_TITLES.map((title) => ({
      title,
      uris: ["magnet:?xt=urn:btih:x"],
    })),
  },
  "fitgirl",
  "FitGirl"
);

describe("real FitGirl source format", () => {
  it("parses every well-formed entry", () => {
    expect(entries).toHaveLength(REPACK_TITLES.length);
  });

  it.each(STEAM_TITLES_THAT_MUST_MATCH)(
    "detects the repack for $steam",
    ({ steam, repack }) => {
      const repacks = findRepacksInEntries([entries], steam);
      const titles = repacks.map((r) => r.title);
      expect(
        titles,
        `formatName("${steam}") = "${formatName(steam)}"`
      ).toContain(repack);
    }
  );

  it("does not detect a repack for an unrelated game", () => {
    expect(findRepacksInEntries([entries], "Half-Life 3")).toEqual([]);
  });

  // Known limitation: when a repacker inserts a romanized alias right after a
  // non-ASCII title token (e.g. "ΔV (DeltaV): Rings of Saturn"), the stripped
  // alias word "deltav" sits between the game's words, so the contiguous
  // whole-word match misses it. Documented so a future normalization change
  // that fixes it flags this test to update.
  it("misses titles with an inserted romanized alias (documented gap)", () => {
    const aliasEntries = parseDownloadSourceEntries(
      {
        name: "FitGirl",
        downloads: [
          {
            title:
              "ΔV (DeltaV): Rings of Saturn – Space Furry Edition – v1.89.2",
            uris: ["magnet:?xt=urn:btih:y"],
          },
        ],
      },
      "fitgirl",
      "FitGirl"
    );
    expect(findRepacksInEntries([aliasEntries], "ΔV: Rings of Saturn")).toEqual(
      []
    );
  });
});
