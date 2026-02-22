import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, CheckboxField, Modal, TextField } from "@renderer/components";
import type { Game, LibraryGame, ShortcutLocation } from "@types";
import { gameDetailsContext } from "@renderer/context";
import { DeleteGameModal } from "@renderer/pages/downloads/delete-game-modal";
import {
  useAppSelector,
  useDownload,
  useToast,
  useUserDetails,
} from "@renderer/hooks";
import { RemoveGameFromLibraryModal } from "./remove-from-library-modal";
import { ResetAchievementsModal } from "./reset-achievements-modal";
import { ChangeGamePlaytimeModal } from "./change-game-playtime-modal";
import {
  FileIcon,
  FileDirectoryIcon,
  LinkExternalIcon,
  DesktopDownloadIcon,
  TrashIcon,
  HistoryIcon,
  TrophyIcon,
  DownloadIcon,
  SyncIcon,
  PinIcon,
} from "@primer/octicons-react";
import SteamLogo from "@renderer/assets/steam-logo.svg?react";
import { debounce } from "lodash-es";
import { levelDBService } from "@renderer/services/leveldb.service";
import { getGameKey } from "@renderer/helpers";
import "./game-options-modal.scss";
import { logger } from "@renderer/logger";

export interface GameOptionsModalProps {
  visible: boolean;
  game: LibraryGame;
  onClose: () => void;
  onNavigateHome?: () => void;
}

const handleKeyDown =
  (onClick?: () => void) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

