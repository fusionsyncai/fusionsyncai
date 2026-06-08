# RecallSync MCP Coverage Map

> Living backlog of **what AIOS can control on RecallSync via MCP**. One row per
> entity × action, tracked across the three layers in the chain. Keep this current:
> when you add/verify an operation, flip its cells and update _Last reviewed_.

_Last reviewed: 2026-06-08 (Batch F done — custom fields: definitions CRUD + per-lead values)_

## How to read this

The chain is `MCP → REST → business tRPC → Prisma` (see `README.md`). An operation
is only **AIOS-controllable** when all three layers exist:

| Layer | Meaning |
|---|---|
| **tRPC** | a `publicProcedure` on a `business/*.router.ts` (api-key auth via `getAPIKeyBusiness`) |
| **REST** | a thin route under `/api/rest/*` |
| **MCP** | a registered tool in `recallsync-mcp` |

Status legend: ✅ done · ⚠️ partial · ❌ missing · — out of scope (dashboard/session-only, not for MCP)

Priority: **P0** = blocks current use case (email outreach + human-in-the-loop) · **P1** = completes the loop · **P2** = defer until scope expands.

---

## Scope: AIOS control plane v1

"Proper coverage" is defined **for the current use case** (North India email outreach with
`agentMode: DRAFT` human-in-the-loop), not all of RecallSync.

- **Must have (v1):** Lead, Tag, Note, Follow-up, Primary/Channel agent, Campaign config + lead ops,
  Automation config, **Conversation read + draft approve/reject**, **campaign-lead status**.
- **Defer (v2):** Pipeline/Opportunity, Calls/voice, provider connect/configure, delete primary agent,
  delete automation, bulk meeting ops.

---

## Lead / Tag / Note / Follow-up — ✅ complete

| Entity | Actions | tRPC | REST | MCP | Pri |
|---|---|:--:|:--:|:--:|:--:|
| Lead | create, find, get, get-by-name, update, delete | ✅ | ✅ | ✅ | — |
| Tag | create, get, get-by-id, update, delete | ✅ | ✅ | ✅ | — |
| Note | create, get, get-by-id, get-by-lead, update, delete | ✅ | ✅ | ✅ | — |
| Follow-up | create, get, get-all, update, delete | ✅ | ✅ | ✅ | — |

No work needed.

---

## Primary agent — ✅ complete for v1

| Action | tRPC | REST | MCP | Pri | Note |
|---|:--:|:--:|:--:|:--:|---|
| List primaries | ✅ | ✅ | ✅ | — | |
| Create / update | ✅ | ✅ | ✅ | — | |
| Get primary by id | ✅ | ✅ | ✅ | — | `get-primary-agent` (REST `GET /primary-agent/[id]`); includes channel agents |
| Delete primary | ❌ | ❌ | ❌ | P2 | not built anywhere |

---

## Channel agent (BaseAgent) — ✅ complete

| Action | tRPC | REST | MCP | Pri |
|---|:--:|:--:|:--:|:--:|
| create (with `agentMode`) | ✅ | ✅ | ✅ | — |
| get / update (incl. `agentMode`) / delete | ✅ | ✅ | ✅ | — |
| set-tools / set-flow-draft | ✅ | ✅ | ✅ | — |
| get-test-lead / test / clear-test | ✅ | ✅ | ✅ | — |

---

## Campaign — ✅ complete for v1

| Action | tRPC | REST | MCP | Pri | Note |
|---|:--:|:--:|:--:|:--:|---|
| get-all / get / create / update | ✅ | ✅ | ✅ | — | `get-all-campaigns` paginated + select + createdAt date filters |
| configure-settings / update-status | ✅ | ✅ | ✅ | — | |
| list / add / get / remove campaign leads | ✅ | ✅ | ✅ | — | `get-campaign-leads` paginated; lean default incl. Lead sub-select; no date filter (no createdAt) |
| find lead to call | ✅ | ✅ | ✅ | — | |
| **Update campaign-lead status** | ✅ | ✅ | ✅ | **P1** | `update-campaign-lead` updates status only (CampaignLead id, not Lead id) |
| **Delete campaign** | ✅ | ✅ | ✅ | **P1** | `delete-campaign`; server refuses deletion if campaign still has leads |

