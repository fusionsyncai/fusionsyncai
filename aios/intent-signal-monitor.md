# Intent Signal Monitor

> **Status:** Early ideation — living doc, expect changes as we iterate.
>
> **Purpose:** Surface high-intent public posts from **agency operators** **and draft a reply for
> each** so Shubham can quality-check, tweak, copy-paste, and send in ~15–20 minutes/day —
> starting partnership conversations. **No auto-send in v1.**

_Last updated: 2026-06-29_

---

## Why build this (revised)

**Finding posts alone is not the bottleneck.** LinkedIn saved searches, F5Bot, and manual scrolling
cover much of discovery with zero code. If we would not reply consistently even with 20 posts each
morning, a finder-only tool gets abandoned after a week.

**What makes this worth building:** the system removes the hardest part — **figuring out what to
say**. Each signal ships with a **ready-to-paste draft reply** in Shubham's partnership voice.
Workflow:

1. Open digest → see ~10 ranked posts.
2. Each post has a drafted reply (first person as Shubham, tech partner tone).
3. Read post + draft → tweak → copy-paste → send manually.
4. Mark as engaged / skip.

Auto-send is **later** — v1 is human QC on every reply.

---

## When to build vs do it manually

| Situation | Recommendation |
|-----------|------------------|
| Not engaging manually yet | **30 days manual first** (LinkedIn alerts, Reddit agency subs). Build when drafting friction hurts. |
| Engaging daily but writing replies is slow | **Build** — finder + draft replies. |
| Volume too high to track by hand | **Build** — centralized digest + dedup. |

Manual baseline: LinkedIn keyword alerts, F5Bot for Reddit agency subs, weekly scan of r/gohighlevel
and r/n8n.

---

## Problem

Agency owners post about client tech gaps, white-label needs, and fulfilment pain on LinkedIn,
Reddit, and communities — but discovery is fragmented and **crafting a peer-level reply takes
time**. We want one **ranked daily inbox with draft replies** for fast, consistent engagement.

Aligns with FusionSync acquisition in `aios/aios-current-context.md`: agency operators → human
first touch → **WhatsApp partnership conversation**.

**Not the primary lane anymore:** solo founders posting about Lovable/Base44 prototypes (legacy
founder ICP — deprioritize unless they also run an agency with client demand).

---

## Goals

- Collect matching public posts: **URL**, **platform**, **author/handle**, **snippet**, **timestamp**.
- **Score / rank** by partnership intent strength.
- For each signal (top N): **draft a reply** via LLM (see [Reply drafting](#reply-drafting)).
- Deliver a **daily digest** — top 10–20 signals from the past 24 hours, each with its draft.
- **Human sends only in v1.**

## Non-goals (v1)

- Auto-post / auto-send.
- RecallSync campaign wiring from signals.
- LinkedIn / X collection at scale on free tier (manual + alerts first).
- Founder/no-code prototype keyword hunting as primary ICP.

---

## What to track

### Keywords / phrases (initial set — will iterate)

**Agency / operator:**
agency owner, run an agency, marketing agency, our clients need, client asked for, white label,
white-label, fulfilment partner, tech partner, implementation partner, dev team, can't deliver,
turning down work, saying no to clients

**Stack / gap signals:**
GoHighLevel, GHL, n8n, CRM bridge, integration, custom software for clients, vertical SaaS,
patient portal, client portal, workflow automation, software for our clients

**Vertical hints (boost score when combined with gap language):**
dental, insurance, real estate, creator, med spa, HVAC, legal, accounting

**Partnership intent:**
looking for tech partner, need a dev team, outsource development, white label software, build for
our clients

### Deprioritize / negative score

Lovable, Base44, Bolt, "my prototype", solo founder MVP, need a developer for my app (unless they
mention agency + clients)

### Sources (target)

| Platform | Where to look | v1 priority |
|----------|----------------|-------------|
| **LinkedIn** | Agency owner posts, comments on GHL/n8n/white-label topics | **Manual + alerts; automate later** |
| **Reddit** | r/agency, r/digital_marketing, r/gohighlevel, r/n8n, r/Entrepreneur, r/smallbusiness | **Yes** |
| **Indie Hackers** | Agency operators, "help wanted" with client fulfilment angle | v2 |
| **X / Twitter** | Saved search: agency + white label + GHL | Manual / defer |
| **Product Hunt** | Lower priority unless maker is clearly an agency productizing for clients | Defer |

---

## Reply drafting

**Core deliverable.** Draft in **first person as Shubham**, founder of FusionSync.

### Voice and rules

- Sound like a **peer operator**, not a pitch or agency spam.
- **Acknowledge** something specific they said (vertical, client ask, stack pain).
- Add **one useful insight** — e.g. starting on GHL/n8n before custom software, white-label
  fulfilment model, integration-first rollout.
- Mention FusionSync **only if natural** — "we partner with agency owners on exactly this" — no
  hard sell.
- **No** "check out my profile", deck, or Upwork link in comments unless context warrants trust.
- Optional soft close: offer to chat on WhatsApp if the conversation fits (don't spam the link).
- Match platform tone (LinkedIn: professional peer; Reddit: direct and helpful).
- Length: ~2–4 sentences for comments; slightly longer for LinkedIn posts.

### Model

- **Preferred:** Anthropic API, `claude-sonnet-4-6` (or current Sonnet at build time).
- **Alternative:** `services/cursor-enrichment` sidecar pattern.

Pull positioning from `context/fusionsyncai.base.md` and homepage partnership model.

---

## Intent scoring

### v1 — rule-based

| Signal | Weight |
|--------|--------|
| Agency owner + clients need software / can't deliver / turning down work | +3 |
| White-label / tech partner / fulfilment + vertical mention | +2 |
| GHL / n8n / CRM bridge / integration gap alone | +2 |
| Generic "need developer" without agency context | +0 |
| Solo founder / Lovable / prototype-only / showcase post | −2 |

Only **top N** get LLM drafts (cap cost — e.g. top 15–20/day).

---

## Fit with existing stack

Same as before — cron, Postgres `IntentSignal`, enrichment sidecar pattern, AIOS dashboard.
ICP column changes from "founders with prototype pain" to **"agency operators with client tech gap"**.

---

## Suggested phasing

### Phase 1

Reddit (agency subs) → store → draft top N → API list. LinkedIn stays manual until collection
is solved.

### Phase 2

LinkedIn collection (if volume justifies), cross-source dedup, promote to CRM contact.

### Phase 3

Slack digest, LLM intent scoring, optional auto-send with approval.

---

## Data model (sketch — not implemented)

```
IntentSignal
  id, url (unique), platform, author, snippet, fullText?, postedAt
  score, keywordsMatched[], verticalHint?
  draftReply?, draftModel?, draftedAt?
  status: NEW | REVIEWED | ENGAGED | SKIP
  collectedAt, reviewedAt?, engagedAt?
```

---

## Open questions

- [ ] LinkedIn: manual-only indefinitely vs Phantombuster / Google dork RSS?
- [ ] Gold-standard reply examples from Shubham's actual partnership comments?
- [ ] Score threshold before drafting?
- [ ] Tag promoted contacts with `vertical` + `techGap` custom fields in CRM?

---

## Related

- Acquisition context: `aios/aios-current-context.md`
- Business ICP + voice: `context/fusionsyncai.base.md`
- Enrichment sidecar: `services/cursor-enrichment/`
