import { EmailStatus, LeadQuality, Prisma } from "@/generated/prisma/client";
import { assignCampaignMailbox } from "@/lib/mailboxes";
import { addContactsToStage } from "@/lib/pipelines";
import { normalizePhone, regionGeoDefaults } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const emailStatuses = Object.values(EmailStatus);
const leadQualities = Object.values(LeadQuality);

type ContactBody = {
  name?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  title?: unknown;
  email?: unknown;
  emailStatus?: unknown;
  phone?: unknown;
  linkedinUrl?: unknown;
  companyName?: unknown;
  companyWebsite?: unknown;
  companyDomain?: unknown;
  companyEmployeeCount?: unknown;
  companyIndustry?: unknown;
  companyLocation?: unknown;
  companyLinkedinUrl?: unknown;
  quality?: unknown;
  score?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  customData?: unknown;
  facebookUrl?: unknown;
  country?: unknown;
  timezone?: unknown;
  city?: unknown;
  state?: unknown;
  /** ISO-3166 alpha-2; default phone region when country omitted (default IN). */
  region?: unknown;
  campaignIds?: unknown;
  // Optional pipeline placement: when both are set, the new contact is placed
  // into this stage after creation (stage must belong to the pipeline).
  pipelineId?: unknown;
  stageId?: unknown;
};

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function jsonObject(value: unknown): Prisma.InputJsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Prisma.InputJsonObject;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
  );

  const [total, contacts] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        emailStatus: true,
        phone: true,
        companyName: true,
        companyWebsite: true,
        companyDomain: true,
        companyLocation: true,
        quality: true,
        score: true,
        enrichmentStatus: true,
        enrichedAt: true,
        source: true,
        sourceUrl: true,
        customData: true,
        createdAt: true,
        _count: {
          select: {
            campaigns: true,
            tags: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return Response.json({
    contacts: contacts.map((contact) => ({
      ...contact,
      createdAt: contact.createdAt.toISOString(),
      enrichedAt: contact.enrichedAt?.toISOString() ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ContactBody | null;
  const name = optionalString(body?.name);
  const email = optionalString(body?.email);
  const region = optionalString(body?.region) ?? optionalString(body?.country);
  const geo = regionGeoDefaults(region);
  const phone =
    normalizePhone(body?.phone, region) ?? optionalString(body?.phone);
  const companyWebsite = optionalString(body?.companyWebsite);

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  // A contact must have a usable anchor: an email/phone to reach it, OR a
  // company website so enrichment can discover the email later. This supports
  // the discovery -> enrich flow (website-only leads). The Sync stage still
  // gates on a verified email downstream, so reachability isn't weakened.
  if (!email && !phone && !companyWebsite) {
    return Response.json(
      { error: "email, phone, or companyWebsite is required" },
      { status: 400 },
    );
  }

  const campaignIds = Array.isArray(body?.campaignIds)
    ? body.campaignIds.filter(
        (campaignId): campaignId is string =>
          typeof campaignId === "string" && campaignId.trim().length > 0,
      )
    : [];

  const pipelineId = optionalString(body?.pipelineId);
  const stageId = optionalString(body?.stageId);

  if (pipelineId && !stageId) {
    return Response.json(
      { error: "stageId is required when pipelineId is set" },
      { status: 400 },
    );
  }

  // The schema has no facebookUrl column; keep it in customData (alongside any
  // caller-provided customData) so social links are captured without migration.
  const facebookUrl = optionalString(body?.facebookUrl);
  const baseCustomData = jsonObject(body?.customData) ?? {};
  const customData: Prisma.InputJsonObject | undefined = facebookUrl
    ? { ...baseCustomData, facebookUrl }
    : jsonObject(body?.customData);

  const data: Prisma.ContactCreateInput = {
    name,
    firstName: optionalString(body?.firstName),
    lastName: optionalString(body?.lastName),
    title: optionalString(body?.title),
    email,
    emailStatus: enumValue(body?.emailStatus, emailStatuses, EmailStatus.UNKNOWN),
    phone,
    country: optionalString(body?.country) ?? geo.country,
    timezone: optionalString(body?.timezone) ?? geo.timezone,
    city: optionalString(body?.city),
    state: optionalString(body?.state),
    linkedinUrl: optionalString(body?.linkedinUrl),
    companyName: optionalString(body?.companyName),
    companyWebsite,
    companyDomain: optionalString(body?.companyDomain),
    companyEmployeeCount: optionalNumber(body?.companyEmployeeCount),
    companyIndustry: optionalString(body?.companyIndustry),
    companyLocation: optionalString(body?.companyLocation),
    companyLinkedinUrl: optionalString(body?.companyLinkedinUrl),
    quality: enumValue(body?.quality, leadQualities, LeadQuality.MEDIUM),
    score: optionalNumber(body?.score),
    source: optionalString(body?.source),
    sourceUrl: optionalString(body?.sourceUrl),
    customData,
  };

  const contact = await prisma.$transaction(async (tx) => {
    const savedContact = email
      ? await tx.contact.upsert({
          where: { email },
          create: data,
          update: data,
          select: { id: true },
        })
      : await tx.contact.create({
          data,
          select: { id: true },
        });

    await Promise.all(
      campaignIds.map((campaignId) =>
        tx.campaignContact.upsert({
          where: {
            campaignId_contactId: {
              campaignId,
              contactId: savedContact.id,
            },
          },
          create: {
            campaignId,
            contactId: savedContact.id,
          },
          update: {},
        }),
      ),
    );

    return tx.contact.findUniqueOrThrow({
      where: { id: savedContact.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailStatus: true,
        phone: true,
        companyName: true,
        companyWebsite: true,
        companyDomain: true,
        companyLocation: true,
        quality: true,
        score: true,
        enrichmentStatus: true,
        enrichedAt: true,
        source: true,
        sourceUrl: true,
        customData: true,
        createdAt: true,
        _count: {
          select: {
            campaigns: true,
            tags: true,
          },
        },
      },
    });
  });

  // Assign a sticky, evenly-distributed sending mailbox per campaign the
  // contact was just added to (no-op when the campaign has none configured).
  // The assignment writes customData after the create above, so refresh the
  // response copy when it changes anything.
  for (const campaignId of campaignIds) {
    await assignCampaignMailbox(campaignId, contact.id);
  }
  if (campaignIds.length > 0) {
    const refreshed = await prisma.contact.findUnique({
      where: { id: contact.id },
      select: { customData: true },
    });
    if (refreshed) {
      contact.customData = refreshed.customData;
    }
  }

  // Optional pipeline placement (after the contact + campaign links exist).
  // addContactsToStage validates the stage belongs to the pipeline and is a
  // no-op for an unknown stage; surface that as a 400 so the client knows.
  if (pipelineId && stageId) {
    const placement = await addContactsToStage(pipelineId, stageId, [
      contact.id,
    ]);
    if (!placement) {
      return Response.json(
        { error: "Stage not found for the given pipeline" },
        { status: 400 },
      );
    }
  }

  return Response.json(
    {
      contact: {
        ...contact,
        createdAt: contact.createdAt.toISOString(),
        enrichedAt: contact.enrichedAt?.toISOString() ?? null,
      },
    },
    { status: 201 },
  );
}
