import { describe, it, expect } from "vitest";
import { formatPrice, normalizeProduct, validateInput, extractProducts } from "@/lib/shopify-catalog";

describe("shopify catalog", () => {
  it("rejects limit above 100", () => expect(validateInput({ keyword: "a", limit: 101 }).ok).toBe(false));
  it("rejects empty keyword", () => expect(validateInput({ keyword: " ", limit: 5 }).ok).toBe(false));
  it("defaults offset to 0", () => expect(validateInput({ keyword: "a", limit: 5 })).toMatchObject({ offset: 0 }));
  it("formats single price from cents", () =>
    expect(formatPrice({ min: { amount: 1999, currency: "USD" }, max: { amount: 1999 } })).toBe("$19.99"));
  it("formats price range with currency", () =>
    expect(formatPrice({ min: { amount: 1000, currency: "USD" }, max: { amount: 2550, currency: "USD" } })).toBe("$10.00 - $25.50 USD"));
  it("returns N/A when price missing", () => expect(formatPrice(undefined)).toBe("N/A"));
  it("strips url query", () => expect(normalizeProduct({ url: "https://x.com/p?a=1" }).url).toBe("https://x.com/p"));
  it("missing products path gives empty array", () => expect(extractProducts({})).toEqual([]));
});
