import { useCallback, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFormat, useToast } from "@renderer/hooks";
import {
  ClockIcon,
  TrophyIcon,
  PinIcon,
  PinSlashIcon,
  ImageIcon,
  DownloadIcon,
} from "@primer/octicons-react";
import { MAX_MINUTES_TO_SHOW_IN_PLAYTIME } from "@renderer/constants";
import {
  buildGameAchievementPath,
  buildGameDetailsPath,
} from "@renderer/helpers";
import { userProfileContext } from "@renderer/context";
import type { UserGame } from "@types";
import "./user-library-game-list-item.scss";

interface UserLibraryGameListItemProps {
  game: UserGame;
  isMe: boolean;
  sortBy?: string;
  isDownloaded?: boolean;
}

export function UserLibraryGameListItem({
  game,
  isMe,
  sortBy,
  isDownloaded,
}: Readonly<UserLibraryGameListItemProps>) {
  const { userProfile, getUserLibraryGames } = useContext(userProfileContext);
  const { t } = useTranslation("user_profile");
  const { numberFormatter } = useFormat();
  const { showSuccessToast } = useToast();
  const navigate = useNavigate();
  const [isPinning, setIsPinning] = useState(false);

  const formatPlayTime = useCallback(
    (playTimeInSeconds = 0) => {
      const minutes = playTimeInSeconds / 60;

      if (minutes < MAX_MINUTES_TO_SHOW_IN_PLAYTIME) {
        return t("amount_minutes", { amount: minutes.toFixed(0) });
      }

      const hours = minutes / 60;
      return t("amount_hours", { amount: numberFormatter.format(hours) });
    },
    [numberFormatter, t]
  );

  const buildPath = useCallback(() => {
    if (userProfile?.hasActiveSubscription && game.achievementCount > 0) {
      return buildGameAchievementPath({ ...game }, { userId: userProfile.id });
    }
    return buildGameDetailsPath({ ...game, objectId: game.objectId });
  }, [userProfile, game]);

  const toggleGamePinned = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinning(true);

    try {
      await window.electron.toggleGamePin(
        game.shop,
        game.objectId,
        !game.isPinned
      );
      await getUserLibraryGames(sortBy);

      if (game.isPinned) {
        showSuccessToast(t("game_removed_from_pinned"));
      } else {
        showSuccessToast(t("game_added_to_pinned"));
      }
    } finally {
      setIsPinning(false);
    }
  };

  const notPlayed = !game.playTimeInSeconds || game.playTimeInSeconds === 0;

  return (
    <div
      className="user-library-game-list-item"
      onClick={() => navigate(buildPath())}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(buildPath());
      }}
    >
      {game.iconUrl ? (
        <img
          className="user-library-game-list-item__icon"
          src={game.iconUrl}
          alt={game.title}
        />
      ) : (
        <div className="user-library-game-list-item__icon-placeholder">
          <ImageIcon size={18} />
        </div>
      )}

      <span className="user-library-game-list-item__title">{game.title}</span>

      {isDownloaded && (
        <div className="user-library-game-list-item__downloaded">
          <DownloadIcon size={12} />
          <span>{t("downloaded")}</span>
        </div>
      )}

      <div className="user-library-game-list-item__playtime">
        {notPlayed ? (
          <span className="user-library-game-list-item__not-played">
            {t("not_played_yet")}
          </span>
        ) : (
          <>
            <ClockIcon size={12} />
            <span>{formatPlayTime(game.playTimeInSeconds)}</span>
          </>
        )}
      </div>

      {userProfile?.hasActiveSubscription && game.achievementCount > 0 && (
        <div className="user-library-game-list-item__achievements">
          <TrophyIcon size={12} />
          <span>
            {game.unlockedAchievementCount} / {game.achievementCount}
          </span>
        </div>
      )}

      {isMe && (
        <button
          type="button"
          className="user-library-game-list-item__pin-button"
          onClick={toggleGamePinned}
          disabled={isPinning}
        >
          {game.isPinned ? <PinSlashIcon size={14} /> : <PinIcon size={14} />}
        </button>
      )}
    </div>
  );
}
