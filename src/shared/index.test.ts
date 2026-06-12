import { describe, it, expect } from "vitest";

import {
  Downloader,
  formatBytes,
  formatName,
  getDownloadersForUri,
  parseBytes,
} from "./index";

describe("formatName", () => {
  it("lowercases and strips trademark symbols", () => {
    expect(formatName("ELDEN RING™")).toBe("elden ring");
  });

  it("removes special edition suffixes", () => {
    const formatted = formatName(
      "The Witcher 3: Wild Hunt - Game of the Year Edition"
    );
    expect(formatted).toContain("the witcher 3 wild hunt");
    expect(formatted).not.toContain("edition");
  });

  it("turns underscores into spaces and strips other symbols", () => {
    // Underscores become spaces; hyphens (and other symbols) are removed.
    expect(formatName("Half-Life_2")).toBe("halflife 2");
    expect(formatName("Cyberpunk 2077")).toBe("cyberpunk 2077");
  });
});

describe("formatBytes", () => {
  it("formats common sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
  });
});

describe("parseBytes", () => {
  it("parses size strings back to bytes", () => {
    expect(parseBytes("1 KB")).toBe(1024);
    expect(parseBytes("1.5 KB")).toBe(1536);
    expect(parseBytes("50 GB")).toBe(50 * 1024 ** 3);
  });

  it("returns null for invalid input", () => {
    expect(parseBytes(null)).toBeNull();
    expect(parseBytes("garbage")).toBeNull();
  });
});

describe("getDownloadersForUri", () => {
  it("offers multiple downloaders for magnet links", () => {
    const downloaders = getDownloadersForUri("magnet:?xt=urn:btih:abc");
    expect(downloaders).toContain(Downloader.Torrent);
  });

  it("maps known hosts to their downloader", () => {
    expect(getDownloadersForUri("https://gofile.io/d/abc")).toEqual([
      Downloader.Gofile,
    ]);
  });

  it("returns an empty list for unknown uris", () => {
    expect(getDownloadersForUri("https://example.com/file.zip")).toEqual([]);
  });
});
