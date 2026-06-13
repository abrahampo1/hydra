import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { SyncIcon } from "@primer/octicons-react";
import { Link } from "../link/link";
import "./auto-update-header.scss";
import type { AppUpdaterEvent } from "@types";

export const releasesPageUrl =
  "https://github.com/abrahampo1/hydra/releases/latest";

export function AutoUpdateSubHeader() {
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [isAutoInstallAvailable, setIsAutoInstallAvailable] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);

  const { t } = useTranslation("header");

  const handleClickInstallUpdate = () => {
    window.electron.restartAndInstallUpdate();
  };

  useEffect(() => {
    const unsubscribe = window.electron.onAutoUpdaterEvent(
      (event: AppUpdaterEvent) => {
        if (event.type == "update-available") {
          setNewVersion(event.info.version);
        }

        if (event.type == "download-progress") {
          setDownloadPercent(event.info.percent);
        }

        if (event.type == "update-downloaded") {
          setDownloadPercent(null);
          setIsReadyToInstall(true);
        }
      }
    );

    window.electron.checkForUpdates().then((isAutoInstallAvailable) => {
      setIsAutoInstallAvailable(isAutoInstallAvailable);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!newVersion) return null;

  if (!isAutoInstallAvailable) {
    return (
      <header className="auto-update-sub-header">
        <Link
          to={releasesPageUrl}
          className="auto-update-sub-header__new-version-link"
        >
          <SyncIcon
            className="auto-update-sub-header__new-version-icon"
            size={12}
          />
          {t("version_available_download", { version: newVersion })}
        </Link>
      </header>
    );
  }

  if (isReadyToInstall) {
    return (
      <header className="auto-update-sub-header">
        <button
          type="button"
          className="auto-update-sub-header__new-version-button"
          onClick={handleClickInstallUpdate}
        >
          <SyncIcon
            className="auto-update-sub-header__new-version-icon"
            size={12}
          />
          {t("version_available_install", { version: newVersion })}
        </button>
      </header>
    );
  }

  if (downloadPercent !== null) {
    const percent = Math.min(100, Math.max(0, Math.round(downloadPercent)));

    return (
      <header className="auto-update-sub-header">
        <div className="auto-update-sub-header__downloading">
          <span className="auto-update-sub-header__downloading-label">
            <SyncIcon
              className="auto-update-sub-header__downloading-icon"
              size={12}
            />
            {t("version_downloading", { version: newVersion, percent })}
          </span>
          <div className="auto-update-sub-header__progress-bar">
            <div
              className="auto-update-sub-header__progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </header>
    );
  }

  return null;
}
