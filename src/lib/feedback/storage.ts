import { useCallback, useEffect, useState } from "react";

import type { SavedView } from "./types";

const STORAGE_KEY = "voxpulse:views";

function read(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(views: SavedView[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  window.dispatchEvent(new CustomEvent("feedback-views-changed"));
}

export function useSavedViews() {
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setViews(read());
    const onChange = () => setViews(read());
    window.addEventListener("feedback-views-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("feedback-views-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const save = useCallback((view: SavedView) => {
    const all = read();
    const idx = all.findIndex((v) => v.id === view.id);
    if (idx >= 0) all[idx] = view;
    else all.unshift(view);
    write(all);
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((v) => v.id !== id));
  }, []);

  const rename = useCallback((id: string, name: string) => {
    const all = read();
    const v = all.find((x) => x.id === id);
    if (v) {
      v.name = name;
      write(all);
    }
  }, []);

  const get = useCallback((id: string): SavedView | undefined => {
    return read().find((v) => v.id === id);
  }, []);

  return { views, save, remove, rename, get };
}

export function getViewSync(id: string): SavedView | undefined {
  return read().find((v) => v.id === id);
}

export function newViewId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
