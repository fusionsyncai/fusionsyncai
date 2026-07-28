# Copy templates — UK dental agency partner (v1)

_Starter drafts for AI prompts and human iteration. Replace `{{variables}}` at generation time._

**Voice:** Peer agency operator. Not selling to practices — **partnering with agencies** that
serve dental clients. FusionSync white-labels patient acquisition systems and integration work
(GHL, n8n, Dentally, Exact). No hard pitch; one useful insight; soft close to a conversation.

**Profile:** UK dental marketing / lead gen agencies · London first · [fusionsync.ai](https://www.fusionsync.ai/)

---

## Email structure (locked)

1. **About them first** (1–2 sentences): what they did well, a specific outcome or mechanic. Peer tone. **No pitch.**
2. **Why you're writing** (1 short paragraph): white-label fulfilment bench, 2–3 representative examples max.
3. **Soft close**

**Do not** open with "Saw your [Client] case study" and jump straight to pitching. That reads like mail-merge with a signal token inserted.

---

## Reference example (send-quality)

**Agency:** Dental Marketing Expert  
**Signal source:** Tooth Doctor case study — published line: *"From gaps in their diary to a waiting list"*

**Good opener (about them, not a case-study name-drop):**

> Getting Tooth Doctor from empty diary slots to a waitlist with a multi-channel push is the kind of result most agencies claim but rarely document.

**Bad opener (case-study token — do not use):**

> Saw your Tooth Doctor case study — looks like strong results for dental practices.

**Full email:**

```
Hi there,

Getting Tooth Doctor from empty diary slots to a waitlist with a multi-channel push is the kind of result most agencies claim but rarely document.

We work with a few UK dental marketing agencies as a white-label fulfilment partner. When client asks outpace what your team can build in-house, whether that's automation, integrations, or something like on-premise voice AI, we build and deliver under your brand.

Not pitching a product, more a bench for when software asks land on your desk.

Worth a quick 15-min chat if that's ever on your radar?

Best,
Shubham
FusionSync
```

---

## Variables

| Variable | Example |
|----------|---------|
| `{{first_name}}` | Sarah |
| `{{company_short}}` | BrightSmile Digital |
| `{{opening_hook}}` | See reference example above |
| `{{signal_context}}` | manual override / Reddit / F5Bot |
| `{{your_name}}` | Shubham |

---

## Email (`email` pipeline)

**Subject:** `Quick thought on {{company_short}}`

**Body template:**

```
Hi {{first_name}},

{{opening_hook}}

We work with a few UK dental marketing agencies as a white-label fulfilment partner. When client asks outpace what your team can build in-house, whether that's automation, integrations, or something like on-premise voice AI, we build and deliver under your brand.

Not pitching a product, more a bench for when software asks land on your desk.

Worth a quick 15-min chat if that's ever on your radar?

Best,
{{your_name}}
FusionSync
```

**Opening hook priority:**

1. `{{signal_context}}` if set (manual / Reddit / F5Bot) — must pass quality checks
2. `personalizedHighlight` from enrichment — **1–2 sentences about what they did well** (mechanic, outcome, approach). Not a case-study headline. Not a pitch.
3. Fallback (flagged generic in UI): `Came across {{company_short}} while looking at UK dental agencies. Your client work stood out.`

**Enrichment must produce:** observations like the Tooth Doctor reference example, not "Saw your X case study."

**Rejected opener patterns:** "Saw your…", "Your case study…", stack dumps, service menus, em dashes.

**Fulfilment line:** Keep to 2–3 representative examples. Full capability list lives in internal docs, not first-touch email.

---

## LinkedIn — connection note (`linkedin` pipeline, no post)

```
Hi {{first_name}} — we partner with UK dental marketing agencies on white-label fulfilment when client asks outpace the team. Saw {{company_short}} — would be good to connect.
```

**Max:** 300 characters.

---

## LinkedIn — comment (when post URL attached)

```
{{post_topic}} — campaigns are one layer, but automation and booking sync is usually where dental clients feel the pain. Curious what you're seeing on your side.
```

---

## Reddit (`reddit` pipeline)

Peer tone, no corporate pitch in first comment. See prior template in repo history.

---

## Signal-specific hooks (for `{{signal_context}}` only)

| Signal | Hook line |
|--------|-----------|
| Hiring setter/VA | "Building out delivery capacity for dental clients — that usually means software asks follow fast." |
| Strong client result | Reference the **outcome/mechanic**, not "your case study on [Client]" |
| Reddit fulfilment post | Quote the pain they described, not your offer |

---

## Related

- Voice source: [context/fusionsyncai.base.md](../context/fusionsyncai.base.md)
- Product spec: [PRODUCT-SPEC.md](./PRODUCT-SPEC.md)
