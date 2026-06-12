import { AxiosError } from "axios";
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import type { CatalogueSearchResult, GameStats, TrendingGame } from "@types";

import { logger } from "../logger";
import {
  buildSteamAssets,
  getBrowseCatalogue,
  getSectionAssets,
  resolveSteamTitle,
  searchSteamGames,
} from "./steam-catalogue";
import {
  annotateSourcesForTitles,
  findRepacks,
  getSourceIdsByFingerprints,
  ingestDownloadSource,
} from "./download-source-index";

export * from "./steam-catalogue";
export * from "./download-source-index";

/**
 * Local, self-hosted replacement for the third-party Hydra backend.
 *
 * `HydraApi` is the single choke point for every backend HTTP call (both the
 * main process and the renderer's generic `hydraApi` proxy go through it).
 * Installing this axios adapter makes those requests resolve against public
 * Steam endpoints and the local download-source index instead of
 * losbroxas.org, so the launcher's core (browse catalogue, find repacks,
 * download, manage library) works without any third-party server.
 *
 * Authenticated/social/cloud endpoints are never reached in this mode: callers
 * pass `needsAuth`, and `HydraApi.validateOptions` throws `UserNotLoggedInError`
 * before the request, which the UI already degrades gracefully around. The
 * catch-all below keeps any unexpected call from crashing.
 */

const buildResponse = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200
): AxiosResponse => ({
  data,
  status,
  statusText: status === 200 ? "OK" : "Error",
  headers: {},
  config,
  request: {},
});

const parseBody = (config: InternalAxiosRequestConfig): any => {
  const { data } = config;
  if (data == null) return undefined;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  return data;
};

const STEAM_STORE_APP_URL = "https://store.steampowered.com/app";

const handleCatalogueSearch = async (config: InternalAxiosRequestConfig) => {
  const body = parseBody(config) ?? {};
  const term: string = body.title ?? "";
  const take: number = body.take ?? 24;
  const skip: number = body.skip ?? 0;
  const fingerprints: string[] = Array.isArray(body.downloadSourceFingerprints)
    ? body.downloadSourceFingerprints
    : [];

  // With a term we search the Steam store; without one (the default catalogue
  // view) we browse the cached steam250 pool so the page is never empty.
  const candidates = term.trim()
    ? (await searchSteamGames(term, "english", skip + take + 12)).map(
        (item) => ({ objectId: String(item.id), title: item.name })
      )
    : await getBrowseCatalogue();

  const sourcesByTitle = await annotateSourcesForTitles(
    candidates.map((candidate) => candidate.title)
  );

  let filtered = candidates;
  if (fingerprints.length) {
    const allowedIds = await getSourceIdsByFingerprints(fingerprints);
    filtered = candidates.filter((candidate) =>
      (sourcesByTitle.get(candidate.title) ?? []).some((id) =>
        allowedIds.has(id)
      )
    );
  }

  const page = filtered.slice(skip, skip + take);

  const edges: CatalogueSearchResult[] = page.map((candidate) => {
    const assets = buildSteamAssets(candidate.objectId, candidate.title);

    return {
      id: `steam:${candidate.objectId}`,
      objectId: candidate.objectId,
      title: candidate.title,
      shop: "steam" as const,
      genres: [],
      libraryImageUrl: assets.libraryImageUrl,
      downloadSources: sourcesByTitle.get(candidate.title) ?? [],
    };
  });

  return { edges, count: filtered.length };
};

const handleCatalogueSuggestions = async (
  config: InternalAxiosRequestConfig
) => {
  const params = config.params ?? {};
  const query: string = params.query ?? "";
  const limit = Number(params.limit ?? 6);

  const items = await searchSteamGames(query, "english", limit);

  return items.map((item) => {
    const objectId = String(item.id);
    return {
      title: item.name,
      objectId,
      shop: "steam" as const,
      iconUrl: item.tiny_image ?? buildSteamAssets(objectId, item.name).iconUrl,
    };
  });
};

