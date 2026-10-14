export type ExportRow = {
  keyword: string;
  title: string;
  price: string;
  url: string;
};

const CSV_HEADER = ["Keyword or store", "Title", "Price", "Product Link"];

export function csvCell(value: string): string {
  const v = typeof value === "string" ? value : "";
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function buildCsv(rows: ExportRow[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([r.keyword, r.title, r.price, r.url].map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function buildTxt(rows: ExportRow[]): string {
  return rows.map((r) => r.url).filter(Boolean).join("\n");
}
