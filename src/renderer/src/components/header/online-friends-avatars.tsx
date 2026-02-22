import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@renderer/components";
import { useUserDetails } from "@renderer/hooks";
import { FriendHoverCard } from "./friend-hover-card";
import type { UserFriend, UserFriends } from "@types";

import "./online-friends-avatars.scss";

const MAX_VISIBLE_AVATARS = 3;
const POLL_INTERVAL_MS = 60_000;

export function OnlineFriendsAvatars() {
  const { userDetails } = useUserDetails();
  const navigate = useNavigate();
  const [playingFriends, setPlayingFriends] = useState<UserFriend[]>([]);
  const [hoveredFriend, setHoveredFriend] = useState<UserFriend | null>(null);
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFriends = useCallback(() => {
    if (!userDetails) return;

    window.electron.hydraApi
      .get<UserFriends>("/profile/friends", {
        params: { take: 12, skip: 0 },
      })
      .then((data) => {
        const playing = data.friends.filter((f) => f.currentGame !== null);
        setPlayingFriends(playing);
      })
      .catch(() => {});
  }, [userDetails]);

  useEffect(() => {
    fetchFriends();

    const interval = setInterval(fetchFriends, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchFriends]);

  const handleMouseEnter = (
    friend: UserFriend,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setCardPosition({
      x: rect.left,
      y: rect.bottom + 8,
    });
    setHoveredFriend(friend);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredFriend(null);
    }, 200);
  };

  const handleCardMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handleCardMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredFriend(null);
    }, 150);
  };

  if (!userDetails || playingFriends.length === 0) {
    return null;
  }

  const visibleFriends = playingFriends.slice(0, MAX_VISIBLE_AVATARS);
  const extraCount = playingFriends.length - MAX_VISIBLE_AVATARS;

  return (
    <div className="online-friends-avatars">
      <div className="online-friends-avatars__stack">
        {visibleFriends.map((friend) => (
          <button
            type="button"
            key={friend.id}
            className="online-friends-avatars__avatar-wrapper"
            onMouseEnter={(e) => handleMouseEnter(friend, e)}
            onMouseLeave={handleMouseLeave}
            onClick={() => navigate(`/profile/${friend.id}`)}
          >
            <Avatar
              size={28}
              src={friend.profileImageUrl}
              alt={friend.displayName}
            />
            <span className="online-friends-avatars__indicator" />
          </button>
        ))}
      </div>

      {extraCount > 0 && (
        <span className="online-friends-avatars__badge">+{extraCount}</span>
      )}

      {hoveredFriend && (
        <FriendHoverCard
          friend={hoveredFriend}
          position={cardPosition}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
        />
      )}
    </div>
  );
}
