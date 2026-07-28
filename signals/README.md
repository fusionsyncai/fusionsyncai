# Signals — AI-assisted outreach (living docs)

This folder is the **canonical home** for designing FusionSync's in-house outreach system. We are
in **discussion mode** — no implementation until the model is clear.

**Start here for what to build first:** [MVP.md](./MVP.md) — queue + channel-specific AI drafts,
manual input, human send. Collection/scraping comes *after* that works daily.

## What this is (full vision)

One **configurable system** that eventually watches public touchpoints for **intent signals**
(hiring, growth, complaints, stack gaps, etc.) and routes qualified hits into **channel-specific
pipelines** (email, LinkedIn, Instagram, …). Same engine, many use cases:

- UK **dental marketing / lead gen agencies** (v1 — partner motion, not practices)
- FusionSync **white-label partner** acquisition (broader agency ICP)
- Real estate **client acquisition** systems
- Future verticals — configured, not forked

## What this is not

- Not a replacement for bulk list building (Google Maps harvester remains useful for **directory
  research**, not primary outbound)
- Not Clay — we do not need their UI; we need **our own orchestration + CRM integration**
- Not "build scrapers for everything" — we buy/scrape via adapters; we own **config, scoring,
  dedup, and action routing**

## Quick map

| Doc | What it covers |
|-----|----------------|
| [JOURNEY.md](./JOURNEY.md) | **How to use it** — Campaign → Profile → Channels |
| **[MVP.md](./MVP.md)** | Build-first philosophy + phase order |
| [LEAD-LISTS.md](./LEAD-LISTS.md) | GMB lists, Sales Nav import, manual add |
| [COPY-TEMPLATES.md](./COPY-TEMPLATES.md) | Starter email / LinkedIn / Reddit copy |
| [CORE.md](./CORE.md) | Problem, Clay demystified, build vs buy, principles |
| [USE-CASES.md](./USE-CASES.md) | Configurable profiles (dental, agency partner, real estate, …) |
| [SIGNAL-TYPES.md](./SIGNAL-TYPES.md) | Signal taxonomy + example triggers per vertical |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | Channel adapters (LinkedIn, Reddit, Google, …) |
| [F5BOT-DENTAL-UK.md](./F5BOT-DENTAL-UK.md) | Reddit subreddits + keywords (UK dental agencies) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Conceptual data flow — harvest → evaluate → route |
| [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) | Decisions still open before we build |

## Related docs elsewhere

| Path | Relationship |
|------|----------------|
| [aios/intent-signal-monitor.md](../aios/intent-signal-monitor.md) | **First concrete use case** — FusionSync agency-partner signals on LinkedIn/Reddit; draft-reply digest for Shubham |
| [services/gmaps-harvester/](../services/gmaps-harvester/) | **Directory harvester** — baseline pattern for a small HTTP sidecar; not the signal engine itself |
| [aios/aios-current-context.md](../aios/aios-current-context.md) | Current acquisition focus (agency operators → WhatsApp partnership) |

## Status

**Phase: design / discussion** — capturing context so we do not lose the thread across sessions.
