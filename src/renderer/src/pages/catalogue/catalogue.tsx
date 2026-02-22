import type {
  CatalogueSearchResult,
  CatalogueSearchPayload,
  DownloadSource,
} from "@types";

import { useAppDispatch, useAppSelector, useFormat } from "@renderer/hooks";
import { useEffect, useMemo, useRef, useState } from "react";

import "./catalogue.scss";

import { FilterSection } from "./filter-section";
import {
  setFilters,
  setPage,
  setViewMode,
  toggleFilterSidebar,
  clearFilters,
} from "@renderer/features";
import { useTranslation } from "react-i18next";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { Pagination } from "./pagination";
import { useCatalogue } from "@renderer/hooks/use-catalogue";
import { GameItem } from "./game-item";
import { FilterItem } from "./filter-item";
import { debounce } from "lodash-es";
import {
  ListUnorderedIcon,
  TableIcon,
  SidebarCollapseIcon,
  SidebarExpandIcon,
  SearchIcon,
} from "@primer/octicons-react";
import { GameCard, Button } from "@renderer/components";
import { useNavigate } from "react-router-dom";
import { buildGameDetailsPath } from "@renderer/helpers";
import cn from "classnames";

const filterCategoryColors = {
  genres: "hsl(262deg 50% 47%)",
  tags: "hsl(95deg 50% 20%)",
  downloadSourceFingerprints: "hsl(27deg 50% 40%)",
  developers: "hsl(340deg 50% 46%)",
  publishers: "hsl(200deg 50% 30%)",
};

const PAGE_SIZE = 20;

const POPULAR_GENRES = [
  "Action",
  "Adventure",
  "RPG",
  "Strategy",
  "Simulation",
  "Sports",
  "Racing",
  "Indie",
];

