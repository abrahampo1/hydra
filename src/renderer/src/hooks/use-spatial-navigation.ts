import { useCallback, useRef, useState } from "react";
import type { GamepadDirection } from "./use-gamepad";

const FOCUSABLE_SELECTOR = "[data-bp-focusable]";

export function useSpatialNavigation() {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const savedPositions = useRef<Record<string, number>>({});

  const getFocusableElements = useCallback((): HTMLElement[] => {
    return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR));
  }, []);

  const applyFocus = useCallback(
    (index: number) => {
      const elements = getFocusableElements();
      elements.forEach((el) => el.removeAttribute("data-bp-focused"));

      if (elements[index]) {
        elements[index].setAttribute("data-bp-focused", "true");

        // First focusable element: scroll container to top so hero is fully visible
        if (index === 0) {
          const scrollContainer = document.querySelector(
            ".big-picture__content"
          );
          if (scrollContainer) {
            scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
          }
        } else {
          elements[index].scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
        }
      }

      setFocusedIndex(index);
    },
    [getFocusableElements]
  );

  const navigate = useCallback(
    (direction: GamepadDirection) => {
      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const current = elements[focusedIndex];
      if (!current) {
        applyFocus(0);
        return;
      }

      const currentRect = current.getBoundingClientRect();
      let bestIndex = -1;
      let bestDistance = Infinity;

      for (let i = 0; i < elements.length; i++) {
        if (i === focusedIndex) continue;

        const rect = elements[i].getBoundingClientRect();
        const cx = currentRect.left + currentRect.width / 2;
        const cy = currentRect.top + currentRect.height / 2;
        const tx = rect.left + rect.width / 2;
        const ty = rect.top + rect.height / 2;

        let isInDirection = false;

        switch (direction) {
          case "up":
            isInDirection = ty < cy - 5;
            break;
          case "down":
            isInDirection = ty > cy + 5;
            break;
          case "left":
            isInDirection = tx < cx - 5;
            break;
          case "right":
            isInDirection = tx > cx + 5;
            break;
        }

        if (!isInDirection) continue;

        const dx = tx - cx;
        const dy = ty - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        applyFocus(bestIndex);
      }
    },
    [focusedIndex, getFocusableElements, applyFocus]
  );

  const select = useCallback(() => {
    const elements = getFocusableElements();
    if (elements[focusedIndex]) {
      elements[focusedIndex].click();
    }
  }, [focusedIndex, getFocusableElements]);

  const savePosition = useCallback(
    (section: string) => {
      savedPositions.current[section] = focusedIndex;
    },
    [focusedIndex]
  );

  const restorePosition = useCallback(
    (section: string) => {
      const saved = savedPositions.current[section];
      if (saved !== undefined) {
        applyFocus(saved);
      } else {
        applyFocus(0);
      }
    },
    [applyFocus]
  );

  const resetFocus = useCallback(() => {
    applyFocus(0);
  }, [applyFocus]);

  return {
    focusedIndex,
    navigate,
    select,
    savePosition,
    restorePosition,
    resetFocus,
  };
}
