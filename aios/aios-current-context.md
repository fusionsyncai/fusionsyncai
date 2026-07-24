# AIOS — Current Context

> Rolling scratchpad for the **current** focus. Keep it minimal. When focus shifts,
> replace stale sections — do not append history. This is a fresh-session primer, not a changelog.

_Last updated: 2026-07-01_

## Now

**FusionSync is a white-label tech partner for agency owners** — not solo-founder MVP shop, not
cold outbound to strangers. Site: [fusionsync.ai](https://www.fusionsync.ai/).

**Primary conversion path:** warm agency operator → **WhatsApp partnership conversation** with
Shubham (vertical, client count, tech gap). Homepage + YouTube video (*White-Glove Tech Partner —
Part 1*) tell the same story.

**ICP:** agency owners with **paying clients in one vertical** who have a **daily tech gap**
(software, CRM bridges, integrations they cannot ship in-house). Enough volume that white-label
fulfilment beats hiring devs or saying no.

**Offer (public):** phased partnership — stack first (GHL + n8n + integrations, ~5 clients) →
production white-label software → ownership milestones (25 = market, 100 = global). Typical
engagement **$20k+**. Path A: white-glove ops retainer. Path B: full handoff.

**Proof on site:** UK dental agency partner, creator monetization build, real estate underwriting,
vertical SaaS fulfilment. Shubham leads delivery; team of 5 ships. Top Rated Plus, 35+ deliveries
(Upwork = credibility mention, not primary CTA).

## Acquisition (what AIOS should optimize for)

Intent surfaces → stage in local CRM → enrich → human first touch → **WhatsApp partnership chat**.

Priority lanes (agency operators, not Lovable founders):
1. **LinkedIn** — agency owners discussing client tech gaps, GHL/n8n, white-label, fulfilment pain
2. **Reddit / communities** — r/agency, r/gohighlevel, r/n8n, r/digital_marketing, r/Entrepreneur
3. **Website / YouTube inbound** — live-chat + WhatsApp from homepage and video CTA
4. **Intent Signal Monitor** — ranked posts + draft replies (`aios/intent-signal-monitor.md`)

**Not ICP for outbound:** idea-stage founders, Lovable/Base44 prototype posts, speculative builds,
partners with no signed clients.

**North India Dev Agency Outreach** — legacy RecallSync primary agent; related motion but site
positioning is sharper. Live agent config is in RecallSync only (MCP/CLI).

## Prod RecallSync account

Business account: `97f02e22-8758-4957-805f-1964da89419d`. MCP: `recallsync-primary`.
Use MCP for all RecallSync reads/writes (never REST from this repo).

**FusionSync Primary** agent: `6809f43d-8de2-4101-b4b5-982c1ed3c055`

## Local AIOS CRM (lead factory)

- Root Next.js app on `http://localhost:3010` — contacts, campaigns, enrichment pipeline.
- Enrichment: `services/cursor-enrichment` (port 5070) → `cursor-agent` → callback to CRM.
- Enrichment `instructions` / `outputs` should reflect **agency partnership** context (vertical,
  client count, tech gap, integration targets), not founder prototype-to-production.
- Typical custom fields: `personalizedHighlight`, `vertical`, `clientVolumeSignal`, `techGap`,
  `integrationTargets`, `partnershipFit`.

## Secret model (important)

- Git stores only `${PLACEHOLDER}` in headers. The **agent never reads `.env` / `.env.local`**.
- Local scripts: `scripts/smoke-webhook.mjs`, `scripts/reconcile-flow.mjs`, `scripts/secret.mjs`.
- All RecallSync writes go through **MCP**. Server encrypts with `ENCRYPTION_KEY`.

## Key paths

- Business context: `context/fusionsyncai.base.md`, `context/fusionsyncai-contact-info.md`
- Agents: live in RecallSync — `get-primary-agents` / `node scripts/recallsync-cli.mjs --json primary-agent list`
- Intent signals (ideation): `aios/intent-signal-monitor.md`
- SOPs: `sops/channel-agent/`, `sops/campaign/`, `sops/automation/`
- MCP coverage map: `recallsync/coverage.md`

## Voice / framing for agents & enrichment

- **We are:** invisible white-label tech partner for agency owners with vertical client demand.
- **We are not:** freelancer body shop, chatbot agency, solo-founder prototype fixer, cold pitch machine.
- **CTA default:** continue on **WhatsApp** for a partnership fit conversation (already on WhatsApp/DM
  on those channels → book call with Shubham). Upwork link = brief credibility only.
- **Tone:** calm operator-to-operator, peer partnership — expertise before pitch; selective ("not
  looking for everyone").

## Next / open

- Sync updated FusionSync Primary channel agents to RecallSync via MCP (live-chat, WhatsApp,
  Instagram, WP Call).
- Update Email + Facebook channel agents when those get refreshed (still legacy founder copy in prod).
- Define **agency-partnership campaign** in local CRM (ICP tags, enrichment schema).
- Build Intent Signal Monitor Phase 1 when ready (Reddit/LinkedIn agency keywords + draft replies).
