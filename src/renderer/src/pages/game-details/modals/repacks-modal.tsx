import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  PlusCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
} from "@primer/octicons-react";
import { Tooltip } from "react-tooltip";

import {
  Button,
  DebridBadge,
  Modal,
  TextField,
  CheckboxField,
} from "@renderer/components";
import type { DownloadSource, Game, GameRepack } from "@types";

import { DownloadSettingsModal } from "./download-settings-modal";
import { gameDetailsContext } from "@renderer/context";
import { Downloader } from "@shared";
import { orderBy } from "lodash-es";
import {
  useDate,
  useFeature,
  useAppDispatch,
  useAppSelector,
} from "@renderer/hooks";
import { clearNewDownloadOptions } from "@renderer/features";
import { levelDBService } from "@renderer/services/leveldb.service";
import { getGameKey } from "@renderer/helpers";
import "./repacks-modal.scss";

export interface RepacksModalProps {
  visible: boolean;
  startDownload: (
    repack: GameRepack,
    downloader: Downloader,
    downloadPath: string,
    automaticallyExtract: boolean,
    addToQueueOnly?: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

export function RepacksModal({
  visible,
  startDownload,
  onClose,
}: Readonly<RepacksModalProps>) {
  const [filteredRepacks, setFilteredRepacks] = useState<GameRepack[]>([]);
  const [repack, setRepack] = useState<GameRepack | null>(null);
  const [showSelectFolderModal, setShowSelectFolderModal] = useState(false);
  const [downloadSources, setDownloadSources] = useState<DownloadSource[]>([]);
  const [selectedFingerprints, setSelectedFingerprints] = useState<string[]>(
    []
  );
  const [filterTerm, setFilterTerm] = useState("");

  const [hashesInDebrid, setHashesInDebrid] = useState<Record<string, boolean>>(
    {}
  );
  const [lastCheckTimestamp, setLastCheckTimestamp] = useState<string | null>(
    null
  );
  const [isLoadingTimestamp, setIsLoadingTimestamp] = useState(true);
  const [viewedRepackIds, setViewedRepackIds] = useState<Set<string>>(
    new Set()
  );
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(
    new Set()
  );

  const { game, repacks } = useContext(gameDetailsContext);

  const { t } = useTranslation("game_details");

  const { formatDate } = useDate();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const getHashFromMagnet = (magnet: string) => {
    if (!magnet || typeof magnet !== "string") {
      return null;
    }

    const hashRegex = /xt=urn:btih:([a-zA-Z0-9]+)/i;
    const match = magnet.match(hashRegex);

    return match ? match[1].toLowerCase() : null;
  };

  const { isFeatureEnabled, Feature } = useFeature();

  useEffect(() => {
    if (!isFeatureEnabled(Feature.NimbusPreview)) {
      return;
    }

    const magnets = repacks.flatMap((repack) =>
      repack.uris.filter((uri) => uri.startsWith("magnet:"))
    );

    window.electron.checkDebridAvailability(magnets).then((availableHashes) => {
      setHashesInDebrid(availableHashes);
    });
  }, [repacks, isFeatureEnabled, Feature]);

  useEffect(() => {
    const fetchDownloadSources = async () => {
      const sources = (await levelDBService.values(
        "downloadSources"
      )) as DownloadSource[];
      const sorted = orderBy(sources, "createdAt", "desc");
      setDownloadSources(sorted);
    };

    fetchDownloadSources();
  }, []);

  useEffect(() => {
    const fetchLastCheckTimestamp = async () => {
      setIsLoadingTimestamp(true);

      try {
        const timestamp = (await levelDBService.get(
          "downloadSourcesSinceValue",
          null,
          "utf8"
        )) as string | null;

        setLastCheckTimestamp(timestamp);
      } catch {
        setLastCheckTimestamp(null);
      } finally {
        setIsLoadingTimestamp(false);
      }
    };

    if (visible && userPreferences?.enableNewDownloadOptionsBadges !== false) {
      fetchLastCheckTimestamp();
    } else {
      setIsLoadingTimestamp(false);
    }
  }, [visible, repacks, userPreferences?.enableNewDownloadOptionsBadges]);

  useEffect(() => {
    if (
      visible &&
      game?.newDownloadOptionsCount &&
      game.newDownloadOptionsCount > 0
    ) {
      const gameKey = getGameKey(game.shop, game.objectId);
      levelDBService
        .get(gameKey, "games")
        .then((gameData) => {
          if (gameData) {
            const updated = {
              ...(gameData as Game),
              newDownloadOptionsCount: undefined,
            };
            return levelDBService.put(gameKey, updated, "games");
          }
          return Promise.resolve();
        })
        .catch(() => {});

      const gameId = `${game.shop}:${game.objectId}`;
      dispatch(clearNewDownloadOptions({ gameId }));
    }
  }, [visible, game, dispatch]);

  const sortedRepacks = useMemo(() => {
    return orderBy(
      repacks,
      [
        (repack) => {
          const magnet = repack.uris.find((uri) => uri.startsWith("magnet:"));
          const hash = magnet ? getHashFromMagnet(magnet) : null;
          return hash ? (hashesInDebrid[hash] ?? false) : false;
        },
        (repack) => repack.uploadDate,
      ],
      ["desc", "desc"]
    );
  }, [repacks, hashesInDebrid]);

  const getRepackAvailabilityStatus = (
    repack: GameRepack
  ): "online" | "partial" | "offline" => {
    const unavailableSet = new Set(repack.unavailableUris ?? []);
    const availableCount = repack.uris.filter(
      (uri) => !unavailableSet.has(uri)
    ).length;
    const unavailableCount = repack.uris.length - availableCount;

    if (unavailableCount === 0) return "online";
    if (availableCount === 0) return "offline";
    return "partial";
  };

  useEffect(() => {
    const term = filterTerm.trim().toLowerCase();

    const byTerm = sortedRepacks.filter((repack) => {
      if (!term) return true;
      const lowerTitle = repack.title.toLowerCase();
      const lowerRepacker = repack.downloadSourceName.toLowerCase();
      return lowerTitle.includes(term) || lowerRepacker.includes(term);
    });

    const bySource = byTerm.filter((repack) => {
      if (selectedFingerprints.length === 0) return true;

      return downloadSources.some(
        (src) =>
          src.fingerprint &&
          selectedFingerprints.includes(src.fingerprint) &&
          src.name === repack.downloadSourceName
      );
    });

    setFilteredRepacks(bySource);
  }, [sortedRepacks, filterTerm, selectedFingerprints, downloadSources]);

  const handleRepackClick = (repack: GameRepack) => {
    setRepack(repack);
    setShowSelectFolderModal(true);
    setViewedRepackIds((prev) => new Set(prev).add(repack.id));
  };

  const handleFilter: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    setFilterTerm(event.target.value);
  };

  const toggleFingerprint = (fingerprint: string) => {
    setSelectedFingerprints((prev) =>
      prev.includes(fingerprint)
        ? prev.filter((f) => f !== fingerprint)
        : [...prev, fingerprint]
    );
  };

  const checkIfLastDownloadedOption = (repack: GameRepack) => {
    if (!game?.download) return false;
    return repack.uris.some((uri) => uri.includes(game.download!.uri));
  };

  const isNewRepack = (repack: GameRepack): boolean => {
    if (isLoadingTimestamp) return false;

    if (viewedRepackIds.has(repack.id)) return false;

    if (!lastCheckTimestamp || !repack.createdAt) {
      return false;
    }

    try {
      const lastCheckDate = new Date(lastCheckTimestamp);

      if (isNaN(lastCheckDate.getTime())) {
        return false;
      }

      const lastCheckUtc = lastCheckDate.toISOString();

      return repack.createdAt > lastCheckUtc;
    } catch {
      return false;
    }
  };

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setFilterTerm("");
      setSelectedFingerprints([]);
      setIsFilterDrawerOpen(false);
      setCollapsedSources(new Set());
    }
  }, [visible]);

  const toggleSourceCollapse = (sourceName: string) => {
    setCollapsedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceName)) {
        next.delete(sourceName);
      } else {
        next.add(sourceName);
      }
      return next;
    });
  };

  const groupedRepacks = useMemo(() => {
    const groups: Record<string, GameRepack[]> = {};

    for (const repack of filteredRepacks) {
      const source = repack.downloadSourceName;
      if (!groups[source]) {
        groups[source] = [];
      }
      groups[source].push(repack);
    }

    const lastDownloadedSource = Object.entries(groups).find(([, repacks]) =>
      repacks.some((r) => checkIfLastDownloadedOption(r))
    );

    return orderBy(
      Object.entries(groups).map(([source, repacks]) => ({
        source,
        repacks,
        hasLastDownloaded: source === lastDownloadedSource?.[0],
      })),
      [(g) => g.hasLastDownloaded, (g) => g.repacks.length],
      ["desc", "desc"]
    );
  }, [filteredRepacks, game?.download]);

  return (
    <>
      <DownloadSettingsModal
        visible={showSelectFolderModal}
        onClose={() => setShowSelectFolderModal(false)}
        startDownload={startDownload}
        repack={repack}
      />

      <Modal
        visible={visible}
        title={t("download_options")}
        description={t("repacks_modal_description")}
        onClose={onClose}
      >
        <div
          className={`repacks-modal__filter-container ${isFilterDrawerOpen ? "repacks-modal__filter-container--drawer-open" : ""}`}
        >
          <div className="repacks-modal__filter-top">
            <TextField
              placeholder={t("filter")}
              value={filterTerm}
              onChange={handleFilter}
            />
            {downloadSources.length > 0 && (
              <Button
                type="button"
                theme="outline"
                onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
                className="repacks-modal__filter-toggle"
              >
                {t("filter_by_source")}
                {isFilterDrawerOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </Button>
            )}
          </div>

          <div
            className={`repacks-modal__download-sources ${isFilterDrawerOpen ? "repacks-modal__download-sources--open" : ""}`}
          >
            <div className="repacks-modal__source-grid">
              {downloadSources
                .filter(
                  (
                    source
                  ): source is DownloadSource & { fingerprint: string } =>
                    source.fingerprint !== undefined
                )
                .map((source) => {
                  const label = source.name || source.url;
                  const truncatedLabel =
                    label.length > 16 ? label.substring(0, 16) + "..." : label;
                  return (
                    <div
                      key={source.fingerprint}
                      className="repacks-modal__source-item"
                    >
                      <CheckboxField
                        label={truncatedLabel}
                        checked={selectedFingerprints.includes(
                          source.fingerprint
                        )}
                        onChange={() => toggleFingerprint(source.fingerprint)}
                      />
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="repacks-modal__repacks">
          {filteredRepacks.length === 0 ? (
            <div className="repacks-modal__no-results">
              <div className="repacks-modal__no-results-content">
                <div className="repacks-modal__no-results-text">
                  {t("no_repacks_found")}
                </div>
                <div className="repacks-modal__no-results-button">
                  <Button
                    type="button"
                    theme="primary"
                    onClick={() => {
                      onClose();
                      navigate("/settings?tab=2");
                    }}
                  >
                    <PlusCircleIcon />
                    {t("add_download_source", { ns: "settings" })}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            groupedRepacks.map(({ source, repacks: groupRepacks }) => {
              const isCollapsed = collapsedSources.has(source);
              const newCount = groupRepacks.filter(
                (r) =>
                  userPreferences?.enableNewDownloadOptionsBadges !== false &&
                  isNewRepack(r)
              ).length;

              return (
                <div key={source} className="repacks-modal__source-group">
                  <button
                    type="button"
                    className="repacks-modal__source-header"
                    onClick={() => toggleSourceCollapse(source)}
                  >
                    <span className="repacks-modal__source-name">{source}</span>
                    <span className="repacks-modal__source-meta">
                      {newCount > 0 && (
                        <span className="repacks-modal__new-count">
                          {newCount} {t("new_download_option")}
                        </span>
                      )}
                      <span className="repacks-modal__source-count">
                        {groupRepacks.length}
                      </span>
                      {isCollapsed ? (
                        <ChevronDownIcon size={14} />
                      ) : (
                        <ChevronUpIcon size={14} />
                      )}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="repacks-modal__source-items">
                      {groupRepacks.map((repack) => {
                        const isLastDownloaded =
                          checkIfLastDownloadedOption(repack);
                        const availabilityStatus =
                          getRepackAvailabilityStatus(repack);
                        const tooltipId = `availability-orb-${repack.id}`;
                        const isNew =
                          userPreferences?.enableNewDownloadOptionsBadges !==
                            false && isNewRepack(repack);

                        return (
                          <button
                            key={repack.id}
                            type="button"
                            onClick={() => handleRepackClick(repack)}
                            className={`repacks-modal__repack-row ${isLastDownloaded ? "repacks-modal__repack-row--last-downloaded" : ""}`}
                          >
                            <span
                              className={`repacks-modal__availability-dot repacks-modal__availability-dot--${availabilityStatus}`}
                              data-tooltip-id={tooltipId}
                              data-tooltip-content={t(
                                `source_${availabilityStatus}`
                              )}
                            />
                            <Tooltip id={tooltipId} />

                            <span className="repacks-modal__repack-main">
                              <span className="repacks-modal__repack-title">
                                {repack.title}
                              </span>
                              <span className="repacks-modal__repack-details">
                                {repack.fileSize && (
                                  <span className="repacks-modal__repack-size">
                                    {repack.fileSize}
                                  </span>
                                )}
                                {repack.uploadDate && (
                                  <span className="repacks-modal__repack-date">
                                    {formatDate(repack.uploadDate)}
                                  </span>
                                )}
                              </span>
                            </span>

                            <span className="repacks-modal__repack-badges">
                              {isNew && (
                                <span className="repacks-modal__new-badge">
                                  {t("new_download_option")}
                                </span>
                              )}
                              {hashesInDebrid[
                                getHashFromMagnet(repack.uris[0]) ?? ""
                              ] && <DebridBadge collapsed />}
                              {isLastDownloaded && (
                                <span className="repacks-modal__last-used-badge">
                                  <DownloadIcon size={12} />
                                  {t("last_downloaded_option")}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </>
  );
}
