import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  DownloadIcon,
  UploadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@primer/octicons-react";

import type { RomEntry } from "@types";
import { ROM_CONSOLES } from "@shared";
import { Button } from "@renderer/components";

import "./rom-player.scss";

const formatPlaytime = (ms: number): string => {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default function RomPlayer() {
  const { t } = useTranslation("roms");
  const navigate = useNavigate();
  const location = useLocation();

  const rom = (location.state as { rom: RomEntry } | null)?.rom;
  const sessionStartRef = useRef(Date.now());
  const [sessionTime, setSessionTime] = useState(0);
  const [currentSlot, setCurrentSlot] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendToIframe = useCallback(
    (type: string, payload: Record<string, unknown> = {}) => {
      iframeRef.current?.contentWindow?.postMessage(
        { source: "hydra-host", type, ...payload },
        "*"
      );
    },
    []
  );

  useEffect(() => {
    if (!rom) {
      navigate("/roms");
      return;
    }

    sessionStartRef.current = Date.now();

    const interval = setInterval(() => {
      setSessionTime(Date.now() - sessionStartRef.current);
    }, 1000);

    const handleMessage = async (e: MessageEvent) => {
      if (!e.data || e.data.source !== "emulator") return;

      const { type, romId, slot, data } = e.data;

      if (type === "save-sram" && romId && data) {
        await window.electron.roms.saveGameSRAM(romId, data);
      }

      if (type === "load-sram" && romId) {
        const sramData = await window.electron.roms.loadGameSRAM(romId);
        sendToIframe("load-sram-response", { data: sramData });
      }

      if (type === "save-state" && romId && slot && data) {
        await window.electron.roms.saveGameState(romId, slot, data);
      }

      if (type === "load-state" && romId && slot) {
        const stateData = await window.electron.roms.loadGameState(romId, slot);
        sendToIframe("load-state-response", { data: stateData, slot });
      }

      if (type === "slot-changed" && typeof slot === "number") {
        setCurrentSlot(slot);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("message", handleMessage);

      const elapsed = Date.now() - sessionStartRef.current;
      if (elapsed > 1000) {
        window.electron.roms.updatePlaytime(rom.id, elapsed);
      }
    };
  }, [rom, navigate, sendToIframe]);

  const handleBack = useCallback(() => {
    if (!rom) return;

    const elapsed = Date.now() - sessionStartRef.current;
    if (elapsed > 1000) {
      window.electron.roms.updatePlaytime(rom.id, elapsed);
    }

    navigate("/roms");
  }, [rom, navigate]);

  const handleSaveState = useCallback(() => {
    sendToIframe("request-save-state", { slot: currentSlot });
  }, [sendToIframe, currentSlot]);

  const handleLoadState = useCallback(() => {
    sendToIframe("request-load-state", { slot: currentSlot });
  }, [sendToIframe, currentSlot]);

  const handleSlotPrev = useCallback(() => {
    setCurrentSlot((s) => {
      const next = s <= 1 ? 9 : s - 1;
      sendToIframe("set-slot", { slot: next });
      return next;
    });
  }, [sendToIframe]);

  const handleSlotNext = useCallback(() => {
    setCurrentSlot((s) => {
      const next = s >= 9 ? 1 : s + 1;
      sendToIframe("set-slot", { slot: next });
      return next;
    });
  }, [sendToIframe]);

  const consoleInfo = rom ? ROM_CONSOLES[rom.console] : null;

  const iframeSrc = useMemo(() => {
    if (!rom || !consoleInfo) return "";

    const romPath = rom.filePath.replace(/\\/g, "/");
    const romUrl = `emulator-rom://localhost/${encodeURIComponent(romPath)}`;

    const sanitizedTitle = rom.title
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .replace(/\s+/g, "_");

    const params = new URLSearchParams({
      core: consoleInfo.core,
      romUrl,
      gameName: sanitizedTitle,
      romId: rom.id,
    });

    return `emulator-data://data/__player__?${params.toString()}`;
  }, [rom, consoleInfo]);

  if (!rom) return null;

  const totalPlaytime = rom.playTimeInMilliseconds + sessionTime;

  return (
    <div className="rom-player">
      <div className="rom-player__header">
        <Button theme="outline" onClick={handleBack}>
          <ArrowLeftIcon size={14} />
          {t("back")}
        </Button>

        <h1 className="rom-player__title">{rom.title}</h1>

        {consoleInfo && (
          <span
            className="rom-player__console-badge"
            style={{ backgroundColor: consoleInfo.color }}
          >
            {consoleInfo.name}
          </span>
        )}

        <span className="rom-player__playtime">
          {t("playtime")}: {formatPlaytime(totalPlaytime)}
        </span>

        <div className="rom-player__controls">
          <div className="rom-player__slot-selector">
            <button
              className="rom-player__slot-btn"
              onClick={handleSlotPrev}
              title={t("slot_previous")}
            >
              <ChevronLeftIcon size={14} />
            </button>
            <span className="rom-player__slot-label">
              {t("slot")} {currentSlot}
            </span>
            <button
              className="rom-player__slot-btn"
              onClick={handleSlotNext}
              title={t("slot_next")}
            >
              <ChevronRightIcon size={14} />
            </button>
          </div>

          <Button theme="outline" onClick={handleSaveState} title="F2">
            <UploadIcon size={14} />
            {t("save")}
          </Button>

          <Button theme="outline" onClick={handleLoadState} title="F4">
            <DownloadIcon size={14} />
            {t("load")}
          </Button>
        </div>
      </div>

      <div className="rom-player__iframe-container">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={rom.title}
          sandbox="allow-scripts allow-same-origin"
          allow="screen-wake-lock"
        />
      </div>
    </div>
  );
}
