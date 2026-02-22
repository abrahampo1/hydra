import { useTranslation } from "react-i18next";
import { Button, Modal } from "@renderer/components";
import { formatBytes } from "@shared";

interface ArchiveDeletionModalProps {
  visible: boolean;
  archivePaths: string[];
  totalSizeInBytes: number;
  onClose: () => void;
}

export function ArchiveDeletionModal({
  visible,
  archivePaths,
  totalSizeInBytes,
  onClose,
}: Readonly<ArchiveDeletionModalProps>) {
  const { t } = useTranslation("downloads");

  const fullFileName =
    archivePaths.length > 0 ? (archivePaths[0].split(/[/\\]/).pop() ?? "") : "";

  const maxLength = 40;
  const fileName =
    fullFileName.length > maxLength
      ? `${fullFileName.slice(0, maxLength)}…`
      : fullFileName;

  const handleConfirm = async () => {
    for (const archivePath of archivePaths) {
      await window.electron.deleteArchive(archivePath);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      title={t("delete_archive_title", { fileName })}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p style={{ margin: 0 }}>{t("delete_archive_description")}</p>

        {totalSizeInBytes > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: "4px",
              backgroundColor: "var(--color-dark-15)",
            }}
          >
            <span>{t("space_to_free_label")}</span>
            <span style={{ fontWeight: "bold" }}>
              {formatBytes(totalSizeInBytes)}
            </span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <Button theme="outline" onClick={onClose}>
            {t("no")}
          </Button>
          <Button theme="danger" onClick={handleConfirm}>
            {t("yes")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
