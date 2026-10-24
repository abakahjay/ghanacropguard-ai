import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(() => {});

/** Short messages at the foot of the screen, above the phone tab bar. One at a time. */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, { tone = "warning", ms = 5000 } = {}) => {
    window.clearTimeout(timer.current);
    setToast({ message, tone, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6"
      >
        {toast && (
          <div
            key={toast.id}
            className={`pointer-events-auto flex max-w-[520px] items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-[15px] leading-[1.45] shadow-[0_8px_30px_rgba(0,0,0,0.45)] motion-safe:animate-[toastIn_220ms_var(--ease-out)] ${
              toast.tone === "danger"
                ? "bg-[var(--danger-bg)] text-[var(--danger-ink)]"
                : "bg-[var(--warning-bg)] text-[var(--warning-ink)]"
            }`}
          >
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss"
              className="-mr-1 -mt-0.5 rounded px-1.5 text-[18px] leading-none opacity-80 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
