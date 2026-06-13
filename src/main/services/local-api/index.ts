import axios, { AxiosError } from "axios";
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
  getIndexedSourceIds,
  getSourceIdsByFingerprints,
  ingestDownloadSource,
} from "./download-source-index";

export * from "./steam-catalogue";
export * from "./download-source-index";

/**
 * Hybrid backend adapter.
 *
 * `HydraApi` is the single choke point for every backend HTTP call (both the
 * main process and the renderer's generic `hydraApi` proxy go through it).
 * This adapter serves the launcher's core locally — browse catalogue, find
 * repacks, game assets — from public Steam endpoints and the local
 * download-source index, so that part keeps working without the third-party
 * server.
 *
 * Everything it doesn't serve locally (sign-in/profile, token refresh, social,
 * cloud saves, achievements, stats…) is delegated to the real backend at
 * `MAIN_VITE_API_URL` via the default HTTP adapter, so logging in and account
 * features work as before. Endpoints with no local handler return the
 * `PASS_TO_REMOTE` sentinel to opt into that delegation.
 */

/** This request has no local handler and must hit the real backend. */
const PASS_TO_REMOTE = Symbol("pass-to-remote");

/** The real HTTP adapter (Node) used to reach `MAIN_VITE_API_URL`. */
const remoteAdapter = axios.getAdapter(axios.defaults.adapter);

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

  const params = config.params ?? {};
  const allowed = Array.isArray(params.downloadSourceIds)
    ? (params.downloadSourceIds as string[])
    : undefined;

  // Sources added through the backend (e.g. Cloudflare-protected ones that
  // can't be fetched client-side) have no local entries. When none of the
  // requested sources are indexed locally, let the backend resolve the
  // repacks — it parsed those sources server-side.
  const indexedIds = new Set(await getIndexedSourceIds());
  const hasLocalSource = allowed
    ? allowed.some((id) => indexedIds.has(id))
    : indexedIds.size > 0;

  if (!hasLocalSource) return PASS_TO_REMOTE;

  const title = await resolveSteamTitle(objectId);
  if (!title) return [];

  return findRepacks(title, allowed);
};

const handleDownloadSourcesAdd = async (config: InternalAxiosRequestConfig) => {
  const body = parseBody(config) ?? {};
  const url: string | undefined = body.url;

  if (!url) throw new Error("Missing download source url");

  try {
    // Index the source locally so the catalogue and repacks resolve offline.
    return await ingestDownloadSource(url);
  } catch (err) {
    // Hosts behind a bot challenge (e.g. Cloudflare) can't be fetched
    // client-side. Rather than prompting the user, hand the add off to the
    // real backend, which fetches and parses the source server-side — the way
    // it worked before the local index existed.
    logger.info(
      "Local source indexing unavailable; delegating add to the backend",
      { url, message: err instanceof Error ? err.message : String(err) }
    );
    return PASS_TO_REMOTE;
  }
};

/**
 * Resolves a single backend request locally. Returns the response payload for
 * locally-served endpoints, or the `PASS_TO_REMOTE` sentinel for everything
 * else (account/auth/social/cloud), which the adapter forwards to the real
 * backend.
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

  // Account/auth/social/cloud (sign-in, /profile/*, token refresh, friends,
  // cloud saves, achievements…) are served by the real backend.
  return PASS_TO_REMOTE;
};

export const localApiAdapter: AxiosAdapter = async (config) => {
  let data: unknown;

  try {
    data = await resolveLocalRequest(config);
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

  // Forward to the real backend, letting its real responses and errors
  // (401s, etc.) propagate untouched so auth handling works normally.
  if (data === PASS_TO_REMOTE) {
    return remoteAdapter(config);
  }

  return buildResponse(config, data);
};
