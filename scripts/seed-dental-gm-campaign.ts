/**
 * Seed: Dental GM campaign + pipeline + London GMB queries + outreach profile.
 *
 * Run: npx tsx scripts/seed-dental-gm-campaign.ts
 */
import "dotenv/config";

import { HttpMethod } from "@/generated/prisma/client";

import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_ENRICHMENT_PROMPT,
  DEFAULT_LINKEDIN_COMMENT,
  DEFAULT_LINKEDIN_CONNECTION,
  DEFAULT_REDDIT_COMMENT,
  DEFAULT_SIGNER_NAME,
} from "@/lib/outreach/defaults";
import {
  ensureDefaultOutreachProfiles,
} from "@/lib/outreach/profiles";
import { createTag } from "@/lib/tags";
import { prisma } from "@/lib/prisma";
import { createGmScraperQuery } from "@/lib/gm-scraper/queries";

const CAMPAIGN_NAME = "Dental marketing agencies — GM";
const CAMPAIGN_DESCRIPTION =
  "London GMB universe — UK dental marketing / lead gen agencies. " +
  "Pipeline: enrich → verify email → admit to Dental Patient Acquisition outreach profile.";

const TAG_NAME = "dental-gm-london";

const LONDON_QUERIES = [
  "dental marketing agency London",
  "dental lead generation London",
  "dental PPC agency London",
  "dental digital marketing agency London",
];

const STAGE_NAMES = [
  "Enrich",
  "Verify Email",
  "Add to Profile",
  "In Outreach",
] as const;

async function findOrCreateAction(
  name: string,
  data: {
    name: string;
    method: HttpMethod;
    url: string;
    body?: object;
    successCriteria?: object;
    advanceOnSuccess?: boolean;
    batchSize?: number;
    concurrency?: number;
  },
) {
  const existing = await prisma.action.findFirst({ where: { name } });
  if (existing) {
    return prisma.action.update({
      where: { id: existing.id },
      data: {
        method: data.method,
        url: data.url,
        body: data.body,
        successCriteria: data.successCriteria,
        advanceOnSuccess: data.advanceOnSuccess,
        batchSize: data.batchSize,
        concurrency: data.concurrency,
      },
    });
  }
  return prisma.action.create({ data });
}

async function findOrCreateCampaign() {
  const existing = await prisma.campaign.findFirst({
    where: { name: CAMPAIGN_NAME },
    include: { pipeline: { include: { stages: { orderBy: { order: "asc" } } } } },
  });
  if (existing) return existing;

  return prisma.campaign.create({
    data: {
      name: CAMPAIGN_NAME,
      description: CAMPAIGN_DESCRIPTION,
      pipeline: {
        create: {
          name: CAMPAIGN_NAME,
          stages: { create: [] },
        },
      },
    },
    include: { pipeline: { include: { stages: { orderBy: { order: "asc" } } } } },
  });
}

async function resetPipelineStages(
  pipelineId: string,
  stages: {
    name: string;
    actionId: string | null;
    autoProcessing: boolean;
  }[],
) {
  await prisma.pipelineContact.deleteMany({ where: { pipelineId } });
  await prisma.stage.deleteMany({ where: { pipelineId } });

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    await prisma.stage.create({
      data: {
        name: stage.name,
        order: i,
        pipelineId,
        actionId: stage.actionId,
        autoProcessing: stage.autoProcessing,
      },
    });
  }
}

