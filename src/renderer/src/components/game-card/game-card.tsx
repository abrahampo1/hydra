import { DownloadIcon, PeopleIcon } from "@primer/octicons-react";
import type { GameStats, ShopAssets } from "@types";

import SteamLogo from "@renderer/assets/steam-logo.svg?react";

import "./game-card.scss";

import { useTranslation } from "react-i18next";
import { StarRating } from "../star-rating/star-rating";
import { useCallback, useState } from "react";
import { useFormat } from "@renderer/hooks";
import cn from "classnames";

export interface GameCardProps
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  game: ShopAssets;
}

const shopIcon = {
  steam: <SteamLogo className="game-card__shop-icon" />,
};

export function GameCard({ game, ...props }: GameCardProps) {
  const { t } = useTranslation("catalogue");

  const [stats, setStats] = useState<GameStats | null>(null);

  const handleHover = useCallback(() => {
    if (!stats) {
      window.electron.getGameStats(game.objectId, game.shop).then((stats) => {
        setStats(stats);
      });
    }
  }, [game, stats]);

  const { numberFormatter } = useFormat();

  const isAvailable = game.downloadSources.length > 0;

  return (
    <button
      {...props}
      type="button"
      className={cn("game-card", {
        "game-card--unavailable": !isAvailable,
      })}
      onMouseEnter={handleHover}
    >
      <div className="game-card__backdrop">
        <img
          src={game.libraryImageUrl ?? undefined}
          alt={game.title}
          className="game-card__cover"
          loading="lazy"
        />

        <div className="game-card__content">
          <div className="game-card__title-container">
            {shopIcon[game.shop]}
            <p className="game-card__title">{game.title}</p>
          </div>

          <span
            className={cn("game-card__availability", {
              "game-card__availability--available": isAvailable,
              "game-card__availability--unavailable": !isAvailable,
            })}
          >
            {isAvailable ? t("available") : t("not_available")}
          </span>

          <div className="game-card__specifics">
            <div className="game-card__specifics-item">
              <DownloadIcon />
              <span>
                {stats ? numberFormatter.format(stats.downloadCount) : "…"}
              </span>
            </div>
            <div className="game-card__specifics-item">
              <PeopleIcon />
              <span>
                {stats ? numberFormatter.format(stats.playerCount) : "…"}
              </span>
            </div>
            <div className="game-card__specifics-item">
              <StarRating rating={stats?.averageScore || null} size={14} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
