import { buildGameDetailsPath } from "@renderer/helpers";
import { useAppSelector, useFormat, useLibrary } from "@renderer/hooks";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "./game-item.scss";
import { useTranslation } from "react-i18next";
import type { CatalogueSearchResult, GameStats } from "@types";
import {
  QuestionIcon,
  PlusIcon,
  CheckIcon,
  DownloadIcon,
  PeopleIcon,
} from "@primer/octicons-react";
import cn from "classnames";
import { StarRating } from "@renderer/components/star-rating/star-rating";
import { logger } from "@renderer/logger";

export interface GameItemProps {
  game: CatalogueSearchResult;
}

export function GameItem({ game }: GameItemProps) {
  const navigate = useNavigate();

  const { i18n, t } = useTranslation("game_details");
  const { t: tCatalogue } = useTranslation("catalogue");

  const language = i18n.language.split("-")[0];

  const { steamGenres } = useAppSelector((state) => state.catalogueSearch);

  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);
  const [added, setAdded] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);

  const { library, updateLibrary } = useLibrary();
  const { numberFormatter } = useFormat();

  useEffect(() => {
    const exists = library.some(
      (libItem) =>
        libItem.shop === game.shop && libItem.objectId === game.objectId
    );
    setAdded(exists);
  }, [library, game.shop, game.objectId]);

  const addGameToLibrary = async (
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    event.stopPropagation();
    if (added || isAddingToLibrary) return;

    setIsAddingToLibrary(true);

    try {
      await window.electron.addGameToLibrary(
        game.shop,
        game.objectId,
        game.title
      );
      updateLibrary();
    } catch (error) {
      logger.error("Failed to add game to library", error);
    } finally {
      setIsAddingToLibrary(false);
    }
  };

  const genres = useMemo(() => {
    return game.genres?.map((genre) => {
      const index = steamGenres["en"]?.findIndex(
        (steamGenre) => steamGenre === genre
      );

      if (
        index !== undefined &&
        steamGenres[language] &&
        steamGenres[language][index]
      ) {
        return steamGenres[language][index];
      }

      return genre;
    });
  }, [game.genres, language, steamGenres]);

  const isAvailable = game.downloadSources.length > 0;

  const handleHover = useCallback(() => {
    if (!stats) {
      window.electron.getGameStats(game.objectId, game.shop).then((result) => {
        setStats(result);
      });
    }
  }, [game.objectId, game.shop, stats]);

  const libraryImage = useMemo(() => {
    if (game.libraryImageUrl) {
      return (
        <img
          className="game-item__cover"
          src={game.libraryImageUrl}
          alt={game.title}
          loading="lazy"
        />
      );
    }

    return (
      <div className="game-item__cover-placeholder">
        <QuestionIcon size={28} />
      </div>
    );
  }, [game.libraryImageUrl, game.title]);

  return (
    <button
      type="button"
      className={cn("game-item", {
        "game-item--unavailable": !isAvailable,
      })}
      onClick={() => navigate(buildGameDetailsPath(game))}
      onMouseEnter={handleHover}
    >
      {libraryImage}

      <div className="game-item__details">
        <span>{game.title}</span>
        <span className="game-item__genres">{genres.join(", ")}</span>

        <span
          className={cn("game-item__availability", {
            "game-item__availability--available": isAvailable,
            "game-item__availability--unavailable": !isAvailable,
          })}
        >
          {isAvailable ? tCatalogue("available") : tCatalogue("not_available")}
        </span>
      </div>

      <div className="game-item__stats">
        <div className="game-item__stats-item">
          <DownloadIcon size={14} />
          <span>
            {stats ? numberFormatter.format(stats.downloadCount) : "…"}
          </span>
        </div>
        <div className="game-item__stats-item">
          <PeopleIcon size={14} />
          <span>{stats ? numberFormatter.format(stats.playerCount) : "…"}</span>
        </div>
        <div className="game-item__stats-item">
          <StarRating rating={stats?.averageScore || null} size={14} />
        </div>
      </div>

      <div
        className={cn("game-item__plus-wrapper", {
          "game-item__plus-wrapper--added": added,
        })}
        role="button"
        tabIndex={0}
        onClick={addGameToLibrary}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            addGameToLibrary(e);
          }
        }}
        title={added ? t("already_in_library") : t("add_to_library")}
      >
        {added ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
      </div>
    </button>
  );
}
