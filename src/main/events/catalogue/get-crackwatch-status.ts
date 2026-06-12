import type { CrackWatchStatus, GameShop } from "@types";
import { registerEvent } from "../register-event";
import { CrackWatchService } from "@main/services";
import { crackwatchCacheSublevel, levelKeys } from "@main/level";

const LOCAL_CACHE_EXPIRATION = 1000 * 60 * 60 * 24; // 24 hours

const getCrackWatchStatus = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  title: string
): Promise<CrackWatchStatus | null> => {
  if (shop !== "steam" || !title) {
    return null;
  }

  const cached = await crackwatchCacheSublevel.get(
    levelKeys.game(shop, objectId)
  );

  if (cached && cached.updatedAt + LOCAL_CACHE_EXPIRATION > Date.now()) {
    const { updatedAt: _updatedAt, ...status } = cached;
    return status;
  }

  const status = await CrackWatchService.getStatusByTitleAndAppId(
    title,
    objectId
  );

  if (status) {
    await crackwatchCacheSublevel.put(levelKeys.game(shop, objectId), {
      ...status,
      updatedAt: Date.now(),
    });
  }

  return status;
};

registerEvent("getCrackWatchStatus", getCrackWatchStatus);
