/** localStorage wrapped in try/catch: private modes and blocked storage must never break the experience. */
export function readJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
const KEY_VISIT = 'wf:lastVisit', KEY_FOUND = 'wf:found', KEY_SEEN = 'wf:seenScenes';
/** Returns the previous visit time (ms) and stamps this visit. Read once per session. */
let prevVisit: number | null = null;
export function previousVisit(): number {
  if (prevVisit !== null) return prevVisit;
  prevVisit = readJSON<number>(KEY_VISIT, 0);
  writeJSON(KEY_VISIT, Date.now());
  return prevVisit;
}
export const loadFound = () => readJSON<Record<string, string[]>>(KEY_FOUND, {});
export const saveFound = (f: Record<string, string[]>) => writeJSON(KEY_FOUND, f);
export const loadSeenScenes = () => readJSON<string[]>(KEY_SEEN, []);
export const saveSeenScenes = (s: string[]) => writeJSON(KEY_SEEN, s);
