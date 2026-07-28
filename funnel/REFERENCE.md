# Funnel reference cheat sheet

Companion to the SOPs. Prefer SOPs for procedures; use this for quick lookup.

---

## Dashboard routes

| UI | Path |
|----|------|
| Websites list | `/dashboard/funnels/websites` |
| Website tree | `/dashboard/funnels/websites/[websiteId]` |
| Page editor | `/dashboard/funnels/pages/[pageId]` |
| Forms | `/dashboard/funnels/forms` |
| Form editor | `/dashboard/funnels/forms/[formId]` |

---

## Public / preview routes

| Purpose | Path |
|---------|------|
| Staging site | `/sites/w/[websiteId]/...` |
| Custom domain | verified hostname → same published paths |
| Legacy live | `/p/[pageId]` |
| Draft preview | `/p/[pageId]/preview` |

---

## Document element types

`heading` · `paragraph` · `button` · `image` · `spacer` · `form` · `navMenu`

Plus section nodes: `section` → `row` → `column` → elements / nested rows  
Plus `globalSectionRef` in page `sections[]`.

---

## Link rules

```text
✅  href: "/about"
✅  href: "/services/dental-implants"
✅  href: "https://..."
❌  href: "/sites/w/{uuid}/about"
```

Staging prefix is applied at render via `websiteLinkBase`.

---

## tRPC (app)

| Router | Common procedures |
|--------|-------------------|
| `websites` | `list`, `create`, `getTree`, `createFolder`, `setHomePage`, `getPublishSummary`, `publishAll`, `listGlobalComponents`, `createGlobalComponent`, `updateGlobalComponent`, `assignGlobalSlots`, `exportBundle`, `import`, domain helpers |
| `landingPages` (alias `funnels.pages`) | `list`, `get`, `create`, `update`, `publish`, `unpublish`, `delete`, `exportBundle`, `import`, AI generate helpers |
| `funnels.forms` | `list`, `get`, `create`, `update`, `delete` |

Access: authenticated user + business membership (`checkUserAccess`).

---

## REST (API key / MCP-style)

Under `src/app/api/rest/funnel-page/`:

- `GET /api/rest/funnel-page` — list  
- `POST /api/rest/funnel-page` — create  
- `GET|PATCH|DELETE /api/rest/funnel-page/[id]`  
- `POST .../publish` · `POST .../unpublish`  

Backed by `businessFunnelPages.*`. Responses may include `editorPath`, `previewPath`, `livePath`, `stagingPath`.

---

## Existing scripts (repo root `scripts/`)

| Script | Use |
|--------|-----|
| `create-acme-dental-website.ts` | Full Acme seed (`BUSINESS_ID`, `RESET=1`) |
| `update-acme-dental-header-nav.ts` | Refresh Acme header global (`WEBSITE_ID`) |
| `peek-funnel-page.ts <pageId>` | Dump title + draft `blocks` |

New scripts → `funnel/scripts/`.

---

## Acme template path (current)

`src/modules/landing-pages/lib/templates/acme-dental/`

New packs → `funnel/templates/<name>/`.

---

## Publish vs globals

| Change | Need page publish? |
|--------|--------------------|
| Page body / meta / slug | Yes, for live snapshot |
| Header/footer global only | No (live resolve) |
| Form fields | No page publish (form entity); page must already be live with form element |

---

## Agent reconcile (one-liner)

**Pull only what the task needs. Before editing a page/global/form, sync that resource to the latest remote draft. Never bulk-download a 100-page site to add one page.**

Full policy: [SOP-AGENT-WORKFLOW.md](./SOP-AGENT-WORKFLOW.md).

---

## Gotchas

1. Home `publishedPath` is `/` even if slug is `home`.  
2. Globals are not inside `publishedBlocks`.  
3. Export = drafts, not necessarily live.  
4. Form name unique per business.  
5. Slug unique per website+folder.  
6. Preview iframe needed for Tailwind breakpoints.  
7. `@/prisma/client` server-only; `@/prisma/browser` in client.  
8. Old `src/modules/landing-pages/docs/README.md` may be outdated — trust `funnel/` SOPs.  
9. Unpublish ≠ delete published snapshot fields.  
10. Surgical patch > reseed for small edits.

---

## Doc index

1. [README.md](./README.md)  
2. [SOP-AGENT-WORKFLOW.md](./SOP-AGENT-WORKFLOW.md)  
3. [SOP-WEBSITES-AND-PAGES.md](./SOP-WEBSITES-AND-PAGES.md)  
4. [SOP-FORMS.md](./SOP-FORMS.md)  
5. [SOP-TEMPLATES.md](./SOP-TEMPLATES.md)  
6. This file  
