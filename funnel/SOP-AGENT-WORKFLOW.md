# SOP — Agent workflow (create / update / reconcile)

Use this runbook whenever an agent (or human following the same discipline) creates or edits funnel websites, pages, forms, or globals.

**Core rule:** Never bulk-sync an entire website “just in case.” Pull **only** the resources the task needs. Always reconcile local copies against the **latest saved draft** before editing.

Related: [SOP-WEBSITES-AND-PAGES.md](./SOP-WEBSITES-AND-PAGES.md) · [SOP-FORMS.md](./SOP-FORMS.md) · [SOP-TEMPLATES.md](./SOP-TEMPLATES.md) · [REFERENCE.md](./REFERENCE.md)

---

## 1. Definitions

| Term | Meaning |
|------|---------|
| **Remote** | What’s in the database (via Prisma script, tRPC, REST/MCP, or dashboard) |
| **Local** | A TypeScript template / patch script / exported JSON under `funnel/` (or an in-progress edit session) |
| **Draft** | `LandingPage.blocks` (+ title, slug, meta) — what the editor saves |
| **Published** | Live snapshot: `publishedBlocks`, `publishedPath`, `status=PUBLISHED` |
| **Global** | `WebsiteGlobalComponent.section` — header/footer/CTA/custom; resolved live into pages |

“Latest saved draft” = remote draft JSON after the user’s last **Save draft** (or last scripted `update`). Not necessarily what’s published.

---

## 2. Decide the task type

Before touching anything, classify the ask:

| User ask | Task type | What to fetch |
|----------|-----------|---------------|
| “Create a new page on site X” | **Create page** | Website id, folder (if any), existing slug collisions on that folder, forms if needed, **globals only if wiring nav/CTA** |
| “Update page Y / the About page” | **Update page** | That page’s latest draft (+ its form ids if present) |
| “Change the site header / footer” | **Update global** | That global component only |
| “Add a form / change form fields” | **Form** | Form record (+ page element `formId` if wiring) |
| “Publish the site / this page” | **Publish** | Publish summary or target page — no full page dump needed |
| “Build a whole new website from a template” | **Seed site** | Business id; use a seed script / template pack |
| “Export / import” | **Bundle** | Export API or script for the website/page |

If the ask is ambiguous (“fix Acme”), ask which **website id / name** and which **page path or page id**.

---

## 3. Reconciliation policy (mandatory)

### 3.1 Do not sync the whole site

A website may have dozens or hundreds of pages.

- **Do not** download, export, or recreate all pages locally unless the user explicitly asks for a full site sync / reseed / export.
- For “add one page,” inspect tree metadata (names, slugs, folders) only as needed for uniqueness and linking — not full `blocks` for every page.
- For “update one page,” reconcile **that page** (and any globals you will edit). Leave the other 99 alone.

### 3.2 Before updating a page

```
IF local template / patch for this page does NOT exist
  → Pull latest remote draft for that pageId into local (see §4)
  → Then apply the requested changes
ELSE (local already exists)
  → Pull latest remote draft
  → Diff / reconcile: remote wins for baseline unless user said otherwise
  → Re-apply intended edits on top of the reconciled baseline
  → Push update (save draft)
```

Never edit from memory of an old peek. Remote draft is source of truth for “what’s live in the editor.”

### 3.3 Incoming vs local conflicts

When local and remote differ:

1. Prefer **remote draft as baseline** (user may have edited in the dashboard).
2. Re-apply the **current task’s** changes on that baseline.
3. If remote contains structural work you would destroy (new sections the user added), **stop and ask** before overwriting.
4. Do not silently replace a page with a full template rebuild unless the user asked to “rebuild from template” or “reset this page.”

### 3.4 Globals

- Header/footer edits: update the **global component**, not every page.
- After changing a global, pages do **not** need republish for the change to appear on live renders (globals resolve live). Still **publish pages** if you also changed page drafts that must go live.
- If a local header template exists under `funnel/templates/...`, reconcile against remote global `section` the same way as pages (§3.2).

### 3.5 Forms

- Forms are shared across pages by `formId`.
- Reconcile the form record before changing fields.
- Do not duplicate forms per page unless the user wants separate forms.

---

## 4. How to pull / peek remote state

Prefer the smallest read that answers the question.

| Need | How |
|------|-----|
| List websites for a business | Prisma / `websites.list` / dashboard |
| Tree (folders + page titles/slugs, not full docs) | `websites.getTree` |
| One page draft | `landingPages.get` or `npx tsx scripts/peek-funnel-page.ts <pageId>` |
| Globals for a site | `websites.listGlobalComponents` |
| Forms | `funnels.forms.list` / `get` |
| Publish status | `websites.getPublishSummary` |

