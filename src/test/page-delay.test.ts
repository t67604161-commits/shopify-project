import { describe, expect, it } from "vitest";

import { PAGE_DELAY_MS, pageDelay } from "@/lib/page-delay";

describe("pageDelay", () => {
  it("waits exactly 1 second between page requests", async () => {
    expect(PAGE_DELAY_MS).toBe(1000);
    const start = Date.now();
    await pageDelay();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(950);
    expect(elapsed).toBeLessThan(1500);
  });
});
