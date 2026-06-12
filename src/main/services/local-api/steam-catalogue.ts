import axios from "axios";

import type { ShopAssets, Steam250Game } from "@types";

import { gamesShopAssetsSublevel, levelKeys } from "@main/level";
import { getSteamAppDetails } from "../steam";
import { requestSteam250 } from "../steam-250";
import { logger } from "../logger";
import { buildSteamAssets } from "./steam-assets";

export { buildSteamAssets } from "./steam-assets";

/**
 * Local replacement for the third-party Hydra catalogue backend. Everything
 * here is resolved from public Steam endpoints (store search, app details and
 * the well-known CDN asset paths) plus the steam250 lists already used by the
 * app, so the catalogue keeps working without losbroxas.org.
 */

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

let browseCache: { games: Steam250Game[]; fetchedAt: number } | null = null;
const BROWSE_CACHE_TTL_MS = 30 * 60 * 1000;

/** Most recognizable games first so the default listing feels curated. */
const BROWSE_LIST_PATHS = [
  "/most_played",
  "/top250",
  `/${new Date().getFullYear()}`,
  "/hidden_gems",
];

/**
 * Pool of well-known games used as the default catalogue listing when the
 * user browses without a search term. Combines every steam250 list the app
 * already consumes; cached in memory since scraping is slow.
 */
export const getBrowseCatalogue = async (): Promise<Steam250Game[]> => {
  if (browseCache && Date.now() - browseCache.fetchedAt < BROWSE_CACHE_TTL_MS) {
    return browseCache.games;
  }

  const lists = await Promise.all(
    BROWSE_LIST_PATHS.map((path) => requestSteam250(path))
  );

  const seen = new Set<string>();
  const games: Steam250Game[] = [];
  for (const game of lists.flat()) {
    if (!game || seen.has(game.objectId)) continue;
    seen.add(game.objectId);
    games.push(game);
  }

  if (games.length) {
    browseCache = { games, fetchedAt: Date.now() };
  }

  return games;
};
