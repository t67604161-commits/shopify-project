import { createFileRoute } from "@tanstack/react-router";
import {
  buildPayload,
  extractProducts,
  normalizeProduct,
  validateInput,
} from "@/lib/shopify-catalog";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

export const Route = createFileRoute("/api/public/search")({
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
        const v = validateInput(body);
        if (!v.ok) return json({ error: v.error }, 400);
        try {
          let res: Response | null = null;
          let data: any = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            res = await fetch("https://catalog.shopify.com/api/ucp/mcp", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(buildPayload(v.keyword, v.limit, v.offset)),
            });
            if (res.ok) {
              data = await res.json();
              if (!data?.error) break;
            } else await res.text().catch(() => "");
            if (res.ok || (res.status !== 429 && res.status < 500)) break;
            await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
          }
          // Upstream hiccups are reported in the body (200) so one flaky page
          // doesn't surface as a server crash; the client retries and logs it.
          if (!res || !res.ok) {
            const error = res?.status === 429 ? "Shopify is rate limiting requests, try again shortly" : `Catalog request failed (${res?.status})`;
            return json({ error, products: [], total: 0, hasNext: false });
          }
          if (data?.error) return json({ error: data.error.message ?? "Catalog error", products: [], total: 0, hasNext: false });
          const products = extractProducts(data).map(normalizeProduct);
          const pg = data?.result?.structuredContent?.pagination;
          return json({ products, total: typeof pg?.total_count === "number" ? pg.total_count : products.length, hasNext: pg?.has_next_page ?? products.length === v.limit });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
        }
      },
    },
  },
});
