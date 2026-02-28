import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { orderBy } from "lodash-es";
import type { GameRepack, LibraryGame } from "@types";
import { useDate } from "@renderer/hooks";
import "./bp-repacks-view.scss";

interface BpRepacksViewProps {
  repacks: GameRepack[];
  game: LibraryGame | null;
  onSelectRepack: (repack: GameRepack) => void;
}

export function BpRepacksView({
  repacks,
  game,
  onSelectRepack,
}: Readonly<BpRepacksViewProps>) {
  const { t } = useTranslation("big_picture");
  const { formatDate } = useDate();

  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(
    new Set()
  );

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

  const checkIfLastDownloadedOption = useCallback(
    (repack: GameRepack) => {
      if (!game?.download) return false;
      return repack.uris.some((uri) => uri.includes(game.download!.uri));
    },
    [game?.download]
  );

  const sortedRepacks = useMemo(() => {
    return orderBy(repacks, [(r) => r.uploadDate], ["desc"]);
  }, [repacks]);

  const groupedRepacks = useMemo(() => {
    const groups: Record<string, GameRepack[]> = {};

    for (const repack of sortedRepacks) {
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
  }, [sortedRepacks, checkIfLastDownloadedOption]);

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

  if (repacks.length === 0) {
    return (
      <div className="bp-repacks">
        <h2 className="bp-repacks__title">{t("select_repack")}</h2>
        <div className="bp-repacks__empty">{t("no_repacks")}</div>
      </div>
    );
  }

  return (
    <div className="bp-repacks">
      <h2 className="bp-repacks__title">{t("select_repack")}</h2>

      <div className="bp-repacks__list">
        {groupedRepacks.map(({ source, repacks: groupRepacks }) => {
          const isCollapsed = collapsedSources.has(source);

          return (
            <div key={source} className="bp-repacks__group">
              <button
                type="button"
                className="bp-repacks__group-header"
                data-bp-focusable
                onClick={() => toggleSourceCollapse(source)}
              >
                <span className="bp-repacks__group-name">{source}</span>
                <span className="bp-repacks__group-meta">
                  <span className="bp-repacks__group-count">
                    {groupRepacks.length}
                  </span>
                  <span className="bp-repacks__group-chevron">
                    {isCollapsed ? "\u25B6" : "\u25BC"}
                  </span>
                </span>
              </button>

              {!isCollapsed && (
                <div className="bp-repacks__items">
                  {groupRepacks.map((repack) => {
                    const status = getRepackAvailabilityStatus(repack);
                    const isLastDownloaded =
                      checkIfLastDownloadedOption(repack);

                    return (
                      <button
                        key={repack.id}
                        type="button"
                        className={`bp-repacks__row ${
                          isLastDownloaded ? "bp-repacks__row--last" : ""
                        }`}
                        data-bp-focusable
                        onClick={() => onSelectRepack(repack)}
                      >
                        <span
                          className={`bp-repacks__dot bp-repacks__dot--${status}`}
                        />
                        <span className="bp-repacks__info">
                          <span className="bp-repacks__repack-title">
                            {repack.title}
                          </span>
                          <span className="bp-repacks__details">
                            {repack.fileSize && (
                              <span className="bp-repacks__size">
                                {repack.fileSize}
                              </span>
                            )}
                            {repack.uploadDate && (
                              <span className="bp-repacks__date">
                                {formatDate(repack.uploadDate)}
                              </span>
                            )}
                            <span
                              className={`bp-repacks__status-text bp-repacks__status-text--${status}`}
                            >
                              {t(`source_${status}`)}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
