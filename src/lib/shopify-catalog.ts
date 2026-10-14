export type NormalizedProduct = {
  id: string;
  title: string;
  url: string;
  vendor: string;
  price: string;
  image: string | null;
  variantId: string | null;
};

const PROFILE =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";

export function validateInput(body: unknown):
  | { ok: true; keyword: string; limit: number; offset: number }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object" };
  const b = body as any;
  if (typeof b.keyword !== "string" || !b.keyword.trim())
    return { ok: false, error: "keyword must be a non-empty string" };
  if (typeof b.limit !== "number" || !Number.isInteger(b.limit) || b.limit < 1 || b.limit > 100)
    return { ok: false, error: "limit must be an integer between 1 and 100" };
  const offset = b.offset ?? 0;
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0)
    return { ok: false, error: "offset must be a non-negative integer" };
  return { ok: true, keyword: b.keyword.trim(), limit: b.limit, offset };
}

export function offsetCursor(offset: number) {
  return btoa(JSON.stringify({ offset })).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function buildPayload(keyword: string, limit: number, offset: number) {
  return {
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
    params: {
      name: "search_catalog",
      arguments: {
        meta: { "ucp-agent": { profile: PROFILE } },
        catalog: {
          query: keyword,
          pagination: offset > 0 ? { limit, cursor: offsetCursor(offset) } : { limit },
        },
      },
    },
  };
}

const toUrl = (v: unknown): string | null => {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object") {
    const o = v as any;
    const u = o.url ?? o.src;
    if (typeof u === "string" && u) return u;
  }
  return null;
};

export function formatPrice(pr: any): string {
  const min = pr?.min?.amount;
  const max = pr?.max?.amount;
  if (min == null || isNaN(Number(min))) return "N/A";
  const currency = pr?.min?.currency ?? pr?.max?.currency ?? "";
  const fmt = (c: unknown) => `$${(Number(c) / 100).toFixed(2)}`;
  if (max != null && !isNaN(Number(max)) && Number(max) !== Number(min))
    return `${fmt(min)} - ${fmt(max)}${currency ? ` ${currency}` : ""}`;
  return fmt(min);
}

export function normalizeProduct(p: any): NormalizedProduct {
  const v0 = Array.isArray(p?.variants) ? p.variants[0] : undefined;
  const rawUrl = typeof p?.url === "string" ? p.url : typeof v0?.url === "string" ? v0.url : "";
  const url = rawUrl.split("?")[0];
  const id =
    (p?.id != null && String(p.id)) ||
    url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    Math.random().toString(36).slice(2);
  const rawVariant = v0?.id ?? p?.variant_id;
  const variantId =
    rawVariant != null ? String(rawVariant).split("/").pop() || null : null;
  return {
    id,
    title: p?.title ?? p?.name ?? "",
    url,
    vendor: p?.vendor ?? p?.store ?? v0?.seller?.name ?? "",
    price: formatPrice(p?.price_range),
    image:
      toUrl(p?.image) ??
      toUrl(p?.featured_image) ??
      (Array.isArray(p?.images) ? toUrl(p.images[0]) : null) ??
      (Array.isArray(p?.media) ? toUrl(p.media[0]) : null),
    variantId,
  };
}

export function extractProducts(json: any): any[] {
  const list = json?.result?.structuredContent?.products;
  return Array.isArray(list) ? list : [];
}