export function GameOptionsModal({
  visible,
  game,
  onClose,
  onNavigateHome,
}: Readonly<GameOptionsModalProps>) {
  const { t } = useTranslation("game_details");
  const { t: tSettings } = useTranslation("settings");

  const { showSuccessToast, showErrorToast } = useToast();

  const {
    updateGame,
    setShowRepacksModal,
    repacks,
    selectGameExecutable,
    achievements,
  } = useContext(gameDetailsContext);

  const { hasActiveSubscription } = useUserDetails();

  const backupProvider = useAppSelector(
    (state) => state.userPreferences.value?.backupProvider ?? "hydra-cloud"
  );

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRemoveGameModal, setShowRemoveGameModal] = useState(false);
  const [launchOptions, setLaunchOptions] = useState(game.launchOptions ?? "");
  const [showResetAchievementsModal, setShowResetAchievementsModal] =
    useState(false);
  const [showChangePlaytimeModal, setShowChangePlaytimeModal] = useState(false);
  const [isDeletingAchievements, setIsDeletingAchievements] = useState(false);
  const [automaticCloudSync, setAutomaticCloudSync] = useState(
    game.automaticCloudSync ?? false
  );
  const [creatingSteamShortcut, setCreatingSteamShortcut] = useState(false);
  const [saveFolderPath, setSaveFolderPath] = useState<string | null>(null);
  const [loadingSaveFolder, setLoadingSaveFolder] = useState(false);

  const {
    removeGameInstaller,
    removeGameFromLibrary,
    isGameDeleting,
    cancelDownload,
  } = useDownload();

  const { userDetails } = useUserDetails();

  const hasAchievements =
    (achievements?.filter((achievement) => achievement.unlocked).length ?? 0) >
    0;

  const deleting = isGameDeleting(game.id);

  const { lastPacket } = useDownload();

  const isGameDownloading =
    game.download?.status === "active" && lastPacket?.gameId === game.id;

  useEffect(() => {
    if (
      visible &&
      game.shop !== "custom" &&
      window.electron.platform === "win32"
    ) {
      setLoadingSaveFolder(true);
      setSaveFolderPath(null);
      window.electron
        .getGameSaveFolder(game.shop, game.objectId)
        .then(setSaveFolderPath)
        .catch(() => setSaveFolderPath(null))
        .finally(() => setLoadingSaveFolder(false));
    }
  }, [visible, game.shop, game.objectId]);

  const debounceUpdateLaunchOptions = useRef(
    debounce(async (value: string) => {
      const gameKey = getGameKey(game.shop, game.objectId);
      const gameData = (await levelDBService.get(
        gameKey,
        "games"
      )) as Game | null;
      if (gameData) {
        const trimmedValue = value.trim();
        const updated = {
          ...gameData,
          launchOptions: trimmedValue ? trimmedValue : null,
        };
        await levelDBService.put(gameKey, updated, "games");
      }
      updateGame();
    }, 1000)
  ).current;

  const handleRemoveGameFromLibrary = async () => {
    if (isGameDownloading) {
      await cancelDownload(game.shop, game.objectId);
    }

    await removeGameFromLibrary(game.shop, game.objectId);
    updateGame();
    onClose();

    if (game.shop === "custom" && onNavigateHome) {
      onNavigateHome();
    }
  };

  const handleChangeExecutableLocation = async () => {
    const path = await selectGameExecutable();

    if (path) {
      const gameUsingPath =
        await window.electron.verifyExecutablePathInUse(path);

      if (gameUsingPath) {
        showErrorToast(
          t("executable_path_in_use", { game: gameUsingPath.title })
        );
        return;
      }

      window.electron
        .updateExecutablePath(game.shop, game.objectId, path)
        .then(updateGame);
    }
  };

  const handleCreateSteamShortcut = async () => {
    try {
      setCreatingSteamShortcut(true);
      await window.electron.createSteamShortcut(game.shop, game.objectId);

      showSuccessToast(
        t("create_shortcut_success"),
        t("you_might_need_to_restart_steam")
      );

      updateGame();
    } catch (error: unknown) {
      logger.error("Failed to create Steam shortcut", error);
      showErrorToast(t("create_shortcut_error"));
    } finally {
      setCreatingSteamShortcut(false);
    }
  };

  const handleCreateShortcut = async (location: ShortcutLocation) => {
    window.electron
      .createGameShortcut(game.shop, game.objectId, location)
      .then((success) => {
        if (success) {
          showSuccessToast(t("create_shortcut_success"));
        } else {
          showErrorToast(t("create_shortcut_error"));
        }
      })
      .catch(() => {
        showErrorToast(t("create_shortcut_error"));
      });
  };

  const handleOpenDownloadFolder = async () => {
    await window.electron.openGameInstallerPath(game.shop, game.objectId);
  };

  const handleDeleteGame = async () => {
    await removeGameInstaller(game.shop, game.objectId);
    updateGame();
  };

  const handleOpenGameExecutablePath = async () => {
    await window.electron.openGameExecutablePath(game.shop, game.objectId);
  };

  const handleOpenSaveFolder = async () => {
    if (saveFolderPath) {
      await window.electron.openGameSaveFolder(
        game.shop,
        game.objectId,
        saveFolderPath
      );
    }
  };

  const handleClearExecutablePath = async () => {
    await window.electron.updateExecutablePath(game.shop, game.objectId, null);

    updateGame();
  };

  const handleChangeWinePrefixPath = async () => {
    const defaultPath =
      await window.electron.getDefaultWinePrefixSelectionPath();

    const { filePaths } = await window.electron.showOpenDialog({
      properties: ["openDirectory"],
      defaultPath: defaultPath ?? game?.winePrefixPath ?? "",
    });

    if (filePaths && filePaths.length > 0) {
      try {
        await window.electron.selectGameWinePrefix(
          game.shop,
          game.objectId,
          filePaths[0]
        );
        await updateGame();
      } catch (error) {
        showErrorToast(
          t("invalid_wine_prefix_path"),
          t("invalid_wine_prefix_path_description")
        );
      }
    }
  };

  const handleClearWinePrefixPath = async () => {
    await window.electron.selectGameWinePrefix(game.shop, game.objectId, null);
    updateGame();
  };

  const handleChangeLaunchOptions = async (event) => {
    const value = event.target.value;

    setLaunchOptions(value);
    debounceUpdateLaunchOptions(value);
  };

  const handleClearLaunchOptions = async () => {
    setLaunchOptions("");

    const gameKey = getGameKey(game.shop, game.objectId);
    const gameData = (await levelDBService.get(
      gameKey,
      "games"
    )) as Game | null;
    if (gameData) {
      const updated = { ...gameData, launchOptions: null };
      await levelDBService.put(gameKey, updated, "games");
    }
    updateGame();
  };

  const shouldShowWinePrefixConfiguration =
    window.electron.platform === "linux";

  const shouldShowCreateStartMenuShortcut =
    window.electron.platform === "win32";

  const handleResetAchievements = async () => {
    setIsDeletingAchievements(true);
    try {
      await window.electron.resetGameAchievements(game.shop, game.objectId);
      await updateGame();
      showSuccessToast(t("reset_achievements_success"));
    } catch (error) {
      showErrorToast(t("reset_achievements_error"));
    } finally {
      setIsDeletingAchievements(false);
    }
  };

  const handleChangePlaytime = async (playtimeInSeconds: number) => {
    try {
      await window.electron.changeGamePlayTime(
        game.shop,
        game.objectId,
        playtimeInSeconds
      );
      await updateGame();
      showSuccessToast(t("update_playtime_success"));
    } catch (error) {
      showErrorToast(t("update_playtime_error"));
    }
  };

  const handleToggleAutomaticCloudSync = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setAutomaticCloudSync(event.target.checked);

    const gameKey = getGameKey(game.shop, game.objectId);
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

  const isDownloadsDisabled = deleting || isGameDownloading || !repacks.length;
  const isDeleteFilesDisabled =
    isGameDownloading || deleting || !game.download?.downloadPath;
  const isResetAchievementsDisabled =
    deleting || isDeletingAchievements || !hasAchievements || !userDetails;
  const isAutomaticCloudSyncDisabled =
    !game.executablePath ||
    (backupProvider === "hydra-cloud" && !hasActiveSubscription);
  const cloudProviderLabel =
    backupProvider === "local"
      ? tSettings("local_backup")
      : tSettings("hydra_cloud");

  return (
    <>
      <DeleteGameModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        deleteGame={handleDeleteGame}
      />

      <RemoveGameFromLibraryModal
        visible={showRemoveGameModal}
        onClose={() => setShowRemoveGameModal(false)}
        removeGameFromLibrary={handleRemoveGameFromLibrary}
        game={game}
      />

      <ResetAchievementsModal
        visible={showResetAchievementsModal}
        onClose={() => setShowResetAchievementsModal(false)}
        resetAchievements={handleResetAchievements}
        game={game}
      />

      <ChangeGamePlaytimeModal
        visible={showChangePlaytimeModal}
        onClose={() => setShowChangePlaytimeModal(false)}
        changePlaytime={handleChangePlaytime}
        game={game}
      />

      <Modal
        visible={visible}
        title={game.title}
        onClose={onClose}
        large={true}
      >
        <div className="game-options-modal__container">
          {/* Executable Section */}
          <div>
            <h3 className="game-options-modal__section-title">
              {t("executable_section_title")}
            </h3>
            <div className="game-options-modal__section-rows">
              <div className="game-options-modal__action-row">
                <span className="game-options-modal__action-icon">
                  <FileIcon size={16} />
                </span>
                <div className="game-options-modal__executable-path">
                  <span className="game-options-modal__executable-path-label">
                    {t("executable_section_description")}
                  </span>
                  {game.executablePath && (
                    <span className="game-options-modal__executable-path-value">
                      {game.executablePath}
                    </span>
                  )}
                </div>
                <div className="game-options-modal__action-right">
                  <Button
                    type="button"
                    theme="outline"
                    onClick={handleChangeExecutableLocation}
                  >
                    {t("select_executable")}
                  </Button>
                  {game.executablePath && (
                    <Button onClick={handleClearExecutablePath} theme="outline">
                      {t("clear")}
                    </Button>
                  )}
                </div>
              </div>

              {game.executablePath && (
                <div
                  className="game-options-modal__action-row game-options-modal__action-row--clickable"
                  onClick={handleOpenGameExecutablePath}
                  onKeyDown={handleKeyDown(handleOpenGameExecutablePath)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="game-options-modal__action-icon">
                    <FileDirectoryIcon size={16} />
                  </span>
                  <span className="game-options-modal__action-label">
                    {t("open_folder")}
                  </span>
                </div>
              )}

              {game.shop !== "custom" &&
                window.electron.platform === "win32" &&
                saveFolderPath &&
                !loadingSaveFolder && (
                  <div
                    className="game-options-modal__action-row game-options-modal__action-row--clickable"
                    onClick={handleOpenSaveFolder}
                    onKeyDown={handleKeyDown(handleOpenSaveFolder)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="game-options-modal__action-icon">
                      <FileDirectoryIcon size={16} />
                    </span>
                    <span className="game-options-modal__action-label">
                      {t("open_save_folder")}
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* Configuration Section */}
          <div>
            <h3 className="game-options-modal__section-title">
              {t("launch_options")}
            </h3>
            <div className="game-options-modal__section-rows">
              <div className="game-options-modal__action-row">
                <span className="game-options-modal__action-icon">
                  <LinkExternalIcon size={16} />
                </span>
                <div className="game-options-modal__inline-field">
                  <TextField
                    value={launchOptions}
                    theme="dark"
                    placeholder={t("launch_options_placeholder")}
                    onChange={handleChangeLaunchOptions}
                    rightContent={
                      game.launchOptions && (
                        <Button
                          onClick={handleClearLaunchOptions}
                          theme="outline"
                        >
                          {t("clear")}
                        </Button>
                      )
                    }
                  />
                </div>
              </div>

              {shouldShowWinePrefixConfiguration && (
                <div className="game-options-modal__action-row">
                  <span className="game-options-modal__action-icon">
                    <FileDirectoryIcon size={16} />
                  </span>
                  <div className="game-options-modal__inline-field">
                    <TextField
                      value={game.winePrefixPath || ""}
                      readOnly
                      theme="dark"
                      disabled
                      placeholder={t("no_directory_selected")}
                      rightContent={
                        <>
                          <Button
                            type="button"
                            theme="outline"
                            onClick={handleChangeWinePrefixPath}
                          >
                            {t("wine_prefix")}
                          </Button>
                          {game.winePrefixPath && (
                            <Button
                              onClick={handleClearWinePrefixPath}
                              theme="outline"
                            >
                              {t("clear")}
                            </Button>
                          )}
                        </>
                      }
                    />
                  </div>
                </div>
              )}

              {game.shop !== "custom" && (
                <div className="game-options-modal__action-row">
                  <span className="game-options-modal__action-icon">
                    <SyncIcon size={16} />
                  </span>
                  <CheckboxField
                    label={
                      <div className="game-options-modal__cloud-sync-label">
                        {t("enable_automatic_cloud_sync")}
                        <span className="game-options-modal__cloud-sync-hydra-cloud">
                          {cloudProviderLabel}
                        </span>
                      </div>
                    }
                    checked={automaticCloudSync}
                    disabled={isAutomaticCloudSyncDisabled}
                    onChange={handleToggleAutomaticCloudSync}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Shortcuts Section */}
          {game.executablePath && (
            <div>
              <h3 className="game-options-modal__section-title">
                {t("shortcuts_section_title")}
              </h3>
              <div className="game-options-modal__section-rows">
                <div
                  className="game-options-modal__action-row game-options-modal__action-row--clickable"
                  onClick={() => handleCreateShortcut("desktop")}
                  onKeyDown={handleKeyDown(() =>
                    handleCreateShortcut("desktop")
                  )}
                  role="button"
                  tabIndex={0}
                >
                  <span className="game-options-modal__action-icon">
                    <DesktopDownloadIcon size={16} />
                  </span>
                  <span className="game-options-modal__action-label">
                    {t("create_shortcut")}
                  </span>
                </div>

                {game.shop !== "custom" && (
                  <div
                    className={`game-options-modal__action-row game-options-modal__action-row--clickable ${creatingSteamShortcut ? "game-options-modal__action-row--disabled" : ""}`}
                    onClick={
                      creatingSteamShortcut
                        ? undefined
                        : handleCreateSteamShortcut
                    }
                    onKeyDown={handleKeyDown(
                      creatingSteamShortcut
                        ? undefined
                        : handleCreateSteamShortcut
                    )}
                    role="button"
                    tabIndex={creatingSteamShortcut ? -1 : 0}
                  >
                    <span className="game-options-modal__steam-logo">
                      <SteamLogo />
                    </span>
                    <span className="game-options-modal__action-label">
                      {t("create_steam_shortcut")}
                    </span>
                  </div>
                )}

                {shouldShowCreateStartMenuShortcut && (
                  <div
                    className="game-options-modal__action-row game-options-modal__action-row--clickable"
                    onClick={() => handleCreateShortcut("start_menu")}
                    onKeyDown={handleKeyDown(() =>
                      handleCreateShortcut("start_menu")
                    )}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="game-options-modal__action-icon">
                      <PinIcon size={16} />
                    </span>
                    <span className="game-options-modal__action-label">
                      {t("create_start_menu_shortcut")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Downloads Section */}
          {game.shop !== "custom" && (
            <div>
              <h3 className="game-options-modal__section-title">
                {t("downloads_section_title")}
              </h3>
              <div className="game-options-modal__section-rows">
                <div
                  className={`game-options-modal__action-row game-options-modal__action-row--clickable ${isDownloadsDisabled ? "game-options-modal__action-row--disabled" : ""}`}
                  onClick={
                    isDownloadsDisabled
                      ? undefined
                      : () => setShowRepacksModal(true)
                  }
                  onKeyDown={handleKeyDown(
                    isDownloadsDisabled
                      ? undefined
                      : () => setShowRepacksModal(true)
                  )}
                  role="button"
                  tabIndex={isDownloadsDisabled ? -1 : 0}
                >
                  <span className="game-options-modal__action-icon">
                    <DownloadIcon size={16} />
                  </span>
                  <span className="game-options-modal__action-label">
                    {t("open_download_options")}
                  </span>
                </div>

                {game.download?.downloadPath && (
                  <div
                    className={`game-options-modal__action-row game-options-modal__action-row--clickable ${deleting ? "game-options-modal__action-row--disabled" : ""}`}
                    onClick={deleting ? undefined : handleOpenDownloadFolder}
                    onKeyDown={handleKeyDown(
                      deleting ? undefined : handleOpenDownloadFolder
                    )}
                    role="button"
                    tabIndex={deleting ? -1 : 0}
                  >
                    <span className="game-options-modal__action-icon">
                      <FileDirectoryIcon size={16} />
                    </span>
                    <span className="game-options-modal__action-label">
                      {t("open_download_location")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div>
            <h3 className="game-options-modal__section-title">
              {t("danger_zone_section_title")}
            </h3>
            <div className="game-options-modal__section-rows">
              <div
                className={`game-options-modal__action-row game-options-modal__action-row--danger game-options-modal__action-row--clickable ${deleting ? "game-options-modal__action-row--disabled" : ""}`}
                onClick={
                  deleting ? undefined : () => setShowRemoveGameModal(true)
                }
                onKeyDown={handleKeyDown(
                  deleting ? undefined : () => setShowRemoveGameModal(true)
                )}
                role="button"
                tabIndex={deleting ? -1 : 0}
              >
                <span className="game-options-modal__action-icon">
                  <TrashIcon size={16} />
                </span>
                <span className="game-options-modal__action-label">
                  {t("remove_from_library")}
                </span>
              </div>

              {game.shop !== "custom" && (
                <div
                  className={`game-options-modal__action-row game-options-modal__action-row--danger game-options-modal__action-row--clickable ${isResetAchievementsDisabled ? "game-options-modal__action-row--disabled" : ""}`}
                  onClick={
                    isResetAchievementsDisabled
                      ? undefined
                      : () => setShowResetAchievementsModal(true)
                  }
                  onKeyDown={handleKeyDown(
                    isResetAchievementsDisabled
                      ? undefined
                      : () => setShowResetAchievementsModal(true)
                  )}
                  role="button"
                  tabIndex={isResetAchievementsDisabled ? -1 : 0}
                >
                  <span className="game-options-modal__action-icon">
                    <TrophyIcon size={16} />
                  </span>
                  <span className="game-options-modal__action-label">
                    {t("reset_achievements")}
                  </span>
                </div>
              )}

              <div
                className="game-options-modal__action-row game-options-modal__action-row--danger game-options-modal__action-row--clickable"
                onClick={() => setShowChangePlaytimeModal(true)}
                onKeyDown={handleKeyDown(() =>
                  setShowChangePlaytimeModal(true)
                )}
                role="button"
                tabIndex={0}
              >
                <span className="game-options-modal__action-icon">
                  <HistoryIcon size={16} />
                </span>
                <span className="game-options-modal__action-label">
                  {t("update_game_playtime")}
                </span>
              </div>

              {game.shop !== "custom" && (
                <div
                  className={`game-options-modal__action-row game-options-modal__action-row--danger game-options-modal__action-row--clickable ${isDeleteFilesDisabled ? "game-options-modal__action-row--disabled" : ""}`}
                  onClick={
                    isDeleteFilesDisabled
                      ? undefined
                      : () => setShowDeleteModal(true)
                  }
                  onKeyDown={handleKeyDown(
                    isDeleteFilesDisabled
                      ? undefined
                      : () => setShowDeleteModal(true)
                  )}
                  role="button"
                  tabIndex={isDeleteFilesDisabled ? -1 : 0}
                >
                  <span className="game-options-modal__action-icon">
                    <TrashIcon size={16} />
                  </span>
                  <span className="game-options-modal__action-label">
                    {t("remove_files")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
