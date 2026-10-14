export type Remembered = {
  mode: "keyword" | "store";
  keywordsText: string;
  domainsText: string;
  pages: number;
  storePages: number;
  rangeKey: string;
  customMin: number;
  customMax: number;
};

export type RememberBounds = {
  pagesMax: number;
  storePagesMax: number;
  rangeKeys: readonly string[];
};

const KEY = "shopify-fetcher:inputs:v1";

const DEFAULTS: Remembered = {
  mode: "keyword",
  keywordsText: "",
  domainsText: "",
  pages: 10,
  storePages: 10,
  rangeKey: "mid",
  customMin: 0,
  customMax: 50,
};

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function sanitizeRemembered(raw: unknown, bounds: RememberBounds): Remembered {
  const o: Record<string, unknown> = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rangeKey = text(o["rangeKey"], DEFAULTS.rangeKey);
  return {
    mode: o["mode"] === "store" ? "store" : "keyword",
    keywordsText: text(o["keywordsText"], ""),
    domainsText: text(o["domainsText"], ""),
    pages: number(o["pages"], DEFAULTS.pages, 1, bounds.pagesMax),
    storePages: number(o["storePages"], DEFAULTS.storePages, 1, bounds.storePagesMax),
    rangeKey: bounds.rangeKeys.includes(rangeKey) ? rangeKey : DEFAULTS.rangeKey,
    customMin: number(o["customMin"], DEFAULTS.customMin, 0, Number.MAX_SAFE_INTEGER),
    customMax: number(o["customMax"], DEFAULTS.customMax, 0, Number.MAX_SAFE_INTEGER),
  };
}

export function loadRemembered(bounds: RememberBounds): Remembered | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return sanitizeRemembered(JSON.parse(raw), bounds);
  } catch {
    return null;
  }
}

export function saveRemembered(remembered: Remembered): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(remembered));
  } catch {
    /* private mode or full storage — inputs simply aren't remembered */
  }
}
