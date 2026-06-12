import {
  HydraApi,
  clearAllDownloadSourceEntries,
  removeDownloadSourceEntries,
} from "@main/services";
import { downloadSourcesSublevel } from "@main/level";
import { registerEvent } from "../register-event";

const removeDownloadSource = async (
  _event: Electron.IpcMainInvokeEvent,
  removeAll = false,
  downloadSourceId?: string
) => {
  const params = new URLSearchParams({
    all: removeAll.toString(),
  });

  if (downloadSourceId) params.set("downloadSourceId", downloadSourceId);

  if (HydraApi.isLoggedIn() && HydraApi.hasActiveSubscription()) {
    void HydraApi.delete(`/profile/download-sources?${params.toString()}`);
  }

  if (removeAll) {
    await downloadSourcesSublevel.clear();
    await clearAllDownloadSourceEntries();
  } else if (downloadSourceId) {
    await downloadSourcesSublevel.del(downloadSourceId);
    await removeDownloadSourceEntries(downloadSourceId);
  }
};

registerEvent("removeDownloadSource", removeDownloadSource);
