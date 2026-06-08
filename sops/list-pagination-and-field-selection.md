---
id: sop_list_pagination_field_selection
title: List endpoints — pagination, field selection, date filters
status: active
owner: vishal
created: 2026-06-06
updated: 2026-06-06
---

# SOP: List pagination + field selection + date filters

## Purpose
Standardize how AIOS (and MCP tools) fetch **lists** from RecallSync: page through results,
request only the fields needed, and filter by date — without pulling full rows or unbounded arrays.

## When to use
Any **list/read-many** operation: leads, meetings, follow-ups, conversation messages, campaign
leads, opportunities, etc.

## Query contract (REST query params)

| Param | Type | Default | Meaning |
|---|---|---|---|
| `page` | number | `1` | 1-based page index |
| `pageSize` | number | `10` | Rows per page (use `50`, `100` when user asks for more) |
| `select` | CSV string | entity-specific lean default | Scalar fields only, e.g. `id,content,sender,status` |
| `gte` / `lte` / `gt` / `lt` | ISO date string | — | Filter on the entity's date field (see below) |
| `eq` | ISO date string | — | Exact date match |

**Agent behavior:** When the user says "get 50 messages" or "only id and status", pass
`pageSize=50` or `select=id,status`. Do not fetch everything and truncate client-side.

## Response shape (tRPC + REST)

```json
{
  "<itemsKey>": [ /* rows */ ],
  "total": 142,
  "totalPages": 15,
  "hasNextPage": true
}
```

Examples: `{ leads, total, … }`, `{ messages, total, … }`, `{ meetings, total, … }`.

## Three-layer wiring

### 1. tRPC (`recallsync-app`)
- Import `filterPaginationSchema`, `applyDateFilter` from `@/schema/agency-rest`.
- Merge into procedure input: `.merge(filterPaginationSchema)`.
- Add optional `select: z.nativeEnum(Prisma.<Model>ScalarFieldEnum).array().optional()`.
- Apply `applyDateFilter(whereInput, input, '<dateField>')` — e.g. `createdAt`, `followUpAt`, `startTime`.
- Use `$transaction([findMany, count])` with `skip` / `take`.
- Return `{ <itemsKey>, total, totalPages, hasNextPage }`.
- **Lean default:** when `select` is omitted, return a curated field set (not full Prisma row).
  Document the default in the procedure comment. Pass `select` to widen or narrow.

Reference: `business/lead.router.ts` → `getLeads`.

### 2. REST (`recallsync-app/src/app/api/rest/*`)
- `getFilterParams(req)` + `getPaginationParams<Prisma.<Model>ScalarFieldEnum>(req)`.
- Spread into the tRPC call along with entity-specific filters.

Reference: `src/app/api/rest/leads/route.ts`.

### 3. MCP (`recallsync-mcp`)
- Import `ListQuerySchema`, `listQueryJsonSchemaProperties` from `src/schema/list-query.ts`.
- Merge list args into tool Zod schema; spread `listQueryJsonSchemaProperties` into tool JSON schema.
- Forward with `appendListQueryToUrl()` from `src/utils/list-query.util.ts`.
- Format response with pagination metadata (`formatPaginatedListText`).

Reference: `get-conversation-messages`, `get-leads`, `get-meetings`, `get-all-follow-ups`.

## Entity-specific date fields

| Entity | Date field for filters |
|---|---|
| Lead | `createdAt` |
| Conversation message | `createdAt` |
| Meeting | `startTime` |
| Follow-up | `followUpAt` |
| Campaign | `createdAt` |
| Automation | `createdAt` |
| Campaign lead | _(none — pagination + select only)_ |
| Opportunity | `createdAt` |

## Lean defaults (when `select` is omitted)

| Entity | Default fields |
|---|---|
| Conversation message | `id`, `content`, `sender`, `status`, `channel`, `createdAt` |
| Follow-up | `id`, `status`, `followUpAt`, `priority`, `type`, `source`, `channel`, `attempts`, `referenceId`, `leadId`, `salesAgentId`, `createdAt`, `updatedAt` (excludes `reason`, `notes`, `summary`) |
| Campaign | `id`, `name`, `status`, `primaryAgentId`, `automationId`, `settingsUpdated`, `createdAt`, `updatedAt` |
| Campaign lead | campaign-lead scalars + lean `Lead` (`id`, `name`, `email`, `phone`, `status`) |
| Automation | `id`, `name`, `description`, `status`, `primaryAgentId`, `createdAt`, `updatedAt` (no `flow` JSON) |

Pass `select` to widen or narrow any of the above.

## When a model has no date field
If the entity has **no `createdAt`** (or no natural date column), **skip date filters entirely** —
ship pagination + `select` only. **Never** add or modify the Prisma schema just to enable a date
filter. Keep the change minimal and ask before adding domain filters or other extra behavior.

## Adding pagination to a new list endpoint
1. tRPC: merge `filterPaginationSchema`, add `select`, paginated query + standard response.
2. REST: forward `getFilterParams` + `getPaginationParams`.
3. MCP: merge `ListQuerySchema`, spread JSON schema props, use `appendListQueryToUrl`.
4. Update `recallsync/coverage.md` if this closes a gap.

## Done criteria
- [ ] tRPC returns paginated shape with lean default when applicable
- [ ] REST forwards all query params
- [ ] MCP tool accepts and forwards `page`, `pageSize`, `select`, date filters
- [ ] Agent uses appropriate `pageSize` / `select` based on user intent
