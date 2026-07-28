# Funnel templates

Place **new** website/page template packs here:

```text
funnel/templates/<pack-name>/
  tokens.ts
  helpers.ts
  shared.ts
  pages/
  index.ts
  MANIFEST.md   # optional remote ids
```

Authoring guide: [../SOP-TEMPLATES.md](../SOP-TEMPLATES.md)  
Reconcile before overwriting live drafts: [../SOP-AGENT-WORKFLOW.md](../SOP-AGENT-WORKFLOW.md)

### Reference implementation (not moved)

Acme Dental still lives at:

`src/modules/landing-pages/lib/templates/acme-dental/`

Copy patterns from there when starting a new pack under this folder. Do not relocate existing packs unless explicitly asked.
