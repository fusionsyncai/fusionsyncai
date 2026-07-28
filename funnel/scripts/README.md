# Funnel scripts

Place **new** seed / update / peek scripts for funnel websites here.

Examples of what belongs:

- `create-<pack>-website.ts` — seed a site from a template pack
- `update-<pack>-header.ts` — refresh a header global from template
- helpers that talk to Prisma / funnel APIs for a specific client site

Run pattern (same as existing repo scripts):

```bash
npx tsx funnel/scripts/<script-name>.ts
```

Load `.env.local` / `.env` and require `DATABASE_URL` unless the script uses REST/MCP instead.

### Existing scripts (not moved)

Still under repo `scripts/` for now:

- `create-acme-dental-website.ts`
- `update-acme-dental-header-nav.ts`
- `peek-funnel-page.ts`

See [../SOP-TEMPLATES.md](../SOP-TEMPLATES.md) and [../SOP-AGENT-WORKFLOW.md](../SOP-AGENT-WORKFLOW.md).
