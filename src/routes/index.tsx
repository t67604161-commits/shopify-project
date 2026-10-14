import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Download, ImageOff, ShoppingBag, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NormalizedProduct } from "@/lib/shopify-catalog";
import { STORE_DEFAULT_PAGES, STORE_MAX_PAGES, STORE_PAGE_LIMIT, parseDomains } from "@/lib/store-products";
import { parseKeywords } from "@/lib/keywords";

function DupCleaner({ count, noun, onClean }: { count: number; noun: string; onClean: () => void }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      <span>
        {count} unique {noun}
        {count === 1 ? "" : "s"}
      </span>
      <button type="button" onClick={onClean} disabled={!count} className="font-medium text-primary hover:underline disabled:opacity-40">
        Remove duplicates
      </button>
    </div>
  );
}
import { pageDelay } from "@/lib/page-delay";
import { buildCsv, buildTxt, type ExportRow } from "@/lib/export-rows";
import { loadRemembered, saveRemembered, type Remembered } from "@/lib/remembered";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shopify Product Fetcher" },
      { name: "description", content: "Fetch Shopify products with direct product links for many keywords at once." },
      { property: "og:title", content: "Shopify Product Fetcher" },
      { property: "og:description", content: "Fetch Shopify products with direct product links for many keywords at once." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const PER_PAGE = 20;
const MAX_PAGES = 30;

const PRICE_RANGES = {
  low: { label: "Low", min: 0, max: 10 },
  mid: { label: "Mid", min: 0, max: 20 },
  high: { label: "High", min: 0, max: 30 },
} as const;
type Tier = keyof typeof PRICE_RANGES;
type PriceKey = Tier | "custom";

type Row = NormalizedProduct & { keyword: string };

function parsePrices(price: string): number[] {
  if (!price) return [];
  const nums = price.match(/\d+(?:\.\d+)?/g);
  return nums ? nums.map(Number).filter((n) => Number.isFinite(n)) : [];
}

function priceTier(price: string): Tier | null {
  const nums = parsePrices(price);
  if (!nums.length) return null;
  const lowest = Math.min(...nums);
  if (lowest <= 10) return "low";
  if (lowest <= 20) return "mid";
  if (lowest <= 30) return "high";
  return null;
}

function inRange(price: string, min: number, max: number): boolean {
  const nums = parsePrices(price);
  if (!nums.length) return false;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return lo <= max && hi >= min;
}

function copy(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => {});
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function downloadText(text: string, filename: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: filename }).catch(() => {});
    return;
  }
  saveBlob(blob, filename);
}

async function fetchPage(keyword: string, offset: number): Promise<NormalizedProduct[]> {
  let lastError = "Search failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
    try {
      const res = await fetch("/api/public/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, limit: PER_PAGE, offset }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) return data.products ?? [];
      lastError = data.error ?? `Search failed (${res.status})`;
      if (res.status === 400) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Network error";
    }
  }
  throw new Error(lastError);
}


