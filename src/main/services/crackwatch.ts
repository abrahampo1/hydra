import axios, { type AxiosInstance } from "axios";

import type { CrackWatchStatus } from "@types";
import { logger } from "./logger";

const NUXT_DATA_REGEX =
  /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

const titleToSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/['’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const derefNuxtState = (arr: unknown[]): ((value: unknown) => unknown) => {
  const cache = new Map<number, unknown>();
  const resolve = (value: unknown, depth: number): unknown => {
    if (depth > 32) return null;
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value < 0 || value >= arr.length) {
        return value;
      }
      if (cache.has(value)) return cache.get(value);
      cache.set(value, null); // break cycles
      const resolved = resolve(arr[value], depth + 1);
      cache.set(value, resolved);
      return resolved;
    }
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) {
      return value.map((v) => resolve(v, depth + 1));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolve(v, depth + 1);
    }
    return out;
  };
  return (value) => resolve(value, 0);
};

interface GameStatusEntry {
  slug?: string;
  title?: string;
  protections?: string | null;
  hacked_groups_en?: string | null;
  crack_date?: string | null;
  steam_prod_id?: number | string | null;
  description_en?: string | null;
  specs_info?: unknown;
}

const isMainGameEntry = (entry: GameStatusEntry): boolean =>
  entry !== null &&
  typeof entry === "object" &&
  // Related-game cards lack description_en/specs_info — only the focused game has them.
  (entry.description_en !== undefined || entry.specs_info !== undefined);

class CrackWatchServiceClass {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: "https://gamestatus.info",
      timeout: 8000,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Hydra/CrackWatch",
      },
    });
  }

  async getStatusByTitleAndAppId(
    title: string,
    appId: string
  ): Promise<CrackWatchStatus | null> {
    const slug = titleToSlug(title);
    if (!slug) return null;

    try {
      const { data: html } = await this.client.get<string>(`/${slug}/en`, {
        responseType: "text",
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const match = NUXT_DATA_REGEX.exec(html);
      if (!match) {
        logger.warn(`CrackWatch: __NUXT_DATA__ not found for slug=${slug}`);
        return null;
      }

      const arr = JSON.parse(match[1]) as unknown[];
      if (!Array.isArray(arr)) return null;

      const deref = derefNuxtState(arr);

      let game: GameStatusEntry | null = null;
      for (const entry of arr) {
        if (
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          "slug" in entry &&
          "crack_date" in entry &&
          "steam_prod_id" in entry &&
          isMainGameEntry(entry as GameStatusEntry)
        ) {
          const resolved = deref(entry) as GameStatusEntry;
          if (String(resolved.steam_prod_id) === String(appId)) {
            game = resolved;
            break;
          }
        }
      }

      if (!game) {
        logger.info(
          `CrackWatch: no entry matched appId=${appId} on slug=${slug}`
        );
        return null;
      }

      const crackDate =
        typeof game.crack_date === "string" && game.crack_date.length > 0
          ? game.crack_date
          : null;

      return {
        isCracked: crackDate !== null,
        crackDate,
        crackGroup:
          typeof game.hacked_groups_en === "string" && game.hacked_groups_en
            ? game.hacked_groups_en
            : null,
        protection:
          typeof game.protections === "string" && game.protections
            ? game.protections
            : null,
      };
    } catch (err) {
      logger.warn(
        `CrackWatch lookup failed for slug=${slug} appId=${appId}`,
        err
      );
      return null;
    }
  }
}

export const CrackWatchService = new CrackWatchServiceClass();
