import { useTranslation } from "react-i18next";
import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  OrganizationIcon,
  QuestionIcon,
  TagIcon,
} from "@primer/octicons-react";

import type { CatalogueSearchResult, SteamGenre } from "@types";
import { gameDetailsContext } from "@renderer/context";
import { buildGameDetailsPath } from "@renderer/helpers";
import "./description-header.scss";

export function DescriptionHeader() {
  const { shopDetails, objectId } = useContext(gameDetailsContext);
  const { t } = useTranslation("game_details");
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [publisherGames, setPublisherGames] = useState<CatalogueSearchResult[]>(
    []
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const publisher =
    Array.isArray(shopDetails?.publishers) && shopDetails.publishers.length > 0
      ? shopDetails.publishers[0]
      : null;

  useEffect(() => {
    if (!publisher) {
      setPublisherGames([]);
      return;
    }

    window.electron.hydraApi
      .post<{
        edges: CatalogueSearchResult[];
        count: number;
      }>("/catalogue/search", {
        data: {
          title: "",
          downloadSourceFingerprints: [],
          tags: [],
          publishers: [publisher],
          genres: [],
          developers: [],
          take: 12,
          skip: 0,
        },
        needsAuth: false,
      })
      .then((response) => {
        const filtered = response.edges.filter(
          (game) => game.objectId !== objectId
        );
        setPublisherGames(filtered.slice(0, 10));
      })
      .catch(() => {
        setPublisherGames([]);
      });
  }, [publisher, objectId]);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateScrollButtons();
  }, [publisherGames]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!shopDetails) return null;

  return (
    <div className="description-header">
      <section className="description-header__info">
        <div className="description-header__meta-items">
          <span className="description-header__meta-item">
            <CalendarIcon size={14} />
            {t("release_date", {
              date: shopDetails?.release_date.date,
            })}
          </span>

          {publisher && (
            <span className="description-header__meta-item">
              <OrganizationIcon size={14} />
              {t("publisher", { publisher })}
            </span>
          )}
        </div>

        {shopDetails?.genres && shopDetails.genres.length > 0 && (
          <div className="description-header__genres">
            <TagIcon size={14} className="description-header__genre-icon" />
            {shopDetails.genres.map((genre: SteamGenre) => (
              <span key={genre.id} className="description-header__genre-badge">
                {genre.description}
              </span>
            ))}
          </div>
        )}
      </section>

      {publisherGames.length > 0 && (
        <div className="description-header__publisher-games">
          <h3 className="description-header__publisher-games-title">
            {t("publisher_games", { publisher })}
          </h3>

          <div className="description-header__carousel-wrapper">
            {canScrollLeft && (
              <button
                type="button"
                className="description-header__scroll-button description-header__scroll-button--left"
                onClick={() => scroll("left")}
              >
                <ChevronLeftIcon size={16} />
              </button>
            )}

            <div
              ref={scrollRef}
              className="description-header__carousel"
              onScroll={updateScrollButtons}
            >
              {publisherGames.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  className="description-header__game-card"
                  onClick={() => navigate(buildGameDetailsPath(game))}
                >
                  {game.objectId ? (
                    <img
                      className="description-header__game-cover"
                      src={`https://shared.steamstatic.com/store_item_assets/steam/apps/${game.objectId}/hero_capsule.jpg`}
                      alt={game.title}
                      loading="lazy"
                      onError={(e) => {
                        if (game.libraryImageUrl) {
                          (e.target as HTMLImageElement).src =
                            game.libraryImageUrl;
                        }
                      }}
                    />
                  ) : (
                    <div className="description-header__game-cover-placeholder">
                      <QuestionIcon size={24} />
                    </div>
                  )}
                  <span className="description-header__game-title">
                    {game.title}
                  </span>
                </button>
              ))}
            </div>

            {canScrollRight && (
              <button
                type="button"
                className="description-header__scroll-button description-header__scroll-button--right"
                onClick={() => scroll("right")}
              >
                <ChevronRightIcon size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