function Index() {
  const [keywordsText, setKeywordsText] = useState("");
  const [pages, setPages] = useState(10);
  const [rangeKey, setRangeKey] = useState<PriceKey>("mid");
  const [customMin, setCustomMin] = useState(0);
  const [customMax, setCustomMax] = useState(50);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [log, setLog] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const stopRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);
  const [mode, setMode] = useState<"keyword" | "store">("keyword");
  const [domainsText, setDomainsText] = useState("");
  const [storePages, setStorePages] = useState(STORE_DEFAULT_PAGES);
  const domains = parseDomains(domainsText);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = loadRemembered({
      pagesMax: MAX_PAGES,
      storePagesMax: STORE_MAX_PAGES,
      rangeKeys: [...(Object.keys(PRICE_RANGES) as Tier[]), "custom"],
    });
    if (saved) {
      setMode(saved.mode);
      setKeywordsText(saved.keywordsText);
      setDomainsText(saved.domainsText);
      setPages(saved.pages);
      setStorePages(saved.storePages);
      setRangeKey(saved.rangeKey as PriceKey);
      setCustomMin(saved.customMin);
      setCustomMax(saved.customMax);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const remembered: Remembered = {
      mode,
      keywordsText,
      domainsText,
      pages,
      storePages,
      rangeKey,
      customMin,
      customMax,
    };
    saveRemembered(remembered);
  }, [ready, mode, keywordsText, domainsText, pages, storePages, rangeKey, customMin, customMax]);

  const keywords = parseKeywords(keywordsText);

  const range =
    rangeKey === "custom"
      ? { min: Math.min(customMin, customMax), max: Math.max(customMin, customMax) }
      : PRICE_RANGES[rangeKey];
  const filtered = rows.filter((r) => inRange(r.price, range.min, range.max));

  async function runStores() {
    if (!domains.length) return;
    const p = Math.min(STORE_MAX_PAGES, Math.max(1, Math.floor(storePages) || 1));
    stopRef.current = false;
    setLoading(true);
    setRows([]);
    setLog([]);
    setElapsed(null);
    const started = performance.now();
    const seen = new Set<string>();
    const total = domains.length * p;
    let done = 0;
    for (const d of domains) {
      let count = 0;
      let cursor: string | null = null;
      for (let i = 1; i <= p; i++) {
        if (stopRef.current) break;
        setProgress({ done, total, current: `${d} · page ${i}` });
        try {
          const res: Response = await fetch("/api/public/store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain: d, cursor }),
          });
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok || data.error) throw new Error(data.error ?? `Fetch failed (${res.status})`);
          const list: NormalizedProduct[] = data.products ?? [];
          const fresh = list.filter((x) => {
            const key = `${d}:${x.url || x.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          count += fresh.length;
          setRows((r) => [...r, ...fresh.map((x) => ({ ...x, keyword: d }))]);
          done++;
          cursor = data.nextCursor ?? null;
          if (!cursor || fresh.length === 0) {
            done += p - i;
            break;
          }
          await pageDelay();
        } catch (e) {
          setLog((l) => [...l, `✕ ${d} page ${i}: ${e instanceof Error ? e.message : "error"}`]);
          done += p - i + 1;
          break;
        }
      }
      setLog((l) => [...l, `✓ ${d} — ${count} products`]);
      if (stopRef.current) break;
    }
    setProgress((s) => ({ ...s, done: total, current: "" }));
    setElapsed(Math.round(performance.now() - started));
    setLoading(false);
  }

  async function run() {
    if (mode === "store") return runStores();
    if (!keywords.length) return;
    const p = Math.min(MAX_PAGES, Math.max(1, Math.floor(pages) || 1));
    stopRef.current = false;
    setLoading(true);
    setRows([]);
    setLog([]);
    setElapsed(null);
    const started = performance.now();
    const seen = new Set<string>();
    const total = keywords.length * p;
    let done = 0;
    for (const kw of keywords) {
      let count = 0;
      for (let i = 0; i < p; i++) {
        if (stopRef.current) break;
        setProgress({ done, total, current: `${kw} · page ${i + 1}` });
        try {
          const list = await fetchPage(kw, i * PER_PAGE);
          const fresh = list.filter((x) => {
            const key = x.variantId ?? x.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          count += fresh.length;
          setRows((r) => [...r, ...fresh.map((x) => ({ ...x, keyword: kw }))]);
          done++;
          if (list.length < PER_PAGE) {
            done += p - i - 1;
            break;
          }
          await pageDelay();
        } catch (e) {
          setLog((l) => [...l, `✕ ${kw} page ${i + 1}: ${e instanceof Error ? e.message : "error"}`]);
          done++;
        }
      }
      setLog((l) => [...l, `✓ "${kw}" — ${count} products`]);
      if (stopRef.current) break;
    }
    setProgress((s) => ({ ...s, done: total, current: "" }));
    setElapsed(Math.round(performance.now() - started));
    setLoading(false);
  }

  const exportRows: ExportRow[] = filtered.map((r) => ({
    keyword: r.keyword,
    title: r.title,
    price: r.price,
    url: r.url,
  }));
  const productLines = buildTxt(exportRows);
  const csvText = buildCsv(exportRows);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const status = loading
    ? { label: "FETCHING", dot: "bg-status-fetching animate-pulse" }
    : elapsed != null
      ? { label: "DONE", dot: "bg-status-done" }
      : { label: "READY", dot: "bg-status-ready" };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-5 shrink-0 text-primary">
            <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z" />
          </svg>
          <span className="font-heading text-xs font-bold tracking-widest text-primary">LUIS //</span>

          <span className="font-heading font-bold">Shopify Product Fetcher</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          {status.label}
        </div>
      </header>

      <div className="grid md:grid-cols-[320px_1fr]">
        <aside className="space-y-6 border-b border-border bg-card p-5 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:border-b-0 md:border-r">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["keyword", "store"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={loading}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                    mode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {m === "keyword" ? "Keyword search" : "Store domain"}
                </button>
              ))}
            </div>
            {mode === "store" ? (
              <>
                <div>
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Store domains <span className="normal-case">(one per line or comma)</span>
                  </label>
                  <textarea
                    value={domainsText}
                    onChange={(e) => setDomainsText(e.target.value)}
                    rows={4}
                    placeholder={"memobottle.us\nwww.trueclassictees.com\nhttps://www.trueclassictees.com/products/..."}
                    className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
                  />
                  <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-ring">
                    <Upload className="size-4" /> Upload .txt file
                    <input
                      type="file"
                      accept=".txt,text/plain"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const text = await f.text();
                        setDomainsText((t) => parseDomains(`${t}\n${text}`).join("\n"));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <DupCleaner
                    count={domains.length}
                    noun="store"
                    onClean={() => setDomainsText(domains.join("\n"))}
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Max pages per store (1–{STORE_MAX_PAGES})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={STORE_MAX_PAGES}
                    value={storePages}
                    onChange={(e) => setStorePages(Math.min(STORE_MAX_PAGES, Math.max(1, Number(e.target.value) || 1)))}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">{STORE_PAGE_LIMIT} products per page</p>
                </div>
              </>
            ) : (
            <>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Keywords <span className="normal-case">(comma or one per line)</span>
              </label>
              <textarea
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                rows={4}
                placeholder={"pen, paper\nshoes\njacket"}
                className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
              />
              <DupCleaner
                count={keywords.length}
                noun="keyword"
                onClean={() => setKeywordsText(keywords.join("\n"))}
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Pages per keyword (1–{MAX_PAGES})
              </label>
              <input
                type="number"
                min={1}
                max={MAX_PAGES}
                value={pages}
                onChange={(e) => setPages(Math.min(MAX_PAGES, Math.max(1, Number(e.target.value) || 1)))}
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{PER_PAGE} products per page</p>
            </div>
            </>
            )}
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Price range
              </label>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {(Object.keys(PRICE_RANGES) as Tier[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRangeKey(k)}
                    className={`rounded-lg border px-1 py-1.5 text-xs font-semibold transition ${
                      rangeKey === k
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-ring"
                    }`}
                  >
                    {PRICE_RANGES[k].label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setRangeKey("custom")}
                className={`mt-1.5 w-full rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                  rangeKey === "custom"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-ring"
                }`}
              >
                Custom
              </button>
              {rangeKey === "custom" && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={customMin}
                    onChange={(e) => setCustomMin(Math.max(0, Number(e.target.value) || 0))}
                    aria-label="Minimum price"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">to</span>
                  <input
                    type="number"
                    min={0}
                    value={customMax}
                    onChange={(e) => setCustomMax(Math.max(0, Number(e.target.value) || 0))}
                    aria-label="Maximum price"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Showing ${range.min}–${range.max}
              </p>
            </div>
            {loading ? (
              <button
                type="button"
                onClick={() => (stopRef.current = true)}
                className="w-full rounded-lg border border-border py-2.5 text-sm font-semibold uppercase tracking-widest font-heading"
              >
                Stop
              </button>
            ) : (
              <button
                disabled={mode === "store" ? !domains.length : !keywords.length}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold uppercase tracking-widest font-heading text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                Fetch Products
              </button>
            )}
          </form>

          {(loading || progress.total > 0) && (
            <div>
              <div className="flex justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
                <span>Progress</span>
                <span className="whitespace-nowrap tracking-normal tabular-nums">{pct}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              {progress.current && <p className="mt-2 truncate text-xs text-muted-foreground">→ {progress.current}</p>}
            </div>
          )}

          {log.length > 0 && (
            <div ref={logRef} className="max-h-[120px] space-y-1 overflow-y-auto rounded-lg bg-muted p-3 text-xs">
              {log.map((l, i) => (
                <p key={i} className={l.startsWith("✕") ? "text-destructive" : "text-secondary-foreground"}>
                  {l}
                </p>
              ))}
            </div>
          )}
        </aside>

        <main className="min-w-0 p-5">
          <div className="overflow-hidden text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-2 font-sans">
                <ShoppingBag className="size-5 text-primary" />
                <h1 className="font-heading text-lg font-semibold">Product results</h1>
              </div>
              <div className="flex min-w-0 flex-wrap justify-end gap-2">
                <Btn onClick={() => copy(productLines)}><Copy />Copy All</Btn>
                <Btn onClick={() => downloadText(productLines, "product-links.txt")} disabled={!productLines}><Download />Download .txt</Btn>
                <Btn onClick={() => downloadText("\uFEFF" + csvText, "products.csv", "text/csv;charset=utf-8")} disabled={exportRows.length === 0}><Download />Download .csv</Btn>
                <Button variant="ghost" size="icon" title="Clear results" aria-label="Clear results" onClick={() => { setRows([]); setLog([]); setProgress({ done: 0, total: 0, current: "" }); setElapsed(null); }}><Trash2 /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-border px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
              <span>Results <b className="text-primary">{filtered.length}</b>{filtered.length !== rows.length && <span className="lowercase"> of {rows.length}</span>}</span>
              <span>{mode === "store" ? "Stores" : "Keywords"} <b className="text-primary">{mode === "store" ? domains.length : keywords.length}</b></span>
              {elapsed != null && <span>Time <b className="text-primary">{(elapsed / 1000).toFixed(1)}s</b></span>}
            </div>
            <div className="space-y-4 py-4 md:max-h-[calc(100vh-12rem)] md:overflow-y-auto md:pr-2">
              {rows.length === 0 ? (
                <p className="py-16 text-center text-muted-foreground">
                  {loading ? "Fetching…" : mode === "store" ? "Enter store domains and press Fetch Products." : "Enter keywords and press Fetch Products."}
                </p>
              ) : filtered.length === 0 ? (
                <p className="py-16 text-center text-muted-foreground">
                  No products in the ${range.min}–${range.max} price range.
                </p>
              ) : (
                filtered.map((p, i) => <Entry key={(p.variantId ?? p.id) + i} product={p} index={i} />)
              )}
            </div>
          </div>
        </main>
      </div>

      <footer className="flex items-center justify-center gap-1.5 border-t border-border bg-card px-5 py-4 text-center text-xs text-muted-foreground">
        <TelegramIcon className="size-3.5 shrink-0 text-primary" />
        <span>Dev: </span>

        <a
          href="https://t.me/RushVx"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          t.me/RushVx
        </a>
      </footer>
    </div>

  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.85-6.11c.73-.33 1.43.18 1.15 1.3l-2.69 12.65c-.19.85-.74 1.06-1.5.66L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

function Btn({ children, onClick, active, disabled }: { children: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean }) {

  return (
    <Button
      variant={active ? "secondary" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="font-sans shadow-none"
    >
      {children}
    </Button>
  );
}

const FIELD_LABEL =
  "shrink-0 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground";

function Entry({ product: p, index }: { product: Row; index: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const num = String(index + 1).padStart(3, "0");
  let origin = p.url;
  try {
    origin = new URL(p.url).origin;
  } catch {
    /* keep */
  }
  const shop =
    p.vendor?.trim() || origin.replace(/^https?:\/\//, "").replace(/^www\./, "") || "N/A";
  return (
    <article className="flex items-stretch gap-3 rounded-lg border border-border bg-card p-3 font-sans transition hover:border-ring sm:gap-4 sm:p-4">
      <div className="w-24 shrink-0 self-stretch overflow-hidden rounded-md bg-muted sm:w-32">
        {p.image && !imageFailed ? (
          <img src={p.image} alt={p.title || "Product"} loading="lazy" onError={() => setImageFailed(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff className="size-5" />
            <span className="text-[10px]">No image</span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{num}</span>
            <span className="truncate rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-medium tracking-tight text-secondary-foreground">{p.keyword}</span>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={async () => {
            try {
              await navigator.clipboard.writeText(`Store: ${shop}\nShop Link: ${origin}\nProduct: ${p.title}\nVariant: ${p.variantId ?? "N/A"} Price: ${p.price}\nProduct Link: ${p.url || "N/A"}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch { setCopied(false); }
          }}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</Button>
        </div>
        <h2 className="font-heading line-clamp-2 text-sm font-semibold leading-snug sm:text-base">{p.title || "N/A"}</h2>
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={FIELD_LABEL}>Store:</span>
          {origin ? <a href={origin} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-primary underline-offset-4 hover:underline">{shop}</a> : <span className="min-w-0 truncate text-muted-foreground">N/A</span>}
        </div>
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-border pt-1.5 text-xs">
          <div className="flex items-baseline gap-2">
            <dt className={FIELD_LABEL}>Variant:</dt>
            <dd className="font-mono text-xs tracking-tight text-foreground tabular-nums">{p.variantId ?? "N/A"}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className={FIELD_LABEL}>Price:</dt>
            <dd className="text-sm font-semibold text-primary tabular-nums">{p.price}</dd>
            {(() => {
              const tier = priceTier(p.price);
              return tier ? (
                <dd className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
                  {PRICE_RANGES[tier].label}
                </dd>
              ) : null;
            })()}
          </div>
        </dl>
        {p.url && (
          <div className="border-t border-border pt-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className={FIELD_LABEL}>Product Link:</span>
              <Button asChild size="sm" variant="secondary" className="shrink-0"><a href={p.url} target="_blank" rel="noreferrer">View Product<ArrowUpRight /></a></Button>
            </div>
            <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 block min-w-0 truncate font-mono text-[11px] tracking-tight text-accent-foreground underline-offset-4 hover:underline">{p.url}</a>
          </div>
        )}
      </div>
    </article>
  );
}
