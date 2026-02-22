import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Modal } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { formatBytes } from "@shared";
import type { LibraryGame, DiskUsage } from "@types";
import { ImageIcon, TrashIcon, XIcon } from "@primer/octicons-react";
import "./settings-storage.scss";

interface DeleteConfirmation {
  game: LibraryGame;
  type: "files" | "installer";
  sizeToFree: number;
}

const SEGMENT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#d946ef",
];

export function SettingsStorage() {
  const { t } = useTranslation("settings");

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const { showSuccessToast, showErrorToast } = useToast();

  const [library, setLibrary] = useState<LibraryGame[]>([]);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [hoveredGameId, setHoveredGameId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation | null>(null);

  const fetchData = useCallback(async () => {
    const games = await window.electron.getLibrary();
    setLibrary(games);

    const downloadsPath =
      userPreferences?.downloadsPath ??
      (await window.electron.getDefaultDownloadsPath());

    if (downloadsPath) {
      const usage = await window.electron.getDiskFreeSpace(downloadsPath);
      setDiskUsage(usage);
    }

    setLoading(false);
  }, [userPreferences?.downloadsPath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const gamesWithStorage = useMemo(() => {
    return library
      .filter(
        (game) =>
          (game.installerSizeInBytes && game.installerSizeInBytes > 0) ||
          (game.installedSizeInBytes && game.installedSizeInBytes > 0)
      )
      .sort((a, b) => {
        const totalA =
          (a.installerSizeInBytes ?? 0) + (a.installedSizeInBytes ?? 0);
        const totalB =
          (b.installerSizeInBytes ?? 0) + (b.installedSizeInBytes ?? 0);
        return totalB - totalA;
      });
  }, [library]);

  const totalGamesSize = useMemo(() => {
    return gamesWithStorage.reduce((acc, game) => {
      return (
        acc +
        (game.installerSizeInBytes ?? 0) +
        (game.installedSizeInBytes ?? 0)
      );
    }, 0);
  }, [gamesWithStorage]);

  const handleDeleteGameFiles = (game: LibraryGame) => {
    const sizeToFree =
      (game.installerSizeInBytes ?? 0) + (game.installedSizeInBytes ?? 0);
    setDeleteConfirmation({ game, type: "files", sizeToFree });
  };

  const handleDeleteInstaller = (game: LibraryGame) => {
    const sizeToFree = game.installerSizeInBytes ?? 0;
    setDeleteConfirmation({ game, type: "installer", sizeToFree });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    const { game, type } = deleteConfirmation;
    setDeleteConfirmation(null);
    setDeletingGameId(game.id);

    try {
      if (type === "files") {
        await window.electron.deleteGameFolder(game.shop, game.objectId);
        showSuccessToast(t("game_files_deleted", { title: game.title }));
      } else {
        const result = await window.electron.deleteGameInstaller(
          game.shop,
          game.objectId
        );

        if (result.ok) {
          showSuccessToast(t("installer_deleted", { title: game.title }));
        } else if (result.reason === "executable_inside_installer") {
          showErrorToast(t("installer_in_use_error"));
        } else {
          showErrorToast(t("delete_files_error"));
        }
      }

      await fetchData();
    } catch {
      showErrorToast(t("delete_files_error"));
    } finally {
      setDeletingGameId(null);
    }
  };

  const spaceAfterDelete =
    diskUsage && deleteConfirmation
      ? diskUsage.free + deleteConfirmation.sizeToFree
      : 0;

  const usedSpace = diskUsage ? diskUsage.total - diskUsage.free : 0;
  const otherUsedSpace = Math.max(0, usedSpace - totalGamesSize);

  const getGameColor = (index: number) => {
    return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
  };

  const getGameCover = (game: LibraryGame) => {
    return (
      game.iconUrl?.replaceAll("\\", "/") ??
      game.coverImageUrl?.replaceAll("\\", "/") ??
      ""
    );
  };

  return (
    <div className="settings-storage">
      <div className="settings-storage__section">
        <h3 className="settings-storage__section-title">{t("disk_space")}</h3>

        {loading ? (
          <div className="settings-storage__disk-overview">
            <div className="settings-storage__disk-labels">
              <span className="settings-storage__skeleton-text settings-storage__skeleton-text--sm" />
              <span className="settings-storage__skeleton-text settings-storage__skeleton-text--sm" />
            </div>
            <div className="settings-storage__progress-bar settings-storage__progress-bar--skeleton" />
            <div className="settings-storage__disk-labels">
              <span className="settings-storage__skeleton-text settings-storage__skeleton-text--md" />
            </div>
          </div>
        ) : (
          diskUsage && (
            <div className="settings-storage__disk-overview">
              <div className="settings-storage__disk-labels">
                <span>
                  {t("used_space", { space: formatBytes(usedSpace) })}
                </span>
                <span>
                  {t("free_space", { space: formatBytes(diskUsage.free) })}
                </span>
              </div>

              <div className="settings-storage__progress-bar">
                {otherUsedSpace > 0 && (
                  <div
                    className="settings-storage__disk-segment settings-storage__disk-segment--other"
                    style={{
                      width: `${(otherUsedSpace / diskUsage.total) * 100}%`,
                    }}
                    title={`${t("other_usage")} — ${formatBytes(otherUsedSpace)}`}
                  />
                )}
                {gamesWithStorage.map((game, index) => {
                  const gameTotal =
                    (game.installerSizeInBytes ?? 0) +
                    (game.installedSizeInBytes ?? 0);
                  const percent = (gameTotal / diskUsage.total) * 100;
                  const isHovered = hoveredGameId === game.id;

                  if (percent < 0.1) return null;

                  return (
                    <div
                      key={game.id}
                      className={`settings-storage__disk-segment ${isHovered ? "settings-storage__disk-segment--hovered" : ""}`}
                      style={{
                        width: `${percent}%`,
                        backgroundColor: getGameColor(index),
                      }}
                      title={`${game.title} — ${formatBytes(gameTotal)}`}
                      onMouseEnter={() => setHoveredGameId(game.id)}
                      onMouseLeave={() => setHoveredGameId(null)}
                    />
                  );
                })}
              </div>

              <div className="settings-storage__disk-legend">
                <span>
                  {t("total_space", { space: formatBytes(diskUsage.total) })}
                </span>
                {totalGamesSize > 0 && (
                  <div className="settings-storage__legend-items">
                    {gamesWithStorage.slice(0, 5).map((game, index) => {
                      const gameTotal =
                        (game.installerSizeInBytes ?? 0) +
                        (game.installedSizeInBytes ?? 0);
                      return (
                        <div
                          key={game.id}
                          className={`settings-storage__legend-item ${hoveredGameId === game.id ? "settings-storage__legend-item--hovered" : ""}`}
                          onMouseEnter={() => setHoveredGameId(game.id)}
                          onMouseLeave={() => setHoveredGameId(null)}
                        >
                          <span
                            className="settings-storage__legend-dot"
                            style={{ backgroundColor: getGameColor(index) }}
                          />
                          <span className="settings-storage__legend-label">
                            {game.title}
                          </span>
                          <span className="settings-storage__legend-size">
                            {formatBytes(gameTotal)}
                          </span>
                        </div>
                      );
                    })}
                    {otherUsedSpace > 0 && (
                      <div className="settings-storage__legend-item">
                        <span
                          className="settings-storage__legend-dot"
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.2)",
                          }}
                        />
                        <span className="settings-storage__legend-label">
                          {t("other_usage")}
                        </span>
                        <span className="settings-storage__legend-size">
                          {formatBytes(otherUsedSpace)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <div className="settings-storage__section">
        <div className="settings-storage__section-header">
          <h3 className="settings-storage__section-title">
            {t("game_storage")}
          </h3>
          {totalGamesSize > 0 && (
            <span className="settings-storage__total-badge">
              {formatBytes(totalGamesSize)}
            </span>
          )}
        </div>

        {loading ? (
          <div className="settings-storage__game-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="settings-storage__game-row">
                <div className="settings-storage__game-info">
                  <div className="settings-storage__game-icon-wrapper settings-storage__skeleton-block" />
                  <div className="settings-storage__game-details">
                    <span className="settings-storage__skeleton-text settings-storage__skeleton-text--lg" />
                    <span className="settings-storage__skeleton-text settings-storage__skeleton-text--sm" />
                  </div>
                </div>
                <div className="settings-storage__game-right">
                  <div className="settings-storage__game-bar-wrapper">
                    <div className="settings-storage__game-bar">
                      <div
                        className="settings-storage__game-bar-fill settings-storage__skeleton-block"
                        style={{ width: `${70 - i * 20}%` }}
                      />
                    </div>
                    <span className="settings-storage__skeleton-text settings-storage__skeleton-text--xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : gamesWithStorage.length === 0 ? (
          <p className="settings-storage__empty-message">
            {t("no_games_using_storage")}
          </p>
        ) : (
          <div className="settings-storage__game-list">
            {gamesWithStorage.map((game, index) => {
              const installerSize = game.installerSizeInBytes ?? 0;
              const installedSize = game.installedSizeInBytes ?? 0;
              const totalSize = installerSize + installedSize;
              const coverImage = getGameCover(game);
              const isHovered = hoveredGameId === game.id;
              const sizePercent = (totalSize / totalGamesSize) * 100;

              return (
                <div
                  key={game.id}
                  className={`settings-storage__game-row ${isHovered ? "settings-storage__game-row--hovered" : ""}`}
                  onMouseEnter={() => setHoveredGameId(game.id)}
                  onMouseLeave={() => setHoveredGameId(null)}
                >
                  <div className="settings-storage__game-info">
                    <div className="settings-storage__game-icon-wrapper">
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt={game.title}
                          className="settings-storage__game-icon"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                            (
                              (e.target as HTMLElement)
                                .nextElementSibling as HTMLElement
                            ).style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className="settings-storage__game-icon-placeholder"
                        style={{ display: coverImage ? "none" : "flex" }}
                      >
                        <ImageIcon size={16} />
                      </div>
                    </div>

                    <div className="settings-storage__game-details">
                      <span className="settings-storage__game-title">
                        {game.title}
                      </span>
                      <div className="settings-storage__game-sizes">
                        {installerSize > 0 && (
                          <span className="settings-storage__size-tag settings-storage__size-tag--installer">
                            {t("installer_size")}: {formatBytes(installerSize)}
                            <button
                              className="settings-storage__size-tag-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteInstaller(game);
                              }}
                              disabled={deletingGameId === game.id}
                              title={t("delete_installer")}
                            >
                              <XIcon size={10} />
                            </button>
                          </span>
                        )}
                        {installedSize > 0 && (
                          <span className="settings-storage__size-tag">
                            {t("installed_size")}: {formatBytes(installedSize)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="settings-storage__game-right">
                    <div className="settings-storage__game-bar-wrapper">
                      <div className="settings-storage__game-bar">
                        <div
                          className="settings-storage__game-bar-fill"
                          style={{
                            width: `${sizePercent}%`,
                            backgroundColor: getGameColor(index),
                          }}
                        />
                      </div>
                      <span className="settings-storage__game-total">
                        {formatBytes(totalSize)}
                      </span>
                    </div>

                    <Button
                      className="settings-storage__delete-btn"
                      theme="outline"
                      onClick={() => handleDeleteGameFiles(game)}
                      disabled={deletingGameId === game.id}
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        visible={deleteConfirmation !== null}
        title={
          deleteConfirmation?.type === "installer"
            ? t("delete_installer_title")
            : t("delete_files_title")
        }
        description={
          deleteConfirmation?.type === "installer"
            ? t("confirm_delete_installer", {
                title: deleteConfirmation.game.title,
              })
            : t("confirm_delete_game_files", {
                title: deleteConfirmation?.game.title ?? "",
              })
        }
        onClose={() => setDeleteConfirmation(null)}
      >
        <div className="settings-storage__confirm-modal">
          <div className="settings-storage__confirm-info">
            <div className="settings-storage__confirm-row">
              <span className="settings-storage__confirm-label">
                {t("space_to_free")}
              </span>
              <span className="settings-storage__confirm-value settings-storage__confirm-value--free">
                {formatBytes(deleteConfirmation?.sizeToFree ?? 0)}
              </span>
            </div>

            {diskUsage && (
              <div className="settings-storage__confirm-row">
                <span className="settings-storage__confirm-label">
                  {t("space_remaining_after")}
                </span>
                <span className="settings-storage__confirm-value">
                  {formatBytes(spaceAfterDelete)}
                </span>
              </div>
            )}

            {diskUsage && (
              <div className="settings-storage__confirm-bar">
                <div
                  className="settings-storage__confirm-bar-used"
                  style={{
                    width: `${((diskUsage.total - spaceAfterDelete) / diskUsage.total) * 100}%`,
                  }}
                />
                <div
                  className="settings-storage__confirm-bar-freed"
                  style={{
                    width: `${((deleteConfirmation?.sizeToFree ?? 0) / diskUsage.total) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>

          <div className="settings-storage__confirm-actions">
            <Button theme="outline" onClick={() => setDeleteConfirmation(null)}>
              {t("cancel")}
            </Button>
            <Button theme="danger" onClick={handleConfirmDelete}>
              <TrashIcon size={14} />
              {t("confirm_delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
