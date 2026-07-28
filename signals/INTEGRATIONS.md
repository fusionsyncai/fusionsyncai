# Integrations — channel adapters

The Signal Engine uses **adapters** to feed research and queue inputs. Profiles enable a subset per
use case.

**v1 dental stack (agreed):** GMB universe + Google Jobs filter + F5Bot + manual LinkedIn.  
See [PRODUCT-SPEC.md](./PRODUCT-SPEC.md).

---

## Adapter contract (conceptual)

```
Input:  profile config + cursor/watermark (last run)
Output: SignalEvent[] + next cursor
Errors: rate limit, auth expiry → alert, don't silent-fail
```

Adapters can be:

- **Sidecar HTTP services** (like `gmaps-harvester`) — Playwright or API wrapper
- **n8n workflow nodes** — cron + HTTP + transform
- **Webhook receivers** — F5Bot, Google Alerts RSS, Apify actor finished
- **Manual ingest** — paste URL for human-found signals (v0)

---

## v1 dental integrations (priority)

| Integration | Role in v1 | Build vs use |
|-------------|------------|--------------|
| **GMB / gm-scraper** | Universe → `Contact` | **Use existing** AIOS gm-scraper + gmaps-harvester |
| **Google Jobs** | "Why now" — hiring VA/receptionist at universe companies | **Wire new** (cron or n8n) |
| **F5Bot** | Reddit keyword hits → webhook | **Configure** (free, no build) |
| **LinkedIn** | Post/profile discovery | **Manual** v1 |
| **Enrichment** | Email + LI lookup, company background on Contact | **Extend** cursor-enrichment / existing pipeline |

Everything else (Instagram, LinkedIn scrape APIs, Clay webhook) is **post-v1**.

| Integration | Best for | Signal examples | Access model | v1 priority |
|-------------|----------|-----------------|--------------|-------------|
| **Google Search / Directory** | Entity research, local businesses | NAP, reviews, "new location" on site | Own harvester ([gmaps-harvester](../services/gmaps-harvester/)) | **Always on** |
| **Google Jobs / News** | Hiring, press, expansion | VA hire, grand opening article | Scrape/API/RSS | High |
| **LinkedIn** | Agency owners, growth posts | New location, partner search, stack pain | 3rd-party API or manual+alerts | High (manual first) |
| **Reddit** | Honest stack/practice complaints | PMS pain, agency fulfilment | Official API, F5Bot, RSS | High |
| **Job boards** (Indeed, etc.) | Structured hiring signals | Receptionist, coordinator, ISA | Aggregator via Google Jobs or Apify | High |
| **Facebook / Groups** | Dental practice owner forums | PMS rants, vendor asks | Hard — limited API; defer | Low |
| **Instagram** | Brand/marketing agencies | Less B2B intent for our ICPs | Hard — defer | Low |
| **X / Twitter** | Real-time intent | "Need dev partner", tool complaints | API tier / manual search | Medium |
| **Indie Hackers / forums** | Agency operators | Fulfilment posts | RSS/scrape | v2 |
| **Webhook (Clay/etc.)** | Optional external enricher | Any | Inbound webhook | Optional hybrid |

---

## Per-profile integration examples

### Dental patient acquisition

```
enabled: [google_directory, google_jobs, linkedin, reddit]
primary: google_jobs (VA hire), linkedin (expansion posts)
secondary: reddit (PMS complaints)
directory: google_directory (enrich every qualified signal)
```

### FusionSync agency partner

```
enabled: [reddit, linkedin, google_directory]
primary: reddit (agency subs), linkedin (manual → automate later)
directory: optional enrich on promote-to-CRM
```

### Real estate client acquisition

```
enabled: [google_jobs, linkedin, reddit, google_news]
primary: google_jobs (ISA hire), linkedin (team expansion)
```

---

## Google Search / directory — special role

**Not** a signal source for "someone complained today."  
**Is** the backbone for:

- Confirming business identity from a fuzzy signal ("Smile Dental")
- Pulling website, phone, location count for CRM
- Periodic **watch list** re-scan (did they add a location page?)

This is why **google_directory** is always available in every profile even when outbound is LinkedIn-only.

---

## Auth & ops notes

- Store credentials per integration in env / secrets — never in profile JSON in git
- Rate limits: stagger crons per adapter; global daily LLM eval budget per profile
- **ToS risk:** prefer official APIs + paid scrapers over home-grown LinkedIn login bots
- Log raw payload hash for dedup (`url` unique where possible)

---

## Dedup across channels

Same company may appear as:

- LinkedIn post about new location
- Google News article
- Job listing for front desk

Entity resolution merges on: domain, company name fuzzy match, phone, LinkedIn company id.

Dedup rule: same `signalType` + same `entity` within 14 days → suppress duplicate outreach.
