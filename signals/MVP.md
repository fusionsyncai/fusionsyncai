# MVP — AI-assisted outreach queue (build this first)

_Last updated: 2026-07-28_

**Canonical spec with locked decisions:** [PRODUCT-SPEC.md](./PRODUCT-SPEC.md)

---

## What we're actually building

**Not Clay. Not a scraper farm.**  
An **AI-assisted outreach queue** in AIOS that kills daily re-invention — no more reopening
ChatGPT as "GTM engineer," rewriting sequences, or deciding which tab to open.

**Research finds people (scoped) → you qualify → queue drafts the channel move → you send and
log timeline.**

---

## The core loop

```
Contact or post (from research or manual)
  → you confirm fit
  → route to pipeline (email | linkedin | reddit | email_linkedin)
  → AI drafts channel-native copy
  → queue for review
  → you send manually
  → timeline: log sent / received / mark success
```

---

## Locked v1 decisions

See [PRODUCT-SPEC.md](./PRODUCT-SPEC.md) for full detail. Summary:

- **UI:** New AIOS tab + sub-tabs (Queue, Timeline, Sources, …)
- **Channels:** email, linkedin, reddit, **email_linkedin**
- **LinkedIn drafts:** comment + connection note; enrich on research
- **First profile:** dental patient acquisition
- **Success:** manual timeline + manual success status

---

## Research is needed — but scoped

For dental you don't live in a feed. **Minimal research layer:**

| Source | Role |
|--------|------|
| GMB scraper | Universe → `Contact` (already built) |
| Google Jobs | One "why now" filter (hiring VA/receptionist) |
| F5Bot | Reddit posts → qualify → queue |
| LinkedIn | Manual |

**Not:** GMB straight to queue as cold outreach. **Not:** scoring layer before human review.

---

## Build order

| Phase | What |
|-------|------|
| **A** | Queue + drafts + timeline (manual input OK) |
| **B** | Dental profile + pipeline routing |
| **C** | Google Jobs → Contacts shortlist |
| **D** | F5Bot webhook → Reddit queue |
| **E** | Enrichment on promote (email/LI lookup) |

Phase A alone still beats ChatGPT + tabs for LinkedIn/Reddit you find by hand.

---

## Anti-pattern

Seven docs on adapter contracts before anyone sends from the queue.  
**Procrastination test:** does the tool get you to **sent** faster?

Scoring rules / dedup / LLM-eval-every-hit **before first dental outreach** = old pattern.

---

## Related

- [PRODUCT-SPEC.md](./PRODUCT-SPEC.md) — full agreed spec
- [ARCHITECTURE.md](./ARCHITECTURE.md) — future full system
- [USE-CASES.md](./USE-CASES.md) — profiles
