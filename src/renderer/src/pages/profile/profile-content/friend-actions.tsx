import { useCallback, useContext, useState } from "react";
import { userProfileContext } from "@renderer/context";
import { useTranslation } from "react-i18next";
import { useToast, useUserDetails } from "@renderer/hooks";
import { useNavigate } from "react-router-dom";
import { BlockedIcon, XCircleFillIcon } from "@primer/octicons-react";
import "./friend-actions.scss";

export function FriendActions() {
  const { userProfile, isMe, getUserProfile } = useContext(userProfileContext);
  const { undoFriendship, blockUser } = useUserDetails();
  const { t } = useTranslation("user_profile");
  const { showSuccessToast, showErrorToast } = useToast();
  const navigate = useNavigate();
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  const handleUndoFriendship = useCallback(async () => {
    if (!userProfile) return;
    setIsPerformingAction(true);
    try {
      await undoFriendship(userProfile.id).then(getUserProfile);
    } catch (_err) {
      showErrorToast(t("try_again"));
    } finally {
      setIsPerformingAction(false);
    }
  }, [userProfile, undoFriendship, getUserProfile, showErrorToast, t]);

  const handleBlockUser = useCallback(async () => {
    if (!userProfile) return;
    setIsPerformingAction(true);
    try {
      await blockUser(userProfile.id).then(() => {
        showSuccessToast(t("user_blocked_successfully"));
        navigate(-1);
      });
    } catch (_err) {
      showErrorToast(t("try_again"));
    } finally {
      setIsPerformingAction(false);
    }
  }, [userProfile, blockUser, showSuccessToast, showErrorToast, navigate, t]);

  if (isMe || !userProfile) return null;

  const isFriend = userProfile.relation?.status === "ACCEPTED";

  return (
    <div className="friend-actions">
      {isFriend && (
        <button
          type="button"
          className="friend-actions__button"
          onClick={handleUndoFriendship}
          disabled={isPerformingAction}
        >
          <XCircleFillIcon size={13} />
          {t("undo_friendship")}
        </button>
      )}
      <button
        type="button"
        className="friend-actions__button friend-actions__button--danger"
        onClick={handleBlockUser}
        disabled={isPerformingAction}
      >
        <BlockedIcon size={13} />
        {t("block_user")}
      </button>
    </div>
  );
}
