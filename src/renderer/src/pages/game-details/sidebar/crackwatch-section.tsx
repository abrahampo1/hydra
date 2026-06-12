import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { useTranslation } from "react-i18next";
import type { CrackWatchStatus } from "@types";
import { SidebarSection } from "../sidebar-section/sidebar-section";
import { useDate } from "@renderer/hooks";
import "./sidebar.scss";

export interface CrackWatchSectionProps {
  data: CrackWatchStatus | null;
  isLoading: boolean;
}

export function CrackWatchSection({ data, isLoading }: CrackWatchSectionProps) {
  const { t } = useTranslation("game_details");
  const { formatDate } = useDate();

  if (!isLoading && !data) return null;

  return (
    <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
      <SidebarSection title={t("crackwatch_status")}>
        <div className="crackwatch__container">
          {data ? (
            <>
              <span
                className={`crackwatch__badge ${
                  data.isCracked
                    ? "crackwatch__badge--cracked"
                    : "crackwatch__badge--uncracked"
                }`}
              >
                {data.isCracked ? t("cracked") : t("uncracked")}
              </span>

              <div className="crackwatch__details">
                {data.protection && (
                  <div className="crackwatch__row">
                    <span className="crackwatch__label">{t("protection")}</span>
                    <span className="crackwatch__value">{data.protection}</span>
                  </div>
                )}

                {data.crackGroup && (
                  <div className="crackwatch__row">
                    <span className="crackwatch__label">
                      {t("crack_group")}
                    </span>
                    <span className="crackwatch__value">{data.crackGroup}</span>
                  </div>
                )}

                {data.crackDate && (
                  <div className="crackwatch__row">
                    <span className="crackwatch__label">{t("crack_date")}</span>
                    <span className="crackwatch__value">
                      {formatDate(data.crackDate)}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Skeleton
                className="crackwatch__skeleton"
                width={120}
                height={28}
              />
              <div className="crackwatch__details">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="crackwatch__skeleton" />
                ))}
              </div>
            </>
          )}
        </div>
      </SidebarSection>
    </SkeletonTheme>
  );
}
