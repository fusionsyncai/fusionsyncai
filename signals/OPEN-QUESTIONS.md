# Open questions — discussion backlog

## Locked (2026-07-28)

- [x] Tab name: **Outreach** (`/outreach`)
- [x] UI: sub-tabs (Queue, Lists, Import, Timeline, Sources)
- [x] Channels: email, linkedin, reddit, email_linkedin
- [x] LinkedIn: comment + connection note; enrich on research
- [x] email_linkedin: both drafts; send timing fully manual
- [x] First profile: **UK dental marketing / lead gen agencies** (partner motion)
- [x] Geo: **London first** (expand UK later)
- [x] Tracking: manual timeline + manual success status
- [x] Lead lists: GMB batches, Sales Nav CSV → LinkedIn pipeline, manual add — [LEAD-LISTS.md](./LEAD-LISTS.md)
- [x] Starter copy: [COPY-TEMPLATES.md](./COPY-TEMPLATES.md) (iterate from real replies)
- [x] F5Bot: [F5BOT-DENTAL-UK.md](./F5BOT-DENTAL-UK.md)

Full spec: [PRODUCT-SPEC.md](./PRODUCT-SPEC.md)

---

## Still open (before build)

### Research

- [ ] **Google Jobs implementation:** n8n workflow vs small sidecar vs Apify actor?
- [ ] **Jobs match logic:** match on company name/domain from Contact — how fuzzy?

### Enrichment

- [ ] **Email finder:** existing tool/API (Apollo, Hunter) or manual?
- [ ] **What triggers enrichment:** on promote-to-queue, or on Contact create from GMB?

### Technical

- [ ] **LLM path:** cursor-enrichment sidecar vs inline API in AIOS route?
- [ ] **OutreachItem** separate table vs extend Pipeline/Stage system?
- [ ] Link outreach items to **Campaign** or standalone under profile?

---

## Discussion notes

**2026-07-28 (session 4):** Tab = Outreach. London-only GMB. Lead lists (GMB, Sales Nav import,
manual). Copy templates drafted.

**2026-07-28 (session 3):** Dental ICP = agencies not practices. UK. F5Bot doc.

**2026-07-28 (session 2):** Queue/action layer + minimal research.

**2026-07-28 (session 1):** Initial signals folder.

---

## Procrastination guardrails

Stop and ship Phase A if any of these happen:

- Writing scoring rules before first queue send
- Building dedup across channels before 20+ manual outreach items logged
- Adding Instagram/LinkedIn scrapers before Google Jobs + F5Bot are wired
- Perfecting adapter contracts before dental agency profile prompts exist
