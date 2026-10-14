import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { STORE_PAGE_LIMIT, cleanDomain, extractShopName, withShopName } from "@/lib/store-products";
import { normalizeProduct } from "@/lib/shopify-catalog";

const AGENT_PROFILE = "https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

const Input = z.object({
  domain: z.string().min(1).max(300),
  cursor: z.string().max(2000).optional().nullable(),
});

export const Route = createFileRoute("/api/public/store")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 200, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        const parsed = Input.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid domain or cursor" }, 400);
        const domain = cleanDomain(parsed.data.domain);
        if (!domain) return json({ error: "Invalid domain" }, 400);
        const args: any = {
          meta: { "ucp-agent": { profile: AGENT_PROFILE } },
          catalog: { query: "", limit: STORE_PAGE_LIMIT },
        };
        if (parsed.data.cursor) args.catalog.pagination = { cursor: parsed.data.cursor };
        const payload = { jsonrpc: "2.0", method: "tools/call", id: 1, params: { name: "search_catalog", arguments: args } };
        try {
          let res: Response | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            res = await fetch(`https://${domain}/api/ucp/mcp`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(payload),
            });
            if (res.status !== 429 && res.status < 500) break;
            await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
          }
          if (!res || !res.ok) {
            const msg = res?.status === 429 ? "Store is rate limiting, try again shortly" : `Store returned HTTP ${res?.status ?? "error"} (not a Shopify store?)`;
            return json({ error: msg, products: [], hasNext: false, nextCursor: null });
          }
          let data: any;
          try {
            data = await res.json();
          } catch {
            return json({ error: "Store did not return catalog data (not a Shopify store?)", products: [], hasNext: false, nextCursor: null });
          }
          const sc = data?.result?.structuredContent ?? {};
          const raw: any[] = Array.isArray(sc.products) ? sc.products : [];
          const pg = sc.pagination ?? {};
          let nextCursor: string | null = pg.cursor ?? pg.next_cursor ?? null;
          const hasNext = pg.has_next_page ?? Boolean(nextCursor);
          if (!hasNext) nextCursor = null;
          const shopName = extractShopName(sc);
          const products = raw
            .map((p) => withShopName(normalizeProduct(p), shopName, domain))
            .filter((p) => p.url);
          return json({ domain, products, count: raw.length, hasNext: Boolean(nextCursor), nextCursor });
        } catch (e) {
          console.error("store fetch failed", e);
          return json({ error: "Could not reach store", products: [], hasNext: false, nextCursor: null });
        }
      },
    },
  },
});