---

## Automation — ✅ config + runtime control complete for v1

| Action | tRPC | REST | MCP | Pri | Note |
|---|:--:|:--:|:--:|:--:|---|
| get-all / get / create / update | ✅ (business) | ✅ | ✅ | — | `get-automations` paginated + select + createdAt date filters |
| **List lead automation sessions** | ✅ | ✅ | ✅ | — | `get-lead-automation-sessions`; defaults to `ACTIVE`; paginated + select + createdAt date filters |
| **Trigger for a lead** | ✅ | ✅ | ✅ | — | `trigger-automation`; business-router scoped (verifies automation+lead belong to business), reuses `triggerLeadAutomationFn` |
| **Stop for a lead** | ✅ | ✅ | ✅ | — | `stop-automation`; same scoping; reuses `stopLeadAutomationFn`; safe no-op when nothing active |
| Delete | — | ❌ | ❌ | P2 | dashboard-only |

> Built as **api-key-scoped business-router procedures** (`businessAutomation.triggerAutomation` /
> `stopAutomation`), not thin wraps of the top-level `automation.router`. REST:
> `POST /api/rest/automation/[id]/trigger|stop` with body `{ leadId }`.
> Sessions key on `primaryAgentId` + `leadId` (no `automationId` on the model), so
> `get-lead-automation-sessions` returns the active PrimaryAgent id/name for each run.

---

## Conversation — ✅ control plane complete (true human-send deferred)

| Action | tRPC (business) | REST | MCP | Pri | Note |
|---|:--:|:--:|:--:|:--:|---|
| Get messages | ✅ | ✅ | ✅ | — | `get-conversation-messages` — paginated; lean default fields; `page`/`pageSize`/`select`/date filters |
| Get conversation by lead/id | ✅ | ✅ | ✅ | **P0** | `get-conversation` |
| Search conversations | ✅ | ✅ | ✅ | **P0** | `search-conversations` |
| Update conversation (star/kill/replyMode/active agent) | ✅ | ✅ | ✅ | P1 | `update-conversation` |
| Create message | ✅ | ✅ | ✅ | P1 | `create-conversation-message` (records to DB; no provider delivery) |
| Update / delete message | ✅ | ✅ | ✅ | P1 | `update-conversation-message` / `delete-conversation-message` |
| **Approve draft message (HITL)** | ✅ | ✅ | ✅ | **P0** | `approve-draft-message` — api-key scoped; reuses `deliverDraftBaseAgentMessage` |
| **Reject draft message (HITL)** | ✅ | ✅ | ✅ | **P0** | `reject-draft-message` |
| **Send message as human (provider delivery)** | ✅ | ✅ | ✅ | — | `send-message` — real outbound via the conversation's channel agent provider (GHL/WhatsApp/Instagram/N8N-Brevo). Records a HUMAN_AGENT message, flips SENT (immediate) or SCHEDULED (N8N). REST `POST /conversation/[conversationId]/send` body `{ content, subject?, baseAgentId? }`. Reuses extracted `dispatchBaseAgentMessageToProvider` (shared with approve-draft) |
| **Test N8N workflow (webhook smoke)** | ✅ | ✅ | ✅ | P1 | `test-n8n-workflow` — simulated production payload; real n8n POST |

> Operable from AIOS: list/search a conversation, read messages, approve/reject drafts, edit/delete
> messages, and steer the conversation (kill AI, switch replyMode, reassign agent). Approve accepts
> optional edited `content` and email `subject`. Audit metadata uses the api-key manager/agency id
> as `approvedByUserId`. NOTE: `create-conversation-message` records to history only — it does NOT
> deliver. For real human delivery use **`send-message`** (provider dispatch via the conversation's
> channel agent), which reuses the same `dispatchBaseAgentMessageToProvider` core as approve-draft.

---

## Meeting — ✅ complete for v1

