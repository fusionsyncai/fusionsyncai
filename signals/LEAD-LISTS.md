# Lead lists — batch inputs to outreach pipelines

People enter outreach through **three paths**: lead lists (batch), signals (one-off with context),
or **manual add** (single person). All land in the same queue + pipelines.

---

## Concept

A **lead list** is a named batch of companies/people you work through over time — not a one-shot
signal, but a **universe to process** with a default pipeline.

```
LeadList
  name, profile, source, defaultPipeline
  → members (Contact rows or import rows)
  → you qualify / enrich
  → promote to OutreachItem (queue)
  → AI draft → you send → timeline
```

**Lists vs signals:**

| Input type | Example | Typical pipeline |
|------------|---------|------------------|
| **Lead list** | GMB pull of 80 London dental agencies | email, linkedin, or email_linkedin after enrich |
| **Lead list** | Sales Navigator export — 50 agency owners | linkedin |
| **Signal** | Reddit post: "dental client wants Dentally integration" | reddit (or linkedin if you find the person) |
| **Signal** | Google Jobs: agency hiring dental appointment setter | email_linkedin once enriched |
| **Manual** | Met someone, paste LinkedIn URL | whatever channel you pick |

Lists are **not** auto-outreach. They're organized inventory. You still qualify, draft, and send manually.

---

## Source 1 — GMB → lead list (already partial)

**Existing:** [GM Scraper](../app/(dashboard)/gm-scraper/) creates `GmScraperQuery` → imports
`Contact` rows via `GmScraperQueryContact`.

**Outreach integration:**

- Each completed GMB query = a **lead list** (e.g. "London dental marketing agencies — Jul 2026")
- List members = linked Contacts
- Default profile: UK dental agency partner
- Default pipeline: unset until enriched — route after you have email and/or LinkedIn

**London v1 seed queries:**

```
dental marketing agency London
dental lead generation London
dental PPC agency London
dental digital marketing agency London
```

---

## Source 2 — Sales Navigator → LinkedIn pipeline

**Flow:**

1. Run search in Sales Navigator (dental marketing agency, UK, London, …)
2. Export CSV (LinkedIn's export or SN list export)
3. **Import** in Outreach tab → creates/updates `Contact` + adds to lead list
4. List default pipeline: **`linkedin`**
5. Bulk or one-by-one: generate connection note (+ optional comment if you attach a post URL later)
6. Work queue — connect, log timeline

**Expected CSV fields (flexible mapping on import):**

| Column | Maps to |
|--------|---------|
| First Name / Last Name | `firstName`, `lastName`, `name` |
| Company | `companyName` |
| Title | `title` |
| LinkedIn URL | `linkedinUrl` |
| Email (if present) | `email` → may upgrade pipeline to `email_linkedin` |
| Location | `city`, `country` |

**Source tag:** `sales_navigator` + list name on Contact.

No Sales Nav API in v1 — **CSV import only**.

---

## Source 3 — Manual entry

Always available:

- **Add person** — name, company, email?, LinkedIn URL?, pipeline, one-line context
- **Add signal/post** — URL + snippet → reddit or linkedin pipeline
- Creates Contact (if new) + OutreachItem in queue immediately

Use for: one-off finds, referrals, conference contacts, Reddit posts you saw outside F5Bot.

---

## UI (Outreach tab sub-tabs — updated)

| Sub-tab | Purpose |
|---------|---------|
| **Queue** | Active outreach items — filter by pipeline, status |
| **Lists** | Lead lists (GMB batches, SN imports, manual lists); members; promote to queue |
| **Timeline** | Per-item history (also reachable from queue row) |
| **Sources** | GMB queries, Jobs watch, F5Bot — links to list creation |
| **Import** | Sales Navigator CSV upload |

---

## Working a list (typical session)

1. Open list **"London dental agencies — GMB"**
2. Scan members — skip non-agencies manually
3. Select 5–10 → **Enrich** (email + LinkedIn lookup)
4. **Promote to queue** — system picks pipeline from available channels
5. Review AI drafts in Queue
6. Send manually, log timeline
7. Mark success when partnership conversation starts

Same flow for SN list, but default pipeline is LinkedIn from import.

---

## Data model sketch (future)

```
LeadList
  id, name, profileId, source (gmb | sales_navigator | manual)
  defaultPipeline?, gmScraperQueryId?, createdAt

LeadListMember
  leadListId, contactId, addedAt, notes?, promotedAt?

OutreachItem
  contactId, leadListId?, pipeline, signalContext?, status, …
```

Reuse `Contact` + `GmScraperQuery` — extend, don't duplicate.

---

## Related

- [PRODUCT-SPEC.md](./PRODUCT-SPEC.md)
- [COPY-TEMPLATES.md](./COPY-TEMPLATES.md)
