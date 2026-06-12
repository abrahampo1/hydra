import axios from "axios";

import type { ShopAssets } from "@types";

import { gamesShopAssetsSublevel, levelKeys } from "@main/level";
import { getSteamAppDetails } from "../steam";
import { requestSteam250 } from "../steam-250";
import { logger } from "../logger";

/**
 * Local replacement for the third-party Hydra catalogue backend. Everything
 * here is resolved from public Steam endpoints (store search, app details and
 * the well-known CDN asset paths) plus the steam250 lists already used by the
 * app, so the catalogue keeps working without losbroxas.org.
 */

const STEAM_APP_CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps";

interface SteamStoreSearchItem {
  id: number;
  type: string;
  name: string;
  tiny_image?: string;
}

interface SteamStoreSearchResponse {
  total: number;
  items: SteamStoreSearchItem[];
}

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

/**
 * Resolves the canonical title for a Steam objectId. Prefers the locally
 * cached assets title, falling back to a Steam app-details lookup.
 */
export const resolveSteamTitle = async (
  objectId: string
): Promise<string | null> => {
  const cachedAssets = await gamesShopAssetsSublevel.get(
    levelKeys.game("steam", objectId)
  );

  if (cachedAssets?.title) return cachedAssets.title;

  const details = await getSteamAppDetails(objectId, "english").catch(
    () => null
  );

  return details?.name ?? null;
};

/**
 * Searches the Steam store for games matching a free-text term.
 */
export const searchSteamGames = async (
  term: string,
  language = "english",
  limit = 24
): Promise<SteamStoreSearchItem[]> => {
  if (!term.trim()) return [];

  const searchParams = new URLSearchParams({
    term,
    l: language,
    cc: "US",
  });

  return axios
    .get<SteamStoreSearchResponse>(
      `https://store.steampowered.com/api/storesearch/?${searchParams.toString()}`
    )
    .then((response) => (response.data?.items ?? []).slice(0, limit))
    .catch((err) => {
      logger.error("Failed to search Steam store", {
        message: err?.message,
        code: err?.code,
      });
      return [] as SteamStoreSearchItem[];
    });
};

/**
 * Steam250 list paths backing each catalogue section. All of these are known
 * stable steam250 routes.
 */
const SECTION_PATHS: Record<string, string> = {
  hot: "/most_played",
  weekly: `/${new Date().getFullYear()}`,
  achievements: "/top250",
  featured: "/hidden_gems",
};

/**
 * Returns the games backing a catalogue section as `ShopAssets`.
 */
export const getSectionAssets = async (
  category: string,
  take = 12
): Promise<ShopAssets[]> => {
  const path = SECTION_PATHS[category] ?? "/top250";
  const games = await requestSteam250(path);

  return games
    .slice(0, take)
    .map((game) => buildSteamAssets(game.objectId, game.title));
};
