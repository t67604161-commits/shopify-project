import type { NormalizedProduct } from "./shopify-catalog";

export const STORE_PAGE_LIMIT = 50;
export const STORE_MAX_PAGES = 30;
export const STORE_DEFAULT_PAGES = 10;

/** Turns any URL / domain-ish string into a bare host like "memobottle.us". */
export function cleanDomain(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let host: string;
  try {
    host = new URL(s).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
  if (host.endsWith(".local") || host.endsWith(".internal")) return null;
  return host;
}

/** Extracts unique domains from free text (comma, newline or space separated). */
export function parseDomains(text: string): string[] {
  const out = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    const d = cleanDomain(part);
    if (d) out.add(d);
  }
  return [...out];
}

export function storePrice(product: any): string {
  const prices: number[] = [];
  for (const v of product?.variants ?? []) {
    const n = parseFloat(v?.price);
    if (!Number.isNaN(n)) prices.push(n);
  }
  if (!prices.length) return "N/A";
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? `$${lo.toFixed(2)}` : `$${lo.toFixed(2)} - $${hi.toFixed(2)}`;
}

/** The shop's own name, when the store's catalog answer carries one. */
export function extractShopName(sc: any): string {
  const handlers = sc?.ucp?.payment_handlers;
  if (handlers && typeof handlers === "object") {
    for (const entry of Object.values(handlers as Record<string, unknown>)) {
      const list = Array.isArray(entry) ? entry : [entry];
      for (const item of list) {
        const name = (item as any)?.config?.merchant_info?.merchant_name;
        if (typeof name === "string" && name.trim()) return name.trim();
      }
    }
  }
  return "";
}

/** Names the product's shop: its own vendor, else the catalog's shop name, else the domain. */
export function withShopName(product: NormalizedProduct, shopName: string, domain: string): NormalizedProduct {
  const name = product.vendor?.trim() || shopName.trim() || domain;
  return { ...product, vendor: name };
}
