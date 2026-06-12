import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, CheckboxField, Modal } from "@renderer/components";
import "./delete-game-modal.scss";

interface DeleteGameModalProps {
  visible: boolean;
  onClose: () => void;
  deleteGame: (deleteFiles: boolean) => void;
  /* When false, the modal always deletes files (legacy "remove files" behavior) */
  showDeleteFilesCheckbox?: boolean;
}

export function DeleteGameModal({
  onClose,
  visible,
  deleteGame,
  showDeleteFilesCheckbox = true,
}: Readonly<DeleteGameModalProps>) {
  const { t } = useTranslation("downloads");

  const [deleteFiles, setDeleteFiles] = useState(true);

  useEffect(() => {
    if (visible) setDeleteFiles(true);
  }, [visible]);

  const handleDeleteGame = () => {
    deleteGame(showDeleteFilesCheckbox ? deleteFiles : true);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      title={t("delete_modal_title")}
      description={
        showDeleteFilesCheckbox
          ? t("remove_download_description")
          : t("delete_modal_description")
      }
      onClose={onClose}
    >
      <div className="delete-game-modal__content">
        {showDeleteFilesCheckbox && (
          <CheckboxField
            label={t("delete_all_files_from_disk")}
            checked={deleteFiles}
            onChange={() => setDeleteFiles(!deleteFiles)}
          />
        )}

        <div className="delete-game-modal__actions">
          <Button onClick={onClose} theme="outline">
            {t("cancel")}
          </Button>

          <Button onClick={handleDeleteGame} theme="primary">
            {showDeleteFilesCheckbox ? t("remove") : t("delete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
