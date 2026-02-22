import { SearchIcon, AppsIcon, RowsIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import { SortOptions } from "./sort-options";
import "./library-controls.scss";

type SortOption = "playtime" | "achievementCount" | "playedRecently";
type ViewMode = "grid" | "list";

interface LibraryControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sortBy: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function LibraryControls({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: Readonly<LibraryControlsProps>) {
  const { t } = useTranslation("user_profile");

  return (
    <div className="library-controls__container">
      <div className="library-controls__search">
        <SearchIcon size={14} className="library-controls__search-icon" />
        <input
          type="text"
          className="library-controls__search-input"
          placeholder={t("search_library")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <SortOptions sortBy={sortBy} onSortChange={onSortChange} />

      <div className="library-controls__spacer" />

      <div className="library-controls__view-toggle">
        <button
          type="button"
          className={`library-controls__view-button ${viewMode === "grid" ? "library-controls__view-button--active" : ""}`}
          onClick={() => onViewModeChange("grid")}
          title={t("grid_view")}
        >
          <AppsIcon size={16} />
        </button>
        <button
          type="button"
          className={`library-controls__view-button ${viewMode === "list" ? "library-controls__view-button--active" : ""}`}
          onClick={() => onViewModeChange("list")}
          title={t("list_view")}
        >
          <RowsIcon size={16} />
        </button>
      </div>
    </div>
  );
}
