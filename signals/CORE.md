# Core — why signal-based tracking

_Last updated: discussion draft_

## The shift

**Old motion:** scrape Google Maps → cold list → generic outreach.  
**New motion:** detect a **moment of need** → hyper-relevant first touch → multi-channel follow-up.

For FusionSync specifically, LinkedIn DMs to dental **agency owners** stay on the table — but the
**trigger** must be signal-driven, e.g.:

- Agency just posted about landing a **new location**
- Agency complained about a **PMS integration gap** (Dentrix, OpenDental, Eaglesoft, …)
- Agency **hired a VA** to handle bookings manually

Same engine, different signal definitions per use case (see [USE-CASES.md](./USE-CASES.md)).

---

## What Clay actually does (and does not do)

Clay is **not** a magical proprietary database of "people about to buy."

Under the hood, Clay is:

1. **List source** — Apollo, Google Maps, CSV, webhook, …
2. **Enrichment waterfall** — call 3rd-party APIs until a field is filled
3. **LLM evaluation** — "Does this text match signal X?" → yes/no + summary
4. **Action** — push to email tool, CRM, webhook

Their moat is **UX + connector catalog**, not exclusive data. Anyone with n8n + APIs + an LLM can
replicate the *logic* for a narrow niche — often cheaper at scale.

---

## What we should own vs rent

| Own (high value) | Rent / adapter (commodity) |
|------------------|----------------------------|
| Use-case **config** (signals, keywords, scoring) | LinkedIn post scraping (Apify, Proxycurl, PhantomBuster) |
| **Dedup** + entity resolution (same company across channels) | Reddit API / F5Bot-style monitors |
| **Scoring** + qualification rules | Job board aggregators |
| Routing to **AIOS / RecallSync CRM** + campaign/agent | Google Search / News alerts |
| Draft message in **brand voice** per use case | Facebook/Instagram where APIs are weak |
| Audit trail — what signal fired, when, why | |

**Wasted effort:** maintaining fragile first-party scrapers for every social network.  
**Not wasted:** a thin **Signal Engine** that normalizes events from adapters and applies
use-case config.

---

## Design principles (proposed)

1. **One engine, many profiles** — dental patient acquisition and agency-partner acquisition differ
   in *signals* and *integrations*, not in core plumbing.
2. **Google Search / directory is always-on baseline** — not for cold spam; for **entity discovery**
   and corroboration ("this post mentions Smile Dental — do we know them?").
3. **Signal → entity → action** — every hit resolves to a business/person record before outreach.
4. **Human-in-the-loop first** — auto-send is later; ranked digest + draft reply (see
   [aios/intent-signal-monitor.md](../aios/intent-signal-monitor.md)).
5. **Cursor / LLM at evaluation time** — same pattern as `cursor-enrichment`: cheap to iterate on
   prompts without redeploying scrapers.
6. **n8n for actions** — schedule harvesters, call sidecars, push CRM, trigger agents.

---

## Build vs buy (pragmatic)

| Approach | When |
|----------|------|
| **Clay** | Fast experiments across many random signals; non-technical ops owns it |
| **In-house Signal Engine** | We know 2–5 high-converting signals per vertical; deep CRM + agent integration matters |
| **Hybrid** | Clay (or similar) as one *adapter* feeding our webhook — only if it saves time |

Current leaning: **in-house engine + rented scrapers/APIs**, configured per use case.

---

## Success criteria (before we build)

- [ ] At least **one use case** fully specified: signals, sources, scoring, CRM fields, outreach channel
- [ ] Manual proof: we engaged from signals found by hand for **30 days** (see intent-signal-monitor)
- [ ] Clear **cost model** — API credits + LLM evals per qualified signal/day
- [ ] Decision on **entity store** — extend AIOS CRM vs separate `SignalEvent` table