| Action | REST | MCP | Pri | Note |
|---|:--:|:--:|:--:|---|
| create / get / get-by-lead / get-by-uid | ✅ | ✅ | — | |
| update / update-by-lead / update-status | ✅ | ✅ | — | |
| overdue-no-show (parameterized) | ✅ | ✅ | — | `update-overdue-no-show` (custom window + markLeadAsCold) |
| Upcoming by lead | ✅ | ✅ | — | `get-upcoming-meetings-by-lead` → `{ meetings, hasMeeting }` |
| Bulk set-all-overdue-no-show | ✅ | ✅ | — | `set-all-overdue-no-show` (no params; >1 day overdue, business-wide; REST `PATCH /meeting/{id}`, id ignored) |

---

## Pipeline — ✅ complete

| Action | tRPC | REST | MCP | Note |
|---|:--:|:--:|:--:|---|
| List (paginated) | ✅ | ✅ | ✅ | `get-pipelines`; lean default id/name/createdAt + opportunity count; createdAt date filter |
| Get by id (incl. stages) | ✅ | ✅ | ✅ | `get-pipeline` |
| Create / update / delete | ✅ | ✅ | ✅ | `create-pipeline`, `update-pipeline`, `delete-pipeline` |

---

## Stage — ✅ complete

| Action | tRPC | REST | MCP | Note |
|---|:--:|:--:|:--:|---|
| List by pipeline (paginated) | ✅ | ✅ | ✅ | `get-stages`; requires pipelineId; ordered by order asc; lean default id/name/order/pipelineId/createdAt |
| Get by id | ✅ | ✅ | ✅ | `get-stage` |
| Create / update / delete | ✅ | ✅ | ✅ | `create-stage`, `update-stage`, `delete-stage`; order auto-assigned on create |

---

## Opportunity — ✅ complete

| Action | tRPC | REST | MCP | Note |
|---|:--:|:--:|:--:|---|
| List (paginated) | ✅ | ✅ | ✅ | `get-opportunities`; filter by pipelineId/stageId/leadId; lean default id/name/status/value/stageId/pipelineId/leadId/createdAt |
| Get by id | ✅ | ✅ | ✅ | `get-opportunity` |
| Create (add lead to stage) | ✅ | ✅ | ✅ | `create-opportunity`; one per lead per pipeline |
| Update (incl. move stage) | ✅ | ✅ | ✅ | `update-opportunity`; stageId move sets addedToStageAt + fires OPPORTUNITY_STAGE_CHANGED |
| Delete (remove from pipeline) | ✅ | ✅ | ✅ | `delete-opportunity` |

---

## Call (LeadCall) — ✅ complete

| Action | tRPC | REST | MCP | Note |
|---|:--:|:--:|:--:|---|
| List (paginated) | ✅ | ✅ | ✅ | `get-calls`; filter by leadId/campaignId; lean default id/callId/type/callType/result/callStat/endedReason/callDuration/totalCost/leadId/campaignId/createdAt; createdAt date filter |
| Get by id | ✅ | ✅ | ✅ | `get-call`; full row incl. transcript/summary |
| Create | ✅ | ✅ | ✅ | `create-call`; records call metadata/outcome (does not place a call) |
| Update | ✅ | ✅ | ✅ | `update-call` |

---

## Custom Field — ✅ complete

API-key-scoped `businessCustomField` router (the pre-existing `customFields` router is dashboard-only `privateProcedure`). Two entities: **definitions** (per business) and **values** (per lead).

| Action | tRPC | REST | MCP | Note |
|---|:--:|:--:|:--:|---|
| List definitions (paginated) | ✅ | ✅ | ✅ | `get-custom-fields`; createdAt date filter; lean default id/key/label/type/options/source/createdAt |
| Get definition by id | ✅ | ✅ | ✅ | `get-custom-field` |
| Create / update / delete definition | ✅ | ✅ | ✅ | `create/update/delete-custom-field`; key unique per business (P2002→CONFLICT); delete cascades values |
| Get values for a lead | ✅ | ✅ | ✅ | `get-lead-custom-field-values`; includes field def key/label/type/options |
| Set one value (upsert) | ✅ | ✅ | ✅ | `set-lead-custom-field-value`; upsert on lead+field; GHL sync when mapped |
| Bulk set values (upsert) | ✅ | ✅ | ✅ | `bulk-set-lead-custom-field-values`; reuses `bulkUpsertLeadCustomFieldValuesForLead` service |
| Delete a value | ✅ | ✅ | ✅ | `delete-lead-custom-field-value` (by value id) |

