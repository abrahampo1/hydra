import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SyncIcon, AlertIcon } from "@primer/octicons-react";
import type { AppUpdaterEvent, UpdateDownloadProgress } from "@types";
import { formatBytes } from "@shared";

import { Button, Link, Modal } from "@renderer/components";

import "./update-modal.scss";

const releasesPageUrl = "https://github.com/abrahampo1/hydra/releases/latest";

type UpdateState =
  | "checking"
  | "up-to-date"
  | "update-available"
  | "downloading"
  | "ready-to-install"
  | "error";

export interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
}

export function UpdateModal({ visible, onClose }: UpdateModalProps) {
  const { t } = useTranslation("bottom_panel");

  const [state, setState] = useState<UpdateState>("checking");
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");
  const [progress, setProgress] = useState<UpdateDownloadProgress | null>(null);

  useEffect(() => {
    window.electron.getVersion().then((v) => setCurrentVersion(v));
  }, []);

  const checkForUpdates = useCallback(() => {
    setState("checking");
    setProgress(null);
    window.electron.checkForUpdates().then((isAutoInstall) => {
      if (isAutoInstall && newVersion) {
        setState("downloading");
      }
    });
  }, [newVersion]);

  useEffect(() => {
    if (!visible) return;

    const unsubscribe = window.electron.onAutoUpdaterEvent(
      (event: AppUpdaterEvent) => {
        if (event.type === "update-available") {
          setNewVersion(event.info.version);
        }

        if (event.type === "download-progress") {
          setProgress(event.info);
          setState("downloading");
        }

        if (event.type === "update-downloaded") {
          setProgress(null);
          setState("ready-to-install");
        }

        if (event.type === "update-not-available") {
          setState("up-to-date");
        }

        if (event.type === "error") {
          setState("error");
        }
      }
    );

    checkForUpdates();

    return () => {
      unsubscribe();
    };
  }, [visible, checkForUpdates]);

  useEffect(() => {
    if (!visible) return;

    if (newVersion && state === "checking") {
      window.electron.checkForUpdates().then((isAutoInstall) => {
        if (isAutoInstall) {
          setState("downloading");
        } else {
          setState("update-available");
        }
      });
    }
  }, [visible, newVersion, state]);

  const handleCheckAgain = () => {
    checkForUpdates();
  };

  const handleRestartAndInstall = () => {
    window.electron.restartAndInstallUpdate();
  };

  const renderDownloadProgress = () => {
    const percent = Math.min(100, Math.max(0, progress?.percent ?? 0));

    return (
      <div className="update-modal__status update-modal__status--downloading">
        <p className="update-modal__title">{t("downloading_update")}</p>

        <div
          className="update-modal__progress-bar"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="update-modal__progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="update-modal__progress-meta">
          <span className="update-modal__progress-percent">
            {Math.round(percent)}%
          </span>
          {progress && progress.total > 0 && (
            <span className="update-modal__progress-detail">
              {formatBytes(progress.transferred)} /{" "}
              {formatBytes(progress.total)}
              {progress.bytesPerSecond > 0 &&
                ` • ${formatBytes(progress.bytesPerSecond)}/s`}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (state) {
      case "checking":
        return (
          <div className="update-modal__status">
            <SyncIcon size={24} className="update-modal__spinner" />
            <p>{t("checking_for_updates")}</p>
          </div>
        );

      case "up-to-date":
        return (
          <div className="update-modal__status">
            <p className="update-modal__title">{t("up_to_date")}</p>
            <p className="update-modal__description">
              {t("up_to_date_description", { version: currentVersion })}
            </p>
            <Button theme="outline" onClick={handleCheckAgain}>
              {t("check_again")}
            </Button>
          </div>
        );

      case "update-available":
        return (
          <div className="update-modal__status">
            <p className="update-modal__title">
              {t("update_available", { version: newVersion })}
            </p>
            <p className="update-modal__description">
              {t("update_available_description")}
            </p>
            <Link to={releasesPageUrl}>
              <Button theme="primary">{t("download_from_github")}</Button>
            </Link>
          </div>
        );

      case "downloading":
        return renderDownloadProgress();

      case "ready-to-install":
        return (
          <div className="update-modal__status">
            <p className="update-modal__title">{t("ready_to_install")}</p>
            <p className="update-modal__description">
              {t("ready_to_install_description", { version: newVersion })}
            </p>
            <Button theme="primary" onClick={handleRestartAndInstall}>
              {t("restart_and_install")}
            </Button>
          </div>
        );

      case "error":
        return (
          <div className="update-modal__status">
            <AlertIcon size={24} className="update-modal__error-icon" />
            <p className="update-modal__title">{t("update_error")}</p>
            <p className="update-modal__description">
              {t("update_error_description")}
            </p>
            <Button theme="outline" onClick={handleCheckAgain}>
              {t("check_again")}
            </Button>
          </div>
        );
    }
  };

  return (
    <Modal visible={visible} title={t("update_modal_title")} onClose={onClose}>
      <div className="update-modal">{renderContent()}</div>
    </Modal>
  );
}
