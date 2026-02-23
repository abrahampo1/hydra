import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, CheckIcon, SyncIcon } from "@primer/octicons-react";
import {
  Heart,
  Gamepad2,
  Trash2,
  CloudIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useDispatch } from "react-redux";

import type { RomEntry } from "@types";
import { ROM_CONSOLES, formatBytes } from "@shared";
import { Button } from "@renderer/components";
import { setRoms } from "@renderer/features";

import { RomCloudSyncModal } from "./rom-cloud-sync-modal";

import "./rom-detail.scss";

const formatPlaytime = (ms: number): string => {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "";
};

export default function RomDetail() {
  const { t } = useTranslation("roms");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams<{ id: string }>();

  const [rom, setRom] = useState<RomEntry | null>(null);
  const [coverError, setCoverError] = useState(false);
  const [screenshotError, setScreenshotError] = useState(false);
  const [titleScreenError, setTitleScreenError] = useState(false);
  const [showCloudSync, setShowCloudSync] = useState(false);

  /* Scraping state */
  const [scrapeTitle, setScrapeTitle] = useState("");
  const [isRescraping, setIsRescraping] = useState(false);
  const [scrapeNotFound, setScrapeNotFound] = useState(false);
  const [coverStatus, setCoverStatus] = useState<
    "loading" | "found" | "not_found"
  >("loading");

  useEffect(() => {
    if (!id) {
      navigate("/roms");
      return;
    }

    window.electron.roms.getById(id).then((entry) => {
      if (!entry) {
        navigate("/roms");
        return;
      }
      setRom(entry);
      setScrapeTitle(entry.title);
    });
  }, [id, navigate]);

  /* Check if cover image actually loads */
  useEffect(() => {
    if (!rom?.coverUrl) {
      setCoverStatus("not_found");
      return;
    }

    setCoverStatus("loading");
    const img = new Image();
    img.onload = () => setCoverStatus("found");
    img.onerror = () => setCoverStatus("not_found");
    img.src = rom.coverUrl;
  }, [rom?.coverUrl]);

  const handleBack = useCallback(() => {
    navigate("/roms");
  }, [navigate]);

  const handlePlay = useCallback(() => {
    if (!rom) return;
    navigate("/roms/play", { state: { rom } });
  }, [rom, navigate]);

  const handleToggleFavorite = useCallback(async () => {
    if (!rom) return;
    const newValue = await window.electron.roms.toggleFavorite(rom.id);
    setRom({ ...rom, favorite: newValue });

    const allRoms = await window.electron.roms.getAll();
    dispatch(setRoms(allRoms));
  }, [rom, dispatch]);

  const handleDelete = useCallback(async () => {
    if (!rom) return;
    await window.electron.roms.delete(rom.id);

    const allRoms = await window.electron.roms.getAll();
    dispatch(setRoms(allRoms));
    navigate("/roms");
  }, [rom, dispatch, navigate]);

  const handleSaveTitle = useCallback(async () => {
    if (!rom || !scrapeTitle.trim()) return;
    const trimmed = scrapeTitle.trim();
    if (trimmed === rom.title) return;

    try {
      const updated = await window.electron.roms.updateTitle(rom.id, trimmed);
      if (updated) {
        setRom(updated);
        const allRoms = await window.electron.roms.getAll();
        dispatch(setRoms(allRoms));
      }
    } catch {
      /* rename failed */
    }
  }, [rom, scrapeTitle, dispatch]);

  const handleRescrape = useCallback(async () => {
    if (!rom || !scrapeTitle.trim()) return;

    setIsRescraping(true);
    setScrapeNotFound(false);
    setCoverError(false);
    setScreenshotError(false);
    setTitleScreenError(false);

    try {
      const updated = await window.electron.roms.scrape(
        rom.id,
        scrapeTitle.trim()
      );

      if (updated) {
        setRom(updated);
        const allRoms = await window.electron.roms.getAll();
        dispatch(setRoms(allRoms));
      } else {
        setScrapeNotFound(true);
      }
    } catch {
      setScrapeNotFound(true);
    } finally {
      setIsRescraping(false);
    }
  }, [rom, scrapeTitle, dispatch]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSaveTitle();
      }
    },
    [handleSaveTitle]
  );

  if (!rom) return null;

  const consoleInfo = ROM_CONSOLES[rom.console];
  const titleChanged = scrapeTitle.trim() !== rom.title;

  const lastPlayedText = rom.lastTimePlayed
    ? t("last_played", {
        date: new Date(rom.lastTimePlayed).toLocaleDateString(),
      })
    : t("never_played");

  return (
    <div className="rom-detail">
      <RomCloudSyncModal
        visible={showCloudSync}
        onClose={() => setShowCloudSync(false)}
      />

      <div className="rom-detail__header">
        <Button theme="outline" onClick={handleBack}>
          <ArrowLeftIcon size={14} />
          {t("back")}
        </Button>

        <h1 className="rom-detail__title">{rom.title}</h1>

        {consoleInfo && (
          <span
            className="rom-detail__console-badge"
            style={{ backgroundColor: consoleInfo.color }}
          >
            {consoleInfo.name}
          </span>
        )}
      </div>

      <div className="rom-detail__content">
        <div className="rom-detail__cover-section">
          <div className="rom-detail__cover">
            {rom.coverUrl && !coverError ? (
              <img
                src={rom.coverUrl}
                alt={rom.title}
                className="rom-detail__cover-img"
                onError={() => setCoverError(true)}
              />
            ) : (
              <div
                className="rom-detail__cover-placeholder"
                style={{
                  backgroundColor: consoleInfo?.color ?? "#555",
                  opacity: 0.3,
                }}
              >
                <Gamepad2 size={48} />
                <span>{t("cover_not_available")}</span>
              </div>
            )}
          </div>

          {/* Cover status indicator */}
          <div className="rom-detail__cover-status">
            {coverStatus === "found" && (
              <>
                <CheckCircle2 size={14} />
                <span>{t("cover_found")}</span>
              </>
            )}
            {coverStatus === "not_found" && (
              <>
                <XCircle size={14} />
                <span>{t("cover_not_found")}</span>
              </>
            )}
          </div>
        </div>

        <div className="rom-detail__info-section">
          <div className="rom-detail__metadata">
            <div className="rom-detail__meta-row">
              <span className="rom-detail__meta-row-label">{t("console")}</span>
              <span className="rom-detail__meta-row-value">
                {consoleInfo?.name ?? rom.console}
              </span>
            </div>

            <div className="rom-detail__meta-row">
              <span className="rom-detail__meta-row-label">
                {t("file_size")}
              </span>
              <span className="rom-detail__meta-row-value">
                {formatBytes(rom.fileSize)}
              </span>
            </div>

            <div className="rom-detail__meta-row">
              <span className="rom-detail__meta-row-label">
                {t("playtime")}
              </span>
              <span className="rom-detail__meta-row-value">
                {rom.playTimeInMilliseconds > 0
                  ? formatPlaytime(rom.playTimeInMilliseconds)
                  : t("never_played")}
              </span>
            </div>

            <div className="rom-detail__meta-row">
              <span className="rom-detail__meta-row-label">
                {t("last_played_label")}
              </span>
              <span className="rom-detail__meta-row-value">
                {lastPlayedText}
              </span>
            </div>

            <div className="rom-detail__meta-row">
              <span className="rom-detail__meta-row-label">
                {t("file_path")}
              </span>
              <span className="rom-detail__meta-row-value" title={rom.filePath}>
                {rom.filePath}
              </span>
            </div>
          </div>

          <div className="rom-detail__actions">
            <Button onClick={handlePlay}>{t("play")}</Button>

            <Button theme="outline" onClick={() => setShowCloudSync(true)}>
              <CloudIcon size={14} />
              {t("cloud_saves")}
            </Button>

            <Button theme="outline" onClick={handleToggleFavorite}>
              <Heart size={14} fill={rom.favorite ? "currentColor" : "none"} />
              {t("toggle_favorite")}
            </Button>

            <Button
              theme="outline"
              className="rom-detail__delete-button"
              onClick={handleDelete}
            >
              <Trash2 size={14} />
              {t("delete_rom")}
            </Button>
          </div>

          {/* Title & Scraping */}
          <div className="rom-detail__scraping">
            <div className="rom-detail__scraping-header">
              <h3>{t("scraping_settings")}</h3>
              <span className="rom-detail__scraping-description">
                {t("scraping_settings_description")}
              </span>
            </div>

            <div className="rom-detail__scraping-form">
              <div className="rom-detail__scraping-field">
                <label
                  className="rom-detail__scraping-label"
                  htmlFor="scrape-title"
                >
                  {t("scrape_title")}
                </label>
                <div className="rom-detail__scraping-input-row">
                  <input
                    id="scrape-title"
                    type="text"
                    className="rom-detail__scraping-input"
                    value={scrapeTitle}
                    onChange={(e) => {
                      setScrapeTitle(e.target.value);
                      setScrapeNotFound(false);
                    }}
                    onKeyDown={handleTitleKeyDown}
                    placeholder={rom.title}
                  />
                  {titleChanged && (
                    <Button theme="primary" onClick={handleSaveTitle}>
                      <CheckIcon size={14} />
                      {t("save")}
                    </Button>
                  )}
                  <Button
                    theme="outline"
                    onClick={handleRescrape}
                    disabled={isRescraping || !scrapeTitle.trim()}
                  >
                    {isRescraping ? (
                      <SyncIcon size={14} className="rom-detail__spin-icon" />
                    ) : (
                      <SyncIcon size={14} />
                    )}
                    {isRescraping ? t("rescraping") : t("rescrape")}
                  </Button>
                </div>
                <span className="rom-detail__scraping-hint">
                  {t("scrape_title_hint")}
                </span>
                {scrapeNotFound && (
                  <span className="rom-detail__scraping-error">
                    <XCircle size={12} />
                    {t("scrape_not_found")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Screenshots */}
          {(rom.screenshotUrl || rom.titleScreenUrl) && (
            <div className="rom-detail__screenshots">
              <div className="rom-detail__screenshots-grid">
                {rom.screenshotUrl && !screenshotError && (
                  <div className="rom-detail__screenshot">
                    <img
                      src={rom.screenshotUrl}
                      alt={`${rom.title} screenshot`}
                      onError={() => setScreenshotError(true)}
                    />
                  </div>
                )}
                {rom.titleScreenUrl && !titleScreenError && (
                  <div className="rom-detail__screenshot">
                    <img
                      src={rom.titleScreenUrl}
                      alt={`${rom.title} title screen`}
                      onError={() => setTitleScreenError(true)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
