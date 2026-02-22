import { useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { TelescopeIcon } from "@primer/octicons-react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useFormat, useLibrary } from "@renderer/hooks";
import type { UserGame } from "@types";
import { UserLibraryGameCard } from "./user-library-game-card";
import { UserLibraryGameListItem } from "./user-library-game-list-item";
import "./profile-content.scss";

type SortOption = "playtime" | "achievementCount" | "playedRecently";
type ViewMode = "grid" | "list";

interface LibraryTabProps {
  sortBy: SortOption;
  pinnedGames: UserGame[];
  libraryGames: UserGame[];
  hasMoreLibraryGames: boolean;
  isLoadingLibraryGames: boolean;
  statsIndex: number;
  userStats: { libraryCount: number } | null;
  animatedGameIdsRef: React.MutableRefObject<Set<string>>;
  onLoadMore: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isMe: boolean;
  searchQuery: string;
  viewMode: ViewMode;
}

function fuzzyFilter(games: UserGame[], query: string): UserGame[] {
  if (!query.trim()) return games;

  const queryLower = query.toLowerCase();
  return games.filter((game) => {
    const titleLower = game.title.toLowerCase();
    let queryIndex = 0;

    for (
      let i = 0;
      i < titleLower.length && queryIndex < queryLower.length;
      i++
    ) {
      if (titleLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }

    return queryIndex === queryLower.length;
  });
}

export function LibraryTab({
  sortBy,
  pinnedGames,
  libraryGames,
  hasMoreLibraryGames,
  isLoadingLibraryGames,
  statsIndex,
  userStats,
  animatedGameIdsRef,
  onLoadMore,
  onMouseEnter,
  onMouseLeave,
  isMe,
  searchQuery,
  viewMode,
}: Readonly<LibraryTabProps>) {
  const { t } = useTranslation("user_profile");
  const { numberFormatter } = useFormat();
  const { library } = useLibrary();

  const downloadedObjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const game of library) {
      if (game.executablePath) {
        ids.add(game.objectId);
      }
    }
    return ids;
  }, [library]);

  const filteredPinnedGames = useMemo(
    () => fuzzyFilter(pinnedGames, searchQuery),
    [pinnedGames, searchQuery]
  );

  const filteredLibraryGames = useMemo(
    () => fuzzyFilter(libraryGames, searchQuery),
    [libraryGames, searchQuery]
  );

  const hasGames = libraryGames.length > 0;
  const hasPinnedGames = pinnedGames.length > 0;
  const hasAnyGames = hasGames || hasPinnedGames;

  const hasFilteredPinned = filteredPinnedGames.length > 0;
  const hasFilteredLibrary = filteredLibraryGames.length > 0;

  return (
    <motion.div
      key="library"
      className="profile-content__tab-panel"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      aria-hidden={false}
    >
      {!hasAnyGames && (
        <div className="profile-content__no-games">
          <div className="profile-content__telescope-icon">
            <TelescopeIcon size={24} />
          </div>
          <h2>{t("no_recent_activity_title")}</h2>
          {isMe && <p>{t("no_recent_activity_description")}</p>}
        </div>
      )}

      {hasAnyGames && (
        <div>
          {hasFilteredPinned && (
            <div style={{ marginBottom: "2rem" }}>
              <div className="profile-content__section-header">
                <div className="profile-content__section-title-group">
                  <h2>{t("pinned")}</h2>
                  <span className="profile-content__section-badge">
                    {filteredPinnedGames.length}
                  </span>
                </div>
              </div>

              {viewMode === "grid" ? (
                <ul className="profile-content__games-grid">
                  {filteredPinnedGames.map((game) => (
                    <li key={game.objectId} style={{ listStyle: "none" }}>
                      <UserLibraryGameCard
                        game={game}
                        statIndex={statsIndex}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        sortBy={sortBy}
                        isDownloaded={downloadedObjectIds.has(game.objectId)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div>
                  {filteredPinnedGames.map((game) => (
                    <UserLibraryGameListItem
                      key={game.objectId}
                      game={game}
                      isMe={isMe}
                      sortBy={sortBy}
                      isDownloaded={downloadedObjectIds.has(game.objectId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {hasFilteredLibrary && (
            <div>
              <div className="profile-content__section-header">
                <div className="profile-content__section-title-group">
                  <h2>{t("library")}</h2>
                  {userStats && (
                    <span className="profile-content__section-badge">
                      {numberFormatter.format(userStats.libraryCount)}
                    </span>
                  )}
                </div>
              </div>

              <InfiniteScroll
                dataLength={libraryGames.length}
                next={onLoadMore}
                hasMore={hasMoreLibraryGames}
                loader={null}
                scrollThreshold={0.9}
                style={{ overflow: "visible" }}
                scrollableTarget="scrollableDiv"
              >
                {viewMode === "grid" ? (
                  <ul className="profile-content__games-grid">
                    {filteredLibraryGames.map((game, index) => {
                      const hasAnimated = animatedGameIdsRef.current.has(
                        game.objectId
                      );
                      const isNewGame = !hasAnimated && !isLoadingLibraryGames;

                      return (
                        <motion.li
                          key={`${sortBy}-${game.objectId}`}
                          style={{ listStyle: "none" }}
                          initial={
                            isNewGame
                              ? { opacity: 0.5, y: 15, scale: 0.96 }
                              : false
                          }
                          animate={
                            isNewGame ? { opacity: 1, y: 0, scale: 1 } : false
                          }
                          transition={
                            isNewGame
                              ? {
                                  duration: 0.15,
                                  ease: "easeOut",
                                  delay: index * 0.01,
                                }
                              : undefined
                          }
                          onAnimationComplete={() => {
                            if (isNewGame) {
                              animatedGameIdsRef.current.add(game.objectId);
                            }
                          }}
                        >
                          <UserLibraryGameCard
                            game={game}
                            statIndex={statsIndex}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                            sortBy={sortBy}
                            isDownloaded={downloadedObjectIds.has(
                              game.objectId
                            )}
                          />
                        </motion.li>
                      );
                    })}
                  </ul>
                ) : (
                  <div>
                    {filteredLibraryGames.map((game) => (
                      <UserLibraryGameListItem
                        key={game.objectId}
                        game={game}
                        isMe={isMe}
                        sortBy={sortBy}
                        isDownloaded={downloadedObjectIds.has(game.objectId)}
                      />
                    ))}
                  </div>
                )}
              </InfiniteScroll>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
