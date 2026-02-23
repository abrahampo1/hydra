import { Button, Modal } from "@renderer/components";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HistoryIcon,
  SyncIcon,
  TrashIcon,
  UploadIcon,
} from "@primer/octicons-react";
import { CloudIcon } from "lucide-react";
import { formatBytes } from "@shared";
import type { GoogleDriveBackupArtifact } from "@types";

export interface RomCloudSyncModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RomCloudSyncModal({
  visible,
  onClose,
}: RomCloudSyncModalProps) {
  const { t } = useTranslation("roms");

  const [savesInfo, setSavesInfo] = useState<{
    sizeInBytes: number;
    lastModified: string | null;
  }>({ sizeInBytes: 0, lastModified: null });
  const [backups, setBackups] = useState<GoogleDriveBackupArtifact[]>([]);
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [info, backupList] = await Promise.all([
        window.electron.roms.getSavesInfo(),
        window.electron.roms.listSaveBackups(),
      ]);
      setSavesInfo(info);
      setBackups(backupList);
    } catch {
      // Failed to load data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

  const handleUpload = async () => {
    setUploading(true);
    try {
      await window.electron.roms.uploadSaves();
      await loadData();
    } catch {
      // Upload failed
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (artifactId: string) => {
    setRestoring(true);
    try {
      await window.electron.roms.downloadSaves(artifactId);
      await loadData();
    } catch {
      // Download failed
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async (fileName: string) => {
    setDeleting(true);
    try {
      await window.electron.roms.deleteSaveBackup(fileName);
      await loadData();
    } catch {
      // Delete failed
    } finally {
      setDeleting(false);
    }
  };

  const disableActions = uploading || restoring || deleting;

  return (
    <Modal
      visible={visible}
      title={t("cloud_saves")}
      description={t("cloud_saves_description")}
      onClose={onClose}
      large
    >
      {/* Save info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          padding: "12px 16px",
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#d0d1d7" }}>
            {t("saves_size")}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.4)" }}>
            {formatBytes(savesInfo.sizeInBytes)}
            {savesInfo.lastModified &&
              ` — ${new Date(savesInfo.lastModified).toLocaleDateString()}`}
          </span>
        </div>

        <Button
          onClick={handleUpload}
          disabled={disableActions || savesInfo.sizeInBytes === 0}
        >
          {uploading ? (
            <SyncIcon className="cloud-sync-modal__sync-icon" />
          ) : (
            <UploadIcon />
          )}
          {t("upload_saves")}
        </Button>
      </div>

      {/* Loading state */}
      {loading && backups.length === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "rgba(255, 255, 255, 0.5)",
            marginBottom: 16,
          }}
        >
          <SyncIcon size={14} className="cloud-sync-modal__sync-icon" />
          <span>{t("loading_backups")}</span>
        </div>
      )}

      {/* Backups list */}
      {!loading && backups.length > 0 && (
        <>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#d0d1d7",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              margin: "0 0 12px 0",
            }}
          >
            {t("backups")}
          </h2>

          <ul
            style={{
              display: "flex",
              gap: 8,
              flexDirection: "column",
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {backups.map((backup) => (
              <li
                key={backup.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 16px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 8,
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#f0f1f7",
                    }}
                  >
                    {new Date(backup.createdAt).toLocaleString()}
                  </span>
                  <span
                    style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.4)" }}
                  >
                    {formatBytes(backup.size ?? 0)}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Button
                    theme="outline"
                    onClick={() => handleDownload(backup.id)}
                    disabled={disableActions}
                  >
                    <HistoryIcon />
                    {t("download_saves")}
                  </Button>
                  <Button
                    theme="outline"
                    onClick={() => handleDelete(backup.id)}
                    disabled={disableActions}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Empty state */}
      {!loading && backups.length === 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
            textAlign: "center",
            gap: 12,
          }}
        >
          <CloudIcon size={40} color="rgba(255, 255, 255, 0.15)" />
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#d0d1d7",
              margin: 0,
            }}
          >
            {t("no_save_backups")}
          </h3>
        </div>
      )}
    </Modal>
  );
}
