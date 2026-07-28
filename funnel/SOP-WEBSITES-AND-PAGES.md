# SOP — Websites, pages, structure & links

How funnel websites are structured, how paths work, how globals fit in, and how publish behaves.

Agent workflow (reconcile / pull-only-what-you-need): [SOP-AGENT-WORKFLOW.md](./SOP-AGENT-WORKFLOW.md).

---

## 1. Hierarchy

```
Business
└── Website
    ├── settings, slug, optional hostname (+ verified)
    ├── headerGlobalComponentId / footerGlobalComponentId (slots)
    ├── WebsiteFolder[] (nested via parentId)
    ├── WebsiteGlobalComponent[] (HEADER | FOOTER | CTA | CUSTOM)
    └── LandingPage[]
          ├── folderId? , isHomePage?, slug
          ├── blocks (draft PageDocumentV2)
          ├── publishedBlocks / publishedPath / status
          └── metaTitle, metaDescription
```

### Ownership rules

- Pages always belong to a **website** (`websiteId`).
- Slug uniqueness is per **(websiteId, folderId)** — not business-wide.
- Exactly one **home page** per website (`isHomePage`). Home public path is always `/` (slug may still be `home` in DB).
- Globals are **website-scoped**. Header/footer slots point at global component ids (string fields on `Website`, not Prisma FKs).

---

## 2. Page document (`PageDocumentV2`)

Schema: `src/schema/landing-pages/document.schema.ts`

```
PageDocumentV2
  version: 2
  googleFont?, pageClassName?, pageEffects?
  sections: (SectionNode | GlobalSectionRefNode)[]

SectionNode → rows → columns → elements
  columns may nest more rows (depth-limited)

GlobalSectionRefNode → { type: 'globalSectionRef', globalComponentId }
```

### Element types

| Type | Role |
|------|------|
| `heading` | `h1`–`h4` + text + className |
| `paragraph` | Text + className |
| `button` | Label + href + className (also used as text links) |
| `image` | src / alt / assetId + className |
| `spacer` | Height via className |
| `form` | `formId` + optional copy overrides (fields live on FunnelForm) |
| `navMenu` | Links + optional mobile CTA; hamburger below `lg`, horizontal at `lg+` |

### Site chrome pattern (recommended — Acme Dental)

1. Create **HEADER** and **FOOTER** globals once.
2. Assign them with `websites.assignGlobalSlots`.
3. Page documents contain **body sections only**.
4. At render time, `resolvePageDocument` injects header **before** page sections and footer **after**.

Do **not** duplicate the full header/footer into every page’s `blocks` when slots are in use.

Pages may also embed `globalSectionRef` for shared mid-page sections (CTA bands, etc.).

---

## 3. Public URLs & link resolution

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Staging | `/sites/w/[websiteId]/[[...path]]` | Published pages by `publishedPath` |
| Custom domain | Host → middleware → `/sites/...` | Requires `hostnameVerified` |
| Legacy live | `/p/[pageId]` | Published page by id |
| Draft preview | `/p/[pageId]/preview` | Auth’d draft |
| Editor | `/dashboard/funnels/pages/[pageId]` | Build / Preview modes |

### Published path formula

Built on publish (`buildPagePublishedPath` / `resolvePublishedPathForPage`):

| Page | `publishedPath` |
|------|-----------------|
| Home | `/` |
| Root page slug `about` | `/about` |
| Folder `services` + slug `dental-implants` | `/services/dental-implants` |

Changing folder slugs after publish can desync paths until pages are republished.

### Canonical links in documents (critical)

Store **site-canonical** hrefs in buttons / `navMenu`:

```text
/           → home
/about
/contact
/services/dental-implants
```

**Never** store staging URLs like `/sites/w/{websiteId}/about` inside page JSON.

At render time, `getWebsiteLinkBase` + `resolveWebsiteHref`:

- Custom verified domain → base `''` (root-relative)
- Staging / legacy `/p/...` → base `/sites/w/{websiteId}`

File: `src/modules/websites/lib/website-link-base.ts`

### Live URL preference (sharing)

`getLandingPageLiveUrl`:

1. Verified hostname + `publishedPath`
2. Else staging `/sites/w/{websiteId}{publishedPath}`
3. Else `/p/{pageId}`

---

## 4. Globals (header / footer / shared sections)

