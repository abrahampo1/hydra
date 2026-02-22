import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Avatar } from "@renderer/components";
import { buildGameDetailsPath } from "@renderer/helpers";
import type { UserFriend } from "@types";

import "./friend-hover-card.scss";

export interface FriendHoverCardProps {
  friend: UserFriend;
  position: { x: number; y: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function FriendHoverCard({
  friend,
  position,
  onMouseEnter,
  onMouseLeave,
}: FriendHoverCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("header");

  const formatSessionDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return t("playing_for_time", { hours, minutes });
    }
    return t("playing_for_minutes", { minutes: Math.max(1, minutes) });
  };

  const cardContent = (
    <div
      className="friend-hover-card"
      style={{ top: position.y, left: position.x }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        className="friend-hover-card__header"
        onClick={() => navigate(`/profile/${friend.id}`)}
      >
        <Avatar
          size={40}
          src={friend.profileImageUrl}
          alt={friend.displayName}
        />
        <span className="friend-hover-card__name">{friend.displayName}</span>
      </button>

      {friend.currentGame && (
        <button
          type="button"
          className="friend-hover-card__game"
          onClick={() => navigate(buildGameDetailsPath(friend.currentGame!))}
        >
          {friend.currentGame.iconUrl && (
            <img
              className="friend-hover-card__game-icon"
              src={friend.currentGame.iconUrl}
              alt={friend.currentGame.title}
            />
          )}
          <div className="friend-hover-card__game-info">
            <span className="friend-hover-card__game-title">
              {friend.currentGame.title}
            </span>
            <span className="friend-hover-card__game-duration">
              {formatSessionDuration(
                friend.currentGame.sessionDurationInSeconds
              )}
            </span>
          </div>
        </button>
      )}
    </div>
  );

  return createPortal(cardContent, document.body);
}
