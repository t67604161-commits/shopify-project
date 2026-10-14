# Shopify Product Finder

Build a website Shopify Product Find. Using MPC 

1. Accept a POST request with JSON body: `{ keyword: string, limit: number, offset?: number }`

2. Validate: keyword is non-empty string, limit is between 1 and 100, offset defaults to 0

3. Make a POST request to `https://catalog.shopify.com/api/ucp/mcp` with these exact headers:

   - `Content-Type: application/json`

   - `Accept: application/json`

4. Use this exact JSON-RPC payload structure:

```json

{

  "jsonrpc": "2.0",

  "method": "tools/call",

  "id": 1,

  "params": {

    "name": "search_catalog",

    "arguments": {

      "meta": {

        "ucp-agent": {

          "profile": "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json"

        }

      },

      "catalog": {

        "query": "<keyword>",

        "pagination": {

          "limit": <limit>,

          "offset": <offset>

        }

      }

    }

  }

}

```



5. Parse the response and extract result.structuredContent.products (an array). Handle cases where this path is missing by returning an empty array.

6. For each product, return a normalized object:

   · id: product.id or generated from URL

   · title: product.title or product.name

   · url: product.url, cleaned of query parameters (strip everything after ?)

   · vendor: product.vendor or product.store or ""

   · price: formatted from product.price_range. price_range.min.amount and price_range.max.amount are in cents (smallest currency unit). Format as $X.XX or $X.XX - $Y.YY <currency> if min != max. Return "N/A" if missing.

   · image: product.image or product.featured_image or product.images[0] if available, else null

7. Return JSON: { products: [...], total: <number> }

8. Set CORS headers: Access-Control-Allow-Origin: *, Access-Control-Allow-Methods: POST, OPTIONS, Access-Control-Allow-Headers: Content-Type

9. Handle OPTIONS preflight requests by returning 200 with CORS headers

10. On any error, return { error: "<message>" } with an appropriate status code

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/70a1f338-0c57-489d-b3df-3b15450a9d53).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
