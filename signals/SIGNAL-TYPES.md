# Signal types — taxonomy

Signals are **observable public events** that indicate timing + pain. Each profile enables a
subset and assigns weights.

---

## Categories

| Category | Meaning | Typical freshness |
|----------|---------|-------------------|
| **Growth** | Business expanding — new location, funding, hiring spree | Days–weeks |
| **Ops pain** | Manual workaround visible — VA hire, spreadsheet, double entry | Days–weeks |
| **Stack gap** | Named tool frustration — PMS, CRM, integration failure | Hours–months |
| **Intent** | Explicit search for partner/vendor/solution | Hours–days |
| **Competitive** | Switching signal — "leaving X", "alternative to Y" | Days |

---

## Dental / agency-owner signals (detailed)

### 1. New location / expansion

- **Evidence:** LinkedIn post, local press, Google News, website banner
- **Keywords:** grand opening, second location, new office, expanding to, ribbon cutting
- **LLM check:** Confirm *new* location vs anniversary marketing
- **Outreach angle:** "Onboarding a new location usually breaks booking + recall workflows…"

### 2. PMS / integration gap

- **Evidence:** Reddit, Facebook groups (harder), LinkedIn comments, job description requirements
- **Keywords:** Dentrix, OpenDental, Eaglesoft, Curve, integration, sync, API, double entry
- **LLM check:** Is this a complaint or a vendor ad?
- **Outreach angle:** Specific stack mention + integration-first approach
- **Note:** Rarer on LinkedIn; Reddit/community sources matter more

### 3. Hiring VA / receptionist / coordinator for bookings

- **Evidence:** Job boards (Indeed, Google Jobs), LinkedIn Jobs, company careers page
- **Keywords:** virtual assistant, patient coordinator, front desk, appointment setter, phone scheduling
- **LLM check:** Dental/practice context + manual booking language
- **Outreach angle:** "Saw you're hiring for phones — often means the PMS + marketing stack aren't talking…"
- **Feasibility:** High — structured public data

### 4. Recall / no-show / empty chair pain

- **Evidence:** Owner posts, community threads
- **Keywords:** no-show, recall, hygiene reactivation, empty chairs, cancellation
- **Outreach angle:** Patient acquisition **system** vs one-off marketing

---

## Agency-partner signals (FusionSync)

See keyword lists in [aios/intent-signal-monitor.md](../aios/intent-signal-monitor.md).

High weight:

- Agency + **can't deliver** / turning down client work
- **White-label** / tech partner search
- **GHL / n8n** + integration gap
- Vertical + software ask (dental portal, RE underwriting tool, …)

Negative weight:

- Solo founder prototype (Lovable, "my app idea") without agency + clients context

---

## Real estate signals (starter set)

- Hiring ISA / lead coordinator / transaction coordinator
- CRM frustration (Follow Up Boss, KVCore, LionDesk)
- Team split / new brokerage / market expansion
- "Need more listings" + lead quality complaints

---

## Signal record (conceptual)

Every collected hit normalizes to:

```
SignalEvent
  id
  profileId              → which use case
  signalType             → e.g. HIRING_VA, NEW_LOCATION, PMS_COMPLAINT
  sourceIntegration      → linkedin | reddit | google_jobs | …
  sourceUrl              → canonical link
  rawText                → post body, job description, snippet
  authorHandle?
  companyNameHint?
  detectedAt             → when we collected it
  postedAt?              → when they published
  score                  → 0–100 after rules + optional LLM
  llmSummary?            → one-line "why this matters"
  llmQualified?          → boolean
  entityId?              → linked CRM contact/lead after resolution
  status                 → NEW | REVIEWED | ENGAGED | SKIP | PROMOTED
```

---

## Scoring (v1 proposal)

**Layer 1 — rules:** keyword matches, source trust, recency decay  
**Layer 2 — LLM:** only for top candidates or ambiguous text (cost cap)  
**Layer 3 — entity boost:** known ICP vertical, prior engagement, directory match

Only **top N/day per profile** get draft outreach generated.
