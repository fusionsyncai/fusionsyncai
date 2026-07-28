# SOP — Templates & seed scripts

How to author reusable website/page templates and scripts. **New** template packs and funnel scripts belong under this `funnel/` tree.

Existing Acme Dental code remains in the app until intentionally migrated — do not move it as part of routine page work.

---

## 1. Where things live

| Kind | Canonical (going forward) | Current reference (do not break) |
|------|---------------------------|----------------------------------|
| Template packs | `funnel/templates/<pack-name>/` | `src/modules/landing-pages/lib/templates/acme-dental/` |
| Seed / update scripts | `funnel/scripts/` | `scripts/create-acme-dental-website.ts`, `scripts/update-acme-dental-header-nav.ts`, `scripts/peek-funnel-page.ts` |
| SOPs / reference | `funnel/*.md` | — |

Each pack should include a short `MANIFEST.md` listing remote `businessId` / `websiteId` / page ids when tied to a live site (optional for pure starter templates).

---

## 2. Recommended pack layout

```text
funnel/templates/<pack-name>/
  MANIFEST.md          # optional live ids + notes
  tokens.ts            # brand colors, shared class tokens, CTA hrefs
  helpers.ts           # heading, para, btn, navMenu, section/row/col, pageShell
  shared.ts            # header section builder, footer, nav link list
  pages/
    home.ts
    about.ts
    contact.ts
    ...
  index.ts             # public exports
```

Scripts:

```text
funnel/scripts/
  create-<pack>-website.ts
  update-<pack>-header.ts
  README.md
```

Run with: `npx tsx funnel/scripts/create-<pack>-website.ts` (after env is loaded the same way as existing scripts).

---

## 3. Acme Dental pattern (reference)

### Design rules learned building Acme

1. **Tokens first** — shared Tailwind class strings (`ACME.navLink`, `ACME.cta`, brand name/phone).
2. **Helpers only** — never hand-roll raw element objects in page files; use `heading` / `para` / `btn` / `navMenu` / `formEl` / `section` / `row` / `col`.
3. **`pageShell`** — wraps body sections with page font / background; **does not** include header/footer.
4. **Globals for chrome** — `createAcmeSiteHeaderSection()` + `createAcmeFooter()` become HEADER/FOOTER globals + slots.
5. **Canonical nav** — `ACME_NAV_LINKS` with `/`, `/about`, `/services`, etc.
6. **Folders for hubs** — `services/` folder + overview + detail pages.
7. **One contact form** — pass `formId` into builders that need it.
8. **Responsive nav** — `navMenu` with mobile CTA; desktop CTA column `hidden … lg:flex`.
9. **Publish after seed** — seed script publishes each page so staging works immediately.

### Intended Acme tree

| Path | Page |
|------|------|
| `/` | Home |
| `/about` | About |
| `/case-studies` | Case studies |
| `/contact` | Contact (+ form) |
| `/services` | Services overview |
| `/services/{slug}` | Service detail pages |

### Seed script responsibilities

`scripts/create-acme-dental-website.ts` (today):

1. Resolve `BUSINESS_ID` (or first business)
2. Optional `RESET=1` delete existing Acme website
3. Create website + contact form
4. Create header/footer globals and assign slots
5. Create folders + pages from builders
6. Set home page
7. Publish pages

Header-only refresh: `scripts/update-acme-dental-header-nav.ts` — rebuilds header from template, preserves section id when present, writes via `updateWebsiteGlobalComponent`. Env: `WEBSITE_ID` or name match `Acme Dental (1)`.

---

## 4. Creating a new template pack

1. Copy the Acme folder structure into `funnel/templates/<new-pack>/` (or start empty and mirror helpers).
2. Replace tokens / copy / nav / services list.
3. Keep page builders returning **body-only** documents if using global slots.
4. Add `funnel/scripts/create-<pack>-website.ts` that:
   - Creates website, globals, folders, pages, form
   - Does **not** require agents to sync unrelated sites
5. Document env vars in the script header and in `funnel/scripts/README.md`.
6. For ongoing client work, after first seed, switch to **surgical updates** per [SOP-AGENT-WORKFLOW.md](./SOP-AGENT-WORKFLOW.md) — do not reseed for small edits.

---

## 5. Updating a live site from a template

| Situation | Action |
|-----------|--------|
| New page from pack | Build document from template helper → create page remotely. Update header nav global if needed. |
| Existing page, local builder exists | Peek remote draft → reconcile → update builder or apply patch → push draft |
| Existing page, no local file | Peek remote → optionally add `pages/<slug>.ts` under the pack → then edit |
| Header/footer change | Update `shared.ts` → run update-global script or `updateGlobalComponent` |
| Full redesign of one page | Confirm with user → replace draft from builder (destructive to dashboard-only edits) |

Never “sync all pack pages to remote” unless the user asks for a full reseed/reset.

---

## 6. Local vs remote for templates

Templates are **generators**, not a two-way CMS sync.

- Remote draft can diverge after dashboard edits.
- Before using a local builder to overwrite remote, **reconcile** (peek + diff).
- Prefer patching remote JSON / targeted section updates when the page has been heavily customized in the UI.

---

## 7. Prisma / env notes for scripts

- Load `.env.local` / `.env` (see existing scripts).
- Use `getPrismaClientSync(DATABASE_URL)`.
- Server-only Prisma: `@/prisma/client` (never in `"use client"` files).
- User runs `prisma generate` / package installs locally when schema deps change — agents should not assume they can install freely (repo convention).

---

## 8. Checklist for a new pack

- [ ] `tokens`, `helpers`, `shared`, `pages/*`, `index`  
- [ ] Header uses `navMenu` (or equivalent) for mobile  
- [ ] Canonical hrefs only  
- [ ] Form id injected where needed  
- [ ] Seed script + optional header update script under `funnel/scripts/`  
- [ ] README / MANIFEST notes business assumptions  
- [ ] Does not modify unrelated existing templates unless asked  