const handleCatalogueSection = async (
  category: string,
  config: InternalAxiosRequestConfig
) => {
  const params = config.params ?? {};
  const take = Number(params.take ?? 12);

  const assets = await getSectionAssets(
    category === "featured" ? "featured" : category,
    take
  );

  const sourcesByTitle = await annotateSourcesForTitles(
    assets.map((asset) => asset.title)
  );

  const annotated = assets.map((asset) => ({
    ...asset,
    downloadSources: sourcesByTitle.get(asset.title) ?? [],
  }));

  if (category === "featured") {
    return annotated.map(
      (asset): TrendingGame => ({
        ...asset,
        description: null,
        uri: `${STEAM_STORE_APP_URL}/${asset.objectId}`,
      })
    );
  }

  return annotated;
};

const handleGameAssets = async (shop: string, objectId: string) => {
  if (shop !== "steam") return null;

  const title = (await resolveSteamTitle(objectId)) ?? "";
  const assets = buildSteamAssets(objectId, title);

  if (!title) return assets;

  const sourcesByTitle = await annotateSourcesForTitles([title]);
  return { ...assets, downloadSources: sourcesByTitle.get(title) ?? [] };
};

const handleGameRepacks = async (
  shop: string,
  objectId: string,
  config: InternalAxiosRequestConfig
) => {
  if (shop !== "steam") return [];

  const title = await resolveSteamTitle(objectId);
  if (!title) return [];

  const params = config.params ?? {};
  const allowed = Array.isArray(params.downloadSourceIds)
    ? (params.downloadSourceIds as string[])
    : undefined;

  return findRepacks(title, allowed);
};

const handleDownloadSourcesAdd = async (config: InternalAxiosRequestConfig) => {
  const body = parseBody(config) ?? {};
  const url: string | undefined = body.url;

  if (!url) throw new Error("Missing download source url");

  return ingestDownloadSource(url);
};

/**
 * Resolves a single backend request locally. Returns the response payload, or
 * `null` for endpoints that have no local equivalent.
 */
const resolveLocalRequest = async (
  config: InternalAxiosRequestConfig
): Promise<unknown> => {
  const method = (config.method ?? "get").toLowerCase();
  const parsedUrl = new URL(
    config.url ?? "",
    config.baseURL || "http://local.hydra"
  );
  const segments = parsedUrl.pathname.split("/").filter(Boolean);

  // /catalogue/*
  if (segments[0] === "catalogue") {
    if (method === "post" && segments[1] === "search") {
      return handleCatalogueSearch(config);
    }
    if (segments[1] === "search" && segments[2] === "suggestions") {
      return handleCatalogueSuggestions(config);
    }
    if (segments[1]) {
      return handleCatalogueSection(segments[1], config);
    }
  }

  // /games/:shop/:objectId/*
  if (segments[0] === "games" && segments.length >= 4) {
    const shop = segments[1];
    const objectId = segments[2];
    const resource = segments[3];

    if (resource === "assets") return handleGameAssets(shop, objectId);
    if (resource === "download-sources") {
      return handleGameRepacks(shop, objectId, config);
    }
    if (resource === "stats") {
      return {
        downloadCount: 0,
        playerCount: 0,
        averageScore: null,
        reviewCount: 0,
      } satisfies GameStats;
    }
    if (resource === "how-long-to-beat") return null;
    if (resource === "reviews") {
      if (segments[4] === "check") return { hasReviewed: false };
      return { reviews: [], totalCount: 0 };
    }
    // Download/queue reports — nothing to record without a backend.
    if (resource === "download") return {};
  }

  // /download-sources/*
  if (segments[0] === "download-sources") {
    if (method === "post" && !segments[1]) {
      return handleDownloadSourcesAdd(config);
    }
    // sync / changes have no remote state to reconcile locally.
    return [];
  }

  // /auth/* — logout/refresh are no-ops without a remote session.
  if (segments[0] === "auth") {
    if (segments[1] === "refresh") return { accessToken: "", expiresIn: 0 };
    return {};
  }

  logger.info("Local API: unhandled endpoint, returning empty response", {
    method,
    path: parsedUrl.pathname,
  });

  return null;
};

export const localApiAdapter: AxiosAdapter = async (config) => {
  try {
    const data = await resolveLocalRequest(config);
    return buildResponse(config, data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Local API: request failed", {
      method: config.method,
      url: config.url,
      message,
    });
    // Reject with a proper AxiosError (config attached) so HydraApi's
    // interceptors and callers can handle it like any other request failure.
    throw new AxiosError(message, AxiosError.ERR_BAD_RESPONSE, config);
  }
};
