import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CheckboxField } from "@renderer/components";
import { useAppSelector } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import "./settings-behavior.scss";
import { QuestionIcon } from "@primer/octicons-react";

export function SettingsBehavior() {
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const [showRunAtStartup, setShowRunAtStartup] = useState(false);

  const { updateUserPreferences } = useContext(settingsContext);

  const [form, setForm] = useState({
    preferQuitInsteadOfHiding: false,
    runAtStartup: false,
    startMinimized: false,
    disableNsfwAlert: false,
    enableAutoInstall: false,
    seedAfterDownloadComplete: false,
    showHiddenAchievementsDescription: false,
    showDownloadSpeedInMegabytes: false,
    extractFilesByDefault: true,
    autoDeleteInstallerAfterExtraction: false,
    enableSteamAchievements: false,
    autoplayGameTrailers: true,
    hideToTrayOnGameStart: false,
    enableNewDownloadOptionsBadges: true,
    createStartMenuShortcut: true,
  });

  const { t } = useTranslation("settings");

  useEffect(() => {
    if (userPreferences) {
      setForm({
        preferQuitInsteadOfHiding:
          userPreferences.preferQuitInsteadOfHiding ?? false,
        runAtStartup: userPreferences.runAtStartup ?? false,
        startMinimized: userPreferences.startMinimized ?? false,
        disableNsfwAlert: userPreferences.disableNsfwAlert ?? false,
        enableAutoInstall: userPreferences.enableAutoInstall ?? false,
        seedAfterDownloadComplete:
          userPreferences.seedAfterDownloadComplete ?? false,
        showHiddenAchievementsDescription:
          userPreferences.showHiddenAchievementsDescription ?? false,
        showDownloadSpeedInMegabytes:
          userPreferences.showDownloadSpeedInMegabytes ?? false,
        extractFilesByDefault: userPreferences.extractFilesByDefault ?? true,
        autoDeleteInstallerAfterExtraction:
          userPreferences.autoDeleteInstallerAfterExtraction ?? false,
        enableSteamAchievements:
          userPreferences.enableSteamAchievements ?? false,
        autoplayGameTrailers: userPreferences.autoplayGameTrailers ?? true,
        hideToTrayOnGameStart: userPreferences.hideToTrayOnGameStart ?? false,
        enableNewDownloadOptionsBadges:
          userPreferences.enableNewDownloadOptionsBadges ?? true,
        createStartMenuShortcut:
          userPreferences.createStartMenuShortcut ?? true,
      });
    }
  }, [userPreferences]);

  useEffect(() => {
    window.electron.isPortableVersion().then((isPortableVersion) => {
      setShowRunAtStartup(!isPortableVersion);
    });
  }, []);

  const handleChange = (values: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...values }));
    updateUserPreferences(values);
  };

  return (
    <div className="settings-behavior">
      <h3 className="settings-behavior__section-title">
        {t("behavior_section_application")}
      </h3>
      <p className="settings-behavior__section-description">
        {t("behavior_section_application_description")}
      </p>
      <div className="settings-behavior__section-grid">
        <CheckboxField
          label={t("quit_app_instead_hiding")}
          checked={form.preferQuitInsteadOfHiding}
          onChange={() =>
            handleChange({
              preferQuitInsteadOfHiding: !form.preferQuitInsteadOfHiding,
            })
          }
        />

        <CheckboxField
          label={t("hide_to_tray_on_game_start")}
          checked={form.hideToTrayOnGameStart}
          onChange={() =>
            handleChange({
              hideToTrayOnGameStart: !form.hideToTrayOnGameStart,
            })
          }
        />

        {showRunAtStartup && (
          <CheckboxField
            label={t("launch_with_system")}
            onChange={() => {
              handleChange({ runAtStartup: !form.runAtStartup });
              window.electron.autoLaunch({
                enabled: !form.runAtStartup,
                minimized: form.startMinimized,
              });
            }}
            checked={form.runAtStartup}
          />
        )}

        {showRunAtStartup && (
          <div
            className={`settings-behavior__checkbox-container ${form.runAtStartup ? "settings-behavior__checkbox-container--enabled" : ""}`}
          >
            <CheckboxField
              label={t("launch_minimized")}
              style={{ cursor: form.runAtStartup ? "pointer" : "not-allowed" }}
              checked={form.runAtStartup && form.startMinimized}
              disabled={!form.runAtStartup}
              onChange={() => {
                handleChange({ startMinimized: !form.startMinimized });
                window.electron.autoLaunch({
                  minimized: !form.startMinimized,
                  enabled: form.runAtStartup,
                });
              }}
            />
          </div>
        )}
      </div>

      <h3 className="settings-behavior__section-title">
        {t("behavior_section_downloads")}
      </h3>
      <p className="settings-behavior__section-description">
        {t("behavior_section_downloads_description")}
      </p>
      <div className="settings-behavior__section-grid">
        <CheckboxField
          label={t("seed_after_download_complete")}
          checked={form.seedAfterDownloadComplete}
          onChange={() =>
            handleChange({
              seedAfterDownloadComplete: !form.seedAfterDownloadComplete,
            })
          }
        />

        <CheckboxField
          label={t("extract_files_by_default")}
          checked={form.extractFilesByDefault}
          onChange={() =>
            handleChange({
              extractFilesByDefault: !form.extractFilesByDefault,
            })
          }
        />

        <CheckboxField
          label={t("auto_delete_installer_after_extraction")}
          checked={form.autoDeleteInstallerAfterExtraction}
          onChange={() =>
            handleChange({
              autoDeleteInstallerAfterExtraction:
                !form.autoDeleteInstallerAfterExtraction,
            })
          }
        />

        <CheckboxField
          label={t("show_download_speed_in_megabytes")}
          checked={form.showDownloadSpeedInMegabytes}
          onChange={() =>
            handleChange({
              showDownloadSpeedInMegabytes: !form.showDownloadSpeedInMegabytes,
            })
          }
        />

        {window.electron.platform === "linux" && (
          <CheckboxField
            label={t("enable_auto_install")}
            checked={form.enableAutoInstall}
            onChange={() =>
              handleChange({ enableAutoInstall: !form.enableAutoInstall })
            }
          />
        )}

        {window.electron.platform === "win32" && (
          <CheckboxField
            label={t("create_start_menu_shortcut_on_download")}
            checked={form.createStartMenuShortcut}
            onChange={() =>
              handleChange({
                createStartMenuShortcut: !form.createStartMenuShortcut,
              })
            }
          />
        )}
      </div>

      <h3 className="settings-behavior__section-title">
        {t("behavior_section_content")}
      </h3>
      <p className="settings-behavior__section-description">
        {t("behavior_section_content_description")}
      </p>
      <div className="settings-behavior__section-grid">
        <CheckboxField
          label={t("autoplay_trailers_on_game_page")}
          checked={form.autoplayGameTrailers}
          onChange={() =>
            handleChange({ autoplayGameTrailers: !form.autoplayGameTrailers })
          }
        />

        <CheckboxField
          label={t("disable_nsfw_alert")}
          checked={form.disableNsfwAlert}
          onChange={() =>
            handleChange({ disableNsfwAlert: !form.disableNsfwAlert })
          }
        />

        <CheckboxField
          label={t("enable_new_download_options_badges")}
          checked={form.enableNewDownloadOptionsBadges}
          onChange={() =>
            handleChange({
              enableNewDownloadOptionsBadges:
                !form.enableNewDownloadOptionsBadges,
            })
          }
        />
      </div>

      <h3 className="settings-behavior__section-title">
        {t("behavior_section_achievements")}
      </h3>
      <p className="settings-behavior__section-description">
        {t("behavior_section_achievements_description")}
      </p>
      <div className="settings-behavior__section-grid">
        <CheckboxField
          label={t("show_hidden_achievement_description")}
          checked={form.showHiddenAchievementsDescription}
          onChange={() =>
            handleChange({
              showHiddenAchievementsDescription:
                !form.showHiddenAchievementsDescription,
            })
          }
        />

        <div className="settings-behavior__checkbox-container--with-tooltip">
          <CheckboxField
            label={t("enable_steam_achievements")}
            checked={form.enableSteamAchievements}
            onChange={() =>
              handleChange({
                enableSteamAchievements: !form.enableSteamAchievements,
              })
            }
          />

          <small
            className="settings-behavior__checkbox-container--tooltip"
            data-open-article="steam-achievements"
          >
            <QuestionIcon size={12} />
          </small>
        </div>
      </div>
    </div>
  );
}