---

## Deferred domains (v2) — ❌ no MCP

| Domain | tRPC | REST | MCP | Pri | Note |
|---|:--:|:--:|:--:|:--:|---|
| Integrations: list | ✅ | ✅ | ✅ | — | read-only is enough |
| Integrations: connect/configure | — | ❌ | ❌ | P2 | do in dashboard for now |
| Knowledge base | partial | ❌ | ❌ | P2 | |
| Delete primary agent / delete automation | maybe | ❌ | ❌ | P3 | verify tRPC then MCP wrap |

---

## Prioritized backlog

### Batch A — Conversation + HITL (P0, highest value)
Unblocks `agentMode: DRAFT` end-to-end.
- [x] business tRPC: `approveDraftMessage` / `rejectDraftMessage` (api-key auth, reuse `deliverDraftBaseAgentMessage`)
- [x] business tRPC reuse: `getConversationById`, `searchConversation` (already existed)
- [x] REST: approve/reject draft routes (`POST /conversation/message/[messageId]/approve|reject`)
- [x] MCP tools: `get-conversation`, `search-conversations`, `approve-draft-message`, `reject-draft-message`
- [x] (P1) MCP: `update-conversation`, `create-conversation-message`, `update-conversation-message`, `delete-conversation-message`
- [x] (P2→done) True human-send delivery: `send-message` (business tRPC + REST + MCP; shared provider dispatch)

### Batch B — Campaign + automation ops (P1) — ✅ complete
- [x] MCP only: `update-campaign-lead` (status) — tRPC + REST exist
- [x] MCP only: `delete-campaign` — tRPC + REST exist
- [x] New business tRPC + REST + MCP: `trigger-automation` / `stop-automation` (api-key scoped)
- [x] New business tRPC + REST + MCP: `get-lead-automation-sessions` (defaults to ACTIVE sessions)

### Batch C — Convenience (P2) — ✅ done
- [x] `get-primary-agent` by id (REST + MCP)
- [x] meeting: `get-upcoming-meetings-by-lead`, `set-all-overdue-no-show` (MCP; REST existed)
- [x] calls: `get-calls` (paginated list + leadId/campaignId filter), `get-call`, `create-call`, `update-call` (new tRPC getCalls/getCallById + REST GET routes + MCP)

### Batch F — Custom fields — ✅ done
- [x] New API-key `businessCustomField` router: definitions CRUD (`get-custom-fields` paginated + select + createdAt filter, `get-custom-field`, `create/update/delete-custom-field`)
- [x] Per-lead values: `get-lead-custom-field-values`, `set-lead-custom-field-value`, `bulk-set-lead-custom-field-values`, `delete-lead-custom-field-value` (reuses existing upsert service incl. GHL sync)
- [x] REST: `/custom-field` (GET/POST), `/custom-field/[id]` (GET/PUT/DELETE), `/custom-field/lead/[leadId]` (GET), `/custom-field/value` (POST single/bulk), `/custom-field/value/[id]` (DELETE)

### Batch D — Pipeline / Stage / Opportunity — ✅ done
- [x] Pipeline: paginated `getPipelines` + REST filter params + MCP CRUD (`get-pipelines`, `get-pipeline`, `create/update/delete-pipeline`)
- [x] Stage: new `businessStage` router + REST `/stage` + MCP CRUD (`get-stages`, `get-stage`, `create/update/delete-stage`)
- [x] Opportunity: paginated `getOpportunities` envelope + MCP CRUD (`get-opportunities`, `get-opportunity`, `create/update/delete-opportunity`; stage move via update)

---

## Process

- Add new operations via `recallsync/add-mcp-operation.md`.
- Schema changes happen in **recallsync-app** Prisma; mirror manually in **recallsync-mcp**.
- MCP source edits require `npm run build` + restart on port **3008** for production MCP (`npm run start`).
  Dev mode (`npm run dev`) watches `server.ts` + `src/**` and hot-restarts automatically.
  Only `.env` changes need a manual restart in dev.
- When an operation lands, flip its cells here and bump _Last reviewed_.
