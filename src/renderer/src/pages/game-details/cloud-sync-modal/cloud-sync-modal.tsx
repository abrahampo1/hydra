import { Button, CheckboxField, Modal, ModalProps } from "@renderer/components";
import { useContext, useEffect, useMemo, useState } from "react";
import { cloudSyncContext, gameDetailsContext } from "@renderer/context";
import "./cloud-sync-modal.scss";
import { formatBytes } from "@shared";
import {
  ClockIcon,
  CloudIcon,
  DeviceDesktopIcon,
  HistoryIcon,
  InfoIcon,
  PencilIcon,
  PinIcon,
  PinSlashIcon,
  SyncIcon,
  TrashIcon,
  UploadIcon,
} from "@primer/octicons-react";
import {
  useAppSelector,
  useDate,
  useToast,
  useUserDetails,
} from "@renderer/hooks";
import { useTranslation } from "react-i18next";
import { AxiosProgressEvent } from "axios";
import { formatDownloadProgress, getGameKey } from "@renderer/helpers";
import { CloudSyncRenameArtifactModal } from "../cloud-sync-rename-artifact-modal/cloud-sync-rename-artifact-modal";
import { Game, GameArtifact } from "@types";
import { motion, AnimatePresence } from "framer-motion";
import { orderBy } from "lodash-es";
import { levelDBService } from "@renderer/services/leveldb.service";

export interface CloudSyncModalProps
  extends Omit<ModalProps, "children" | "title"> {}

