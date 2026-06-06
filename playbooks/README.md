# Playbooks

A playbook is a **specific instantiation** of agents + SOPs aimed at a concrete outcome.

Where an SOP is the *generic procedure* ("how to run an email campaign") and an agent is the
*worker*, a playbook is the *actual run*: this campaign, this target, this offer, this sequence.

## Convention

- One playbook per Markdown file: `playbooks/<name>.md`.
- A playbook references the agent(s) it uses and the SOP(s) it follows.
- It captures the strategy/sequence/messaging — not the operational data (lists, replies, results
  live in RecallSync / DB, never in git).

## Example contents

- Objective and target (ICP / segment)
- Offer and angle
- Sequence (steps, timing)
- Agent(s) used
- SOP(s) followed
- Success metric
