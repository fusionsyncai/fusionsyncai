# Use cases — configurable profiles

Each **profile** is a bundle of: ICP, signal definitions, source integrations, scoring weights,
CRM mapping, and outreach motion. The engine runs the same pipeline; only config changes.

---

## Profile schema (conceptual)

```
SignalProfile
  id, name, slug, active
  icpDescription
  signals[]          → refs SIGNAL-TYPES.md
  integrations[]     → refs INTEGRATIONS.md (enabled channels + creds)
  keywords[]         → include / exclude / boost
  scoringRules[]     → rule-based v1; LLM assist optional
  crmTarget          → AIOS | RecallSync | both
  crmFieldMapping    → vertical, techGap, signalSummary, …
  outreachMotion     → email | linkedin | reddit | email_linkedin | multi
  draftVoice         → prompt template / agent id
  digestSchedule     → cron, top N per day
```

Profiles are **not** separate codebases — one config document (JSON/YAML/DB row) per vertical/motion.

---

## Profile: UK dental marketing / lead gen agencies (**v1 — build first**)

**Buyer:** UK agencies that **serve dental practices** — marketing, lead gen, GHL/PPC shops with
paying dental clients. **Not** practice owners. Same partnership motion as FusionSync homepage:
agency keeps relationships; we white-label patient acquisition systems and integration fulfilment.

**Primary channels:** Email + LinkedIn (`email_linkedin` when both), Reddit for agency-operator posts.

**Geo:** UK (first GMB pull)

**Research stack (v1):**

| Source | Role |
|--------|------|
| GMB scraper | Universe — `"dental marketing agency UK"` etc. → AIOS `Contact` |
| Google Jobs | Trigger — agency hiring VA / setter / coordinator for **dental client** work |
| F5Bot | Agency subreddits + dental-vertical keywords → [F5BOT-DENTAL-UK.md](./F5BOT-DENTAL-UK.md) |
| LinkedIn | Manual — agency owners posting about dental clients, GHL, fulfilment gaps |

**Example signals:**

| Signal | Example public evidence |
|--------|-------------------------|
| Client fulfilment gap | "Dental client wants recall automation we can't build" |
| Hiring for capacity | Hiring appointment setter / VA for dental clients |
| Stack / integration pain | GHL + Dentally / Exact / OpenDental bridge complaints |
| Vertical focus + growth | "We specialize in dental" + new hire or new service line |

**Outreach:** Peer agency tone — patient acquisition / integration partner, not selling to practices.  
**Full v1 walkthrough:** [PRODUCT-SPEC.md](./PRODUCT-SPEC.md)

---

## Profile: FusionSync white-label partner (v2)

**Buyer:** agency owner with paying clients in one vertical; daily tech gap they cannot ship in-house.

**Primary channels:** LinkedIn, Reddit (r/agency, r/gohighlevel, r/n8n, …)

**Example signals:**

| Signal | Example public evidence |
|--------|-------------------------|
| Client tech gap | "Client asked for a portal we can't build" |
| White-label search | "Looking for fulfilment / tech partner" |
| Stack pain | GHL + n8n + integration complaints |
| Capacity | Turning down work, need dev team |

**Outreach:** Comment/reply first (peer tone) → WhatsApp partnership chat.  
**Existing spec:** [aios/intent-signal-monitor.md](../aios/intent-signal-monitor.md)

---

## Profile: Real estate client acquisition

**Buyer:** broker, team lead, or prop-tech agency serving agents.

**Primary channels:** LinkedIn, Reddit (r/realtors, r/RealEstate), job posts, Google News

**Example signals:**

| Signal | Example public evidence |
|--------|-------------------------|
| Team expansion | Hiring ISA, showing assistant, lead coordinator |
| Lead gen frustration | "Zillow leads aren't converting", CRM complaints |
| New market / office | Opening second office, expanding team |
| Tech stack gap | Follow Up Boss, KVCore, custom portal asks |

**Outreach:** DM or comment tied to expansion or hiring signal.

---

## Profile: Directory research (cross-cutting)

Not a sales motion by itself — **feeds entity resolution** for all profiles.

**Source:** Google Maps / Search (existing [gmaps-harvester](../services/gmaps-harvester/))

**Use:** When a signal mentions "Smile Dental Austin", directory research confirms website, phone,
locations, review volume — enriches CRM before outreach.

**Always-on:** yes, as integration type `google_directory` (see [INTEGRATIONS.md](./INTEGRATIONS.md)).

---

## Adding a new profile (checklist)

1. Write ICP in one paragraph
2. List 3–5 **high-intent signals** with real example posts (gold samples)
3. Pick integrations that actually surface those signals (don't enable Instagram if signals are on LinkedIn)
4. Define CRM fields + campaign/agent hook
5. Run **manual** for 2 weeks; only then automate collection
