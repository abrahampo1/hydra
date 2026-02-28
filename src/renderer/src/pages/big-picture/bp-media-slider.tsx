import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ShopDetailsWithAssets } from "@types";
import "./bp-media-slider.scss";

interface BpMediaSliderProps {
  shopDetails: ShopDetailsWithAssets;
  viewerIndex: number | null;
  onOpenViewer: (index: number) => void;
}

interface MediaItem {
  id: string;
  type: "video" | "image";
  src?: string;
  poster?: string;
  videoSrc?: string;
  alt: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BpMediaSlider({
  shopDetails,
  viewerIndex,
  onOpenViewer,
}: Readonly<BpMediaSliderProps>) {
  const { t } = useTranslation("big_picture");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const viewerOpen = viewerIndex !== null;

  const mediaItems = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = [];

    if (shopDetails.movies) {
      shopDetails.movies.forEach((video, index) => {
        let videoSrc: string | undefined;

        // Prefer MP4/WebM for native playback in custom player
        if (video.mp4?.max) {
          videoSrc = video.mp4.max;
        } else if (video.webm?.max) {
          videoSrc = video.webm.max;
        } else if (video.mp4?.["480"]) {
          videoSrc = video.mp4["480"];
        } else if (video.webm?.["480"]) {
          videoSrc = video.webm["480"];
        }

        if (videoSrc) {
          items.push({
            id: String(video.id),
            type: "video",
            poster: video.thumbnail,
            videoSrc: videoSrc.startsWith("http://")
              ? videoSrc.replace("http://", "https://")
              : videoSrc,
            alt: video.name || t("media") + ` ${index + 1}`,
          });
        }
      });
    }

    if (shopDetails.screenshots) {
      shopDetails.screenshots.forEach((image, index) => {
        items.push({
          id: String(image.id),
          type: "image",
          src: image.path_full,
          alt: t("media") + ` ${index + 1}`,
        });
      });
    }

    return items;
  }, [shopDetails, t]);

  const currentViewerItem =
    viewerIndex !== null ? mediaItems[viewerIndex] : null;

  // --- Thumbnail strip logic ---

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.firstElementChild
      ? (container.firstElementChild as HTMLElement).offsetWidth
      : 1;
    const index = Math.round(scrollLeft / (itemWidth + 16));
    setActiveIndex(Math.min(index, mediaItems.length - 1));
  }, [mediaItems.length]);

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const children = scrollRef.current.children;
    if (children[index]) {
      (children[index] as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
      setActiveIndex(index);
    }
  }, []);

  const handleThumbnailClick = useCallback(
    (index: number) => {
      scrollToIndex(index);
      onOpenViewer(index);
    },
    [scrollToIndex, onOpenViewer]
  );

  // --- Video player logic ---

  // Reset video state when viewer item changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [viewerIndex]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeekBack = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      videoRef.current.currentTime - 10
    );
  }, []);

  const handleSeekForward = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(
      videoRef.current.duration || 0,
      videoRef.current.currentTime + 10
    );
  }, []);

  const handleViewerPrev = useCallback(() => {
    if (viewerIndex === null || viewerIndex <= 0) return;
    onOpenViewer(viewerIndex - 1);
  }, [viewerIndex, onOpenViewer]);

  const handleViewerNext = useCallback(() => {
    if (viewerIndex === null || viewerIndex >= mediaItems.length - 1) return;
    onOpenViewer(viewerIndex + 1);
  }, [viewerIndex, mediaItems.length, onOpenViewer]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (mediaItems.length === 0) return null;

  return (
    <div className="bp-media-slider">
      {/* Thumbnail strip (normal mode) */}
      <div className="bp-media-slider__header">
        <h2 className="bp-media-slider__title">{t("media")}</h2>
        <span className="bp-media-slider__counter">
          {activeIndex + 1} / {mediaItems.length}
        </span>
      </div>

      <div
        className="bp-media-slider__viewport"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {mediaItems.map((item) => (
          <div key={item.id} className="bp-media-slider__slide">
            {item.type === "video" ? (
              <img
                className="bp-media-slider__media"
                src={item.poster}
                alt={item.alt}
              />
            ) : (
              <img
                className="bp-media-slider__media"
                src={item.src}
                alt={item.alt}
                loading="lazy"
              />
            )}
            {item.type === "video" && (
              <div className="bp-media-slider__slide-play-badge">&#9654;</div>
            )}
          </div>
        ))}
      </div>

      <div className="bp-media-slider__thumbnails">
        {mediaItems.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`bp-media-slider__thumbnail ${
              activeIndex === i ? "bp-media-slider__thumbnail--active" : ""
            }`}
            data-bp-focusable={!viewerOpen ? "" : undefined}
            onClick={() => handleThumbnailClick(i)}
          >
            <img
              src={item.type === "video" ? item.poster : item.src}
              alt={item.alt}
              className="bp-media-slider__thumbnail-image"
            />
            {item.type === "video" && (
              <div className="bp-media-slider__play-icon">&#9654;</div>
            )}
          </button>
        ))}
      </div>

      {/* Fullscreen viewer overlay */}
      {viewerOpen && currentViewerItem && (
        <div className="bp-media-viewer">
          <div className="bp-media-viewer__backdrop" />

          <div className="bp-media-viewer__content">
            {currentViewerItem.type === "video" ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- game trailers don't have caption tracks
              <video
                ref={videoRef}
                className="bp-media-viewer__video"
                src={currentViewerItem.videoSrc}
                poster={currentViewerItem.poster}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleVideoEnded}
                playsInline
              />
            ) : (
              <img
                className="bp-media-viewer__image"
                src={currentViewerItem.src}
                alt={currentViewerItem.alt}
              />
            )}
          </div>

          {/* Controls bar */}
          <div className="bp-media-viewer__controls">
            <div className="bp-media-viewer__controls-row">
              {/* Prev */}
              <button
                type="button"
                className="bp-media-viewer__btn"
                data-bp-focusable=""
                onClick={handleViewerPrev}
                disabled={viewerIndex <= 0}
              >
                &#9664; {t("viewer_prev")}
              </button>

              {/* Video-specific controls */}
              {currentViewerItem.type === "video" && (
                <>
                  <button
                    type="button"
                    className="bp-media-viewer__btn"
                    data-bp-focusable=""
                    onClick={handleSeekBack}
                  >
                    &#9194; 10s
                  </button>

                  <button
                    type="button"
                    className="bp-media-viewer__btn bp-media-viewer__btn--play"
                    data-bp-focusable=""
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? "\u23F8" : "\u25B6"}
                  </button>

                  <button
                    type="button"
                    className="bp-media-viewer__btn"
                    data-bp-focusable=""
                    onClick={handleSeekForward}
                  >
                    10s &#9193;
                  </button>
                </>
              )}

              {/* Next */}
              <button
                type="button"
                className="bp-media-viewer__btn"
                data-bp-focusable=""
                onClick={handleViewerNext}
                disabled={viewerIndex >= mediaItems.length - 1}
              >
                {t("viewer_next")} &#9654;
              </button>
            </div>

            {/* Progress bar + time (video only) */}
            {currentViewerItem.type === "video" && (
              <div className="bp-media-viewer__progress-row">
                <span className="bp-media-viewer__time">
                  {formatTime(currentTime)}
                </span>
                <div className="bp-media-viewer__progress-bar">
                  <div
                    className="bp-media-viewer__progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="bp-media-viewer__time">
                  {formatTime(duration)}
                </span>
              </div>
            )}

            {/* Counter */}
            <div className="bp-media-viewer__counter">
              {(viewerIndex ?? 0) + 1} / {mediaItems.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
