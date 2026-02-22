import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import "./profile-content.scss";

export type ProfileTabType = "library" | "stats" | "reviews";

interface ProfileTabsProps {
  activeTab: ProfileTabType;
  reviewsTotalCount: number;
  onTabChange: (tab: ProfileTabType) => void;
}

export function ProfileTabs({
  activeTab,
  reviewsTotalCount,
  onTabChange,
}: Readonly<ProfileTabsProps>) {
  const { t } = useTranslation("user_profile");

  const tabs: { key: ProfileTabType; label: string; badge?: number }[] = [
    { key: "library", label: t("library") },
    { key: "stats", label: t("stats") },
    {
      key: "reviews",
      label: t("user_reviews"),
      badge: reviewsTotalCount > 0 ? reviewsTotalCount : undefined,
    },
  ];

  return (
    <div className="profile-content__tabs">
      {tabs.map((tab) => (
        <div key={tab.key} className="profile-content__tab-wrapper">
          <button
            type="button"
            className={`profile-content__tab ${activeTab === tab.key ? "profile-content__tab--active" : ""}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="profile-content__tab-badge">{tab.badge}</span>
            )}
          </button>
          {activeTab === tab.key && (
            <motion.div
              className="profile-content__tab-underline"
              layoutId="tab-underline"
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
