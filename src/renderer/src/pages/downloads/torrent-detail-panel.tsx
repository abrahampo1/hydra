import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRightIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import { formatBytes } from "@shared";
import { torrentPanelVariants, chevronVariants } from "./download-animations";

interface TorrentDetailPanelProps {
  numSeeds: number;
  numPeers: number;
  downloadSpeed: number;
  uploadSpeed?: number;
  formatSpeed: (speed: number) => string;
}

export function TorrentDetailPanel({
  numSeeds,
  numPeers,
  downloadSpeed,
  uploadSpeed,
  formatSpeed,
}: Readonly<TorrentDetailPanelProps>) {
  const { t } = useTranslation("downloads");
  const [isExpanded, setIsExpanded] = useState(false);

  const togglePanel = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="download-group__torrent-panel">
      <button
        type="button"
        className="download-group__torrent-toggle"
        onClick={togglePanel}
      >
        <motion.div
          variants={chevronVariants}
          animate={isExpanded ? "expanded" : "collapsed"}
          style={{ display: "flex" }}
        >
          <ChevronRightIcon size={14} />
        </motion.div>
        {t("torrent_info")}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="torrent-panel"
            variants={torrentPanelVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
          >
            <div className="download-group__torrent-grid">
              <div className="download-group__torrent-stat">
                <span className="download-group__torrent-stat-label">
                  {t("seeds")}
                </span>
                <span className="download-group__torrent-stat-value download-group__torrent-stat-value--seeds">
                  {numSeeds}
                </span>
              </div>

              <div className="download-group__torrent-stat">
                <span className="download-group__torrent-stat-label">
                  {t("peers")}
                </span>
                <span className="download-group__torrent-stat-value">
                  {numPeers}
                </span>
              </div>

              <div className="download-group__torrent-stat">
                <span className="download-group__torrent-stat-label">
                  {t("network")}
                </span>
                <span className="download-group__torrent-stat-value">
                  {formatSpeed(downloadSpeed)}
                </span>
              </div>

              {uploadSpeed !== undefined && uploadSpeed > 0 && (
                <div className="download-group__torrent-stat">
                  <span className="download-group__torrent-stat-label">
                    {t("upload_speed")}
                  </span>
                  <span className="download-group__torrent-stat-value download-group__torrent-stat-value--upload">
                    {formatBytes(uploadSpeed)}/s
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
