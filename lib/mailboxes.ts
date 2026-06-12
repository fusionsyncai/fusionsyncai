import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Per-campaign sending mailboxes. The campaign carries a JSON array of email
// addresses; when a lead is added to the campaign we assign it ONE mailbox
// (stored at customData.mailbox) so every email for that lead — first touch and
// all follow-ups — sends from the same box. Assignment is:
//   - sticky: once a contact has customData.mailbox, we never change it.
//   - even:   we pick the least-loaded mailbox within the campaign (ties broken
//             by the configured order), which also self-heals when you add a
//             new mailbox later (it starts empty and catches up).

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Normalizes the campaign's mailboxes JSON into a clean, de-duped, lowercased
// list of addresses. Tolerant of malformed input (returns []).
export function parseMailboxes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const mailbox = item.trim().toLowerCase();
    if (!mailbox || seen.has(mailbox)) continue;
    seen.add(mailbox);
    out.push(mailbox);
  }
  return out;
}

// Reads a previously-assigned mailbox from a contact's customData, if any.
export function readContactMailbox(customData: unknown): string | null {
  if (!isRecord(customData)) return null;
  const value = customData.mailbox;
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

// Assigns (or returns the already-assigned, sticky) mailbox for a contact within
// a campaign. No-op (returns null) when the campaign has no mailboxes configured.
// Call this right after a CampaignContact is created.
export async function assignCampaignMailbox(
  campaignId: string,
  contactId: string,
): Promise<string | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { mailboxes: true },
  });
  const mailboxes = parseMailboxes(campaign?.mailboxes);
  if (mailboxes.length === 0) return null;

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { customData: true },
  });
  if (!contact) return null;

  // Sticky: never reshuffle a contact that already has a mailbox.
  const existing = readContactMailbox(contact.customData);
  if (existing) return existing;

  // Least-loaded within this campaign. Counts are sequential-safe: ingestion
  // loops await each assignment, so each pick sees prior writes.
  const counts = await Promise.all(
    mailboxes.map((mailbox) =>
      prisma.campaignContact.count({
        where: {
          campaignId,
          contact: { customData: { path: ["mailbox"], equals: mailbox } },
        },
      }),
    ),
  );

  let bestIndex = 0;
  for (let i = 1; i < mailboxes.length; i++) {
    if (counts[i] < counts[bestIndex]) bestIndex = i;
  }
  const chosen = mailboxes[bestIndex];

  const base = isRecord(contact.customData) ? contact.customData : {};
  await prisma.contact.update({
    where: { id: contactId },
    data: { customData: { ...base, mailbox: chosen } as Prisma.InputJsonObject },
  });

  return chosen;
}
