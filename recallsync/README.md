# RecallSync Integration (system layer)

This folder documents how AIOS extends and operates the **RecallSync** platform through the
primary MCP. It is the *system / engineering* layer — distinct from `/sops` (business operations).

## The three repos in the chain

```
AIOS (this repo)  ──MCP (StreamableHTTP /mcp)──▶  recallsync-mcp  ──REST (Bearer api_key)──▶  recallsync-app  ──Prisma──▶  DB
   Cursor calls tool          forwards api_key header        thin tool → fetch              tRPC business router        MySQL
```

- **recallsync-app** — Next.js app. REST routes under `/api/rest/*` are thin wrappers over
  **business-context tRPC routers** (`publicProcedure` + `getAPIKeyBusiness`). These resolve the
  business from the `Authorization: Bearer <apiKey.id>` header.
- **recallsync-mcp** — Express MCP server. Tools call `${BASE_URL}/...` (BASE_URL ends in
  `/api/rest`) with `Authorization: Bearer ${getApiKey(request)}`. The `/mcp` route forwards the
  caller's `api_key` header into tool args as `_apiKey`.
- **AIOS** — calls MCP tools from Cursor. Config in `.cursor/mcp.json` (gitignored; holds api_key).

## Auth model (important)

| Layer | Auth | Use for |
|---|---|---|
| `*.router.ts` `privateProcedure` | logged-in **session** + `businessId` input | the web UI |
| `business/*.router.ts` `publicProcedure` + `getAPIKeyBusiness` | **api key** Bearer | REST / MCP |

When building MCP operations, always use (or add to) the **business-context routers**. Never wire
the MCP to a `privateProcedure` — it has no session.

## Conventions

- One business = one repo = one RecallSync sub-account (fixed by the api key).
- MCP tools are thin: validate input → fetch REST → return text. Business logic stays in the app.
- To add a new MCP operation, follow `add-mcp-operation.md`.
