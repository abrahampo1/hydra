import { LibraryGame } from "@types";
import { useGameCard } from "@renderer/hooks";
import { formatBytes } from "@shared";
import {
  ClockIcon,
  AlertFillIcon,
  TrophyIcon,
  DatabaseIcon,
  FileZipIcon,
} from "@primer/octicons-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./library-game-card-large.scss";

interface ProgressInfo {
  raw: number;
  formatted: string;
}

interface LibraryGameCardLargeProps {
  game: LibraryGame;
  onContextMenu: (
    game: LibraryGame,
    position: { x: number; y: number }
  ) => void;
  downloadProgress: ProgressInfo | null;
  extractionProgress: ProgressInfo | null;
}

const normalizePathForCss = (url: string | null | undefined): string => {
  if (!url) return "";
  return url.replaceAll("\\", "/");
};

const getImageWithCustomPriority = (
  customUrl: string | null | undefined,
  originalUrl: string | null | undefined,
  fallbackUrl?: string | null | undefined
) => {
  const selectedUrl = customUrl || originalUrl || fallbackUrl || "";
  return normalizePathForCss(selectedUrl);
};

export const LibraryGameCardLarge = memo(function LibraryGameCardLarge({
  game,
  onContextMenu,
  downloadProgress,
  extractionProgress,
}: Readonly<LibraryGameCardLargeProps>) {
  const { t } = useTranslation("library");
  const { formatPlayTime, handleCardClick, handleContextMenuClick } =
    useGameCard(game, onContextMenu);

  const gameState = useMemo(() => {
    if (extractionProgress) return "extracting";
    if (downloadProgress) return "downloading";
    if (game.download?.queued) return "queued";
    if (game.download?.status === "paused") return "paused";
    if (
      game.download?.progress === 1 &&
      game.download?.status === "complete" &&
      !game.executablePath
    )
      return "installer-ready";
    if (!game.executablePath) return "not-installed";
    return "installed";
  }, [
    extractionProgress,
    downloadProgress,
    game.download,
    game.executablePath,
  ]);

  const stateLabel = useMemo(() => {
    switch (gameState) {
      case "extracting":
        return extractionProgress!.formatted;
      case "downloading":
        return downloadProgress!.formatted;
      case "queued":
        return t("queued");
      case "paused":
        return t("paused");
      case "installer-ready":
        return t("installer_ready");
      default:
        return null;
    }
  }, [gameState, extractionProgress, downloadProgress, t]);

  const sizeBars = useMemo(() => {
    const items: {
      type: "installer" | "installed";
      bytes: number;
      formatted: string;
      icon: typeof FileZipIcon;
      tooltipKey: string;
    }[] = [];

    if (game.installerSizeInBytes) {
      items.push({
        type: "installer",
        bytes: game.installerSizeInBytes,
        formatted: formatBytes(game.installerSizeInBytes),
        icon: FileZipIcon,
        tooltipKey: "installer_size_tooltip",
      });
    }

    if (game.installedSizeInBytes) {
      items.push({
        type: "installed",
        bytes: game.installedSizeInBytes,
        formatted: formatBytes(game.installedSizeInBytes),
        icon: DatabaseIcon,
        tooltipKey: "disk_usage_tooltip",
      });
    }

    if (items.length === 0) return [];

    // Sort by size descending (larger first)
    items.sort((a, b) => b.bytes - a.bytes);

    // Calculate proportional widths in pixels (max bar is 80px)
    const maxBytes = items[0].bytes;
    const maxWidth = 80;
    return items.map((item) => ({
      ...item,
      widthPx: Math.round((item.bytes / maxBytes) * maxWidth),
    }));
  }, [game.installerSizeInBytes, game.installedSizeInBytes]);

  const backgroundImage = useMemo(
    () =>
      getImageWithCustomPriority(
        game.customHeroImageUrl,
        game.libraryHeroImageUrl,
        game.libraryImageUrl ?? game.iconUrl
      ),
    [
      game.customHeroImageUrl,
      game.libraryHeroImageUrl,
      game.libraryImageUrl,
      game.iconUrl,
    ]
  );

  const [unlockedAchievementsCount, setUnlockedAchievementsCount] = useState(
    game.unlockedAchievementCount ?? 0
  );

  useEffect(() => {
    if (game.unlockedAchievementCount) return;

    window.electron
      .getUnlockedAchievements(game.objectId, game.shop)
      .then((achievements) => {
        setUnlockedAchievementsCount(
          achievements.filter((a) => a.unlocked).length
        );
      });
  }, [game]);

  const backgroundStyle = useMemo(
    () =>
      backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : {},
    [backgroundImage]
  );

  const achievementBarStyle = useMemo(
    () => ({
      width: `${(unlockedAchievementsCount / (game.achievementCount ?? 1)) * 100}%`,
    }),
    [unlockedAchievementsCount, game.achievementCount]
  );

  const logoImage = game.customLogoImageUrl ?? game.logoImageUrl;

  const wrapperClass = useMemo(() => {
    const base = "library-game-card-large";
    if (gameState === "not-installed") return `${base} ${base}--not-installed`;
    if (gameState === "installer-ready")
      return `${base} ${base}--installer-ready`;
    if (gameState === "downloading") return `${base} ${base}--downloading`;
    if (gameState === "extracting") return `${base} ${base}--extracting`;
    if (gameState === "queued") return `${base} ${base}--queued`;
    if (gameState === "paused") return `${base} ${base}--paused`;
    return base;
  }, [gameState]);

  return (
    <button
      type="button"
      className={wrapperClass}
      onClick={handleCardClick}
      onContextMenu={handleContextMenuClick}
    >
      <div
        className="library-game-card-large__background"
        style={backgroundStyle}
      />
      <div className="library-game-card-large__gradient" />

      <div className="library-game-card-large__overlay">
        <div className="library-game-card-large__top-section">
          {sizeBars.length > 0 && (
            <div className="library-game-card-large__size-badges">
              {sizeBars.map((bar) => (
                <div
                  key={bar.type}
                  className="library-game-card-large__size-bar"
                  title={t(bar.tooltipKey)}
                >
                  <bar.icon size={11} />
                  <div
                    className={`library-game-card-large__size-bar-line library-game-card-large__size-bar-line--${bar.type}`}
                    style={{ width: `${bar.widthPx}px` }}
                  />
                  <span className="library-game-card-large__size-bar-text">
                    {bar.formatted}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="library-game-card-large__top-right">
            {stateLabel && (
              <div
                className={`library-game-card-large__status-badge library-game-card-large__status-badge--${gameState}`}
              >
                {stateLabel}
              </div>
            )}

            <div className="library-game-card-large__playtime">
              {game.hasManuallyUpdatedPlaytime ? (
                <AlertFillIcon
                  size={11}
                  className="library-game-card-large__manual-playtime"
                />
              ) : (
                <ClockIcon size={11} />
              )}
              <span className="library-game-card-large__playtime-text">
                {formatPlayTime(game.playTimeInMilliseconds)}
              </span>
            </div>
          </div>
        </div>

        <div className="library-game-card-large__logo-container">
          {logoImage ? (
            <img
              src={logoImage}
              alt={game.title}
              className="library-game-card-large__logo"
            />
          ) : (
            <h3 className="library-game-card-large__title">{game.title}</h3>
          )}
        </div>

        <div className="library-game-card-large__info-bar">
          {/* Achievements section */}
          {(game.achievementCount ?? 0) > 0 && (
            <div className="library-game-card-large__achievements">
              <div className="library-game-card-large__achievement-header">
                <div className="library-game-card-large__achievements-gap">
                  <TrophyIcon
                    size={14}
                    className="library-game-card-large__achievement-trophy"
                  />
                  <span className="library-game-card-large__achievement-count">
                    {unlockedAchievementsCount} / {game.achievementCount ?? 0}
                  </span>
                </div>
                <span className="library-game-card-large__achievement-percentage">
                  {Math.round(
                    (unlockedAchievementsCount / (game.achievementCount ?? 1)) *
                      100
                  )}
                  %
                </span>
              </div>
              <div className="library-game-card-large__achievement-progress">
                <div
                  className="library-game-card-large__achievement-bar"
                  style={achievementBarStyle}
                />
              </div>
            </div>
          )}
        </div>

        {(gameState === "downloading" || gameState === "extracting") && (
          <div className="library-game-card-large__progress-bar">
            <div
              className={`library-game-card-large__progress-fill library-game-card-large__progress-fill--${gameState}`}
              style={{
                width: `${(gameState === "downloading" ? downloadProgress!.raw : extractionProgress!.raw) * 100}%`,
              }}
            />
          </div>
        )}
      </div>
    </button>
  );
});
