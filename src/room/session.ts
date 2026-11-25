import { STORAGE_KEY, type StoredSession } from "../../shared/types.ts";

/**
 * This tab's memory of "which room am I in, and who am I there".
 * sessionStorage is per tab: it survives a refresh, but other tabs (even
 * in the same browser) don't share it, so host + display can run side by side.
 */

export function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredSession;
    return data.code && data.key ? data : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private browsing can block storage; the game still works, refresh just won't rejoin.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