When creating a **local working copy** under `funnel/` for an existing remote page:

1. Peek / get the page.
2. Save a snapshot if useful: `funnel/templates/<site>/_snapshots/<slug>-draft.json` (optional; gitignore large dumps if noisy).
3. Or regenerate / hand-port into a TypeScript builder under `funnel/templates/<site>/pages/`.
4. Record `pageId`, `websiteId`, `businessId`, slug, and folder in a short `funnel/templates/<site>/MANIFEST.md`.

You do **not** need a local file for pages you are not touching.

---

## 5. Create page — procedure

1. Confirm `businessId` + `websiteId` (and folder if nested).
2. Check slug uniqueness **within that website + folder** (`ensureUniquePageSlugInWebsite` / tree).
3. Reuse an existing form or create one ([SOP-FORMS.md](./SOP-FORMS.md)).
4. Build `PageDocumentV2` body sections only if the site uses header/footer **slots** (Acme pattern). Do not duplicate header/footer into the page JSON.
5. Use **canonical hrefs** in buttons/nav (`/about`, `/contact`) — never hardcode `/sites/w/...`.
6. Create via `landingPages.create` / REST / seed script.
7. Save draft. Publish only if the user asked to publish (or the task clearly requires live).
8. If nav should include the new page, update the **header global** `navMenu` / links — reconcile that global first (§3.4).

### Do not

- Clone all existing pages locally.
- Copy header/footer into the new page when slots already provide them.
- Publish other unrelated dirty pages unless asked.

---

## 6. Update page — procedure

1. Identify page by id or by `(websiteId + publishedPath/slug)`.
2. **Reconcile** (§3.2): ensure local baseline matches latest remote draft.
3. Apply surgical edits (prefer patching sections/elements over rewriting the whole document).
4. Push `landingPages.update` (draft save).
5. If the user wants it live: `landingPages.publish` or `websites.publishAll` (only when bulk publish is intended).
6. Verify in editor Preview (viewport 375 / 768 / desktop) and/or `/p/[id]/preview`.

### Surgical vs rebuild

| Prefer surgical patch when | Prefer full rebuild when |
|----------------------------|--------------------------|
| Copy, CTA, one section, image, form swap | User asked to redesign / reset from template |
| Page already customized in dashboard | Page is still a pure seed with no manual edits |

When unsure, peek remote and ask.

---

## 7. Update header / footer (global) — procedure

1. Load website → `headerGlobalComponentId` / `footerGlobalComponentId`.
2. Fetch that global’s `section`.
3. Reconcile any local template (`createXHeaderSection`) against remote.
4. Update via `websites.updateGlobalComponent`.
5. Spot-check any page in Preview — no page republish required for global-only changes.
6. If you also changed page bodies, publish those pages separately.

---

## 8. Publish — procedure

| Goal | Action |
|------|--------|
| One page live | `landingPages.publish` for that `pageId` |
| Whole site live | `websites.publishAll` (skips pages with no draft changes) |
| Global-only change | No page publish needed |

Remember: publish copies **page draft → published snapshot**. Globals are not baked into `publishedBlocks`.

---

## 9. Seed / reseed a site

Use only when the user wants a **new** website or an explicit reset.

1. Prefer a script under `funnel/scripts/` (or existing `scripts/create-acme-dental-website.ts` until migrated).
2. `RESET=1` deletes/recreates — **destructive**. Confirm website name / id first.
3. After seed, record ids in `MANIFEST.md` for future surgical updates.

Do not reseed to apply a one-line copy change on one page.

---

## 10. Checklist before finishing a task

- [ ] Touched only the pages/globals/forms required by the ask  
- [ ] Reconciled against latest remote draft before editing  
- [ ] Canonical internal links (`/path`), not staging URLs  
- [ ] Header/footer left as globals when the site uses slots  
- [ ] Forms referenced by `formId`, fields edited on the form entity  
- [ ] Draft saved; published only if requested / required  
- [ ] Mobile/tablet nav considered if header/nav changed (`navMenu`)  
- [ ] Local template/script under `funnel/` updated if this site is tracked there  

---

## 11. Anti-patterns

| Don’t | Do instead |
|-------|------------|
| Export all 100 pages to “be safe” | Fetch tree + the one page |
| Edit local template that’s weeks stale | Peek remote, then edit |
| Paste header into every page | Update header global |
| Hardcode `/sites/w/{id}/about` in documents | Use `/about` |
| Reseed the website for a typo | Patch that page draft |
| Assume publish is needed after global edit | Verify live resolve; publish pages only if page drafts changed |
| Invent form fields inside the page JSON | Edit `FunnelForm` / fields via forms API |
