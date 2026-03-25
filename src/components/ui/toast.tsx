"use client";

import { useCallback, useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastVariant = "info" | "success" | "error" | "loading";

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number; // ms, default 5000; 0 = persistent
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => string;
  dismissToast: (id: string) => void;
  updateToast: (id: string, message: string, variant?: ToastVariant, duration?: number) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Single Toast item
// ---------------------------------------------------------------------------

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (toast.duration === 0) return; // persistent
    const ms = toast.duration ?? 5000;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, ms);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const Icon =
    toast.variant === "success"
      ? CheckCircle2
      : toast.variant === "error"
        ? AlertTriangle
        : toast.variant === "loading"
          ? Loader2
          : Info;

  const iconColor =
    toast.variant === "success"
      ? "text-emerald-500"
      : toast.variant === "error"
        ? "text-red-500"
        : toast.variant === "loading"
          ? "text-[#5B22FF]"
          : "text-blue-500";

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all duration-300",
        "bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]",
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
      )}
      style={{ minWidth: 320, maxWidth: 440 }}
    >
      <Icon
        className={cn(
          "h-4.5 w-4.5 mt-0.5 shrink-0",
          iconColor,
          toast.variant === "loading" && "animate-spin",
        )}
      />
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider + Renderer
// ---------------------------------------------------------------------------

let _counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", duration?: number): string => {
      const id = `toast-${++_counter}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      return id;
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback(
    (id: string, message: string, variant?: ToastVariant, duration?: number) => {
      setToasts((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, message, variant: variant ?? t.variant, duration: duration ?? t.duration }
            : t,
        ),
      );
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, updateToast }}>
      {children}
      {/* Toast container — top-right fixed */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