export default function Catalogue() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const cataloguePageRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  const { steamDevelopers, steamPublishers, downloadSources } = useCatalogue();

  const {
    steamGenres,
    steamUserTags,
    filters,
    page,
    viewMode,
    filterSidebarCollapsed,
  } = useAppSelector((state) => state.catalogueSearch);

  const [isLoading, setIsLoading] = useState(true);

  const [results, setResults] = useState<CatalogueSearchResult[]>([]);

  const [itemsCount, setItemsCount] = useState(0);

  const { formatNumber } = useFormat();

  const dispatch = useAppDispatch();

  const { t, i18n } = useTranslation("catalogue");

  const debouncedSearch = useRef(
    debounce(
      async (
        filters: CatalogueSearchPayload,
        downloadSources: DownloadSource[],
        pageSize: number,
        offset: number
      ) => {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const requestData = {
          ...filters,
          take: pageSize,
          skip: offset,
          downloadSourceIds: downloadSources.map(
            (downloadSource) => downloadSource.id
          ),
        };

        const response = await window.electron.hydraApi.post<{
          edges: CatalogueSearchResult[];
          count: number;
        }>("/catalogue/search", {
          data: requestData,
          needsAuth: false,
        });

        if (abortController.signal.aborted) return;

        setResults(response.edges);
        setItemsCount(response.count);
        setIsLoading(false);
      },
      500
    )
  ).current;

  const decodeHTML = (s: string) =>
    s.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">");

  useEffect(() => {
    setResults([]);
    setIsLoading(true);
    abortControllerRef.current?.abort();

    debouncedSearch(
      filters,
      downloadSources,
      PAGE_SIZE,
      (page - 1) * PAGE_SIZE
    );

    return () => {
      debouncedSearch.cancel();
    };
  }, [filters, downloadSources, page, debouncedSearch]);

  const language = i18n.language.split("-")[0];

  const steamGenresMapping = useMemo<Record<string, string>>(() => {
    if (!steamGenres[language]) return {};

    return steamGenres[language].reduce((prev, genre, index) => {
      prev[genre] = steamGenres["en"][index];
      return prev;
    }, {});
  }, [steamGenres, language]);

  const steamGenresFilterItems = useMemo(() => {
    return Object.entries(steamGenresMapping)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => ({
        label: key,
        value: value,
        checked: filters.genres.includes(value),
      }));
  }, [steamGenresMapping, filters.genres]);

  const steamUserTagsFilterItems = useMemo(() => {
    if (!steamUserTags[language]) return [];

    return Object.entries(steamUserTags[language])
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => ({
        label: key,
        value: value,
        checked: filters.tags.includes(value),
      }));
  }, [steamUserTags, filters.tags, language]);

  const groupedFilters = useMemo(() => {
    return [
      ...filters.genres.map((genre) => ({
        label: Object.keys(steamGenresMapping).find(
          (key) => steamGenresMapping[key] === genre
        ) as string,
        orbColor: filterCategoryColors.genres,
        key: "genres",
        value: genre,
      })),

      ...filters.tags.map((tag) => ({
        label: Object.keys(steamUserTags[language]).find(
          (key) => steamUserTags[language][key] === tag
        ),
        orbColor: filterCategoryColors.tags,
        key: "tags",
        value: tag,
      })),

      ...filters.downloadSourceFingerprints.map((fingerprint) => ({
        label: downloadSources.find(
          (source) => source.fingerprint === fingerprint
        )?.name as string,
        orbColor: filterCategoryColors.downloadSourceFingerprints,
        key: "downloadSourceFingerprints",
        value: fingerprint,
      })),

      ...filters.developers.map((developer) => ({
        label: developer,
        orbColor: filterCategoryColors.developers,
        key: "developers",
        value: developer,
      })),

      ...filters.publishers.map((publisher) => ({
        label: decodeHTML(publisher),
        orbColor: filterCategoryColors.publishers,
        key: "publishers",
        value: publisher,
      })),
    ];
  }, [filters, steamUserTags, downloadSources, steamGenresMapping, language]);

  const filterSections = useMemo(() => {
    return [
      {
        title: t("genres"),
        items: steamGenresFilterItems,
        key: "genres",
      },
      {
        title: t("tags"),
        items: steamUserTagsFilterItems,
        key: "tags",
      },
      {
        title: t("download_sources"),
        items: downloadSources
          .filter((source) => source.fingerprint)
          .map((source) => ({
            label: source.name,
            value: source.fingerprint!,
            checked: filters.downloadSourceFingerprints.includes(
              source.fingerprint!
            ),
          })),
        key: "downloadSourceFingerprints",
      },
      {
        title: t("developers"),
        items: steamDevelopers.map((developer) => ({
          label: developer,
          value: developer,
          checked: filters.developers.includes(developer),
        })),
        key: "developers",
      },
      {
        title: t("publishers"),
        items: steamPublishers.map((publisher) => ({
          label: decodeHTML(publisher),
          value: publisher,
          checked: filters.publishers.includes(publisher),
        })),
        key: "publishers",
      },
    ];
  }, [
    downloadSources,
    filters.developers,
    filters.downloadSourceFingerprints,
    filters.publishers,
    steamDevelopers,
    steamGenresFilterItems,
    steamPublishers,
    steamUserTagsFilterItems,
    t,
  ]);

  const toggleGenreChip = (genreEnglish: string) => {
    if (filters.genres.includes(genreEnglish)) {
      dispatch(
        setFilters({
          genres: filters.genres.filter((g) => g !== genreEnglish),
        })
      );
    } else {
      dispatch(
        setFilters({
          genres: [...filters.genres, genreEnglish],
        })
      );
    }
  };

  const getGenreLocalizedName = (englishGenre: string) => {
    const localizedName = Object.keys(steamGenresMapping).find(
      (key) => steamGenresMapping[key] === englishGenre
    );
    return localizedName || englishGenre;
  };

  return (
    <div className="catalogue" ref={cataloguePageRef}>
      <div className="catalogue__header">
        <div className="catalogue__filters-wrapper">
          <ul className="catalogue__filters-list">
            {groupedFilters.map((filter) => (
              <li key={`${filter.key}-${filter.value}`}>
                <FilterItem
                  filter={filter.label ?? ""}
                  orbColor={filter.orbColor}
                  onRemove={() => {
                    dispatch(
                      setFilters({
                        [filter.key]: filters[filter.key].filter(
                          (item) => item !== filter.value
                        ),
                      })
                    );
                  }}
                />
              </li>
            ))}
          </ul>

          {groupedFilters.length > 0 && (
            <Button
              className="catalogue__clear-all-button"
              onClick={() => dispatch(clearFilters())}
            >
              {t("clear_all_filters")}
            </Button>
          )}
        </div>
      </div>

      <div className="catalogue__toolbar">
        <div className="catalogue__view-toggle">
          <button
            type="button"
            className={cn("catalogue__view-toggle-button", {
              "catalogue__view-toggle-button--active": viewMode === "list",
            })}
            onClick={() => dispatch(setViewMode("list"))}
            title={t("list_view")}
          >
            <ListUnorderedIcon size={16} />
          </button>
          <button
            type="button"
            className={cn("catalogue__view-toggle-button", {
              "catalogue__view-toggle-button--active": viewMode === "grid",
            })}
            onClick={() => dispatch(setViewMode("grid"))}
            title={t("grid_view")}
          >
            <TableIcon size={16} />
          </button>
        </div>

        <button
          type="button"
          className="catalogue__filter-toggle"
          onClick={() => dispatch(toggleFilterSidebar())}
          title={filterSidebarCollapsed ? t("show_filters") : t("hide_filters")}
        >
          {filterSidebarCollapsed ? (
            <SidebarExpandIcon size={16} />
          ) : (
            <SidebarCollapseIcon size={16} />
          )}
        </button>
      </div>

      <div className="catalogue__genre-chips">
        {POPULAR_GENRES.map((genre) => (
          <button
            key={genre}
            type="button"
            className={cn("catalogue__genre-chip", {
              "catalogue__genre-chip--active": filters.genres.includes(genre),
            })}
            onClick={() => toggleGenreChip(genre)}
          >
            {getGenreLocalizedName(genre)}
          </button>
        ))}
      </div>

      <div className="catalogue__content">
        <div
          className={cn("catalogue__games-container", {
            "catalogue__games-container--grid": viewMode === "grid",
            "catalogue__games-container--with-sidebar":
              viewMode === "grid" && !filterSidebarCollapsed,
          })}
        >
          {isLoading ? (
            <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={cn("catalogue__skeleton", {
                    "catalogue__skeleton--grid": viewMode === "grid",
                  })}
                />
              ))}
            </SkeletonTheme>
          ) : results.length === 0 ? (
            <div className="catalogue__empty-state">
              <SearchIcon size={48} />
              <h3>{t("no_results_title")}</h3>
              <p>{t("no_results_description")}</p>
              <Button onClick={() => dispatch(clearFilters())}>
                {t("clear_all_filters")}
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            results.map((game) => (
              <GameCard
                key={game.id}
                game={{
                  objectId: game.objectId,
                  shop: game.shop,
                  title: game.title,
                  iconUrl: null,
                  libraryHeroImageUrl: null,
                  libraryImageUrl: game.libraryImageUrl,
                  logoImageUrl: null,
                  logoPosition: null,
                  coverImageUrl: null,
                  downloadSources: game.downloadSources,
                }}
                onClick={() => navigate(buildGameDetailsPath(game))}
              />
            ))
          ) : (
            results.map((game) => <GameItem key={game.id} game={game} />)
          )}

          {results.length > 0 && (
            <div className="catalogue__pagination-container">
              <span className="catalogue__result-count">
                {t("result_count", {
                  resultCount: formatNumber(itemsCount),
                })}
              </span>

              <Pagination
                page={page}
                totalPages={Math.ceil(itemsCount / PAGE_SIZE)}
                onPageChange={(page) => {
                  dispatch(setPage(page));
                  if (cataloguePageRef.current) {
                    cataloguePageRef.current.scrollTop = 0;
                  }
                }}
              />
            </div>
          )}
        </div>

        {!filterSidebarCollapsed && (
          <div className="catalogue__filters-container">
            <div className="catalogue__filters-sections">
              {filterSections.map((section) => (
                <FilterSection
                  key={section.key}
                  title={section.title}
                  onClear={() => dispatch(setFilters({ [section.key]: [] }))}
                  color={filterCategoryColors[section.key]}
                  onSelect={(value) => {
                    if (filters[section.key].includes(value)) {
                      dispatch(
                        setFilters({
                          [section.key]: filters[
                            section.key as
                              | "genres"
                              | "tags"
                              | "downloadSourceFingerprints"
                              | "developers"
                              | "publishers"
                          ].filter((item) => item !== value),
                        })
                      );
                    } else {
                      dispatch(
                        setFilters({
                          [section.key]: [...filters[section.key], value],
                        })
                      );
                    }
                  }}
                  items={section.items}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
