import SteamLogo from "@renderer/assets/steam-logo.svg?react";
import PlayLogo from "@renderer/assets/play-logo.svg?react";
import { LibraryGame } from "@types";
import cn from "classnames";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GameContextMenu } from "..";
import { useAppSelector } from "@renderer/hooks";

interface DownloadProgressInfo {
  raw: number;
  formatted: string;
}

interface SidebarGameItemProps {
  game: LibraryGame;
  handleSidebarGameClick: (event: React.MouseEvent, game: LibraryGame) => void;
  getGameTitle: (game: LibraryGame) => string;
  downloadProgress: DownloadProgressInfo | null;
  extractionProgress: DownloadProgressInfo | null;
}

export function SidebarGameItem({
  game,
  handleSidebarGameClick,
  getGameTitle,
  downloadProgress,
  extractionProgress,
}: Readonly<SidebarGameItemProps>) {
  const { t } = useTranslation("sidebar");
  const location = useLocation();
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
  }>({ visible: false, position: { x: 0, y: 0 } });

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      visible: true,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ visible: false, position: { x: 0, y: 0 } });
  };

  const isCustomGame = game.shop === "custom";
  const sidebarIcon = isCustomGame
    ? game.libraryImageUrl || game.iconUrl
    : game.customIconUrl || game.iconUrl;

  // Determine fallback icon based on game type
  const getFallbackIcon = () => {
    if (isCustomGame) {
      return <PlayLogo className="sidebar__game-icon" />;
    }
    return <SteamLogo className="sidebar__game-icon" />;
  };

  const isDownloading = downloadProgress !== null;
  const isExtracting = extractionProgress !== null;
  const isQueued =
    !isDownloading && !isExtracting && game.download?.queued === true;
  const isPaused =
    !isDownloading && !isExtracting && game.download?.status === "paused";
  const isNotInstalled =
    !game.executablePath &&
    !isDownloading &&
    !isExtracting &&
    !isQueued &&
    !isPaused;

  const renderStatusLabel = () => {
    if (isExtracting) {
      return (
        <span className="sidebar__menu-item-extraction-label">
          {extractionProgress.formatted}
        </span>
      );
    }

    if (isDownloading) {
      return (
        <span className="sidebar__menu-item-percentage">
          {downloadProgress.formatted}
        </span>
      );
    }

    if (isQueued) {
      return (
        <span className="sidebar__menu-item-queued-label">
          {t("queued_label")}
        </span>
      );
    }

    if (isPaused) {
      return (
        <span className="sidebar__menu-item-paused-label">
          {t("paused_label")}
        </span>
      );
    }

    if (
      userPreferences?.enableNewDownloadOptionsBadges !== false &&
      (game.newDownloadOptionsCount ?? 0) > 0
    ) {
      return (
        <span className="sidebar__game-badge">
          +{game.newDownloadOptionsCount}
        </span>
      );
    }

    return null;
  };

  return (
    <>
      <li
        key={game.id}
        className={cn("sidebar__menu-item", {
          "sidebar__menu-item--active":
            location.pathname === `/game/${game.shop}/${game.objectId}`,
          "sidebar__menu-item--muted": game.download?.status === "removed",
          "sidebar__menu-item--downloading": isDownloading,
          "sidebar__menu-item--extracting": isExtracting,
          "sidebar__menu-item--queued": isQueued,
          "sidebar__menu-item--paused": isPaused,
          "sidebar__menu-item--not-installed": isNotInstalled,
        })}
      >
        {isExtracting && (
          <div
            className="sidebar__menu-item-progress sidebar__menu-item-progress--extraction"
            style={{ width: `${extractionProgress.raw * 100}%` }}
          />
        )}

        {isDownloading && (
          <div
            className="sidebar__menu-item-progress"
            style={{ width: `${downloadProgress.raw * 100}%` }}
          />
        )}

        <button
          type="button"
          className="sidebar__menu-item-button"
          onClick={(event) => handleSidebarGameClick(event, game)}
          onContextMenu={handleContextMenu}
        >
          {sidebarIcon ? (
            <img
              className="sidebar__game-icon"
              src={sidebarIcon}
              alt={game.title}
              loading="lazy"
            />
          ) : (
            getFallbackIcon()
          )}

          <span className="sidebar__menu-item-button-label">
            {getGameTitle(game)}
          </span>

          {renderStatusLabel()}
        </button>
      </li>

      <GameContextMenu
        game={game}
        visible={contextMenu.visible}
        position={contextMenu.position}
        onClose={handleCloseContextMenu}
      />
    </>
  );
}
