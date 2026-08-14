import type { Role } from "../../shared/types";

/**
 * Who is holding the device, which block they work in, and which language they
 * read. Kept in localStorage rather than IndexedDB because it is read
 * synchronously on first paint and it is settings, not data.
 */

export type Lang = "en" | "hi" | "mr";

export interface Session {
  role: Role | null;
  block_id: string | null;
  worker_name: string;
  reporter_id: string;
  lang: Lang;
}

const KEY = "rb.session";

const DEFAULT: Session = {
  role: null,
  block_id: null,
  worker_name: "",
  reporter_id: "",
  lang: "en",
};

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<Session>) };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveSession(patch: Partial<Session>): Session {
  const next = { ...loadSession(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

/** Demo personas, so the app has a plausible name on screen without asking a
 *  field worker to type one on a first run. */
export const DEMO_WORKERS: Record<Role, { name: string; prefix: string }> = {
  asha: { name: "Sunita Kharat", prefix: "ASHA" },
  agri: { name: "Prakash Ingle", prefix: "AGRI" },
  officer: { name: "Dr Meenal Deshpande", prefix: "BLOCK" },
};
