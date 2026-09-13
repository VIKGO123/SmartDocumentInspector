"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type ToastType = "info" | "success" | "error" | "loading";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number; // ms, default 4000 (0 for indefinite/loading)
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
  toast: {
    info: (message: string, title?: string) => string;
    success: (message: string, title?: string) => string;
    error: (message: string, title?: string) => string;
    loading: (message: string, title?: string) => string;
    dismiss: (id: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Strips leading emojis and decorative symbols from titles/messages
 * to prevent double-icon appearance in toasts.
 */
function cleanToastText(text?: string): string {
  if (!text) return "";
  return text
    .replace(/^[\p{Extended_Pictographic}\u200d\uFE0F✓✕ℹ✗\s\-–—:]+/u, "")
    .trim();
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toastData: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const duration = toastData.duration ?? (toastData.type === "loading" ? 0 : 4500);

      const rawTitle = toastData.title ? cleanToastText(toastData.title) : undefined;
      let rawMessage = cleanToastText(toastData.message);

      // Prevent duplicate title keywords in message (e.g. Title: "Deleted", Message: "Deleted file.pdf")
      if (rawTitle && rawMessage.toLowerCase().startsWith(`${rawTitle.toLowerCase()} `)) {
        rawMessage = rawMessage.slice(rawTitle.length).trim();
      }

      const newItem: ToastItem = {
        ...toastData,
        title: rawTitle,
        message: rawMessage,
        id,
        duration,
      };

      setToasts((prev) => [...prev.slice(-4), newItem]); // Keep max 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast],
  );

  const toastHelpers = {
    info: (message: string, title?: string) => showToast({ type: "info", message, title }),
    success: (message: string, title?: string) => showToast({ type: "success", message, title }),
    error: (message: string, title?: string) => showToast({ type: "error", message, title }),
    loading: (message: string, title?: string) => showToast({ type: "loading", message, title, duration: 0 }),
    dismiss: dismissToast,
  };

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast,
        toast: toastHelpers,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="toast-container"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 420,
        width: "calc(100vw - 32px)",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case "error":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case "loading":
        return (
          <span
            className="toast-spinner"
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2px solid #3b82f6",
              borderTopColor: "transparent",
              display: "inline-block",
            }}
          />
        );
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case "success":
        return "#10b981";
      case "error":
        return "#ef4444";
      case "loading":
        return "#3b82f6";
      default:
        return "#6366f1";
    }
  };

  return (
    <div
      className="toast-card"
      style={{
        pointerEvents: "auto",
        background: "var(--color-bg-card, #ffffff)",
        color: "var(--color-ink, #0f172a)",
        borderRadius: 12,
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
        border: "1px solid var(--color-border, #e2e8f0)",
        borderLeft: `4px solid ${getBorderColor()}`,
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        animation: "toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>{getIcon()}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 2 }}>
            {toast.title}
          </div>
        )}
        <div style={{ fontSize: "0.875rem", lineHeight: 1.45, color: "var(--color-ink, #334155)", wordBreak: "break-word" }}>
          {toast.message}
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close notification"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#94a3b8",
          fontSize: "1.1rem",
          lineHeight: 1,
          padding: 2,
          marginLeft: 4,
          borderRadius: 4,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
