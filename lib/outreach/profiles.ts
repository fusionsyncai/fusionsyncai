import { prisma } from "@/lib/prisma";

import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_ENRICHMENT_PROMPT,
  DEFAULT_LINKEDIN_COMMENT,
  DEFAULT_LINKEDIN_CONNECTION,
  DEFAULT_REDDIT_COMMENT,
  DEFAULT_SIGNER_NAME,
} from "@/lib/outreach/defaults";

export {
  OUTREACH_CHANNELS,
  channelToPipeline,
  pipelineToChannel,
  type OutreachChannel,
} from "@/lib/outreach/constants";

export const DEFAULT_DENTAL_PROFILE = {
  name: "Dental Patient Acquisition",
  slug: "dental-patient-acquisition",
  icpDescription:
    "UK dental marketing and lead gen agencies with paying practice clients. " +
    "Partner motion — white-label patient acquisition systems and integration fulfilment. " +
    "Not practice owners.",
  voiceNotes:
    "Peer agency operator tone. Reference their dental client delivery pain. " +
    "FusionSync white-labels software and integrations under the agency brand.",
  signerName: DEFAULT_SIGNER_NAME,
  emailSubjectTemplate: DEFAULT_EMAIL_SUBJECT,
  emailBodyTemplate: DEFAULT_EMAIL_BODY,
  linkedinConnectionTemplate: DEFAULT_LINKEDIN_CONNECTION,
  linkedinCommentTemplate: DEFAULT_LINKEDIN_COMMENT,
  redditCommentTemplate: DEFAULT_REDDIT_COMMENT,
  enrichmentPrompt: DEFAULT_ENRICHMENT_PROMPT,
};

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const TEMPLATE_DEFAULTS = {
  signerName: DEFAULT_SIGNER_NAME,
  emailSubjectTemplate: DEFAULT_EMAIL_SUBJECT,
  emailBodyTemplate: DEFAULT_EMAIL_BODY,
  linkedinConnectionTemplate: DEFAULT_LINKEDIN_CONNECTION,
  linkedinCommentTemplate: DEFAULT_LINKEDIN_COMMENT,
  redditCommentTemplate: DEFAULT_REDDIT_COMMENT,
  enrichmentPrompt: DEFAULT_ENRICHMENT_PROMPT,
} as const;

/** Backfill empty template fields on existing profiles. */
async function ensureProfileTemplates(id: string) {
  const profile = await prisma.outreachProfile.findUnique({ where: { id } });
  if (!profile) return null;

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(TEMPLATE_DEFAULTS)) {
    const current = profile[key as keyof typeof profile];
    if (typeof current !== "string" || !current.trim()) {
      data[key] = value;
    }
  }

  if (Object.keys(data).length === 0) return profile;
  return prisma.outreachProfile.update({ where: { id }, data });
}

export async function ensureDefaultOutreachProfiles() {
  const existing = await prisma.outreachProfile.findUnique({
    where: { slug: DEFAULT_DENTAL_PROFILE.slug },
  });
  if (existing) {
    return ensureProfileTemplates(existing.id);
  }

  return prisma.outreachProfile.create({
    data: DEFAULT_DENTAL_PROFILE,
  });
}

export async function listOutreachProfiles() {
  await ensureDefaultOutreachProfiles();
  return prisma.outreachProfile.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
  });
}

export async function getOutreachProfile(id: string) {
  await ensureProfileTemplates(id);
  return prisma.outreachProfile.findUnique({
    where: { id },
    include: {
      _count: {
        select: { items: true },
      },
    },
  });
}

export async function createOutreachProfile(input: {
  name: string;
  icpDescription?: string | null;
  voiceNotes?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("name is required");

  const slug = slugify(name);
  const clash = await prisma.outreachProfile.findUnique({ where: { slug } });
  if (clash) throw new Error("A profile with a similar name already exists");

  return prisma.outreachProfile.create({
    data: {
      name,
      slug,
      icpDescription: input.icpDescription?.trim() || null,
      voiceNotes: input.voiceNotes?.trim() || null,
      ...TEMPLATE_DEFAULTS,
    },
  });
}

export type UpdateOutreachProfileInput = {
  name?: string;
  icpDescription?: string | null;
  voiceNotes?: string | null;
  signerName?: string | null;
  emailSubjectTemplate?: string | null;
  emailBodyTemplate?: string | null;
  linkedinConnectionTemplate?: string | null;
  linkedinCommentTemplate?: string | null;
  redditCommentTemplate?: string | null;
  enrichmentPrompt?: string | null;
  active?: boolean;
};

export async function updateOutreachProfile(
  id: string,
  input: UpdateOutreachProfileInput,
) {
  const data: Record<string, string | boolean | null> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("name is required");
    data.name = name;
  }

  const textFields = [
    "icpDescription",
    "voiceNotes",
    "signerName",
    "emailSubjectTemplate",
    "emailBodyTemplate",
    "linkedinConnectionTemplate",
    "linkedinCommentTemplate",
    "redditCommentTemplate",
    "enrichmentPrompt",
  ] as const;

  for (const field of textFields) {
    if (!(field in input)) continue;
    const raw = input[field];
    if (raw === null) {
      data[field] = null;
    } else if (typeof raw === "string") {
      data[field] = raw.trim() || null;
    }
  }

  if (typeof input.active === "boolean") {
    data.active = input.active;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No fields to update");
  }

  const profile = await prisma.outreachProfile.update({
    where: { id },
    data,
    include: {
      _count: { select: { items: true } },
    },
  });

  if (
    typeof data.enrichmentPrompt === "string" &&
    data.enrichmentPrompt.trim()
  ) {
    await syncEnrichmentActionPrompt(data.enrichmentPrompt);
  }

  return profile;
}

/** Keep campaign Enrich action instructions in sync with profile prompt. */
export async function syncEnrichmentActionPrompt(prompt: string) {
  const action = await prisma.action.findFirst({
    where: { name: "Enrich (Cursor) — Dental GM" },
  });
  if (!action) return;

  const body =
    action.body && typeof action.body === "object" && !Array.isArray(action.body)
      ? { ...(action.body as Record<string, unknown>) }
      : {};

  await prisma.action.update({
    where: { id: action.id },
    data: {
      body: {
        ...body,
        instructions: prompt,
      },
    },
  });
}
