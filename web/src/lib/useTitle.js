import { useEffect } from "react";

/** Sets the tab title as "<page> · GhanaCropGuard AI". */
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · GhanaCropGuard AI` : "GhanaCropGuard AI";
  }, [title]);
}
