import { describe, expect, it } from "vitest";
import { parseKeywords } from "@/lib/keywords";
describe("parseKeywords", () => {
  it("removes duplicate keywords ignoring case and spacing", () => {
    expect(parseKeywords("pen, Pen\nshoes,  pen \nlinen  shirt, linen shirt")).toEqual(["pen", "shoes", "linen shirt"]);
  });
});
