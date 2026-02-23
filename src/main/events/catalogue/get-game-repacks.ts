import type { GameRepack, GameShop } from "@types";
import { registerEvent } from "../register-event";
import { HydraApi, logger } from "@main/services";
import {
  downloadSourcesSublevel,
  levelKeys,
  repackCacheSublevel,
} from "@main/level";
import { orderBy } from "lodash-es";

const getGameRepacks = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
): Promise<GameRepack[]> => {
  const cacheKey = levelKeys.game(shop, objectId);

  const sourcesRaw = await downloadSourcesSublevel.values().all();
  const sources = orderBy(sourcesRaw, "createdAt", "desc");

  const params = {
    take: 100,
    skip: 0,
    downloadSourceIds: sources.map((source) => source.id),
  };

  try {
    const repacks = await HydraApi.get<GameRepack[]>(
      `/games/${shop}/${objectId}/download-sources`,
      params,
      { needsAuth: false }
    );

    repackCacheSublevel.put(cacheKey, repacks).catch((err) => {
      logger.error("Failed to cache repacks:", err);
    });

    return repacks;
  } catch (err) {
    logger.error("Failed to fetch repacks from API, trying cache:", err);

    const cached = await repackCacheSublevel.get(cacheKey);
    if (cached) return cached;

    return [];
  }
};

registerEvent("getGameRepacks", getGameRepacks);
