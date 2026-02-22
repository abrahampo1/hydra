import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import type { BackupProvider } from "@types";
import { CloudIcon, FileDirectoryIcon } from "@primer/octicons-react";
import "./settings-backups.scss";

export function SettingsBackups() {
  const { t } = useTranslation("settings");

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast } = useToast();

  const [localBackupPath, setLocalBackupPath] = useState<string | null>(
    userPreferences?.localBackupPath ?? null
  );

  const backupProvider: BackupProvider =
    userPreferences?.backupProvider ?? "hydra-cloud";

  useEffect(() => {
    setLocalBackupPath(userPreferences?.localBackupPath ?? null);
  }, [userPreferences?.localBackupPath]);

  const handleProviderChange = async (provider: BackupProvider) => {
    await updateUserPreferences({ backupProvider: provider });
  };

  const handleSelectLocalBackupPath = async () => {
    const selectedPath = await window.electron.localBackup.selectPath();
    if (selectedPath) {
      setLocalBackupPath(selectedPath);
      showSuccessToast(t("local_backup_path_set"));
    }
  };

  return (
    <div className="settings-backups">
      <p className="settings-backups__description">
        {t("backups_description")}
      </p>

      <div className="settings-backups__section">
        <h3 className="settings-backups__section-title">
          {t("backup_provider_label")}
        </h3>

        <div className="settings-backups__provider-cards">
          <button
            type="button"
            className={`settings-backups__provider-card ${backupProvider === "hydra-cloud" ? "settings-backups__provider-card--active" : ""}`}
            onClick={() => handleProviderChange("hydra-cloud")}
          >
            <CloudIcon size={24} />
            <span className="settings-backups__provider-card-label">
              {t("hydra_cloud")}
            </span>
          </button>

          <button
            type="button"
            className={`settings-backups__provider-card ${backupProvider === "local" ? "settings-backups__provider-card--active" : ""}`}
            onClick={() => handleProviderChange("local")}
          >
            <FileDirectoryIcon size={24} />
            <span className="settings-backups__provider-card-label">
              {t("local_backup")}
            </span>
          </button>
        </div>
      </div>

      {backupProvider === "local" && (
        <div className="settings-backups__section">
          <h3 className="settings-backups__section-title">
            {t("local_backup")}
          </h3>

          <div className="settings-backups__local-backup-path">
            <span className="settings-backups__status-label">
              {t("local_backup_path")}:{" "}
              {localBackupPath ?? t("local_backup_path_not_set")}
            </span>
            <Button theme="outline" onClick={handleSelectLocalBackupPath}>
              {t("select_local_backup_path")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
