import { useAppSelector, useToast } from "@renderer/hooks";
import { logger } from "@renderer/logger";
import type {
  LudusaviBackup,
  GameArtifact,
  GameShop,
  BackupProvider,
  GoogleDriveBackupArtifact,
} from "@types";
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

export enum CloudSyncState {
  New,
  Different,
  Same,
  Unknown,
}

export interface CloudSyncContext {
  backupPreview: LudusaviBackup | null;
  artifacts: GameArtifact[];
  showCloudSyncModal: boolean;
  showCloudSyncFilesModal: boolean;
  backupState: CloudSyncState;
  backupProvider: BackupProvider;
  setShowCloudSyncModal: React.Dispatch<React.SetStateAction<boolean>>;
  downloadGameArtifact: (gameArtifactId: string) => Promise<void>;
  uploadSaveGame: (downloadOptionTitle: string | null) => Promise<void>;
  deleteGameArtifact: (gameArtifactId: string) => Promise<void>;
  setShowCloudSyncFilesModal: React.Dispatch<React.SetStateAction<boolean>>;
  getGameBackupPreview: () => Promise<void>;
  getGameArtifacts: () => Promise<void>;
  toggleArtifactFreeze: (
    gameArtifactId: string,
    freeze: boolean
  ) => Promise<void>;
  restoringBackup: boolean;
  uploadingBackup: boolean;
  loadingPreview: boolean;
  loadingArtifacts: boolean;
  freezingArtifact: boolean;
}

export const cloudSyncContext = createContext<CloudSyncContext>({
  backupPreview: null,
  showCloudSyncModal: false,
  backupState: CloudSyncState.Unknown,
  backupProvider: "hydra-cloud",
  setShowCloudSyncModal: () => {},
  downloadGameArtifact: async () => {},
  uploadSaveGame: async () => {},
  artifacts: [],
  deleteGameArtifact: async () => {},
  showCloudSyncFilesModal: false,
  setShowCloudSyncFilesModal: () => {},
  getGameBackupPreview: async () => {},
  toggleArtifactFreeze: async () => {},
  getGameArtifacts: async () => {},
  restoringBackup: false,
  uploadingBackup: false,
  loadingPreview: false,
  loadingArtifacts: false,
  freezingArtifact: false,
});

const { Provider } = cloudSyncContext;
export const { Consumer: CloudSyncContextConsumer } = cloudSyncContext;

export interface CloudSyncContextProviderProps {
  children: React.ReactNode;
  objectId: string;
  shop: GameShop;
}

const mapGoogleDriveArtifact = (
  backup: GoogleDriveBackupArtifact
): GameArtifact => ({
  id: backup.id,
  artifactLengthInBytes: backup.size,
  downloadOptionTitle: null,
  createdAt: backup.createdAt,
  updatedAt: backup.modifiedAt,
  hostname: "",
  downloadCount: 0,
  label: backup.label ?? undefined,
  isFrozen: false,
});

