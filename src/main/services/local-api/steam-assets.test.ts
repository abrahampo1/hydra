import { describe, it, expect } from "vitest";

import { STEAM_APP_CDN, buildSteamAssets } from "./steam-assets";

describe("buildSteamAssets", () => {
  const assets = buildSteamAssets("1245620", "ELDEN RING");

  it("returns a steam ShopAssets with the given object id and title", () => {
    expect(assets.objectId).toBe("1245620");
    expect(assets.shop).toBe("steam");
    expect(assets.title).toBe("ELDEN RING");
    expect(assets.downloadSources).toEqual([]);
    expect(assets.logoPosition).toBeNull();
  });

  it("builds the conventional Steam CDN urls from the object id", () => {
    expect(assets.libraryImageUrl).toBe(
      `${STEAM_APP_CDN}/1245620/library_600x900.jpg`
    );
    expect(assets.libraryHeroImageUrl).toBe(
      `${STEAM_APP_CDN}/1245620/library_hero.jpg`
    );
    expect(assets.coverImageUrl).toBe(`${STEAM_APP_CDN}/1245620/header.jpg`);
    expect(assets.logoImageUrl).toBe(`${STEAM_APP_CDN}/1245620/logo.png`);
    expect(assets.iconUrl).toBe(`${STEAM_APP_CDN}/1245620/capsule_231x87.jpg`);
  });
});