export function CloudSyncModal({ visible, onClose }: CloudSyncModalProps) {
  const [deletingArtifact, setDeletingArtifact] = useState(false);
  const [backupDownloadProgress, setBackupDownloadProgress] =
    useState<AxiosProgressEvent | null>(null);
  const [backupUploadProgress, setBackupUploadProgress] =
    useState<AxiosProgressEvent | null>(null);
  const [artifactToRename, setArtifactToRename] = useState<GameArtifact | null>(
    null
  );

  const { t } = useTranslation("game_details");
  const { t: tSettings } = useTranslation("settings");
  const { formatDate, formatDateTime } = useDate();

  const {
    artifacts,
    backupPreview,
    uploadingBackup,
    restoringBackup,
    loadingArtifacts,
    freezingArtifact,
    backupProvider,
    uploadSaveGame,
    downloadGameArtifact,
    deleteGameArtifact,
    toggleArtifactFreeze,
    setShowCloudSyncFilesModal,
    getGameBackupPreview,
    getGameArtifacts,
  } = useContext(cloudSyncContext);

  const { objectId, shop, gameTitle, game, lastDownloadedOption, updateGame } =
    useContext(gameDetailsContext);

  const { showSuccessToast, showErrorToast } = useToast();
  const { hasActiveSubscription } = useUserDetails();

  const [automaticCloudSync, setAutomaticCloudSync] = useState(
    game?.automaticCloudSync ?? false
  );

  useEffect(() => {
    setAutomaticCloudSync(game?.automaticCloudSync ?? false);
  }, [game?.automaticCloudSync]);

  const handleToggleAutomaticCloudSync = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setAutomaticCloudSync(event.target.checked);

    const gameKey = getGameKey(game!.shop, game!.objectId);
    const gameData = (await levelDBService.get(
      gameKey,
      "games"
    )) as Game | null;
    if (gameData) {
      const updated = { ...gameData, automaticCloudSync: event.target.checked };
      await levelDBService.put(gameKey, updated, "games");
    }

    updateGame();
  };

  const handleDeleteArtifactClick = async (gameArtifactId: string) => {
    setDeletingArtifact(true);
    try {
      await deleteGameArtifact(gameArtifactId);
      showSuccessToast(t("backup_deleted"));
    } catch (_err) {
      showErrorToast("backup_deletion_failed");
    } finally {
      setDeletingArtifact(false);
    }
  };

  useEffect(() => {
    const removeBackupDownloadProgressListener =
      window.electron.onBackupDownloadProgress(
        objectId!,
        shop,
        (progressEvent) => {
          setBackupDownloadProgress(progressEvent);
        }
      );
    const removeBackupUploadProgressListener = window.electron.onUploadProgress(
      objectId!,
      shop,
      (progressEvent) => {
        setBackupUploadProgress(progressEvent);
      }
    );
    return () => {
      removeBackupDownloadProgressListener();
      removeBackupUploadProgressListener();
    };
  }, [backupPreview, objectId, shop]);

  const handleBackupInstallClick = async (artifactId: string) => {
    setBackupDownloadProgress(null);
    downloadGameArtifact(artifactId);
  };

  const handleFreezeArtifactClick = async (
    artifactId: string,
    isFrozen: boolean
  ) => {
    try {
      await toggleArtifactFreeze(artifactId, isFrozen);
      showSuccessToast(isFrozen ? t("backup_frozen") : t("backup_unfrozen"));
    } catch (_err) {
      showErrorToast(
        t("backup_freeze_failed"),
        t("backup_freeze_failed_description")
      );
    }
  };

  useEffect(() => {
    if (visible) {
      getGameBackupPreview();
      getGameArtifacts();
    }
  }, [getGameBackupPreview, getGameArtifacts, visible]);

  const userDetails = useAppSelector((state) => state.userDetails.userDetails);
  const backupsPerGameLimit =
    backupProvider === "hydra-cloud"
      ? (userDetails?.quirks?.backupsPerGameLimit ?? 0)
      : Infinity;

  const isHydraCloud = backupProvider === "hydra-cloud";

  const disableActions =
    uploadingBackup || restoringBackup || deletingArtifact || freezingArtifact;
  const isMissingWinePrefix =
    window.electron.platform === "linux" && !game?.winePrefixPath;

  const isWorking = uploadingBackup || restoringBackup;
  const downloadProgressValue = backupDownloadProgress?.progress ?? 0;
  const uploadProgressValue = backupUploadProgress?.progress ?? 0;
  const progressValue = uploadingBackup
    ? uploadProgressValue
    : downloadProgressValue;

  const isLoading = loadingArtifacts && artifacts.length === 0;
  const isContentReady = !loadingArtifacts;

  const isAutomaticCloudSyncDisabled =
    !game?.executablePath ||
    (backupProvider === "hydra-cloud" && !hasActiveSubscription);

  const cloudProviderLabel =
    backupProvider === "local"
      ? tSettings("local_backup")
      : tSettings("hydra_cloud");

  const sortedArtifacts = useMemo(
    () => orderBy(artifacts, [(a) => !a.isFrozen], ["asc"]),
    [artifacts]
  );

  return (
    <>
      <CloudSyncRenameArtifactModal
        visible={!!artifactToRename}
        onClose={() => setArtifactToRename(null)}
        artifact={artifactToRename}
      />

      <Modal
        visible={visible}
        title={t("cloud_save")}
        description={t("cloud_save_description")}
        onClose={onClose}
        large
      >
        {/* Header */}
        <div className="cloud-sync-modal__header">
          <div className="cloud-sync-modal__title-container">
            <h2>{gameTitle}</h2>
            <button
              type="button"
              className="cloud-sync-modal__manage-files-button"
              onClick={() => setShowCloudSyncFilesModal(true)}
              disabled={disableActions}
            >
              {t("manage_files")}
            </button>
          </div>

          <div className="cloud-sync-modal__header-actions">
            <Button
              type="button"
              onClick={() => {
                setBackupUploadProgress(null);
                uploadSaveGame(lastDownloadedOption?.title ?? null);
              }}
              tooltip={
                isMissingWinePrefix ? t("missing_wine_prefix") : undefined
              }
              tooltipPlace="left"
              disabled={
                disableActions ||
                !backupPreview?.overall.totalGames ||
                artifacts.length >= backupsPerGameLimit ||
                isMissingWinePrefix
              }
            >
              {uploadingBackup ? (
                <SyncIcon className="cloud-sync-modal__sync-icon" />
              ) : (
                <UploadIcon />
              )}
              {t("create_backup")}
            </Button>
          </div>
        </div>

        {/* Auto-sync toggle */}
        <div className="cloud-sync-modal__auto-sync">
          <div className="cloud-sync-modal__auto-sync-info">
            <SyncIcon
              size={16}
              className={
                automaticCloudSync && !isAutomaticCloudSyncDisabled
                  ? "cloud-sync-modal__auto-sync-icon--active"
                  : "cloud-sync-modal__auto-sync-icon"
              }
            />
            <div className="cloud-sync-modal__auto-sync-text">
              <span className="cloud-sync-modal__auto-sync-label">
                {t("enable_automatic_cloud_sync")}
              </span>
              <span className="cloud-sync-modal__auto-sync-provider">
                {cloudProviderLabel}
              </span>
            </div>
          </div>
          <CheckboxField
            label=""
            checked={automaticCloudSync}
            disabled={isAutomaticCloudSyncDisabled}
            onChange={handleToggleAutomaticCloudSync}
          />
        </div>

        {/* Progress bar */}
        <AnimatePresence>
          {isWorking && (
            <motion.div
              className="cloud-sync-modal__progress-wrapper"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className="cloud-sync-modal__progress-info">
                <span className="cloud-sync-modal__progress-label">
                  <SyncIcon size={14} className="cloud-sync-modal__sync-icon" />
                  {uploadingBackup
                    ? t("uploading_backup")
                    : t("restoring_backup", {
                        progress: formatDownloadProgress(downloadProgressValue),
                      })}
                </span>
                {progressValue > 0 && (
                  <span className="cloud-sync-modal__progress-percentage">
                    {formatDownloadProgress(progressValue)}
                  </span>
                )}
              </div>
              <div className="cloud-sync-modal__progress-track">
                <motion.div
                  className={`cloud-sync-modal__progress-fill ${
                    uploadingBackup
                      ? "cloud-sync-modal__progress-fill--uploading"
                      : "cloud-sync-modal__progress-fill--restoring"
                  } ${
                    progressValue === 0
                      ? "cloud-sync-modal__progress-fill--indeterminate"
                      : ""
                  }`}
                  style={
                    progressValue > 0
                      ? { width: `${progressValue * 100}%` }
                      : undefined
                  }
                  layout
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              className="cloud-sync-modal__loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="cloud-sync-modal__loading-header">
                <SyncIcon size={14} className="cloud-sync-modal__sync-icon" />
                <span>{t("loading_backups")}</span>
              </div>
              <div className="cloud-sync-modal__skeleton">
                <div className="cloud-sync-modal__skeleton-item">
                  <div className="cloud-sync-modal__skeleton-line cloud-sync-modal__skeleton-line--title" />
                  <div className="cloud-sync-modal__skeleton-line cloud-sync-modal__skeleton-line--meta" />
                </div>
                <div className="cloud-sync-modal__skeleton-item">
                  <div className="cloud-sync-modal__skeleton-line cloud-sync-modal__skeleton-line--title" />
                  <div className="cloud-sync-modal__skeleton-line cloud-sync-modal__skeleton-line--meta" />
                </div>
                <div className="cloud-sync-modal__skeleton-item">
                  <div className="cloud-sync-modal__skeleton-line cloud-sync-modal__skeleton-line--title" />
                  <div className="cloud-sync-modal__skeleton-line cloud-sync-modal__skeleton-line--meta" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backups list header */}
        {isContentReady && (
          <div className="cloud-sync-modal__backups-header">
            <h2>{t("backups")}</h2>
            {isHydraCloud && (
              <span className="cloud-sync-modal__backups-count">
                {artifacts.length} / {backupsPerGameLimit}
              </span>
            )}
          </div>
        )}

        {/* Artifacts list */}
        {isContentReady && artifacts.length > 0 ? (
          <ul className="cloud-sync-modal__artifacts">
            <AnimatePresence mode="popLayout">
              {sortedArtifacts.map((artifact) => (
                <motion.li
                  key={artifact.id}
                  className={`cloud-sync-modal__artifact ${
                    artifact.isFrozen
                      ? "cloud-sync-modal__artifact--frozen"
                      : ""
                  }`}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{
                    duration: 0.25,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className="cloud-sync-modal__artifact-info">
                    <div className="cloud-sync-modal__artifact-header">
                      {isHydraCloud ? (
                        <button
                          type="button"
                          className="cloud-sync-modal__artifact-label"
                          onClick={() => setArtifactToRename(artifact)}
                        >
                          {artifact.label ??
                            t("backup_from", {
                              date: formatDate(artifact.createdAt),
                            })}
                          <PencilIcon size={12} />
                        </button>
                      ) : (
                        <span className="cloud-sync-modal__artifact-label">
                          {artifact.label ??
                            t("backup_from", {
                              date: formatDate(artifact.createdAt),
                            })}
                        </span>
                      )}
                      <span className="cloud-sync-modal__artifact-size">
                        {formatBytes(artifact.artifactLengthInBytes)}
                      </span>
                      {artifact.isFrozen && isHydraCloud && (
                        <span className="cloud-sync-modal__artifact-frozen-badge">
                          <PinIcon size={10} />
                          {t("frozen")}
                        </span>
                      )}
                    </div>

                    <div className="cloud-sync-modal__artifact-meta-row">
                      <span className="cloud-sync-modal__artifact-meta">
                        <ClockIcon size={12} />
                        {formatDateTime(artifact.createdAt)}
                      </span>

                      {isHydraCloud && artifact.hostname && (
                        <span className="cloud-sync-modal__artifact-meta">
                          <DeviceDesktopIcon size={12} />
                          {artifact.hostname}
                        </span>
                      )}

                      {isHydraCloud && (
                        <span className="cloud-sync-modal__artifact-meta">
                          <InfoIcon size={12} />
                          {artifact.downloadOptionTitle ??
                            t("no_download_option_info")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="cloud-sync-modal__artifact-actions">
                    {isHydraCloud && (
                      <Button
                        type="button"
                        tooltip={
                          artifact.isFrozen
                            ? t("unfreeze_backup")
                            : t("freeze_backup")
                        }
                        theme={artifact.isFrozen ? "primary" : "outline"}
                        onClick={() =>
                          handleFreezeArtifactClick(
                            artifact.id,
                            !artifact.isFrozen
                          )
                        }
                        disabled={disableActions}
                      >
                        {artifact.isFrozen ? <PinSlashIcon /> : <PinIcon />}
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={() => handleBackupInstallClick(artifact.id)}
                      disabled={disableActions}
                      theme="outline"
                    >
                      <HistoryIcon />
                      {t("install_backup")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleDeleteArtifactClick(artifact.id)}
                      disabled={disableActions || artifact.isFrozen}
                      theme="outline"
                      tooltip={t("delete_backup")}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          isContentReady && (
            <motion.div
              className="cloud-sync-modal__empty-state"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <CloudIcon size={40} className="cloud-sync-modal__empty-icon" />
              <h3 className="cloud-sync-modal__empty-title">
                {t("no_backups_created")}
              </h3>
              <p className="cloud-sync-modal__empty-description">
                {t("cloud_save_description")}
              </p>
            </motion.div>
          )
        )}
      </Modal>
    </>
  );
}
