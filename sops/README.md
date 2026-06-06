# SOPs — Standard Operating Procedures

An SOP is a **repeatable, documented process** that a human or an AI agent can follow literally.

## Convention

- One SOP per Markdown file: `sops/<verb-noun>.md` (e.g. `create-agent.md`, `run-email-campaign.md`).
  Related SOPs may be grouped in a subfolder (e.g. `sops/channel-agent/creation.md`,
  `prompting-standard.md`, `prompting-flow.md`, `tool-calls.md`, `testing.md`).
- Each SOP starts with YAML frontmatter (`id`, `status`, `owner`), then numbered steps.
- Write SOPs as **checklists**, not essays. Every step should be executable.
- If a step needs human approval, say so explicitly.
- Copy `_template.md` to start a new SOP.

## Principle

SOPs make AI behavior repeatable, documented, and manageable. If something is done more than
once, it should become an SOP.
