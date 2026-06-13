import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@primer/octicons-react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

import type { CatalogueSearchResult } from "@types";
import { Button } from "@renderer/components";
import { useFormat } from "@renderer/hooks";

import { ExploreCard } from "../catalogue/explore-card";
import "./search-results.scss";

const PAGE_SIZE = 24;

export default function SearchResults() {
  const { t } = useTranslation("catalogue");
  const { numberFormatter } = useFormat();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [inputValue, setInputValue] = useState(query);
  const [results, setResults] = useState<CatalogueSearchResult[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reflect the URL query into the input and reset paging when it changes
  // (e.g. when the search came from the header).
  useEffect(() => {
    setInputValue(query);
    setPage(1);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce the input into the URL query so typing searches live.
  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = inputValue.trim();
      if (trimmed !== query) {
        setSearchParams(trimmed ? { q: trimmed } : {}, { replace: true });
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [inputValue, query, setSearchParams]);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    window.electron.hydraApi
      .post<{ edges: CatalogueSearchResult[]; count: number }>(
        "/catalogue/search",
        {
          data: {
            title: trimmed,
            take: PAGE_SIZE,
            skip: (page - 1) * PAGE_SIZE,
          },
          needsAuth: false,
        }
      )
      .then((response) => {
        if (abortController.signal.aborted) return;
        setResults(response.edges);
        setCount(response.count);
      })
      .catch(() => {
        if (abortController.signal.aborted) return;
        setResults([]);
        setCount(0);
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false);
      });

    return () => abortController.abort();
  }, [query, page]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const hasQuery = query.trim().length > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    setSearchParams(trimmed ? { q: trimmed } : {}, { replace: true });
  };

  return (
    <div className="search-results">
      <form className="search-results__search-box" onSubmit={handleSubmit}>
        <SearchIcon size={18} className="search-results__search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="search-results__input"
          placeholder={t("search_placeholder")}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
      </form>

      {hasQuery && !isLoading && results.length > 0 && (
        <p className="search-results__count">
          {t("result_count", { resultCount: numberFormatter.format(count) })}
        </p>
      )}

      {isLoading ? (
        <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
          <div className="search-results__grid">
            {Array.from({ length: PAGE_SIZE }).map((_, index) => (
              <Skeleton key={index} className="search-results__skeleton" />
            ))}
          </div>
        </SkeletonTheme>
      ) : !hasQuery ? (
        <div className="search-results__empty">
          <SearchIcon size={48} />
          <h2>{t("search_prompt_title")}</h2>
          <p>{t("search_prompt_description")}</p>
        </div>
      ) : results.length === 0 ? (
        <div className="search-results__empty">
          <SearchIcon size={48} />
          <h2>{t("no_results_title")}</h2>
          <p>{t("no_results_description")}</p>
        </div>
      ) : (
        <>
          <div className="search-results__grid">
            {results.map((game, index) => (
              <ExploreCard key={game.id} game={game} index={index} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="search-results__pagination">
              <Button
                theme="outline"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeftIcon size={16} />
              </Button>
              <span className="search-results__page-indicator">
                {page} / {totalPages}
              </span>
              <Button
                theme="outline"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                <ChevronRightIcon size={16} />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