| Concern | Behavior |
|---------|----------|
| Storage | `WebsiteGlobalComponent.section` = full `SectionNode` |
| Slots | `Website.headerGlobalComponentId` / `footerGlobalComponentId` |
| Live site | Resolved every request via `resolvePublicPageDocument` |
| Publish | **Not** copied into `publishedBlocks` |
| Editor | Editing a global shows amber “global” UX; save with explicit **Save global** |

### Implications

- Update header once → all pages show the new header (draft preview and live).
- `websites.publishAll` skipping pages does **not** mean the header is stale — globals already live.
- Deleting a global fails if still slotted or referenced by pages.

### Responsive header (Acme)

Use a `navMenu` element:

- Desktop (`lg+`): horizontal links; separate CTA column optional
- Tablet/mobile: hamburger → floating panel with links + CTA

Template helper: `navMenu(...)` in Acme `helpers.ts`. Update script pattern: refresh header global from `createAcmeSiteHeaderSection()` while preserving section id when possible.

---

## 5. Draft vs publish

| Field | Meaning |
|-------|---------|
| `blocks` | Latest draft document |
| `publishedBlocks` | Last published snapshot of the page body |
| `status` | `DRAFT` \| `PUBLISHED` |
| `publishedPath` | Public path used by staging/domain routing |
| `hasUnpublishedChanges` | Draft snapshot ≠ published snapshot |

### Page publish

`publishLandingPageForBusiness`:

- Requires unpublished draft changes
- Copies draft → published\* fields
- Sets `publishedPath` (collision-checked)
- Sets `status=PUBLISHED`

### Site publish

`publishWebsitePagesForBusiness` / `websites.publishAll`:

- Publishes each page that needs it
- Skips “No draft changes to publish”
- Does not freeze globals into pages

### Unpublish

Sets `status=DRAFT`, clears `publishedAt`. Does **not** necessarily wipe `publishedBlocks` / `publishedPath`.

### Editor Preview mode

Build vs Preview toggle in the page editor:

- Preview hides sidebars, uses viewport presets (375 / 768 / desktop)
- Preview iframe so Tailwind `md:` / `lg:` match frame width
- Links may be disabled in preview chrome — use draft preview route for real navigation

---

## 6. Folders

- Nested `WebsiteFolder` tree; slug segments join into public paths.
- Create service hubs as a folder + overview page + child pages (Acme: `services/`).
- When adding a page under a folder, pass `folderId` on create and use hrefs that include the folder chain.

---

## 7. Export / import

| Bundle | Kind | Includes |
|--------|------|----------|
| Website | `recallsync/website` | Folders, page drafts, forms, globals + slots |
| Single page | `recallsync/funnel-page` | Page draft + referenced forms |

Notes:

- Export uses **draft** `blocks`, not only published snapshots.
- Hostname is not exported.
- Import creates a **new** website (form names must stay unique per business).
- Full website import should preserve page slugs (no `-imported` suffix on intentional full imports).

tRPC: `websites.exportBundle` / `import`, `landingPages.exportBundle` / `import`.

---

## 8. Create / update operations (product)

### Create website

1. `websites.create` (name, slug)
2. Create header/footer globals → `assignGlobalSlots`
3. Create folders as needed
4. Create pages (set one home via `setHomePage`)
5. Create/reuse forms; wire `form` elements
6. Publish when ready

### Create page

See [SOP-AGENT-WORKFLOW.md](./SOP-AGENT-WORKFLOW.md) §5.

Minimal fields: `businessId`, `websiteId`, `title`, `slug`, `document`, optional `folderId`, meta.

### Update page / global

Always reconcile remote draft first ([SOP-AGENT-WORKFLOW.md](./SOP-AGENT-WORKFLOW.md) §3).

---

## 9. Key source files

| Area | Path |
|------|------|
| Websites CRUD / tree / home | `src/modules/websites/lib/websites.ts` |
| Paths | `src/modules/websites/lib/page-path.ts` |
| Globals | `src/modules/websites/lib/global-components.ts` |
| Resolve for public | `src/modules/websites/lib/resolve-public-page-document.ts` |
| Publish site | `src/modules/websites/lib/publish-website.ts` |
| Pages CRUD / publish | `src/modules/landing-pages/lib/landing-pages.ts` |
| Document resolve | `src/modules/landing-pages/lib/document/resolve-globals.ts` |
| Renderer | `src/modules/landing-pages/components/v2/document-renderer.tsx` |
| Nav menu UI | `src/modules/landing-pages/components/v2/nav-menu-element.tsx` |
| tRPC websites | `src/modules/websites/server/websites.router.ts` |
| tRPC pages | `src/modules/landing-pages/server/landing-pages.router.ts` |
