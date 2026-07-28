import {
  OutreachItemStatus,
  OutreachPipeline,
  OutreachTimelineAuthor,
  OutreachTimelineType,
  Prisma,
} from "@/generated/prisma/client";

import { buildDrafts, draftsToTimelineSummary } from "./drafts";
import { resolvePipeline, type ContactForDraft } from "./types";
import { prisma } from "@/lib/prisma";

const contactSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  title: true,
  email: true,
  linkedinUrl: true,
  companyName: true,
  companyShortName: true,
  companyWebsite: true,
  companyIndustry: true,
  companyLocation: true,
  customData: true,
} satisfies Prisma.ContactSelect;

export type CreateOutreachItemInput = {
  profileId: string;
  contactId?: string | null;
  pipeline?: OutreachPipeline;
  signalContext?: string | null;
  sourceUrl?: string | null;
  postTopic?: string | null;
  skipDraft?: boolean;
};

export type AdmitContactInput = {
  profileId: string;
  contactId: string;
  signalContext?: string | null;
  forcePipeline?: OutreachPipeline;
};

/** Campaign pipeline stage calls this — routes channel from contact fields. */
export async function admitContactToProfile(input: AdmitContactInput) {
  const profile = await prisma.outreachProfile.findUnique({
    where: { id: input.profileId },
  });
  if (!profile) throw new Error("Outreach profile not found");

  const contact = await prisma.contact.findUnique({
    where: { id: input.contactId },
    select: { ...contactSelect, id: true },
  });
  if (!contact) throw new Error("Contact not found");

  const pipeline =
    input.forcePipeline ??
    resolvePipeline({
      email: contact.email,
      linkedinUrl: contact.linkedinUrl,
    });

  const existing = await prisma.outreachItem.findUnique({
    where: {
      profileId_contactId_pipeline: {
        profileId: input.profileId,
        contactId: input.contactId,
        pipeline,
      },
    },
  });

  if (existing) {
    return { item: existing, created: false, pipeline };
  }

  const item = await createOutreachItem({
    profileId: input.profileId,
    contactId: input.contactId,
    pipeline,
    signalContext: input.signalContext,
  });

  return { item, created: true, pipeline };
}

export async function createOutreachItem(input: CreateOutreachItemInput) {
  const profile = await prisma.outreachProfile.findUnique({
    where: { id: input.profileId },
  });
  if (!profile) throw new Error("Outreach profile not found");

  let contact: (ContactForDraft & { id: string }) | null = null;

  if (input.contactId) {
    contact = await prisma.contact.findUnique({
      where: { id: input.contactId },
      select: { ...contactSelect, id: true },
    });
    if (!contact) throw new Error("Contact not found");
  }

  const pipeline =
    input.pipeline ??
    resolvePipeline({
      email: contact?.email,
      linkedinUrl: contact?.linkedinUrl,
      sourceUrl: input.sourceUrl,
    });

  const drafts = input.skipDraft
    ? null
    : buildDrafts(pipeline, {
        contact: contact ?? {
          name: "Unknown",
          firstName: null,
          lastName: null,
          title: null,
          email: null,
          linkedinUrl: null,
          companyName: null,
          companyShortName: null,
          companyWebsite: null,
          companyIndustry: null,
          companyLocation: null,
          customData: null,
        },
        profile,
        signalContext: input.signalContext,
        sourceUrl: input.sourceUrl,
        postTopic: input.postTopic,
      });

  const item = await prisma.outreachItem.create({
    data: {
      profileId: input.profileId,
      contactId: input.contactId ?? null,
      pipeline,
      signalContext: input.signalContext?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      drafts: drafts ? (drafts as Prisma.InputJsonValue) : Prisma.JsonNull,
      timeline: drafts
        ? {
            create: {
              type: OutreachTimelineType.DRAFT,
              author: OutreachTimelineAuthor.SYSTEM,
              body: draftsToTimelineSummary(pipeline, drafts),
              metadata: drafts as Prisma.InputJsonValue,
            },
          }
        : undefined,
    },
    include: {
      contact: { select: contactSelect },
      profile: { select: { id: true, name: true, slug: true } },
      timeline: { orderBy: { createdAt: "asc" } },
    },
  });

  return item;
}

export async function regenerateDrafts(itemId: string) {
  const item = await prisma.outreachItem.findUnique({
    where: { id: itemId },
    include: {
      contact: { select: contactSelect },
      profile: true,
    },
  });
  if (!item) throw new Error("Outreach item not found");

  const drafts = buildDrafts(item.pipeline, {
    contact: item.contact ?? {
      name: "Unknown",
      firstName: null,
      lastName: null,
      title: null,
      email: null,
      linkedinUrl: null,
      companyName: null,
      companyShortName: null,
      companyWebsite: null,
      companyIndustry: null,
      companyLocation: null,
      customData: null,
    },
    profile: item.profile,
    signalContext: item.signalContext,
    sourceUrl: item.sourceUrl,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.outreachItem.update({
      where: { id: itemId },
      data: { drafts: drafts as Prisma.InputJsonValue },
      include: {
        contact: { select: contactSelect },
        profile: { select: { id: true, name: true, slug: true } },
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });

    await tx.outreachTimelineEntry.create({
      data: {
        outreachItemId: itemId,
        type: OutreachTimelineType.DRAFT,
        author: OutreachTimelineAuthor.SYSTEM,
        body: draftsToTimelineSummary(item.pipeline, drafts),
        metadata: drafts as Prisma.InputJsonValue,
      },
    });

    return row;
  });

  return updated;
}

export async function addTimelineEntry(
  itemId: string,
  input: {
    type: OutreachTimelineType;
    body: string;
    author?: OutreachTimelineAuthor;
    metadata?: Prisma.InputJsonValue;
    status?: OutreachItemStatus;
  },
) {
  const item = await prisma.outreachItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Outreach item not found");

  return prisma.$transaction(async (tx) => {
    const entry = await tx.outreachTimelineEntry.create({
      data: {
        outreachItemId: itemId,
        type: input.type,
        author: input.author ?? OutreachTimelineAuthor.USER,
        body: input.body.trim(),
        metadata: input.metadata,
      },
    });

    let status = item.status;
    if (input.status) {
      status = input.status;
    } else if (input.type === OutreachTimelineType.NOTE_SENT) {
      status = OutreachItemStatus.SENT;
    } else if (input.type === OutreachTimelineType.NOTE_RECEIVED) {
      status = OutreachItemStatus.REPLIED;
    }

    const updated = await tx.outreachItem.update({
      where: { id: itemId },
      data: { status },
      include: {
        contact: { select: contactSelect },
        profile: { select: { id: true, name: true, slug: true } },
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });

    return { entry, item: updated };
  });
}

export function serializeOutreachItem(
  item: Awaited<ReturnType<typeof createOutreachItem>>,
) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    timeline: item.timeline.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}
