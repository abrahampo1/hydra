import { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  CheckboxField,
  Link,
  Modal,
  TextField,
} from "@renderer/components";
import {
  DownloadIcon,
  SyncIcon,
  CheckCircleFillIcon,
  PlusIcon,
  TrashIcon,
  AlertIcon,
} from "@primer/octicons-react";
import {
  Downloader,
  formatBytes,
  getDownloadersForUri,
  parseBytes,
} from "@shared";
import type { GameRepack, LibraryGame, DiskUsage } from "@types";
import { DOWNLOADER_NAME } from "@renderer/constants";
import {
  useAppSelector,
  useDownload,
  useFeature,
  useToast,
} from "@renderer/hooks";
import { motion } from "framer-motion";
import { Tooltip } from "react-tooltip";
import { RealDebridInfoModal } from "./real-debrid-info-modal";
import "./download-settings-modal.scss";

export interface DownloadSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  startDownload: (
    repack: GameRepack,
    downloader: Downloader,
    downloadPath: string,
    automaticallyExtract: boolean,
    addToQueueOnly?: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  repack: GameRepack | null;
}

export function DownloadSettingsModal({
  visible,
  onClose,
  startDownload,
  repack,
}: Readonly<DownloadSettingsModalProps>) {
  const { t } = useTranslation("game_details");
  const { t: tSettings } = useTranslation("settings");

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const { lastPacket } = useDownload();
  const { showErrorToast, showSuccessToast } = useToast();

  const hasActiveDownload = lastPacket !== null;

  const [diskFreeSpace, setDiskFreeSpace] = useState<number | null>(null);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [downloadStarting, setDownloadStarting] = useState(false);
  const [automaticExtractionEnabled, setAutomaticExtractionEnabled] = useState(
    userPreferences?.extractFilesByDefault ?? true
  );
  const [selectedDownloader, setSelectedDownloader] =
    useState<Downloader | null>(null);
  const [hasWritePermission, setHasWritePermission] = useState<boolean | null>(
    null
  );
  const [showRealDebridModal, setShowRealDebridModal] = useState(false);
  const [library, setLibrary] = useState<LibraryGame[]>([]);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);

  const { isFeatureEnabled, Feature } = useFeature();

  const getDiskFreeSpace = async (path: string) => {
    const result = await window.electron.getDiskFreeSpace(path);
    setDiskFreeSpace(result.free);
    setDiskUsage(result);
  };

  const checkFolderWritePermission = useCallback(
    async (path: string) => {
      if (isFeatureEnabled(Feature.CheckDownloadWritePermission)) {
        const result = await window.electron.checkFolderWritePermission(path);
        setHasWritePermission(result);
      } else {
        setHasWritePermission(true);
      }
    },
    [Feature, isFeatureEnabled]
  );

  useEffect(() => {
    if (visible) {
      getDiskFreeSpace(selectedPath);
      checkFolderWritePermission(selectedPath);
    }
  }, [visible, checkFolderWritePermission, selectedPath]);

  const estimatedSizeBytes = useMemo(() => {
    if (!repack?.fileSize) return null;
    return parseBytes(repack.fileSize);
  }, [repack?.fileSize]);

  const hasEnoughSpace = useMemo(() => {
    if (diskFreeSpace === null || estimatedSizeBytes === null) return true;
    return diskFreeSpace >= estimatedSizeBytes;
  }, [diskFreeSpace, estimatedSizeBytes]);

  useEffect(() => {
    if (visible && !hasEnoughSpace) {
      window.electron.getLibrary().then((games) => {
        setLibrary(games);
      });
    }
  }, [visible, hasEnoughSpace]);

  const gamesWithStorage = useMemo(() => {
    return library
      .filter(
        (game) =>
          (game.installerSizeInBytes && game.installerSizeInBytes > 0) ||
          (game.installedSizeInBytes && game.installedSizeInBytes > 0)
      )
      .sort((a, b) => {
        const totalA =
          (a.installerSizeInBytes ?? 0) + (a.installedSizeInBytes ?? 0);
        const totalB =
          (b.installerSizeInBytes ?? 0) + (b.installedSizeInBytes ?? 0);
        return totalB - totalA;
      });
  }, [library]);

  const handleDeleteGame = async (game: LibraryGame) => {
    setDeletingGameId(game.id);
    try {
      await window.electron.deleteGameFolder(game.shop, game.objectId);
      showSuccessToast(tSettings("game_files_deleted", { title: game.title }));
      const games = await window.electron.getLibrary();
      setLibrary(games);
      await getDiskFreeSpace(selectedPath);
    } catch {
      showErrorToast(tSettings("delete_files_error"));
    } finally {
      setDeletingGameId(null);
    }
  };

  const downloadOptions = useMemo(() => {
    const unavailableUrisSet = new Set(repack?.unavailableUris ?? []);

    const downloaderMap = new Map<
      Downloader,
      { hasAvailable: boolean; hasUnavailable: boolean }
    >();

    if (repack) {
      for (const uri of repack.uris) {
        const uriDownloaders = getDownloadersForUri(uri);
        const isAvailable = !unavailableUrisSet.has(uri);

        for (const downloader of uriDownloaders) {
          const existing = downloaderMap.get(downloader);
          if (existing) {
            existing.hasAvailable = existing.hasAvailable || isAvailable;
            existing.hasUnavailable = existing.hasUnavailable || !isAvailable;
          } else {
            downloaderMap.set(downloader, {
              hasAvailable: isAvailable,
              hasUnavailable: !isAvailable,
            });
          }
        }
      }
    }

    const allDownloaders = Object.values(Downloader).filter(
      (value) => typeof value === "number"
    ) as Downloader[];

    const getDownloaderPriority = (option: {
      isAvailable: boolean;
      canHandle: boolean;
      isAvailableButNotConfigured: boolean;
    }) => {
      if (option.isAvailable) return 0;
      if (option.canHandle && !option.isAvailableButNotConfigured) return 1;
      if (option.isAvailableButNotConfigured) return 2;
      return 3;
    };

    return allDownloaders
      .filter((downloader) => downloader !== Downloader.Hydra)
      .map((downloader) => {
        const status = downloaderMap.get(downloader);
        const canHandle = status !== undefined;
        const isAvailable = status?.hasAvailable ?? false;

        let isConfigured = true;
        if (downloader === Downloader.RealDebrid) {
          isConfigured = !!userPreferences?.realDebridApiToken;
        } else if (downloader === Downloader.TorBox) {
          isConfigured = !!userPreferences?.torBoxApiToken;
        }

        const isAvailableButNotConfigured =
          isAvailable && !isConfigured && canHandle;

        return {
          downloader,
          isAvailable: isAvailable && isConfigured,
          canHandle,
          isAvailableButNotConfigured,
        };
      })
      .sort((a, b) => getDownloaderPriority(a) - getDownloaderPriority(b));
  }, [
    repack,
    userPreferences?.realDebridApiToken,
    userPreferences?.torBoxApiToken,
    isFeatureEnabled,
    Feature,
  ]);

  const getDefaultDownloader = useCallback(
    (availableDownloaders: Downloader[]) => {
      if (availableDownloaders.length === 0) return null;

      if (availableDownloaders.includes(Downloader.RealDebrid)) {
        return Downloader.RealDebrid;
      }

      if (availableDownloaders.includes(Downloader.TorBox)) {
        return Downloader.TorBox;
      }

      return availableDownloaders[0];
    },
    []
  );

  useEffect(() => {
    if (userPreferences?.downloadsPath) {
      setSelectedPath(userPreferences.downloadsPath);
    } else {
      window.electron
        .getDefaultDownloadsPath()
        .then((defaultDownloadsPath) => setSelectedPath(defaultDownloadsPath));
    }

    const availableDownloaders = downloadOptions
      .filter((option) => option.isAvailable)
      .map((option) => option.downloader);

    setSelectedDownloader(getDefaultDownloader(availableDownloaders));
  }, [getDefaultDownloader, userPreferences?.downloadsPath, downloadOptions]);

  const handleChooseDownloadsPath = async () => {
    const { filePaths } = await window.electron.showOpenDialog({
      defaultPath: selectedPath,
      properties: ["openDirectory"],
    });

    if (filePaths && filePaths.length > 0) {
      const path = filePaths[0];
      setSelectedPath(path);
    }
  };

  const getButtonContent = () => {
    if (downloadStarting) {
      return (
        <>
          <SyncIcon className="download-settings-modal__loading-spinner" />
          {t("loading")}
        </>
      );
    }

    if (hasActiveDownload) {
      return (
        <>
          <PlusIcon />
          {t("add_to_queue")}
        </>
      );
    }

    return (
      <>
        <DownloadIcon />
        {t("download_now")}
      </>
    );
  };

  const handleStartClick = async () => {
    if (repack) {
      setDownloadStarting(true);

      try {
        const response = await startDownload(
          repack,
          selectedDownloader!,
          selectedPath,
          automaticExtractionEnabled,
          hasActiveDownload
        );

        if (response.ok) {
          onClose();
          return;
        } else if (response.error) {
          showErrorToast(t("download_error"), t(response.error), 4_000);
        }
      } catch (error) {
        if (error instanceof Error) {
          showErrorToast(t("download_error"), error.message, 4_000);
        }
      } finally {
        setDownloadStarting(false);
      }
    }
  };

  const storageBarSegments = useMemo(() => {
    if (!diskUsage) return null;

    const usedSpace = diskUsage.total - diskUsage.free;
    const usedPercent = (usedSpace / diskUsage.total) * 100;
    const downloadPercent = estimatedSizeBytes
      ? (estimatedSizeBytes / diskUsage.total) * 100
      : 0;

    return { usedPercent, downloadPercent };
  }, [diskUsage, estimatedSizeBytes]);

  return (
    <Modal visible={visible} title={t("download_settings")} onClose={onClose}>
      <div className="download-settings-modal__container">
        {/* Storage bar */}
        {diskUsage && (
          <div className="download-settings-modal__storage-section">
            <div className="download-settings-modal__storage-header">
              <span className="download-settings-modal__storage-label">
                {t("storage_usage")}
              </span>
              <span className="download-settings-modal__storage-free">
                {t("space_left_on_disk", {
                  space: formatBytes(diskFreeSpace ?? 0),
                })}
              </span>
            </div>

            <div className="download-settings-modal__storage-bar">
              {storageBarSegments && (
                <>
                  <div
                    className="download-settings-modal__storage-bar-used"
                    style={{ width: `${storageBarSegments.usedPercent}%` }}
                  />
                  {estimatedSizeBytes && (
                    <div
                      className={`download-settings-modal__storage-bar-download ${!hasEnoughSpace ? "download-settings-modal__storage-bar-download--overflow" : ""}`}
                      style={{
                        width: `${Math.min(storageBarSegments.downloadPercent, 100 - storageBarSegments.usedPercent)}%`,
                      }}
                    />
                  )}
                </>
              )}
            </div>

            {estimatedSizeBytes && (
              <div className="download-settings-modal__storage-legend">
                <span className="download-settings-modal__storage-legend-item">
                  <span className="download-settings-modal__storage-dot download-settings-modal__storage-dot--download" />
                  {t("estimated_size")}: {repack?.fileSize}
                </span>
                {!hasEnoughSpace && (
                  <span className="download-settings-modal__storage-legend-item download-settings-modal__storage-legend-item--warning">
                    <AlertIcon size={12} />
                    {t("not_enough_space")}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Free space list when not enough space */}
        {!hasEnoughSpace && gamesWithStorage.length > 0 && (
          <div className="download-settings-modal__free-space-section">
            <span className="download-settings-modal__free-space-hint">
              {t("free_space_to_continue")}
            </span>
            <div className="download-settings-modal__free-space-list">
              {gamesWithStorage.slice(0, 5).map((game) => {
                const totalSize =
                  (game.installerSizeInBytes ?? 0) +
                  (game.installedSizeInBytes ?? 0);

                return (
                  <div
                    key={game.id}
                    className="download-settings-modal__free-space-item"
                  >
                    <div className="download-settings-modal__free-space-info">
                      <span className="download-settings-modal__free-space-title">
                        {game.title}
                      </span>
                      <span className="download-settings-modal__free-space-size">
                        {formatBytes(totalSize)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="download-settings-modal__free-space-delete"
                      onClick={() => handleDeleteGame(game)}
                      disabled={deletingGameId === game.id}
                    >
                      {deletingGameId === game.id ? (
                        <SyncIcon
                          size={12}
                          className="download-settings-modal__loading-spinner"
                        />
                      ) : (
                        <TrashIcon size={12} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="download-settings-modal__downloads-path-field">
          <span>{t("downloader")}</span>

          <div className="download-settings-modal__downloaders-list-wrapper">
            <div className="download-settings-modal__downloaders-list">
              {downloadOptions.map((option, index) => {
                const isSelected = selectedDownloader === option.downloader;
                const tooltipId = `availability-indicator-${option.downloader}`;
                const isLastItem = index === downloadOptions.length - 1;

                const Indicator = option.isAvailable ? motion.span : "span";

                const isDisabled =
                  !option.canHandle ||
                  (!option.isAvailable && !option.isAvailableButNotConfigured);

                const getAvailabilityIndicator = () => {
                  if (option.isAvailable) {
                    return (
                      <Indicator
                        className={`download-settings-modal__availability-indicator download-settings-modal__availability-indicator--available download-settings-modal__availability-indicator--pulsating`}
                        animate={{
                          scale: [1, 1.1, 1],
                          opacity: [1, 0.7, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={t("downloader_online")}
                      />
                    );
                  }

                  if (option.isAvailableButNotConfigured) {
                    return (
                      <span
                        className={`download-settings-modal__availability-indicator download-settings-modal__availability-indicator--warning`}
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={t("downloader_not_configured")}
                      />
                    );
                  }

                  if (option.canHandle) {
                    return (
                      <span
                        className={`download-settings-modal__availability-indicator download-settings-modal__availability-indicator--unavailable`}
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={t("downloader_offline")}
                      />
                    );
                  }

                  return (
                    <span
                      className={`download-settings-modal__availability-indicator download-settings-modal__availability-indicator--not-present`}
                      data-tooltip-id={tooltipId}
                      data-tooltip-content={t("downloader_not_available")}
                    />
                  );
                };

                const getRightContent = () => {
                  if (isSelected) {
                    return (
                      <motion.div
                        className="download-settings-modal__check-icon-wrapper"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                      >
                        <CheckCircleFillIcon
                          size={16}
                          className="download-settings-modal__check-icon"
                        />
                      </motion.div>
                    );
                  }

                  if (
                    option.downloader === Downloader.RealDebrid &&
                    option.canHandle
                  ) {
                    return (
                      <div className="download-settings-modal__recommendation-badge">
                        <Badge>{t("recommended")}</Badge>
                      </div>
                    );
                  }

                  return null;
                };

                return (
                  <div
                    key={option.downloader}
                    className="download-settings-modal__downloader-item-wrapper"
                  >
                    <button
                      type="button"
                      className={`download-settings-modal__downloader-item ${
                        isSelected
                          ? "download-settings-modal__downloader-item--selected"
                          : ""
                      } ${
                        isLastItem
                          ? "download-settings-modal__downloader-item--last"
                          : ""
                      }`}
                      disabled={isDisabled}
                      onClick={() => {
                        if (
                          option.downloader === Downloader.RealDebrid &&
                          option.isAvailableButNotConfigured
                        ) {
                          setShowRealDebridModal(true);
                        } else {
                          setSelectedDownloader(option.downloader);
                        }
                      }}
                    >
                      <span className="download-settings-modal__downloader-name">
                        {DOWNLOADER_NAME[option.downloader]}
                      </span>
                      <div className="download-settings-modal__availability-indicator-wrapper">
                        {getAvailabilityIndicator()}
                      </div>
                      <Tooltip id={tooltipId} />
                      {getRightContent()}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="download-settings-modal__downloads-path-field">
          <TextField
            value={selectedPath}
            readOnly
            disabled
            label={t("download_path")}
            error={
              hasWritePermission === false ? (
                <span
                  className="download-settings-modal__path-error"
                  data-open-article="cannot-write-directory"
                >
                  {t("no_write_permission")}
                </span>
              ) : undefined
            }
            rightContent={
              <Button
                className="download-settings-modal__change-path-button"
                theme="outline"
                onClick={handleChooseDownloadsPath}
                disabled={downloadStarting}
              >
                {t("change")}
              </Button>
            }
          />

          <p className="download-settings-modal__hint-text">
            <Trans i18nKey="select_folder_hint" ns="game_details">
              <Link to="/settings" />
            </Trans>
          </p>
        </div>

        <CheckboxField
          label={t("automatically_extract_downloaded_files")}
          checked={automaticExtractionEnabled}
          onChange={() =>
            setAutomaticExtractionEnabled(!automaticExtractionEnabled)
          }
        />

        <Button
          onClick={handleStartClick}
          disabled={
            downloadStarting ||
            selectedDownloader === null ||
            !hasWritePermission ||
            downloadOptions.some(
              (option) =>
                option.downloader === selectedDownloader &&
                (option.isAvailableButNotConfigured ||
                  (!option.isAvailable && option.canHandle) ||
                  !option.canHandle)
            )
          }
        >
          {getButtonContent()}
        </Button>
      </div>

      <RealDebridInfoModal
        visible={showRealDebridModal}
        onClose={() => setShowRealDebridModal(false)}
      />
    </Modal>
  );
}
