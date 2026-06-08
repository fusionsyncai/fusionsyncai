# Cursor Enrichment Service

AIOS sidecar that enriches CRM contacts by spawning the `cursor-agent` CLI with
web search, validating the agent's JSON output, and calling back into the CRM.

## Run

From the repo root:

```bash
npm run start --prefix services/cursor-enrichment
```

Required runtime assumptions:

- `cursor-agent` is on `PATH` (or set `CURSOR_AGENT_BIN`).
- `CURSOR_API_KEY` exists in the repo root `.env`.
- `ENRICHMENT_CALLBACK_SECRET` exists in the repo root `.env` and matches the
  CRM callback route.
- The CRM app is reachable at the callback URL passed in each `/enrich` request.

## Endpoints

- `GET /health`
- `POST /enrich`
- `GET /jobs/:id`

`POST /enrich` returns `202` quickly. The long-running agent work happens in the
worker pool, then the service posts `RUNNING`, `ENRICHED`, or `FAILED` back to
the CRM callback URL.

## Configurable enrichment (instructions + outputs)

Each `/enrich` request can carry campaign-specific guidance and the structured
fields you want back, Clay-style ("add a column with a prompt"):

- `instructions` (string, optional): campaign context / goal / tone.
- `outputs` (array, optional): declared custom fields, each
  `{ key, type, description, required }` where `type` is
  `string | number | boolean | string[]`. The service builds a dynamic
  validator from these and rejects/retries if a required field is missing.

The agent returns base firmographics + signals **plus** a `custom` object with
your declared keys. On callback the custom keys are merged into **top-level**
`contact.customData` (so automation templates can read them directly), with a
provenance copy kept under `customData.enrichment.custom`. Firmographics are
best-effort; for some campaigns the custom field is the real deliverable.

Example action body:

```json
{
  "contactId": "{{contact.id}}",
  "seed": {
    "name": "{{contact.name}}",
    "title": "{{contact.title}}",
    "linkedinUrl": "{{contact.linkedinUrl}}",
    "companyName": "{{contact.companyName}}",
    "companyWebsite": "{{contact.companyWebsite}}",
    "companyDomain": "{{contact.companyDomain}}"
  },
  "instructions": "Partnership outreach to North Indian dev agencies serving US clients. Write one specific, genuine opening sentence grounded in a real fact.",
  "outputs": [
    { "key": "personalizedHighlight", "type": "string", "required": true, "description": "One specific opening sentence for a cold email." },
    { "key": "personalizationHighlight", "type": "string", "required": true, "description": "Exact mirror of personalizedHighlight." }
  ],
  "callbackUrl": "http://localhost:3010/api/contacts/{{contact.id}}/enrichment"
}
```

Use success criteria `{ "type": "STATUS_CODE", "statusCode": 202 }`.
