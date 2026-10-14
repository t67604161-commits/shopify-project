import { describe, it, expect } from "vitest";
import type { NormalizedProduct } from "@/lib/shopify-catalog";
import {
  STORE_DEFAULT_PAGES,
  STORE_MAX_PAGES,
  cleanDomain,
  extractShopName,
  parseDomains,
  storePrice,
  withShopName,
} from "@/lib/store-products";
describe("store domain parsing", () => {
  it("extracts bare domain from product URL", () => {
    expect(cleanDomain("https://www.memobottle.us/products/slim-memobottle")).toBe("memobottle.us");
  });
  it("handles www and bare forms", () => {
    expect(cleanDomain("www.memobottle.us")).toBe("memobottle.us");
    expect(cleanDomain("memobottle.us")).toBe("memobottle.us");
  });
  it("dedupes domains from text", () => {
    expect(parseDomains("memobottle.us\nhttps://www.memobottle.us/x, foo.com")).toEqual(["memobottle.us", "foo.com"]);
  });
  it("formats price ranges", () => {
    expect(storePrice({ variants: [{ price: "5.00" }, { price: "9.5" }] })).toBe("$5.00 - $9.50");
    expect(storePrice({ variants: [] })).toBe("N/A");
  });
});

describe("store page limits", () => {
  it("allows at most 30 pages per store", () => {
    expect(STORE_MAX_PAGES).toBe(30);
  });
  it("defaults to 10 pages per store", () => {
    expect(STORE_DEFAULT_PAGES).toBe(10);
    expect(STORE_DEFAULT_PAGES).toBeLessThanOrEqual(STORE_MAX_PAGES);
  });
});

describe("shop name", () => {
  it("reads the shop's own name from the catalog answer", () => {
    expect(
      extractShopName({
        ucp: {
          payment_handlers: {
            "com.google.pay": [{ config: { merchant_info: { merchant_name: " memobottle™ " } } }],
          },
        },
      }),
    ).toBe("memobottle™");
    expect(extractShopName({})).toBe("");
    expect(extractShopName(undefined)).toBe("");
  });

  it("names the shop from vendor first, then catalog name, then the domain", () => {
    const base: NormalizedProduct = {
      id: "1",
      title: "A6 memobottle",
      url: "https://memobottle.us/products/a6",
      vendor: "",
      price: "$40.00",
      image: null,
      variantId: "9",
    };
    expect(withShopName(base, "memobottle™", "memobottle.us").vendor).toBe("memobottle™");
    expect(withShopName(base, "", "memobottle.us").vendor).toBe("memobottle.us");
    expect(withShopName({ ...base, vendor: "memobottle" }, "ignored", "memobottle.us").vendor).toBe(
      "memobottle",
    );
  });
});
