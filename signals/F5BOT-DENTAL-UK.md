# F5Bot — Reddit monitoring (dental agency profile)

_Config for v1 **UK dental marketing / lead gen agency** outreach. F5Bot is free — webhook into AIOS
when we wire Phase D._

---

## What we're listening for

**Buyer:** UK agencies that **serve dental practices** (marketing, lead gen, GHL shops) — not
practice owners. Same partnership model as [fusionsync.ai](https://www.fusionsync.ai/): you keep the
client relationship; we white-label patient acquisition / integration fulfilment.

Posts should indicate **agency operator pain** or **dental vertical focus**, not patient questions.

---

## Subreddits (priority order)

### Tier 1 — agency operators (start here)

| Subreddit | Why |
|-----------|-----|
| **r/agency** | Core — owners discussing clients, fulfilment, hiring |
| **r/digital_marketing** | Lead gen / marketing shop owners |
| **r/gohighlevel** | High density of agency + dental GHL setups |
| **r/PPC** | Paid lead gen agencies; dental is common vertical |

### Tier 2 — ops / automation angle

| Subreddit | Why |
|-----------|-----|
| **r/n8n** | Integration / workflow pain (agency builders) |
| **r/automation** | Broader automation requests |
| **r/Entrepreneur** | Filter mentally for agency + clients language |
| **r/smallbusiness** | Smaller agency owners |

### Tier 3 — optional / noisy

| Subreddit | Why |
|-----------|-----|
| **r/marketing** | Volume high; many non-agency posts — use strict keywords |
| **r/freelance** | Sometimes agency-adjacent; lower priority |
| **r/dentistry** | Mostly **practices**, not agencies — **deprioritize** unless post mentions "our clients" / agency context |

**Skip for v1:** r/DentalPracticeManagement (practice owners), r/UKPersonalFinance-style subs.

---

## F5Bot keyword sets

Configure as separate alerts or one combined feed; start with **Set A + Set B** (max ~10 alerts on
free tier — combine with OR where F5Bot allows).

### Set A — Dental vertical + agency (high intent)

```
dental clients
dental client
dental agency
dental marketing agency
dental lead gen
dental leads
patient acquisition dental
dental vertical
our dental clients
dental practice clients
```

### Set B — Fulfilment / tech gap (agency voice)

```
can't deliver
turning down work
white label
white-label
need a dev
tech partner
fulfilment partner
fulfillment partner
build for our clients
integration for client
custom software for clients
```

### Set C — Stack + dental client context

```
GoHighLevel dental
GHL dental
n8n dental
Dentrix integration
OpenDental integration
Dentally integration
Exact dental
dental CRM
dental recall
dental booking
dental appointment
PMS integration
```

### Set D — Hiring = capacity pain (agency hiring for client work)

```
hiring VA dental
dental appointment setter
dental patient coordinator
dental receptionist remote
hire for dental clients
```

### Set E — UK-specific (boost when combined with agency language)

```
UK dental
NHS dental
Dentally
Exact Software dental
private dental UK
GDC
```

---

## Negative filters (ignore / down-rank manually)

Skip posts that match these patterns — practice owner, not agency:

- "I'm a dentist" / "my practice" / "our office" (without agency/client language)
- Patient advice, clinical questions, salary threads
- Job seekers ("looking for work in dental marketing")
- Vendor ads / course spam

**LLM not required for v1** — you glance at F5Bot email/webhook and reject junk in seconds.

---

## Example posts worth qualifying (archetypes)

1. *"We run a small agency — 8 dental clients on GHL — client wants recall automation tied to
   Dentally and we're stuck."* → **High** — stack gap, dental vertical, agency
2. *"Anyone white-labeling patient acquisition for dental? We're turning down requests."* → **High**
3. *"Hiring remote coordinator for our dental lead gen clients — phones and booking still manual."*
   → **Medium-high** — hiring signal, agency
4. *"How do you handle no-shows for dental clients?"* → **Medium** — only if poster history shows
   agency operator
5. *"Best marketing for my dental practice in London?"* → **Skip** — practice owner

---

## Webhook → queue flow (when built)

```
F5Bot hit → AIOS webhook → create OutreachItem (reddit pipeline)
  → attach: subreddit, url, title, snippet, matched keyword
  → optional: link to Contact if company name found in post history
  → you qualify → AI drafts comment → timeline
```

---

## Related

- Profile: [USE-CASES.md](./USE-CASES.md) — dental agency ICP
- Spec: [PRODUCT-SPEC.md](./PRODUCT-SPEC.md)
