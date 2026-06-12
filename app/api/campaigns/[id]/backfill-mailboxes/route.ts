import { Prisma } from "@/generated/prisma/client";
import {
  assignCampaignMailbox,
  parseMailboxes,
  readContactMailbox,
} from "@/lib/mailboxes";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// One-time (re-runnable) backfill: ensure EVERY contact linked to this campaign
// has a sending mailbox at customData.mailbox — regardless of pipeline stage.
//
// Two modes:
//   default        — sticky fill via lib/mailboxes.assignCampaignMailbox:
//                     contacts that already have a box keep it; gaps are filled,
//                     evenly distributed across the campaign's mailboxes.
//   ?force=true    — IGNORE existing assignments and re-distribute ALL contacts
//                     evenly across the current mailboxes (round-robin). Use
//                     after adding/removing a mailbox to rebalance.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const force = new URL(request.url).searchParams.get("force") === "true";

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, mailboxes: true },
  });

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const mailboxes = parseMailboxes(campaign.mailboxes);
  if (mailboxes.length === 0) {
    return Response.json(
      { error: "Campaign has no mailboxes configured" },
      { status: 400 },
    );
  }

  // Every contact linked to this campaign, irrespective of stage placement.
  // Ordered for deterministic, reproducible round-robin in force mode.
  const links = await prisma.campaignContact.findMany({
    where: { campaignId: id },
    orderBy: { addedAt: "asc" },
    select: { contactId: true },
  });

  const distribution: Record<string, number> = Object.fromEntries(
    mailboxes.map((mailbox) => [mailbox, 0]),
  );

  // ---- Force mode: overwrite every contact, round-robin even split. ----
  if (force) {
    let reassigned = 0;
    let failed = 0;

    for (let i = 0; i < links.length; i++) {
      const { contactId } = links[i];
      const chosen = mailboxes[i % mailboxes.length];

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { customData: true },
      });
      if (!contact) {
        failed++;
        continue;
      }

      const base = isRecord(contact.customData) ? contact.customData : {};
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          customData: { ...base, mailbox: chosen } as Prisma.InputJsonObject,
        },
      });

      reassigned++;
      distribution[chosen] = (distribution[chosen] ?? 0) + 1;
    }

    return Response.json({
      campaignId: id,
      mode: "force",
      totalContacts: links.length,
      reassigned,
      failed,
      mailboxes,
      distribution,
    });
  }

  // ---- Default mode: sticky fill (gaps only). ----
  let assigned = 0;
  let alreadyHad = 0;
  let failed = 0;

  // Sequential on purpose: assignCampaignMailbox picks the least-loaded box and
  // each pick must observe prior writes to stay evenly distributed.
  for (const { contactId } of links) {
    const before = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { customData: true },
    });
    const had = readContactMailbox(before?.customData);

    const chosen = await assignCampaignMailbox(id, contactId);
    if (!chosen) {
      failed++;
      continue;
    }

    if (had) {
      alreadyHad++;
    } else {
      assigned++;
    }
    distribution[chosen] = (distribution[chosen] ?? 0) + 1;
  }

  return Response.json({
    campaignId: id,
    mode: "fill",
    totalContacts: links.length,
    assigned,
    alreadyHad,
    failed,
    mailboxes,
    distribution,
  });
}
