import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDownload, useAppSelector, useDate } from "@renderer/hooks";
import { Downloader } from "@shared";
import { getSteamLanguage } from "@renderer/helpers";
import type {
  GameShop,
  GameRepack,
  LibraryGame,
  ShopDetailsWithAssets,
  StartGameDownloadPayload,
} from "@types";
import { useBigPictureContext } from "./big-picture-app";
import { BpMediaSlider } from "./bp-media-slider";
import { BpReviewsSection } from "./bp-reviews-section";
import { BpRepacksView } from "./bp-repacks-view";
import { BpDownloadSettingsView } from "./bp-download-settings-view";
import "./big-picture-game-detail.scss";

type DetailView = "main" | "repacks" | "download-settings";

export default function BigPictureGameDetail() {
  const { shop, objectId } = useParams<{ shop: string; objectId: string }>();
  const { t, i18n } = useTranslation("big_picture");
  const navigate = useNavigate();
  const { formatDate } = useDate();
  const {
    registerBackHandler,
    unregisterBackHandler,
    registerSectionHandler,
    unregisterSectionHandler,
  } = useBigPictureContext();

  const gameRunning = useAppSelector((state) => state.gameRunning.gameRunning);
  const {
    lastPacket,
    progress,
    pauseDownload,
    resumeDownload,
    startDownload: startGameDownload,
    addGameToQueue,
  } = useDownload();

  const [game, setGame] = useState<LibraryGame | null>(null);
  const [shopDetails, setShopDetails] = useState<ShopDetailsWithAssets | null>(
    null
  );
  const [repacks, setRepacks] = useState<GameRepack[]>([]);
  const [viewState, setViewState] = useState<DetailView>("main");
  const [selectedRepack, setSelectedRepack] = useState<GameRepack | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState<number | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Data fetching
  useEffect(() => {
    if (!shop || !objectId) return;

    setIsLoadingDetails(true);

    window.electron.getGameByObjectId(shop as GameShop, objectId).then(setGame);

    window.electron
      .getGameShopDetails(
        objectId,
        shop as GameShop,
        getSteamLanguage(i18n.language)
      )
      .then((details) => {
        if (details) setShopDetails(details);
      })
      .finally(() => setIsLoadingDetails(false));

    window.electron.getGameRepacks(shop as GameShop, objectId).then(setRepacks);
  }, [shop, objectId, i18n.language]);

  // Back handler: navigate the view stack
  useEffect(() => {
    const handler = (): boolean => {
      if (mediaViewerIndex !== null) {
        setMediaViewerIndex(null);
        return true;
      }
      if (viewState === "download-settings") {
        setViewState("repacks");
        return true;
      }
      if (viewState === "repacks") {
        setViewState("main");
        return true;
      }
      return false;
    };

    registerBackHandler(handler);
    return () => unregisterBackHandler();
  }, [viewState, mediaViewerIndex, registerBackHandler, unregisterBackHandler]);

  // Section handler: LB/RB scroll between sections
  useEffect(() => {
    const sectionHandler = (direction: "prev" | "next"): boolean => {
      if (viewState !== "main") return true;

      const refs = sectionRefs.current.filter(Boolean);
      if (refs.length === 0) return false;

      const container = scrollContainerRef.current?.closest(
        ".big-picture__content"
      ) as HTMLElement | null;
      if (!container) return true;

      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const midPoint = scrollTop + containerHeight / 2;

      let currentIndex = 0;
      for (let i = 0; i < refs.length; i++) {
        const el = refs[i]!;
        if (el.offsetTop <= midPoint) {
          currentIndex = i;
        }
      }

      const nextIndex =
        direction === "next"
          ? Math.min(currentIndex + 1, refs.length - 1)
          : Math.max(currentIndex - 1, 0);

      refs[nextIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    registerSectionHandler(sectionHandler);
    return () => unregisterSectionHandler();
  }, [viewState, registerSectionHandler, unregisterSectionHandler]);

  const isRunning = game ? gameRunning?.id === game.id : false;
  const isDownloading = game ? lastPacket?.gameId === game.id : false;
  const isPaused = game?.download?.status === "paused";
  const isInstalled = Boolean(game?.executablePath);
  const canDownload =
    repacks.length > 0 && !isInstalled && !isDownloading && !isPaused;

  const handlePlay = useCallback(() => {
    if (!game?.executablePath) return;
    window.electron.openGame(
      game.shop,
      game.objectId,
      game.executablePath,
      game.launchOptions
    );
  }, [game]);

  const handleCloseGame = useCallback(() => {
    if (!game) return;
    window.electron.closeGame(game.shop, game.objectId);
  }, [game]);

  const handlePause = useCallback(() => {
    if (!game) return;
    pauseDownload(game.shop, game.objectId);
  }, [game, pauseDownload]);

  const handleResume = useCallback(() => {
    if (!game) return;
    resumeDownload(game.shop, game.objectId);
  }, [game, resumeDownload]);

  const handleDownloadClick = useCallback(() => {
    setViewState("repacks");
  }, []);

  const handleSelectRepack = useCallback((repack: GameRepack) => {
    setSelectedRepack(repack);
    setViewState("download-settings");
  }, []);

  const handleStartDownload = useCallback(
    async (
      repack: GameRepack,
      downloader: Downloader,
      downloadPath: string,
      automaticallyExtract: boolean,
      addToQueueOnly?: boolean
    ) => {
      if (!shop || !objectId) return { ok: false, error: "no_game" };

      const title = game?.title || shopDetails?.name || objectId;

      const payload: StartGameDownloadPayload = {
        objectId,
        title,
        shop: (game?.shop || shop) as GameShop,
        uri: repack.uris[0],
        downloadPath,
        downloader,
        automaticallyExtract,
        fileSize: repack.fileSize,
      };

      const response = addToQueueOnly
        ? await addGameToQueue(payload)
        : await startGameDownload(payload);

      if (response.ok) {
        setViewState("main");
        window.electron
          .getGameByObjectId((game?.shop || shop) as GameShop, objectId)
          .then(setGame);
      }

      return response;
    },
    [game, shop, objectId, shopDetails, startGameDownload, addGameToQueue]
  );

  const formatPlaytime = (ms: number) => {
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const heroImage = useMemo(() => {
    return (
      game?.customHeroImageUrl ||
      game?.libraryHeroImageUrl ||
      shopDetails?.assets?.libraryHeroImageUrl ||
      null
    );
  }, [game, shopDetails]);

  const hasMedia = useMemo(() => {
    return (
      shopDetails &&
      ((shopDetails.screenshots && shopDetails.screenshots.length > 0) ||
        (shopDetails.movies && shopDetails.movies.length > 0))
    );
  }, [shopDetails]);

  const gameTitle = game?.title || shopDetails?.name || "";

  if (isLoadingDetails && !game && !shopDetails) {
    return <div className="bp-game-detail__loading" />;
  }

  // Sub-views
  if (viewState === "repacks") {
    return (
      <div className="bp-game-detail bp-game-detail--subview">
        <BpRepacksView
          repacks={repacks}
          game={game}
          onSelectRepack={handleSelectRepack}
        />
      </div>
    );
  }

  if (viewState === "download-settings" && selectedRepack) {
    return (
      <div className="bp-game-detail bp-game-detail--subview">
        <BpDownloadSettingsView
          repack={selectedRepack}
          onStartDownload={handleStartDownload}
        />
      </div>
    );
  }

  // Main view
  return (
    <div className="bp-game-detail" ref={scrollContainerRef}>
      {/* Hero */}
      {heroImage && (
        <div className="bp-game-detail__hero">
          <img src={heroImage} alt="" className="bp-game-detail__hero-image" />
          <div className="bp-game-detail__hero-overlay" />
        </div>
      )}

      <div className="bp-game-detail__body">
        {/* Title & Stats */}
        <section
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
        >
          <h1 className="bp-game-detail__title">{gameTitle}</h1>

          <div className="bp-game-detail__stats">
            {game && game.playTimeInMilliseconds > 0 && (
              <div className="bp-game-detail__stat">
                <span className="bp-game-detail__stat-label">
                  {t("playtime")}
                </span>
                <span className="bp-game-detail__stat-value">
                  {formatPlaytime(game.playTimeInMilliseconds)}
                </span>
              </div>
            )}
            {game?.lastTimePlayed && (
              <div className="bp-game-detail__stat">
                <span className="bp-game-detail__stat-label">
                  {t("last_played")}
                </span>
                <span className="bp-game-detail__stat-value">
                  {formatDate(game.lastTimePlayed)}
                </span>
              </div>
            )}
            {game?.achievementCount != null && game.achievementCount > 0 && (
              <div className="bp-game-detail__stat">
                <span className="bp-game-detail__stat-label">
                  {t("achievements")}
                </span>
                <span className="bp-game-detail__stat-value">
                  {game.unlockedAchievementCount ?? 0}/{game.achievementCount}
                </span>
              </div>
            )}
            {shopDetails?.publishers && shopDetails.publishers.length > 0 && (
              <div className="bp-game-detail__stat">
                <span className="bp-game-detail__stat-label">
                  {t("publisher")}
                </span>
                <span className="bp-game-detail__stat-value">
                  {shopDetails.publishers.join(", ")}
                </span>
              </div>
            )}
            {shopDetails?.release_date?.date && (
              <div className="bp-game-detail__stat">
                <span className="bp-game-detail__stat-label">
                  {t("release_date")}
                </span>
                <span className="bp-game-detail__stat-value">
                  {shopDetails.release_date.date}
                </span>
              </div>
            )}
          </div>

          {/* Genre chips */}
          {shopDetails?.genres && shopDetails.genres.length > 0 && (
            <div className="bp-game-detail__genres">
              {shopDetails.genres.map((genre) => (
                <span key={genre.id} className="bp-game-detail__genre-chip">
                  {genre.description}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <section
          className="bp-game-detail__actions"
          ref={(el) => {
            sectionRefs.current[1] = el;
          }}
        >
          {isRunning && (
            <button
              type="button"
              className="bp-game-detail__action bp-game-detail__action--danger"
              data-bp-focusable
              onClick={handleCloseGame}
            >
              {t("close_game")}
            </button>
          )}

          {!isRunning && isInstalled && (
            <button
              type="button"
              className="bp-game-detail__action bp-game-detail__action--primary"
              data-bp-focusable
              onClick={handlePlay}
            >
              {t("play")}
            </button>
          )}

          {canDownload && (
            <button
              type="button"
              className="bp-game-detail__action bp-game-detail__action--download"
              data-bp-focusable
              onClick={handleDownloadClick}
            >
              {t("download")}
            </button>
          )}

          {isDownloading && (
            <button
              type="button"
              className="bp-game-detail__action"
              data-bp-focusable
              onClick={handlePause}
            >
              {t("pause_download")} ({progress})
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              className="bp-game-detail__action"
              data-bp-focusable
              onClick={handleResume}
            >
              {t("resume_download")}
            </button>
          )}

          <button
            type="button"
            className="bp-game-detail__action bp-game-detail__action--secondary"
            data-bp-focusable
            onClick={() => navigate(-1)}
          >
            {t("press_b_back")}
          </button>
        </section>

        {/* Media */}
        {hasMedia && shopDetails && (
          <section
            className="bp-game-detail__section"
            ref={(el) => {
              sectionRefs.current[2] = el;
            }}
          >
            <BpMediaSlider
              shopDetails={shopDetails}
              viewerIndex={mediaViewerIndex}
              onOpenViewer={setMediaViewerIndex}
            />
          </section>
        )}

        {/* Description */}
        {shopDetails?.about_the_game && (
          <section
            className="bp-game-detail__section"
            ref={(el) => {
              sectionRefs.current[3] = el;
            }}
          >
            <h2 className="bp-game-detail__section-title">
              {t("description")}
            </h2>
            <div
              className={`bp-game-detail__description ${
                !descriptionExpanded
                  ? "bp-game-detail__description--collapsed"
                  : ""
              }`}
              dangerouslySetInnerHTML={{
                __html: shopDetails.about_the_game,
              }}
            />
            <button
              type="button"
              className="bp-game-detail__expand-btn"
              data-bp-focusable
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
            >
              {descriptionExpanded ? t("show_less") : t("show_more")}
            </button>
          </section>
        )}

        {/* Reviews */}
        {shop && objectId && shop !== "custom" && (
          <section
            className="bp-game-detail__section"
            ref={(el) => {
              sectionRefs.current[4] = el;
            }}
          >
            <BpReviewsSection shop={shop as GameShop} objectId={objectId} />
          </section>
        )}
      </div>
    </div>
  );
}
