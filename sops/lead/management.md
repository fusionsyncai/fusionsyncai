---
id: sop_lead_management
title: Manage leads in RecallSync
status: active
owner: vishal
created: 2026-06-05
updated: 2026-06-05
---

# SOP: Manage leads

## Purpose
The single home for all lead-related instructions. Covers how AIOS reads, creates, updates, looks
up, and deletes **leads** in RecallSync via MCP tools, and how leads connect to campaigns.

> **AIOS does not own lead data.** Leads (and their PII) live in RecallSync, not in this repo. We do
> **not** create per-lead mirror files, and we never commit lead PII (emails, phones, names,
> addresses). Lead operations are live MCP calls, not repo state.

## Trigger
The owner wants to create/look up/update a lead, attach a lead to a campaign, set the test lead, or
clean up lead data.

## Core rules (read first)
- **Never invent or assume lead fields.** Do not fabricate a phone number, name, source, note, or any
  other value. If a required-by-context detail is missing, **ask the owner** — don't guess.
- **A lead needs a name + at least one contact identifier.** Valid identifiers are **email**,
  **phone**, `instagramSID`, or `facebookSenderId`. Exactly one is enough.
  - Phone is **not** mandatory. An email-only lead is valid (`create-lead` sends `phone: ""` under
    the hood to satisfy the backend, and the runtime accepts email-only).
- **Find before you create** to avoid duplicates: run `find-lead` (email/phone) or
  `get-lead-by-name` first.
- `firstName` / `lastName` are optional but preferred when known; ask rather than splitting `name`
  yourself unless it's unambiguous.

## Lead enums
- `status`: `NEW | CONTACTED | RETRYING | JUNK | BOOKED`
- `statusType`: `HOT | WARM | COLD`
- `quality`: `UNQUALIFIED | LOW | MEDIUM | HIGH | PERFECT`

## Tools (MCP)
| Tool | Use | Required args |
|---|---|---|
| `find-lead` | Look up by email or phone (dedupe check) | one of `email` / `phone` |
| `get-lead` | Fetch full lead by id | `id` |
| `get-lead-by-name` | Fetch by exact name | `name` |
| `get-leads` | List leads, optional `status`/`statusType`/`quality`/`all` filters | — |
| `create-lead` | Create a lead | `name` (+ at least one of email/phone) |
| `update-lead` | Update status/quality/contact/note fields | `id` |
| `delete-lead` | Delete a lead (**destructive**) | `id` |
| `get-test-lead` | Get the business's designated test lead (`isTestLead`) | — |
| `get-lead-notes` | Read notes on a lead | (lead id) |
| `add-lead-to-campaign` | Attach a lead to a campaign | `campaignId`, `leadId` |
| `find-campaign-lead` / `get-campaign-lead` | Lead ↔ campaign lookups | (campaign/lead ids) |
| `find-lead-to-call` | Next lead to contact in a campaign (respects schedule/status) | `campaignId` |

## Steps

### Create (or find) a lead
1. **Dedupe.** Run `find-lead` with the email and/or phone you were given. If it returns a lead, use
   that `id` — don't create a duplicate.
2. **Gather inputs from the owner.** Confirm `name` and at least one contact identifier. Do **not**
   fill in missing optional fields with guesses; ask if they matter.
3. **Create** with `create-lead` `{ name, firstName?, lastName?, email?, phone?, ... }`. Pass only
   values you were actually given.
4. **Report the new lead `id`** back to the owner.

### Update a lead
1. `get-lead` (by id) to see current state.
2. `update-lead` with `id` + only the fields that change (`status`, `statusType`, `quality`,
   `email`, `bestEmail`, `bestPhone`, `firstName`, `lastName`, `note`, …).

### Look up a lead
- By id → `get-lead`; by name → `get-lead-by-name`; by email/phone → `find-lead`; browse/filter →
  `get-leads`.

### Connect a lead to a campaign
- `add-lead-to-campaign` `{ campaignId, leadId }`. Verify with `find-campaign-lead` /
  `get-campaign-lead`. (Campaign config itself lives in `sops/campaign/configure-campaign.md`.)

### Test lead
- Before `test-channel-agent`, call `get-test-lead`. If none is set, ask the owner to mark one
  `isTestLead` in RecallSync.

### Delete a lead
- `delete-lead` `{ id }`. **Destructive — owner-approved only** (see Human-in-the-loop).

## Human-in-the-loop
- **Confirm before guessing.** Missing name parts, phone, source, or any field → ask the owner.
- **Deletion requires explicit owner approval** in the same turn. Never bulk-delete on your own.
- Treat all lead PII as sensitive: never write it into committed repo files.

## Output
- A live lead in RecallSync (created/updated/linked) and the relevant `id` reported to the owner.
- **No repo files are produced** for individual leads — lead state stays in RecallSync.

## Done criteria
- [ ] Dedupe check (`find-lead` / `get-lead-by-name`) run before any create.
- [ ] Lead has a name + at least one contact identifier; no fabricated/assumed fields.
- [ ] The intended operation succeeded and the lead `id` was reported.
- [ ] No lead PII was committed to the repo.
- [ ] Any delete was explicitly owner-approved.
