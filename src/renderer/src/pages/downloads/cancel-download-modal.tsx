import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, CheckboxField, Modal } from "@renderer/components";
import "./cancel-download-modal.scss";

interface CancelDownloadModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (deleteFiles: boolean) => void;
}

export function CancelDownloadModal({
  visible,
  onClose,
  onConfirm,
}: Readonly<CancelDownloadModalProps>) {
  const { t } = useTranslation("downloads");

  const [deleteFiles, setDeleteFiles] = useState(true);

  useEffect(() => {
    if (visible) setDeleteFiles(true);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      title={t("cancel_download")}
      description={t("cancel_download_confirmation")}
      onClose={onClose}
    >
      <div className="cancel-download-modal">
        <CheckboxField
          label={t("delete_files_from_disk")}
          checked={deleteFiles}
          onChange={() => setDeleteFiles(!deleteFiles)}
        />

        <div className="cancel-download-modal__actions">
          <Button onClick={onClose} theme="outline">
            {t("keep_downloading")}
          </Button>

          <Button onClick={() => onConfirm(deleteFiles)} theme="primary">
            {t("yes_cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
