"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";

const ToastContext = createContext(null);

let counter = 0;
const nextId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * App-wide toast notifications. Mount <ToastProvider> once (in the root layout);
 * anywhere below it call `const { push } = useToast()` to raise a toast.
 *
 * push({ variant, title, body, href, actionLabel, duration })
 *  - variant: "emergency" | "success" | "info" (default "info")
 *  - duration: ms before auto-dismiss (default 7000; emergency 12000). 0 = sticky.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = nextId();
    const variant = toast.variant || "info";
    const duration =
      toast.duration ?? (variant === "emergency" ? 12000 : 7000);
    setToasts((list) => [{ id, variant, duration, ...toast }, ...list].slice(0, 4));
    return id;
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function Toaster({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-1000 flex flex-col items-center gap-2 px-3 pt-3 sm:inset-x-auto sm:right-4 sm:items-end">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const STYLES = {
  emergency: {
    box: "border-emergency bg-emergency/10 text-emergency",
    icon: "🚨",
    btn: "bg-emergency text-white",
  },
  success: {
    box: "border-success/50 bg-success/10 text-success",
    icon: "✅",
    btn: "bg-success text-white",
  },
  info: {
    box: "border-primary/40 bg-surface text-text",
    icon: "🔔",
    btn: "bg-primary text-white",
  },
};

function ToastCard({ toast, onDismiss }) {
  const { id, variant, title, body, href, actionLabel, duration } = toast;
  const style = STYLES[variant] || STYLES.info;
  const timer = useRef(null);

  useEffect(() => {
    if (!duration) return;
    timer.current = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer.current);
  }, [id, duration, onDismiss]);

  return (
    <div
      role="alert"
      className={`pointer-events-auto w-full max-w-sm rounded-2xl border p-4 shadow-lg backdrop-blur animate-fade-up ${style.box} ${
        variant === "emergency" ? "animate-pulse-glow" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">{style.icon}</span>
        <div className="min-w-0 flex-1">
          {title && <p className="font-display font-semibold">{title}</p>}
          {body && <p className="mt-0.5 text-sm opacity-90">{body}</p>}
          {(href || actionLabel) && (
            <div className="mt-2.5 flex items-center gap-2">
              {href && (
                <Link
                  href={href}
                  onClick={() => onDismiss(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${style.btn}`}
                >
                  {actionLabel || "View"}
                </Link>
              )}
              <button
                type="button"
                onClick={() => onDismiss(id)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:text-text"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
        {!href && !actionLabel && (
          <button
            type="button"
            onClick={() => onDismiss(id)}
            aria-label="Dismiss"
            className="text-muted hover:text-text"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
