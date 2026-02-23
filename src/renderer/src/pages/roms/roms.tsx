import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Heart, Gamepad2 } from "lucide-react";

import type { RootState } from "@renderer/store";
import type { RomConsole, RomEntry } from "@types";
import {
  setRoms,
  setSelectedConsole,
  setIsScanning,
  setRomsPath,
} from "@renderer/features";
import { ROM_CONSOLES } from "@shared";
import { Button } from "@renderer/components";

import "./roms.scss";

const formatPlaytime = (ms: number): string => {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "";
};

function RomCard({
  rom,
  onOpen,
  onToggleFavorite,
  t,
}: {
  rom: RomEntry;
  onOpen: (rom: RomEntry) => void;
  onToggleFavorite: (e: React.MouseEvent, rom: RomEntry) => void;
  t: (key: string) => string;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="roms__card"
      onClick={() => onOpen(rom)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(rom);
      }}
    >
      <div className="roms__card-cover">
        {rom.coverUrl && !imgError ? (
          <img
            src={rom.coverUrl}
            alt={rom.title}
            className="roms__card-cover-img"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div
            className="roms__card-cover-placeholder"
            style={{
              backgroundColor: ROM_CONSOLES[rom.console]?.color ?? "#555",
            }}
          >
            <Gamepad2 size={28} />
          </div>
        )}
      </div>

      <button
        type="button"
        className={`roms__card-favorite ${
          rom.favorite ? "roms__card-favorite--active" : ""
        }`}
        onClick={(e) => onToggleFavorite(e, rom)}
        title={t("toggle_favorite")}
      >
        <Heart size={14} fill={rom.favorite ? "currentColor" : "none"} />
      </button>

      <span
        className="roms__card-console"
        style={{
          backgroundColor: ROM_CONSOLES[rom.console]?.color ?? "#555",
        }}
      >
        {ROM_CONSOLES[rom.console]?.name ?? rom.console}
      </span>

      <span className="roms__card-title" title={rom.title}>
        {rom.title}
      </span>

      <span className="roms__card-meta">
        {rom.playTimeInMilliseconds > 0
          ? formatPlaytime(rom.playTimeInMilliseconds)
          : t("never_played")}
      </span>
    </div>
  );
}

export default function Roms() {
  const { t } = useTranslation("roms");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { roms, searchQuery, selectedConsole, isScanning, romsPath } =
    useSelector((state: RootState) => state.roms);

  useEffect(() => {
    window.electron.getUserPreferences().then((prefs) => {
      if (prefs?.romsPath) {
        dispatch(setRomsPath(prefs.romsPath));
      }
    });

    window.electron.roms.getAll().then((allRoms) => {
      dispatch(setRoms(allRoms));
    });
  }, [dispatch]);

  const handleSelectFolder = useCallback(async () => {
    const folder = await window.electron.roms.selectFolder();
    if (!folder) return;

    dispatch(setRomsPath(folder));
    dispatch(setIsScanning(true));

    const scannedRoms = await window.electron.roms.scan(folder);
    dispatch(setRoms(scannedRoms));
    dispatch(setIsScanning(false));
  }, [dispatch]);

  const handleRescan = useCallback(async () => {
    if (!romsPath) return;
    dispatch(setIsScanning(true));

    const scannedRoms = await window.electron.roms.scan(romsPath);
    dispatch(setRoms(scannedRoms));
    dispatch(setIsScanning(false));
  }, [dispatch, romsPath]);

  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent, rom: RomEntry) => {
      e.stopPropagation();
      const newValue = await window.electron.roms.toggleFavorite(rom.id);
      dispatch(
        setRoms(
          roms.map((r) => (r.id === rom.id ? { ...r, favorite: newValue } : r))
        )
      );
    },
    [dispatch, roms]
  );

  const handleOpenRomDetail = useCallback(
    (rom: RomEntry) => {
      navigate(`/roms/${rom.id}`);
    },
    [navigate]
  );

  const consoleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rom of roms) {
      counts[rom.console] = (counts[rom.console] || 0) + 1;
    }
    return counts;
  }, [roms]);

  const filteredRoms = useMemo(() => {
    let result = roms;

    if (selectedConsole === ("favorites" as string)) {
      result = result.filter((r) => r.favorite);
    } else if (selectedConsole) {
      result = result.filter((r) => r.console === selectedConsole);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(query));
    }

    return result;
  }, [roms, selectedConsole, searchQuery]);

  const activeConsoles = useMemo(() => {
    return (Object.keys(ROM_CONSOLES) as RomConsole[]).filter(
      (c) => consoleCounts[c]
    );
  }, [consoleCounts]);

  const hasRoms = roms.length > 0;

  return (
    <div className="roms">
      <div className="roms__header">
        <div className="roms__header-left">
          <h1 className="roms__title">{t("title")}</h1>
          <span className="roms__beta-badge">{t("beta_badge")}</span>
          {romsPath && (
            <span className="roms__folder-info" title={romsPath}>
              {t("current_folder", { path: romsPath })}
            </span>
          )}
        </div>

        <div className="roms__header-actions">
          <Button
            theme="outline"
            onClick={hasRoms ? handleRescan : handleSelectFolder}
            disabled={isScanning}
          >
            {isScanning
              ? t("scanning")
              : hasRoms
                ? t("change_folder")
                : t("browse_folder")}
          </Button>
        </div>
      </div>

      <div className="roms__body">
        {hasRoms ? (
          <>
            <nav className="roms__console-sidebar">
              <button
                type="button"
                className={`roms__console-item ${
                  selectedConsole === null ? "roms__console-item--active" : ""
                }`}
                onClick={() => dispatch(setSelectedConsole(null))}
              >
                <span>{t("all_consoles")}</span>
                <span className="roms__console-count">{roms.length}</span>
              </button>

              <button
                type="button"
                className={`roms__console-item ${
                  selectedConsole === ("favorites" as RomConsole)
                    ? "roms__console-item--active"
                    : ""
                }`}
                onClick={() =>
                  dispatch(setSelectedConsole("favorites" as RomConsole))
                }
              >
                <span>{t("favorites")}</span>
                <span className="roms__console-count">
                  {roms.filter((r) => r.favorite).length}
                </span>
              </button>

              {activeConsoles.map((consoleId) => (
                <button
                  key={consoleId}
                  type="button"
                  className={`roms__console-item ${
                    selectedConsole === consoleId
                      ? "roms__console-item--active"
                      : ""
                  }`}
                  onClick={() => dispatch(setSelectedConsole(consoleId))}
                >
                  <span>{ROM_CONSOLES[consoleId].name}</span>
                  <span className="roms__console-count">
                    {consoleCounts[consoleId]}
                  </span>
                </button>
              ))}
            </nav>

            <div className="roms__content">
              <div className="roms__grid">
                {filteredRoms.map((rom) => (
                  <RomCard
                    key={rom.id}
                    rom={rom}
                    onOpen={handleOpenRomDetail}
                    onToggleFavorite={handleToggleFavorite}
                    t={t}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="roms__empty">
            <Gamepad2 size={48} />
            <span className="roms__empty-title">{t("empty_title")}</span>
            <span className="roms__empty-description">
              {t("empty_description")}
            </span>
            <Button onClick={handleSelectFolder} disabled={isScanning}>
              {isScanning ? t("scanning") : t("browse_folder")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
