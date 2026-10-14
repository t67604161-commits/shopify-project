import { describe, expect, it } from "vitest";

import { sanitizeRemembered } from "@/lib/remembered";

const bounds = {
  pagesMax: 30,
  storePagesMax: 30,
  rangeKeys: ["low", "mid", "high", "custom"],
};

describe("sanitizeRemembered", () => {
  it("falls back to defaults when nothing usable was stored", () => {
    expect(sanitizeRemembered(null, bounds)).toEqual({
      mode: "keyword",
      keywordsText: "",
      domainsText: "",
      pages: 10,
      storePages: 10,
      rangeKey: "mid",
      customMin: 0,
      customMax: 50,
    });
    expect(
      sanitizeRemembered({ pages: "abc", rangeKey: "bogus", mode: "x" }, bounds),
    ).toMatchObject({ pages: 10, rangeKey: "mid", mode: "keyword" });
  });

  it("keeps stored values and clamps page counts into range", () => {
    expect(
      sanitizeRemembered(
        {
          mode: "store",
          domainsText: "memobottle.us",
          pages: 99,
          storePages: 4.9,
          rangeKey: "high",
          customMin: -5,
          customMax: 12,
        },
        bounds,
      ),
    ).toEqual({
      mode: "store",
      keywordsText: "",
      domainsText: "memobottle.us",
      pages: 30,
      storePages: 4,
      rangeKey: "high",
      customMin: 0,
      customMax: 12,
    });
  });
});
