import { useContext } from "react";
import { CheckboxField } from "@renderer/components";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import "./settings-beta.scss";

export function SettingsBeta() {
  const { t } = useTranslation("settings");

  const { updateUserPreferences } = useContext(settingsContext);

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const handleShowROMsInSidebarChange = () => {
    updateUserPreferences({
      ...userPreferences,
      showROMsInSidebar: !userPreferences?.showROMsInSidebar,
    });
  };

  return (
    <div className="settings-beta">
      <h3>{t("beta_features")}</h3>
      <p className="settings-beta__description">
        {t("beta_features_description")}
      </p>

      <CheckboxField
        label={t("show_roms_in_sidebar")}
        checked={userPreferences?.showROMsInSidebar ?? false}
        onChange={handleShowROMsInSidebarChange}
      />
    </div>
  );
}
