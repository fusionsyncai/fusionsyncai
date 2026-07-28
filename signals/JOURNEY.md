# Feature journey — Campaign → Outreach Profile

How to run the **London dental agency** motion end-to-end.

---

## Mental model

| System | Job |
|--------|-----|
| **GM Scraper / CSV / Sales Nav** | Get raw contacts into a **Campaign** |
| **Campaign pipeline** | Enrich, verify email, qualify |
| **Stage action: Add to Profile** | Admit contact into **Outreach Profile** (auto channel) |
| **Outreach Profile → Channels** | Drafts, send, timeline |

---

## Setup (once)

### 1. Outreach profile

Open **Outreach** → default profile **Dental Patient Acquisition** is auto-created.

Or create manually with ICP: UK dental marketing / lead gen agencies.

Copy the profile **ID** from the URL: `/outreach/<profileId>/channels/email`

### 2. Campaign

**Campaigns** → create **Dental marketing agencies — GM**

Description: London GMB universe for dental marketing agencies.

### 3. Pipeline stages (like North India)

On the campaign **Pipeline** tab, add stages:

| Order | Stage | Action |
|-------|-------|--------|
| 1 | Enrich | `POST` → `http://localhost:5070/enrich` (cursor-enrichment) |
| 2 | Verify Email | `POST` → `http://localhost:3010/api/contacts/{{contact.id}}/verify-email` |
| 3 | Add to Profile | `POST` → `http://localhost:3010/api/outreach/admit` |

**Add to Profile action body:**

```json
{
  "contactId": "{{contact.id}}",
  "profileId": "<paste-dental-profile-uuid>"
}
```

Enable **auto-process** on stages 1–3.

Routing on admit (automatic):

- email + LinkedIn → **Email + LinkedIn** channel  
- email only → **Email**  
- LinkedIn only → **LinkedIn**

### 4. GM Scraper queries

**GM Scraper** → create 3–4 London queries, all pointing to the campaign above:

```
dental marketing agency London
dental lead generation London
dental PPC agency London
dental digital marketing agency London
```

Set **region: GB**, pick a tag, select campaign + first pipeline stage (Enrich).

---

## Weekly loop

1. GM Scraper cron runs → contacts enter campaign Stage 1  
2. Pipeline processes: enrich → verify → **admit to profile**  
3. **Outreach** → Dental Patient Acquisition → **Email** tab (default)  
4. Work contacts: copy draft, send, log timeline, mark success  
5. Switch to **LinkedIn** / **Email + LinkedIn** tabs for other channels  
6. Reddit post found manually → **Add manually** on Reddit channel tab  

---

## Sales Navigator / CSV

Import via **Campaign** (Contacts import) — not Outreach. Same pipeline applies.

---

## Related

- [PRODUCT-SPEC.md](./PRODUCT-SPEC.md)
- [COPY-TEMPLATES.md](./COPY-TEMPLATES.md)
