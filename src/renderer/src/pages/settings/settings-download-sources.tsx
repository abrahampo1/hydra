import { useContext, useEffect, useState } from "react";

import { Button, ConfirmationModal } from "@renderer/components";
import { useTranslation } from "react-i18next";

import type { DownloadSource } from "@types";
import {
  NoEntryIcon,
  PlusCircleIcon,
  SyncIcon,
  TrashIcon,
  LinkIcon,
  CheckCircleFillIcon,
  ClockIcon,
  XCircleFillIcon,
  SearchIcon,
} from "@primer/octicons-react";
import { AddDownloadSourceModal } from "./add-download-source-modal";
import { useAppDispatch, useToast } from "@renderer/hooks";
import { DownloadSourceStatus } from "@shared";
import { settingsContext } from "@renderer/context";
import { useNavigate } from "react-router-dom";
import { setFilters, clearFilters } from "@renderer/features";
import { levelDBService } from "@renderer/services/leveldb.service";
import { orderBy } from "lodash-es";
import "./settings-download-sources.scss";
import { logger } from "@renderer/logger";

export function SettingsDownloadSources() {
  const [
    showConfirmationDeleteAllSourcesModal,
    setShowConfirmationDeleteAllSourcesModal,
  ] = useState(false);
  const [showAddDownloadSourceModal, setShowAddDownloadSourceModal] =
    useState(false);
  const [downloadSources, setDownloadSources] = useState<DownloadSource[]>([]);
  const [isSyncingDownloadSources, setIsSyncingDownloadSources] =
    useState(false);
  const [isRemovingDownloadSource, setIsRemovingDownloadSource] =
    useState(false);

  const { sourceUrl, clearSourceUrl } = useContext(settingsContext);

  const { t } = useTranslation("settings");
  const { showSuccessToast } = useToast();

  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  useEffect(() => {
    if (sourceUrl) setShowAddDownloadSourceModal(true);
  }, [sourceUrl]);

  useEffect(() => {
    const fetchDownloadSources = async () => {
      const sources = (await levelDBService.values(
        "downloadSources"
      )) as DownloadSource[];
      const sorted = orderBy(sources, "createdAt", "desc");
      setDownloadSources(sorted);
    };

    fetchDownloadSources();
  }, []);

  useEffect(() => {
    const hasPendingOrMatchingSource = downloadSources.some(
      (source) =>
        source.status === DownloadSourceStatus.PendingMatching ||
        source.status === DownloadSourceStatus.Matching
    );

    if (!hasPendingOrMatchingSource || !downloadSources.length) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        await window.electron.syncDownloadSources();
        const sources = (await levelDBService.values(
          "downloadSources"
        )) as DownloadSource[];
        const sorted = orderBy(sources, "createdAt", "desc");
        setDownloadSources(sorted);
      } catch (error) {
        logger.error("Failed to fetch download sources:", error);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [downloadSources]);

  const handleRemoveSource = async (downloadSource: DownloadSource) => {
    setIsRemovingDownloadSource(true);

    try {
      await window.electron.removeDownloadSource(false, downloadSource.id);
      const sources = (await levelDBService.values(
        "downloadSources"
      )) as DownloadSource[];
      const sorted = orderBy(sources, "createdAt", "desc");
      setDownloadSources(sorted);
      showSuccessToast(t("removed_download_source"));
    } catch (error) {
      logger.error("Failed to remove download source:", error);
    } finally {
      setIsRemovingDownloadSource(false);
    }
  };

  const handleRemoveAllDownloadSources = async () => {
    setIsRemovingDownloadSource(true);

    try {
      await window.electron.removeDownloadSource(true);
      const sources = (await levelDBService.values(
        "downloadSources"
      )) as DownloadSource[];
      const sorted = orderBy(sources, "createdAt", "desc");
      setDownloadSources(sorted);
      showSuccessToast(t("removed_all_download_sources"));
    } catch (error) {
      logger.error("Failed to remove all download sources:", error);
    } finally {
      setIsRemovingDownloadSource(false);
      setShowConfirmationDeleteAllSourcesModal(false);
    }
  };

  const handleAddDownloadSource = async () => {
    try {
      const sources = (await levelDBService.values(
        "downloadSources"
      )) as DownloadSource[];
      const sorted = orderBy(sources, "createdAt", "desc");
      setDownloadSources(sorted);
    } catch (error) {
      logger.error("Failed to refresh download sources:", error);
    }
  };

  const syncDownloadSources = async () => {
    setIsSyncingDownloadSources(true);
    try {
      await window.electron.syncDownloadSources();
      const sources = (await levelDBService.values(
        "downloadSources"
      )) as DownloadSource[];
      const sorted = orderBy(sources, "createdAt", "desc");
      setDownloadSources(sorted);

      showSuccessToast(t("download_sources_synced_successfully"));
    } finally {
      setIsSyncingDownloadSources(false);
    }
  };

  const handleModalClose = () => {
    clearSourceUrl();
    setShowAddDownloadSourceModal(false);
  };

  const navigateToCatalogue = (fingerprint?: string) => {
    if (!fingerprint) {
      logger.error("Cannot navigate: fingerprint is undefined");
      return;
    }

    dispatch(clearFilters());
    dispatch(setFilters({ downloadSourceFingerprints: [fingerprint] }));

    navigate("/catalogue");
  };

  const getStatusIcon = (status: DownloadSourceStatus) => {
    switch (status) {
      case DownloadSourceStatus.Matched:
        return <CheckCircleFillIcon size={14} />;
      case DownloadSourceStatus.PendingMatching:
      case DownloadSourceStatus.Matching:
        return (
          <SyncIcon size={14} className="settings-download-sources__spinner" />
        );
      case DownloadSourceStatus.Failed:
        return <XCircleFillIcon size={14} />;
      default:
        return <ClockIcon size={14} />;
    }
  };

  const getStatusClass = (status: DownloadSourceStatus) => {
    switch (status) {
      case DownloadSourceStatus.Matched:
        return "settings-download-sources__status--matched";
      case DownloadSourceStatus.PendingMatching:
      case DownloadSourceStatus.Matching:
        return "settings-download-sources__status--matching";
      case DownloadSourceStatus.Failed:
        return "settings-download-sources__status--failed";
      default:
        return "";
    }
  };

  const statusTitle = {
    [DownloadSourceStatus.PendingMatching]: t(
      "download_source_pending_matching"
    ),
    [DownloadSourceStatus.Matched]: t("download_source_matched"),
    [DownloadSourceStatus.Matching]: t("download_source_matching"),
    [DownloadSourceStatus.Failed]: t("download_source_failed"),
  };

  return (
    <div className="settings-download-sources">
      <AddDownloadSourceModal
        visible={showAddDownloadSourceModal}
        onClose={handleModalClose}
        onAddDownloadSource={handleAddDownloadSource}
      />
      <ConfirmationModal
        cancelButtonLabel={t("cancel_button_confirmation_delete_all_sources")}
        confirmButtonLabel={t("confirm_button_confirmation_delete_all_sources")}
        descriptionText={t("description_confirmation_delete_all_sources")}
        clickOutsideToClose={false}
        onConfirm={handleRemoveAllDownloadSources}
        visible={showConfirmationDeleteAllSourcesModal}
        title={t("title_confirmation_delete_all_sources")}
        onClose={() => setShowConfirmationDeleteAllSourcesModal(false)}
        buttonsIsDisabled={isRemovingDownloadSource}
      />

      <p className="settings-download-sources__description">
        {t("download_sources_description")}
      </p>

      <div className="settings-download-sources__header">
        <div className="settings-download-sources__header-left">
          <span className="settings-download-sources__count">
            {downloadSources.length}{" "}
            {downloadSources.length === 1 ? "source" : "sources"}
          </span>
        </div>

        <div className="settings-download-sources__header-actions">
          <Button
            type="button"
            theme="outline"
            disabled={
              !downloadSources.length ||
              isSyncingDownloadSources ||
              isRemovingDownloadSource
            }
            onClick={syncDownloadSources}
          >
            <SyncIcon />
            {t("sync_download_sources")}
          </Button>

          <Button
            type="button"
            theme="danger"
            onClick={() => setShowConfirmationDeleteAllSourcesModal(true)}
            disabled={
              isRemovingDownloadSource ||
              isSyncingDownloadSources ||
              !downloadSources.length
            }
          >
            <TrashIcon />
          </Button>

          <Button
            type="button"
            theme="outline"
            onClick={() => setShowAddDownloadSourceModal(true)}
            disabled={isSyncingDownloadSources || isRemovingDownloadSource}
          >
            <PlusCircleIcon />
            {t("add_download_source")}
          </Button>
        </div>
      </div>

      {downloadSources.length === 0 ? (
        <div className="settings-download-sources__empty">
          <LinkIcon size={24} />
          <p>{t("download_sources_description")}</p>
        </div>
      ) : (
        <ul className="settings-download-sources__list">
          {downloadSources.map((downloadSource) => {
            const isPendingOrMatching =
              downloadSource.status === DownloadSourceStatus.PendingMatching ||
              downloadSource.status === DownloadSourceStatus.Matching;

            return (
              <li
                key={downloadSource.id}
                className={`settings-download-sources__item ${isSyncingDownloadSources ? "settings-download-sources__item--syncing" : ""}`}
              >
                <div className="settings-download-sources__item-info">
                  <div className="settings-download-sources__item-name-row">
                    <span className="settings-download-sources__item-name">
                      {downloadSource.name}
                    </span>
                    <span
                      className={`settings-download-sources__status ${getStatusClass(downloadSource.status)}`}
                    >
                      {getStatusIcon(downloadSource.status)}
                      {statusTitle[downloadSource.status]}
                    </span>
                  </div>

                  <div className="settings-download-sources__item-meta">
                    <span className="settings-download-sources__item-url">
                      <LinkIcon size={12} />
                      {downloadSource.url}
                    </span>
                    {!isPendingOrMatching && (
                      <button
                        type="button"
                        className="settings-download-sources__catalogue-link"
                        disabled={!downloadSource.fingerprint}
                        onClick={() =>
                          navigateToCatalogue(downloadSource.fingerprint)
                        }
                      >
                        <SearchIcon size={12} />
                        {downloadSource.downloadCount.toLocaleString()}{" "}
                        {t("download_count").toLowerCase()}
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="settings-download-sources__remove-btn"
                  onClick={() => handleRemoveSource(downloadSource)}
                  disabled={isRemovingDownloadSource}
                  title={t("remove_download_source")}
                >
                  <NoEntryIcon size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
