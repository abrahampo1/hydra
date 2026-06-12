import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDownloadProgress } from "@renderer/helpers";
import {
  useAppSelector,
  useDate,
  useDownload,
  useFormat,
} from "@renderer/hooks";
import { Link } from "@renderer/components";
import { gameDetailsContext } from "@renderer/context";
import { MAX_MINUTES_TO_SHOW_IN_PLAYTIME } from "@renderer/constants";
import { AlertFillIcon } from "@primer/octicons-react";
import { Tooltip } from "react-tooltip";
import { getDisplayStreak } from "@shared";
import flameIconAnimated from "@renderer/assets/icons/flame-animated.gif";
import "./hero-panel-playtime.scss";

export function HeroPanelPlaytime() {
  const [lastTimePlayed, setLastTimePlayed] = useState("");

  const { game, isGameRunning } = useContext(gameDetailsContext);
  const { t } = useTranslation("game_details");
  const { numberFormatter } = useFormat();
  const { progress, lastPacket } = useDownload();
  const { formatDistance } = useDate();
  const extraction = useAppSelector((state) => state.download.extraction);

  const isExtracting = extraction?.visibleId === game?.id;

  useEffect(() => {
    if (game?.lastTimePlayed) {
      setLastTimePlayed(
        formatDistance(game.lastTimePlayed, new Date(), {
          addSuffix: true,
        })
      );
    }
  }, [game?.lastTimePlayed, formatDistance]);

  const formattedPlayTime = useMemo(() => {
    const milliseconds = game?.playTimeInMilliseconds || 0;
    const seconds = milliseconds / 1000;
    const minutes = seconds / 60;

    if (minutes < MAX_MINUTES_TO_SHOW_IN_PLAYTIME) {
      return t("amount_minutes", {
        amount: minutes.toFixed(0),
      });
    }

    const hours = minutes / 60;
    return t("amount_hours", { amount: numberFormatter.format(hours) });
  }, [game?.playTimeInMilliseconds, numberFormatter, t]);

  if (!game) return null;

  const displayStreak = getDisplayStreak(
    {
      currentStreak: game.currentStreak ?? 0,
      longestStreak: game.longestStreak ?? 0,
      lastStreakDate: game.lastStreakDate ?? null,
    },
    new Date()
  );
  const streakRecord = Math.max(game.longestStreak ?? 0, displayStreak);

  const streakChip = displayStreak >= 2 && (
    <div className="hero-panel-playtime__streak">
      <div className="hero-panel-playtime__streak-flame">
        <img
          src={flameIconAnimated}
          alt=""
          className="hero-panel-playtime__streak-flame-icon"
          draggable={false}
        />
        <span className="hero-panel-playtime__streak-flame-glow" />
      </div>
      <div className="hero-panel-playtime__streak-text">
        <span className="hero-panel-playtime__streak-days">
          {t("streak_days", { count: displayStreak })}
        </span>
        <span className="hero-panel-playtime__streak-record">
          {t("streak_record", { count: streakRecord })}
        </span>
      </div>
    </div>
  );

  const hasDownload =
    ["active", "paused"].includes(game.download?.status as string) &&
    game.download?.progress !== 1;

  const isGameDownloading =
    game.download?.status === "active" && lastPacket?.gameId === game.id;

  const extractionInProgressInfo = (
    <div className="hero-panel-playtime__download-details">
      <Link to="/downloads" className="hero-panel-playtime__downloads-link">
        {t("extracting")}
      </Link>

      <small>{formatDownloadProgress(extraction?.progress ?? 0)}</small>
    </div>
  );

  const downloadInProgressInfo = (
    <div className="hero-panel-playtime__download-details">
      <Link to="/downloads" className="hero-panel-playtime__downloads-link">
        {game.download?.status === "active"
          ? t("download_in_progress")
          : t("download_paused")}
      </Link>

      <small>
        {isGameDownloading
          ? progress
          : formatDownloadProgress(game.download?.progress)}
      </small>
    </div>
  );

  if (!game.lastTimePlayed) {
    return (
      <>
        <p>{t("not_played_yet", { title: game?.title })}</p>
        {isExtracting && extractionInProgressInfo}
        {!isExtracting && hasDownload && downloadInProgressInfo}
      </>
    );
  }

  if (isGameRunning) {
    return (
      <div className="hero-panel-playtime">
        <div className="hero-panel-playtime__info">
          <p className="hero-panel-playtime__playing-now">
            <span className="hero-panel-playtime__live-dot" />
            {t("playing_now")}
          </p>
          {isExtracting && extractionInProgressInfo}
          {!isExtracting && hasDownload && downloadInProgressInfo}
        </div>

        {streakChip}
      </div>
    );
  }

  return (
    <div className="hero-panel-playtime">
      <div className="hero-panel-playtime__info">
        <p
          className="hero-panel-playtime__play-time"
          data-tooltip-place="right"
          data-tooltip-content={
            game.hasManuallyUpdatedPlaytime
              ? t("manual_playtime_tooltip")
              : undefined
          }
          data-tooltip-id={
            game.hasManuallyUpdatedPlaytime
              ? "manual-playtime-warning"
              : undefined
          }
        >
          {game.hasManuallyUpdatedPlaytime && (
            <AlertFillIcon
              size={16}
              className="hero-panel-playtime__manual-warning"
            />
          )}
          {t("play_time", {
            amount: formattedPlayTime,
          })}
        </p>

        {isExtracting && extractionInProgressInfo}
        {!isExtracting && hasDownload && downloadInProgressInfo}
        {!isExtracting && !hasDownload && (
          <p>
            {t("last_time_played", {
              period: lastTimePlayed,
            })}
          </p>
        )}
      </div>

      {streakChip}

      {game.hasManuallyUpdatedPlaytime && (
        <Tooltip
          id="manual-playtime-warning"
          style={{
            zIndex: 9999,
          }}
          openOnClick={false}
        />
      )}
    </div>
  );
}