async function main() {
  const profile = await ensureDefaultOutreachProfiles();
  if (!profile) throw new Error("Failed to ensure outreach profile");

  // Always refresh templates from defaults on seed (source of truth for dental GM).
  await prisma.outreachProfile.update({
    where: { id: profile.id },
    data: {
      signerName: DEFAULT_SIGNER_NAME,
      emailSubjectTemplate: DEFAULT_EMAIL_SUBJECT,
      emailBodyTemplate: DEFAULT_EMAIL_BODY,
      linkedinConnectionTemplate: DEFAULT_LINKEDIN_CONNECTION,
      linkedinCommentTemplate: DEFAULT_LINKEDIN_COMMENT,
      redditCommentTemplate: DEFAULT_REDDIT_COMMENT,
      enrichmentPrompt: DEFAULT_ENRICHMENT_PROMPT,
    },
  });
  console.log(`Outreach profile: ${profile.name} (${profile.id})`);

  const tag = await createTag({
    name: TAG_NAME,
    description: "London dental agency GMB harvest",
    color: "#0ea5e9",
  });
  console.log(`Tag: ${tag.name} (${tag.id})`);

  const enrichAction = await findOrCreateAction("Enrich (Cursor) — Dental GM", {
    name: "Enrich (Cursor) — Dental GM",
    method: HttpMethod.POST,
    url: "http://localhost:5070/enrich",
    body: {
      contactId: "{{contact.id}}",
      seed: {
        name: "{{contact.name}}",
        title: "{{contact.title}}",
        linkedinUrl: "{{contact.linkedinUrl}}",
        companyName: "{{contact.companyName}}",
        companyWebsite: "{{contact.companyWebsite}}",
        companyDomain: "{{contact.companyDomain}}",
        companyLocation: "{{contact.companyLocation}}",
      },
      instructions: DEFAULT_ENRICHMENT_PROMPT,
      findEmail: true,
      findContactChannels: true,
      outputs: [
        {
          key: "personalizedHighlight",
          type: "string",
          required: true,
          description:
            "One cold-email opener sentence (~20-35 words). Peer tone. See instructions for GOOD/BAD examples.",
        },
        {
          key: "vertical",
          type: "string",
          required: false,
          description: "dental / dental marketing",
        },
        {
          key: "techGap",
          type: "string",
          required: false,
          description: "Internal only. Not for email.",
        },
        {
          key: "integrationTargets",
          type: "string",
          required: false,
          description: "Internal only. Not for email.",
        },
      ],
      callbackUrl:
        "http://localhost:3010/api/contacts/{{contact.id}}/enrichment",
      advanceWhen: { hasField: "email" },
    },
    successCriteria: { type: "STATUS_CODE", statusCode: 202 },
    advanceOnSuccess: false,
    batchSize: 10,
    concurrency: 2,
  });

  const verifyAction = await findOrCreateAction("Verify Email — Dental GM", {
    name: "Verify Email — Dental GM",
    method: HttpMethod.POST,
    url: "http://localhost:3010/api/contacts/{{contact.id}}/verify-email",
    body: {},
    advanceOnSuccess: true,
    batchSize: 5,
    concurrency: 1,
  });

  const admitAction = await findOrCreateAction(
    "Add to Dental Patient Acquisition",
    {
      name: "Add to Dental Patient Acquisition",
      method: HttpMethod.POST,
      url: "http://localhost:3010/api/outreach/admit",
      body: {
        contactId: "{{contact.id}}",
        profileId: profile.id,
      },
      successCriteria: { type: "JSON_MATCH", key: "ok", value: "true" },
      advanceOnSuccess: true,
      batchSize: 20,
      concurrency: 5,
    },
  );

  const campaign = await findOrCreateCampaign();
  if (!campaign.pipeline) {
    throw new Error("Campaign pipeline missing");
  }

  const pipelineId = campaign.pipeline.id;

  const currentNames = campaign.pipeline.stages.map((s) => s.name).join("|");
  const expectedNames = STAGE_NAMES.join("|");

  if (currentNames !== expectedNames) {
    await resetPipelineStages(pipelineId, [
      {
        name: STAGE_NAMES[0],
        actionId: enrichAction.id,
        autoProcessing: true,
      },
      {
        name: STAGE_NAMES[1],
        actionId: verifyAction.id,
        autoProcessing: true,
      },
      {
        name: STAGE_NAMES[2],
        actionId: admitAction.id,
        autoProcessing: true,
      },
      {
        name: STAGE_NAMES[3],
        actionId: null,
        autoProcessing: false,
      },
    ]);
    console.log("Pipeline stages reset: Enrich → Verify Email → Add to Profile → In Outreach");
  } else {
    console.log("Pipeline stages already configured");
  }

  const enrichStage = await prisma.stage.findFirst({
    where: { pipelineId, name: STAGE_NAMES[0] },
  });
  if (!enrichStage) throw new Error("Enrich stage not found");

  for (const query of LONDON_QUERIES) {
    const existing = await prisma.gmScraperQuery.findFirst({
      where: { query, campaignId: campaign.id },
    });
    if (existing) {
      console.log(`GM query exists: ${query}`);
      continue;
    }

    const row = await createGmScraperQuery({
      query,
      tagId: tag.id,
      campaignId: campaign.id,
      stageId: enrichStage.id,
      autoProcess: true,
      maxResults: 120,
      region: "GB",
    });
    console.log(`GM query created: ${query} (${row.id})`);
  }

  console.log("\nDone.");
  console.log(`Campaign: ${campaign.name} (${campaign.id})`);
  console.log(`Profile: ${profile.name} (${profile.id})`);
  console.log(`Open: http://localhost:3010/campaign/${campaign.id}`);
  console.log(`Outreach: http://localhost:3010/outreach/${profile.id}/channels/email`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
