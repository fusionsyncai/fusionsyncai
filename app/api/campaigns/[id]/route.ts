import { EmailStatus, LeadQuality } from "@/generated/prisma/client";
import { parseContactColumns } from "@/lib/campaign-columns";
import { parseMailboxes } from "@/lib/mailboxes";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const qualityOrder = Object.values(LeadQuality);
const emailStatusOrder = Object.values(EmailStatus);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      recallsyncCampaignId: true,
      mailboxes: true,
      contactColumns: true,
      createdAt: true,
      pipeline: {
        select: {
          id: true,
          name: true,
          stages: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              order: true,
              actionId: true,
              autoProcessing: true,
              action: {
                select: { id: true, name: true, method: true, url: true },
              },
              _count: { select: { contacts: true } },
            },
          },
        },
      },
      contacts: {
        orderBy: { addedAt: "desc" },
        select: {
          addedAt: true,
          contact: {
            select: {
              id: true,
              name: true,
              quality: true,
              emailStatus: true,
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const contacts = campaign.contacts.map((row) => ({
    ...row.contact,
    addedAt: row.addedAt.toISOString(),
  }));

  const byQuality = qualityOrder.map((quality) => ({
    key: quality,
    count: contacts.filter((contact) => contact.quality === quality).length,
  }));

  const byEmailStatus = emailStatusOrder.map((emailStatus) => ({
    key: emailStatus,
    count: contacts.filter((contact) => contact.emailStatus === emailStatus)
      .length,
  }));

  return Response.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      recallsyncCampaignId: campaign.recallsyncCampaignId,
      mailboxes: parseMailboxes(campaign.mailboxes),
      contactColumns: parseContactColumns(campaign.contactColumns),
      createdAt: campaign.createdAt.toISOString(),
      contactCount: contacts.length,
      pipeline: campaign.pipeline,
    },
    contacts,
    aggregates: {
      byQuality,
      byEmailStatus,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    description?: unknown;
    mailboxes?: unknown;
    contactColumns?: unknown;
  } | null;

  // Only touch fields the caller actually sent (partial update).
  const data: {
    description?: string | null;
    mailboxes?: string[];
    contactColumns?: string[];
  } = {};
  if (body && "description" in body) {
    data.description =
      typeof body.description === "string" ? body.description : null;
  }
  if (body && "mailboxes" in body) {
    data.mailboxes = parseMailboxes(body.mailboxes);
  }
  if (body && "contactColumns" in body) {
    data.contactColumns = parseContactColumns(body.contactColumns);
  }

  try {
    const campaign = await prisma.campaign.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        recallsyncCampaignId: true,
        mailboxes: true,
        contactColumns: true,
        createdAt: true,
      },
    });

    return Response.json({
      campaign: {
        ...campaign,
        mailboxes: parseMailboxes(campaign.mailboxes),
        contactColumns: parseContactColumns(campaign.contactColumns),
        createdAt: campaign.createdAt.toISOString(),
      },
    });
  } catch {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.campaign.delete({ where: { id } });
  } catch {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
