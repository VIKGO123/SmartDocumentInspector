"use client";

import { useCallback, useSyncExternalStore } from "react";
import { CLOUD_ASSIST_KEY } from "@/lib/constants";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("cloud-assist-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("cloud-assist-change", callback);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CLOUD_ASSIST_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reusable, SSR-safe hook to read and update the Gemini Cloud Assist preference.
 * Uses React 18/19 useSyncExternalStore to eliminate cascading effect renders
 * and synchronizes state instantly across tabs and components.
 */
export function useCloudAssist(): [boolean, (enabled: boolean) => void] {
  const isEnabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setEnabled = useCallback((enabled: boolean) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(CLOUD_ASSIST_KEY, String(enabled));
    window.dispatchEvent(new Event("cloud-assist-change"));
  }, []);

  return [isEnabled, setEnabled];
}
