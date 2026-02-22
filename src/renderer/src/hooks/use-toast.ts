import { useCallback } from "react";
import { sileo } from "sileo";

export function useToast() {
  const showSuccessToast = useCallback(
    (title: string, description?: string, duration?: number) => {
      sileo.success({ title, description, duration: duration ?? 3000 });
    },
    []
  );

  const showErrorToast = useCallback(
    (title: string, description?: string, duration?: number) => {
      sileo.error({ title, description, duration: duration ?? 4000 });
    },
    []
  );

  const showWarningToast = useCallback(
    (title: string, description?: string, duration?: number) => {
      sileo.warning({ title, description, duration: duration ?? 3500 });
    },
    []
  );

  return { showSuccessToast, showErrorToast, showWarningToast };
}
