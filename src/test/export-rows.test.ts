import { describe, expect, it } from "vitest";

import { buildCsv, buildTxt, csvCell, type ExportRow } from "@/lib/export-rows";

const rows: ExportRow[] = [
  {
    keyword: "memobottle.us",
    title: "Slim Memobottle, A5",
    price: "$28.00",
    url: "https://memobottle.us/products/slim-a5",
  },
  {
    keyword: "pen",
    title: 'The "Best" Pen\nGold',
    price: "N/A",
    url: "https://x.test/products/pen",
  },
];

describe("buildCsv", () => {
  it("writes a header then one line per row, in order", () => {
    expect(buildCsv([])).toBe("Keyword or store,Title,Price,Product Link\r\n");
    expect(buildCsv(rows).split("\r\n")).toEqual([
      "Keyword or store,Title,Price,Product Link",
      'memobottle.us,"Slim Memobottle, A5",$28.00,https://memobottle.us/products/slim-a5',
      'pen,"The ""Best"" Pen\nGold",N/A,https://x.test/products/pen',
      "",
    ]);
  });

  it("quotes only the cells that need it", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("buildTxt", () => {
  it("lists one product link per line and skips missing links", () => {
    expect(buildTxt(rows)).toBe(
      "https://memobottle.us/products/slim-a5\nhttps://x.test/products/pen",
    );
    expect(buildTxt([{ keyword: "pen", title: "Pen", price: "$1.00", url: "" }])).toBe("");
  });
});