export function CloudSyncContextProvider({
  children,
  objectId,
  shop,
}: CloudSyncContextProviderProps) {
  const { t } = useTranslation("game_details");

  const [artifacts, setArtifacts] = useState<GameArtifact[]>([]);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [backupPreview, setBackupPreview] = useState<LudusaviBackup | null>(
    null
  );
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [showCloudSyncFilesModal, setShowCloudSyncFilesModal] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [freezingArtifact, setFreezingArtifact] = useState(false);

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const backupProvider: BackupProvider =
    userPreferences?.backupProvider ?? "hydra-cloud";

  const { showSuccessToast, showErrorToast } = useToast();

  const downloadGameArtifact = useCallback(
    async (gameArtifactId: string) => {
      setRestoringBackup(true);

      if (backupProvider === "local") {
        window.electron.localBackup.downloadBackup(
          objectId,
          shop,
          gameArtifactId
        );
      } else {
        window.electron.downloadGameArtifact(objectId, shop, gameArtifactId);
      }
    },
    [objectId, shop, backupProvider]
  );

  const getGameArtifacts = useCallback(async () => {
    if (shop === "custom") {
      setArtifacts([]);
      return;
    }

    setLoadingArtifacts(true);

    try {
      if (backupProvider === "local") {
        const results = await window.electron.localBackup
          .listBackups(objectId, shop)
          .catch(() => []);
        setArtifacts(results.map(mapGoogleDriveArtifact));
      } else {
        const params = new URLSearchParams({
          objectId,
          shop,
        });

        const results = await window.electron.hydraApi
          .get<GameArtifact[]>(
            `/profile/games/artifacts?${params.toString()}`,
            {
              needsSubscription: true,
            }
          )
          .catch(() => []);
        setArtifacts(results);
      }
    } finally {
      setLoadingArtifacts(false);
    }
  }, [objectId, shop, backupProvider]);

  const getGameBackupPreview = useCallback(async () => {
    setLoadingPreview(true);

    try {
      const preview = await window.electron.getGameBackupPreview(
        objectId,
        shop
      );

      setBackupPreview(preview);
    } catch (err) {
      logger.error("Failed to get game backup preview", objectId, shop, err);
    } finally {
      setLoadingPreview(false);
    }
  }, [objectId, shop]);

  const uploadSaveGame = useCallback(
    async (downloadOptionTitle: string | null) => {
      setUploadingBackup(true);

      const uploadPromise =
        backupProvider === "local"
          ? window.electron.localBackup.uploadSaveGame(
              objectId,
              shop,
              downloadOptionTitle
            )
          : window.electron.uploadSaveGame(objectId, shop, downloadOptionTitle);

      uploadPromise.catch((err) => {
        setUploadingBackup(false);
        logger.error("Failed to upload save game", { objectId, shop, err });
        showErrorToast(t("backup_failed"));
      });
    },
    [objectId, shop, backupProvider, t, showErrorToast]
  );

  const toggleArtifactFreeze = useCallback(
    async (gameArtifactId: string, freeze: boolean) => {
      if (backupProvider !== "hydra-cloud") return;

      setFreezingArtifact(true);
      try {
        const endpoint = freeze ? "freeze" : "unfreeze";
        await window.electron.hydraApi.put(
          `/profile/games/artifacts/${gameArtifactId}/${endpoint}`
        );
        getGameArtifacts();
      } catch (err) {
        logger.error("Failed to toggle artifact freeze", objectId, shop, err);
        throw err;
      } finally {
        setFreezingArtifact(false);
      }
    },
    [objectId, shop, getGameArtifacts, backupProvider]
  );

  useEffect(() => {
    const removeUploadStartedListener = window.electron.onUploadStarted(
      objectId,
      shop,
      () => {
        setUploadingBackup(true);
      }
    );

    const removeUploadCompleteListener = window.electron.onUploadComplete(
      objectId,
      shop,
      () => {
        showSuccessToast(t("backup_uploaded"));
        setUploadingBackup(false);
        getGameArtifacts();
        getGameBackupPreview();
      }
    );

    const removeDownloadCompleteListener =
      window.electron.onBackupDownloadComplete(objectId, shop, () => {
        showSuccessToast(t("backup_restored"));

        setRestoringBackup(false);
        getGameArtifacts();
        getGameBackupPreview();
      });

    return () => {
      removeUploadStartedListener();
      removeUploadCompleteListener();
      removeDownloadCompleteListener();
    };
  }, [
    objectId,
    shop,
    showSuccessToast,
    t,
    getGameBackupPreview,
    getGameArtifacts,
  ]);

  const deleteGameArtifact = useCallback(
    async (gameArtifactId: string) => {
      if (backupProvider === "local") {
        await window.electron.localBackup.deleteBackup(gameArtifactId);
      } else {
        await window.electron.hydraApi.delete<{ ok: boolean }>(
          `/profile/games/artifacts/${gameArtifactId}`
        );
      }

      getGameBackupPreview();
      getGameArtifacts();
    },
    [getGameBackupPreview, getGameArtifacts, backupProvider]
  );

  useEffect(() => {
    setBackupPreview(null);
    setArtifacts([]);
    setShowCloudSyncModal(false);
    setRestoringBackup(false);
    setUploadingBackup(false);
    setLoadingArtifacts(false);
  }, [objectId, shop]);

  const backupState = useMemo(() => {
    if (!backupPreview) return CloudSyncState.Unknown;
    if (backupPreview.overall.changedGames.new) return CloudSyncState.New;
    if (backupPreview.overall.changedGames.different)
      return CloudSyncState.Different;
    if (backupPreview.overall.changedGames.same) return CloudSyncState.Same;

    return CloudSyncState.Unknown;
  }, [backupPreview]);

  return (
    <Provider
      value={{
        backupPreview,
        showCloudSyncModal,
        artifacts,
        backupState,
        backupProvider,
        restoringBackup,
        uploadingBackup,
        showCloudSyncFilesModal,
        loadingPreview,
        loadingArtifacts,
        freezingArtifact,
        setShowCloudSyncModal,
        uploadSaveGame,
        downloadGameArtifact,
        deleteGameArtifact,
        setShowCloudSyncFilesModal,
        getGameBackupPreview,
        getGameArtifacts,
        toggleArtifactFreeze,
      }}
    >
      {children}
    </Provider>
  );
}
