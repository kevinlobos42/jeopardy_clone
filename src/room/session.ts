import { STORAGE_KEY, type StoredSession } from "../../shared/types.ts";

/** The browser's memory of "which room am I in, and who am I there". Survives refreshes. */

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredSession;
    return data.code && data.key ? data : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private browsing can block storage; the game still works, refresh just won't rejoin.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
