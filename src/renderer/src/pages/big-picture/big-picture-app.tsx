import {
  useCallback,
  useEffect,
  useRef,
  createContext,
  useContext,
} from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGamepad } from "@renderer/hooks/use-gamepad";
import { useSpatialNavigation } from "@renderer/hooks/use-spatial-navigation";
import { useAppSelector, useBigPicture } from "@renderer/hooks";
import { BigPictureNavbar } from "./big-picture-navbar";
import "./big-picture-app.scss";

const sections = [
  "/big-picture",
  "/big-picture/catalogue",
  "/big-picture/downloads",
  "/big-picture/settings",
] as const;

interface BigPictureContextValue {
  activeSection: number;
  navigateSection: (direction: "prev" | "next") => void;
  exitBigPicture: () => void;
  registerBackHandler: (handler: () => boolean) => void;
  unregisterBackHandler: () => void;
  registerSectionHandler: (
    handler: (direction: "prev" | "next") => boolean
  ) => void;
  unregisterSectionHandler: () => void;
  registerPageHandler: (
    handler: (direction: "prev" | "next") => boolean
  ) => void;
  unregisterPageHandler: () => void;
}

const BigPictureContext = createContext<BigPictureContextValue>({
  activeSection: 0,
  navigateSection: () => {},
  exitBigPicture: () => {},
  registerBackHandler: () => {},
  unregisterBackHandler: () => {},
  registerSectionHandler: () => {},
  unregisterSectionHandler: () => {},
  registerPageHandler: () => {},
  unregisterPageHandler: () => {},
});

export const useBigPictureContext = () => useContext(BigPictureContext);

export default function BigPictureApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("big_picture");
  const { exitBigPicture } = useBigPicture();
  const {
    navigate: spatialNavigate,
    select,
    resetFocus,
  } = useSpatialNavigation();

  const backHandlerRef = useRef<(() => boolean) | null>(null);
  const sectionHandlerRef = useRef<
    ((direction: "prev" | "next") => boolean) | null
  >(null);
  const pageHandlerRef = useRef<
    ((direction: "prev" | "next") => boolean) | null
  >(null);

  const gameRunning = useAppSelector((state) => state.gameRunning.gameRunning);
  const prevGameRunningRef = useRef(gameRunning);

  useEffect(() => {
    const wasRunning = prevGameRunningRef.current !== null;
    const isNowStopped = gameRunning === null;

    if (wasRunning && isNowStopped) {
      window.electron.openMainWindow();
    }

    prevGameRunningRef.current = gameRunning;
  }, [gameRunning]);

  const registerBackHandler = useCallback((handler: () => boolean) => {
    backHandlerRef.current = handler;
  }, []);

  const unregisterBackHandler = useCallback(() => {
    backHandlerRef.current = null;
  }, []);

  const registerSectionHandler = useCallback(
    (handler: (direction: "prev" | "next") => boolean) => {
      sectionHandlerRef.current = handler;
    },
    []
  );

  const unregisterSectionHandler = useCallback(() => {
    sectionHandlerRef.current = null;
  }, []);

  const registerPageHandler = useCallback(
    (handler: (direction: "prev" | "next") => boolean) => {
      pageHandlerRef.current = handler;
    },
    []
  );

  const unregisterPageHandler = useCallback(() => {
    pageHandlerRef.current = null;
  }, []);

  const activeSection = sections.findIndex((s) => location.pathname === s);
  const isGameDetail = location.pathname.includes("/game/");

  const handleBack = useCallback(() => {
    if (backHandlerRef.current?.()) return;
    if (isGameDetail) {
      navigate(-1);
    } else {
      exitBigPicture();
    }
  }, [isGameDetail, navigate, exitBigPicture]);

  const navigateSection = useCallback(
    (direction: "prev" | "next") => {
      if (sectionHandlerRef.current?.(direction)) return;
      if (isGameDetail) return;

      const current = activeSection === -1 ? 0 : activeSection;
      const next =
        direction === "prev"
          ? Math.max(0, current - 1)
          : Math.min(sections.length - 1, current + 1);

      if (next !== current) {
        navigate(sections[next]);
        resetFocus();
      }
    },
    [activeSection, isGameDetail, navigate, resetFocus]
  );

  const MAX_SCROLL_SPEED = 18;

  const applyScrollCurve = useCallback((value: number) => {
    const sign = Math.sign(value);
    const abs = Math.abs(value);
    return sign * abs * abs * MAX_SCROLL_SPEED;
  }, []);

  const handleGamepadAction = useCallback(
    (action: {
      type: string;
      direction?: string;
      dx?: number;
      dy?: number;
    }) => {
      switch (action.type) {
        case "navigate":
          spatialNavigate(action.direction as "up" | "down" | "left" | "right");
          break;
        case "select":
          select();
          break;
        case "back":
          handleBack();
          break;
        case "section-prev":
          navigateSection("prev");
          break;
        case "section-next":
          navigateSection("next");
          break;
        case "page-prev":
          pageHandlerRef.current?.("prev");
          break;
        case "page-next":
          pageHandlerRef.current?.("next");
          break;
        case "menu":
          exitBigPicture();
          break;
        case "scroll": {
          const container = document.querySelector(".big-picture__content");
          if (container) {
            container.scrollBy(
              applyScrollCurve(action.dx ?? 0),
              applyScrollCurve(action.dy ?? 0)
            );
          }
          break;
        }
      }
    },
    [
      spatialNavigate,
      select,
      exitBigPicture,
      navigateSection,
      handleBack,
      applyScrollCurve,
    ]
  );

  useGamepad({
    enabled: true,
    onAction: handleGamepadAction,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          handleBack();
          break;
        case "ArrowUp":
          spatialNavigate("up");
          e.preventDefault();
          break;
        case "ArrowDown":
          spatialNavigate("down");
          e.preventDefault();
          break;
        case "ArrowLeft":
          spatialNavigate("left");
          e.preventDefault();
          break;
        case "ArrowRight":
          spatialNavigate("right");
          e.preventDefault();
          break;
        case "Enter":
          select();
          e.preventDefault();
          break;
        case "Backspace":
          handleBack();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [spatialNavigate, select, handleBack]);

  useEffect(() => {
    resetFocus();
  }, [location.pathname, resetFocus]);

  return (
    <BigPictureContext.Provider
      value={{
        activeSection,
        navigateSection,
        exitBigPicture,
        registerBackHandler,
        unregisterBackHandler,
        registerSectionHandler,
        unregisterSectionHandler,
        registerPageHandler,
        unregisterPageHandler,
      }}
    >
      <div className="big-picture">
        <BigPictureNavbar />
        <div className="big-picture__content" key={location.pathname}>
          <Outlet />
        </div>
        <div className="bp-controller-hints">
          <div className="bp-controller-hints__hint">
            <span className="bp-controller-hints__badge">A</span>
            {t("press_a_select")}
          </div>
          <div className="bp-controller-hints__hint">
            <span className="bp-controller-hints__badge">B</span>
            {isGameDetail ? t("press_b_back") : t("exit_big_picture")}
          </div>
          {!isGameDetail && (
            <>
              <div className="bp-controller-hints__hint">
                <span className="bp-controller-hints__badge">LB</span>
                <span className="bp-controller-hints__badge">RB</span>
                {t("navigate_sections")}
              </div>
            </>
          )}
        </div>
      </div>
    </BigPictureContext.Provider>
  );
}
