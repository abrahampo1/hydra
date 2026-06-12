import type { ShopAssets } from "@types";

/**
 * Pure helpers for Steam CDN asset URLs. Kept dependency-free (no LevelDB,
 * network or electron) so they are trivially unit-testable.
 */

export const STEAM_APP_CDN =
  "https://cdn.cloudflare.steamstatic.com/steam/apps";

/**
 * Builds a `ShopAssets` object from the predictable Steam CDN asset paths.
 * Some games miss a few of these files; the renderer degrades gracefully when
 * an image 404s, so it is fine to always provide the conventional URLs.
 */
export const buildSteamAssets = (
  objectId: string,
  title: string
): ShopAssets => ({
  objectId,
  shop: "steam",
  title,
  iconUrl: `${STEAM_APP_CDN}/${objectId}/capsule_231x87.jpg`,
  libraryHeroImageUrl: `${STEAM_APP_CDN}/${objectId}/library_hero.jpg`,
  libraryImageUrl: `${STEAM_APP_CDN}/${objectId}/library_600x900.jpg`,
  logoImageUrl: `${STEAM_APP_CDN}/${objectId}/logo.png`,
  logoPosition: null,
  coverImageUrl: `${STEAM_APP_CDN}/${objectId}/header.jpg`,
  downloadSources: [],
});
