# SOP — Funnel forms

Forms are first-class funnel entities, separate from page documents. Pages only store a **reference** (`formId`) plus optional copy overrides.

Agent reconcile rules: [SOP-AGENT-WORKFLOW.md](./SOP-AGENT-WORKFLOW.md). Website wiring: [SOP-WEBSITES-AND-PAGES.md](./SOP-WEBSITES-AND-PAGES.md).

---

## 1. Model

```
Business
└── FunnelForm          (unique name per business)
    ├── fields[]        FunnelFormField
    ├── webhook URL / token (optional)
    ├── active flag
    └── submissions[]   FunnelFormSubmission (optional landingPageId → Lead)
```

### Field types

`TEXT` | `EMAIL` | `PHONE` | `TEXTAREA` | `NUMBER`

### Page document element

```ts
{
  type: 'form',
  formId: '<funnel-form-uuid>',
  headline?: string,
  subheadline?: string,
  submitLabel: string,
  successMessage: string,
  className: string,
}
```

**Live field definitions always come from the DB form**, not from legacy inline field schemas that may still exist in older document types.

---

## 2. Create a form

1. Confirm `businessId`.
2. Choose a unique `name` within the business (`@@unique([businessId, name])`).
3. Create via `funnels.forms.create` (dashboard: `/dashboard/funnels/forms/new`).
4. Add fields (label, type, required, order).
5. Note the form id for page wiring.

Seed scripts often create one shared “Contact” form and pass `formId` into page builders (Acme: home + contact).

---

## 3. Wire a form into a page

1. Reconcile the target page draft ([SOP-AGENT-WORKFLOW.md](./SOP-AGENT-WORKFLOW.md)).
2. Insert or update a `form` element with the correct `formId`.
3. Optionally override headline / submit / success copy on the element.
4. Save draft; publish page if it must go live.

Public render loads forms with `collectFormIdsFromDocument` / `loadPublicFunnelFormsByIds`. Inactive forms are omitted → empty/missing form UI.

Submit path: `POST /api/funnels/forms/[formId]/submit`.

---

## 4. Update form fields

1. Fetch the form (`funnels.forms.get`) — **do not** invent fields only in local memory.
2. Apply field changes via `funnels.forms.update`.
3. All pages referencing that `formId` pick up field changes without editing page JSON (copy overrides on the element are unchanged unless you edit them).

### Shared vs dedicated forms

| Pattern | When |
|---------|------|
| One shared Contact form | Most marketing sites (Acme) |
| Per-page form | Different fields, webhooks, or compliance needs |

Do not create a new form per page by default.

---

## 5. Export / import

- Page and website exports **include** referenced forms (deduped on website export).
- Import remaps form ids inside documents.
- Watch for **name collisions** on import into a business that already has the same form names.

---

## 6. Agent checklist

- [ ] Form exists (or created) before setting `formId` on an element  
- [ ] Reconciled form + page before edits  
- [ ] Did not duplicate forms unnecessarily  
- [ ] Did not put field schemas into the page document  
- [ ] Verified form is active for public pages  

---

## 7. Key source files

| Area | Path |
|------|------|
| Forms lib | `src/modules/funnels/lib/forms.ts` |
| Public load / collect ids | `src/modules/funnels/lib/public-forms.ts` |
| Submissions | `src/modules/funnels/lib/submissions.ts` |
| Form element UI | `src/modules/landing-pages/components/v2/form-element.tsx` |
| tRPC | `src/modules/funnels/server/forms.router.ts` → `funnels.forms.*` |
| Dashboard | `/dashboard/funnels/forms` |
