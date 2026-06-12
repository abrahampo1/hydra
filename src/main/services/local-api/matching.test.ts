import { describe, it, expect } from "vitest";

import {
  annotateSourcesInEntries,
  findRepacksInEntries,
  hashId,
  matchesGame,
  parseDownloadSourceEntries,
  type RawDownloadSourceJson,
} from "./matching";

const sampleSource: RawDownloadSourceJson = {
  name: "Test Source",
  downloads: [
    {
      title: "ELDEN RING: Shadow of the Erdtree Edition v1.12 [FitGirl Repack]",
      uris: ["magnet:?xt=urn:btih:elden"],
      uploadDate: "2024-06-21T00:00:00.000Z",
      fileSize: "50 GB",
    },
    {
      title: "Cyberpunk 2077 v2.1 + All DLCs [DODI Repack]",
      uris: ["magnet:?xt=urn:btih:cp2077", "https://gofile.io/d/abc"],
      uploadDate: "2023-12-05T00:00:00.000Z",
      fileSize: "70 GB",
    },
    {
      // Invalid: missing uris — must be filtered out.
      title: "Broken Entry",
    } as never,
    {
      // Invalid: missing title — must be filtered out.
      uris: ["magnet:?xt=urn:btih:nope"],
    } as never,
  ],
};

describe("hashId", () => {
  it("is deterministic and respects the requested length", () => {
    const a = hashId("https://example.com/source.json", 24);
    const b = hashId("https://example.com/source.json", 24);
    expect(a).toBe(b);
    expect(a).toHaveLength(24);
    expect(hashId("https://example.com/source.json", 16)).toHaveLength(16);
  });

  it("produces different ids for different inputs", () => {
    expect(hashId("a", 24)).not.toBe(hashId("b", 24));
  });
});

describe("matchesGame", () => {
  it("matches an exact formatted title", () => {
    expect(matchesGame("elden ring", "elden ring")).toBe(true);
  });

  it("matches when the game name is a leading whole-word run", () => {
    expect(matchesGame("elden ring", "elden ring v1 12 fitgirl repack")).toBe(
      true
    );
  });

  it("does not match a partial word", () => {
    expect(matchesGame("elden", "eldenring")).toBe(false);
  });

  it("returns false for empty inputs", () => {
    expect(matchesGame("", "elden ring")).toBe(false);
    expect(matchesGame("elden ring", "")).toBe(false);
  });
});

describe("parseDownloadSourceEntries", () => {
  const entries = parseDownloadSourceEntries(
    sampleSource,
    "src1",
    "Test Source"
  );

  it("keeps only entries with a title and uris array", () => {
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.title)).toEqual([
      "ELDEN RING: Shadow of the Erdtree Edition v1.12 [FitGirl Repack]",
      "Cyberpunk 2077 v2.1 + All DLCs [DODI Repack]",
    ]);
  });

  it("precomputes a normalized formatted title", () => {
    expect(entries[0].formattedTitle).toContain("elden ring");
    expect(entries[0].formattedTitle).toBe(
      entries[0].formattedTitle.toLowerCase()
    );
  });

  it("tags entries with the source id/name and parses the upload date", () => {
    expect(entries[0].sourceId).toBe("src1");
    expect(entries[0].sourceName).toBe("Test Source");
    expect(entries[0].uploadDateMs).toBe(
      new Date("2024-06-21T00:00:00.000Z").getTime()
    );
  });

  it("returns an empty array when downloads is missing", () => {
    expect(parseDownloadSourceEntries({ name: "x" }, "s", "x")).toEqual([]);
  });
});

describe("findRepacksInEntries", () => {
  const entries = parseDownloadSourceEntries(
    sampleSource,
    "src1",
    "Test Source"
  );
  const perSource = [entries];

  it("finds a repack despite edition/version/repacker tags", () => {
    const repacks = findRepacksInEntries(perSource, "ELDEN RING");
    expect(repacks).toHaveLength(1);
    expect(repacks[0].downloadSourceId).toBe("src1");
    expect(repacks[0].downloadSourceName).toBe("Test Source");
    expect(repacks[0].uris).toEqual(["magnet:?xt=urn:btih:elden"]);
    expect(repacks[0].id).toBe("src1:0");
    expect(repacks[0].uploadDate).toBe("2024-06-21T00:00:00.000Z");
  });

  it("matches another game in the same source", () => {
    const repacks = findRepacksInEntries(perSource, "Cyberpunk 2077");
    expect(repacks).toHaveLength(1);
    expect(repacks[0].title).toContain("Cyberpunk 2077");
  });

  it("returns nothing for a game with no repack", () => {
    expect(findRepacksInEntries(perSource, "Half-Life 3")).toEqual([]);
  });

  it("respects the allowed source ids filter", () => {
    expect(findRepacksInEntries(perSource, "ELDEN RING", ["other"])).toEqual(
      []
    );
    expect(
      findRepacksInEntries(perSource, "ELDEN RING", ["src1"])
    ).toHaveLength(1);
  });

  it("returns nothing for an empty title", () => {
    expect(findRepacksInEntries(perSource, "")).toEqual([]);
  });
});

describe("annotateSourcesInEntries", () => {
  const entries = parseDownloadSourceEntries(
    sampleSource,
    "src1",
    "Test Source"
  );

  it("maps each title to the source ids that contain a match", () => {
    const result = annotateSourcesInEntries(
      [entries],
      ["ELDEN RING", "Cyberpunk 2077", "Unknown Game"]
    );

    expect(result.get("ELDEN RING")).toEqual(["src1"]);
    expect(result.get("Cyberpunk 2077")).toEqual(["src1"]);
    expect(result.get("Unknown Game")).toEqual([]);
  });

  it("does not duplicate a source id for the same title", () => {
    const dup = parseDownloadSourceEntries(
      {
        name: "Dup",
        downloads: [
          { title: "Elden Ring v1", uris: ["magnet:a"] },
          { title: "Elden Ring v2", uris: ["magnet:b"] },
        ],
      },
      "src2",
      "Dup"
    );

    const result = annotateSourcesInEntries([dup], ["Elden Ring"]);
    expect(result.get("Elden Ring")).toEqual(["src2"]);
  });
});
