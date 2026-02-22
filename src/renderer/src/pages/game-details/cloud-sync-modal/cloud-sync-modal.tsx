import { Button, Modal, ModalProps } from "@renderer/components";
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
import { useAppSelector, useDate, useToast } from "@renderer/hooks";
import { useTranslation } from "react-i18next";
import { AxiosProgressEvent } from "axios";
import { formatDownloadProgress } from "@renderer/helpers";
import { CloudSyncRenameArtifactModal } from "../cloud-sync-rename-artifact-modal/cloud-sync-rename-artifact-modal";
import { GameArtifact } from "@types";
import { motion, AnimatePresence } from "framer-motion";
import { orderBy } from "lodash-es";

export interface CloudSyncModalProps
  extends Omit<ModalProps, "children" | "title"> {}

export function CloudSyncModal({ visible, onClose }: CloudSyncModalProps) {
  const [deletingArtifact, setDeletingArtifact] = useState(false);
  const [backupDownloadProgress, setBackupDownloadProgress] =
    useState<AxiosProgressEvent | null>(null);
  const [artifactToRename, setArtifactToRename] = useState<GameArtifact | null>(
    null
  );

  const { t } = useTranslation("game_details");
  const { formatDate, formatDateTime } = useDate();

  const {
    artifacts,
    backupPreview,
    uploadingBackup,
    restoringBackup,
    loadingPreview,
    freezingArtifact,
    backupProvider,
    uploadSaveGame,
    downloadGameArtifact,
    deleteGameArtifact,
    toggleArtifactFreeze,
    setShowCloudSyncFilesModal,
    getGameBackupPreview,
  } = useContext(cloudSyncContext);

  const { objectId, shop, gameTitle, game, lastDownloadedOption } =
    useContext(gameDetailsContext);

  const { showSuccessToast, showErrorToast } = useToast();

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
    return () => {
      removeBackupDownloadProgressListener();
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
    }
  }, [getGameBackupPreview, visible]);

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
  const progressValue = backupDownloadProgress?.progress ?? 0;

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
              onClick={() =>
                uploadSaveGame(lastDownloadedOption?.title ?? null)
              }
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
                        progress: formatDownloadProgress(progressValue),
                      })}
                </span>
                {restoringBackup && progressValue > 0 && (
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
                    uploadingBackup || progressValue === 0
                      ? "cloud-sync-modal__progress-fill--indeterminate"
                      : ""
                  }`}
                  style={
                    !uploadingBackup && progressValue > 0
                      ? { width: `${progressValue * 100}%` }
                      : undefined
                  }
                  layout
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading preview skeleton */}
        <AnimatePresence>
          {loadingPreview && artifacts.length === 0 && (
            <motion.div
              className="cloud-sync-modal__skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="cloud-sync-modal__skeleton-item" />
              <div className="cloud-sync-modal__skeleton-item" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backups list header */}
        {!loadingPreview && (
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
        {!loadingPreview && artifacts.length > 0 ? (
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
          !loadingPreview && (
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
