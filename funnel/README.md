# Funnel docs & library

This folder is the **canonical home** for funnel/website work: SOPs, page templates, and related scripts.

Existing app code under `src/modules/{landing-pages,websites,funnels}` stays where it is. New templates and funnel-specific scripts should be added here (see [`templates/`](./templates/) and [`scripts/`](./scripts/)).

## Quick map

| Doc | What it covers |
|-----|----------------|
| [SOP-AGENT-WORKFLOW.md](./SOP-AGENT-WORKFLOW.md) | **Start here for agents.** Reconcile remote drafts, pull only what you need, update/create/publish safely |
| [SOP-WEBSITES-AND-PAGES.md](./SOP-WEBSITES-AND-PAGES.md) | Website tree, pages, folders, globals, URLs, links, publish |
| [SOP-FORMS.md](./SOP-FORMS.md) | Funnel forms, fields, wiring into page documents |
| [SOP-TEMPLATES.md](./SOP-TEMPLATES.md) | How to author templates (Acme Dental pattern) and seed sites |
| [REFERENCE.md](./REFERENCE.md) | Cheat sheet: element types, paths, tRPC, scripts, gotchas |

## Product surface (dashboard)

- Websites: `/dashboard/funnels/websites`
- Page editor: `/dashboard/funnels/pages/[pageId]`
- Forms: `/dashboard/funnels/forms`

## Mental model (one paragraph)

A **Website** owns folders, pages, and optional **global components** (header/footer slots). Each **LandingPage** stores a draft `PageDocumentV2` (`blocks`) and, when published, a live snapshot (`publishedBlocks` + `publishedPath`). Forms are **business-scoped** and linked into pages by `formId`. Header/footer globals resolve **live** on every render — editing a global does not require republishing every page.

## Reference implementation

**Acme Dental** (multi-page site with shared header/footer, services folder, contact form, responsive `navMenu`) currently lives at:

`src/modules/landing-pages/lib/templates/acme-dental/`

Seed / update scripts (today):

- `scripts/create-acme-dental-website.ts`
- `scripts/update-acme-dental-header-nav.ts`

New template packs and funnel scripts should go under `funnel/templates/` and `funnel/scripts/` going forward.
