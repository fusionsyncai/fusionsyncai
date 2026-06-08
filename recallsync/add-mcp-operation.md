---
id: sop_add_mcp_operation
title: Add a new RecallSync MCP operation (end-to-end)
status: active
owner: vishal
created: 2026-06-04
updated: 2026-06-04
---

# SOP: Add a new RecallSync MCP operation

## Purpose
When AIOS needs an operation on RecallSync that does not exist yet, build it end-to-end across the
three repos so it becomes a callable MCP tool. Use this whenever a requested MCP tool is missing.

## Principle
MCP → REST → tRPC business router → Prisma. Reuse existing pieces; only create what's missing.
Mirror the **lead** implementation as the reference (`business/lead.router.ts`, `/api/rest/leads`,
`tools/lead.ts`). For **list** endpoints, also follow `sops/list-pagination-and-field-selection.md`.

## Steps

### 1. Check what already exists
- Look for a business-context tRPC procedure in `recallsync-app/src/server/api/routers/business/*`
  that resolves the business via `getAPIKeyBusiness` (NOT a `privateProcedure`).
- Look for a matching REST route under `recallsync-app/src/app/api/rest/*`.
- Look for an existing MCP tool in `recallsync-mcp/src/tools/*`.

### 2. tRPC procedure (recallsync-app) — only if missing
- Add a `publicProcedure` to the relevant `business/<x>.router.ts`.
- Resolve the business with `const { businessId } = await getAPIKeyBusiness(ctx.prisma);`.
- Scope every query by `businessId`. Mount the router in `server/api/root.ts` if new.

### 3. REST route (recallsync-app) — only if missing
- Create `src/app/api/rest/<resource>/route.ts` with `export const dynamic = 'force-dynamic';`.
- `const client = await serverClient(null);` then call `client.<businessRouter>.<procedure>(...)`.
- Return `NextResponse.json(...)`. Wrap in try/catch with `handleError(err)`.
- The path under `/api/rest` is what the MCP appends to `BASE_URL`.

### 4. MCP tool (recallsync-mcp)
- Add the endpoint path to `src/constants/tool.ts`.
- Add (if input is needed) a Zod schema in `src/schema/tool.ts` (non-strict — `_apiKey` is dropped).
- Add the tool definition + handler in `src/tools/<resource>.ts`:
  - Build URL as `` `${process.env.BASE_URL}<path>` ``.
  - Auth header: `` Authorization: `Bearer ${getApiKey(request)}` `` (import from `utils/auth.util.js`).
  - Return a `content: [{ type: "text", text }]` response.
- Register in `src/servers/primary.server.ts`: import the tool array + handler, add to the
  `ListToolsRequestSchema` list, and add the `case` in `CallToolRequestSchema`.

### 5. MCP picks it up automatically (dev mode)
- `recallsync-mcp` runs in **dev mode with hot reload** (see rule `recallsync-mcp-run`), so it
  reloads source edits on its own. **No manual MCP restart or Cursor re-enable is needed.**
- Note: changes to `.env` do NOT hot-reload — only restart for env changes.

### 6. Run the operation
- Call the new tool via MCP and verify against a direct REST/DB check if useful.

## Done criteria
- [ ] Business-context tRPC procedure exists (api-key auth)
- [ ] REST route exists under `/api/rest`
- [ ] MCP tool added and registered
- [ ] Tool call returns expected data

## Reference: files touched for a typical operation
- `recallsync-app/src/server/api/routers/business/<x>.router.ts`
- `recallsync-app/src/server/api/root.ts` (only if new router)
- `recallsync-app/src/app/api/rest/<resource>/route.ts`
- `recallsync-mcp/src/constants/tool.ts`
- `recallsync-mcp/src/schema/tool.ts` (if input)
- `recallsync-mcp/src/tools/<resource>.ts`
- `recallsync-mcp/src/servers/primary.server.ts`
