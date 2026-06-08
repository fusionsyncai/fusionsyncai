import { EmailStatus, LeadQuality, Prisma } from "@/generated/prisma/client";
import { addContactsToStage } from "@/lib/pipelines";
import { prisma } from "@/lib/prisma";

export type ImportContactRow = {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  companyName?: string | null;
  companyWebsite?: string | null;
  companyDomain?: string | null;
  companyEmployeeCount?: number | null;
  companyIndustry?: string | null;
  companyLocation?: string | null;
  companyLinkedinUrl?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
};

export type ImportContactsInput = {
  contacts: ImportContactRow[];
  tagId: string;
  campaignId?: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
  /** When set, links newly created contacts to this GM Scraper query. */
  gmScraperQueryId?: string | null;
};

export type ImportContactsResult = {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: { row: number; reason: string }[];
  createdContactIds: string[];
};

function optionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Canonical phone for storage + dedup (digits only; India → last 10). */
export function normalizePhone(
  phone: string | null | undefined,
): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function phoneLookupVariants(normalized: string): string[] {
  return [
    normalized,
    `+91${normalized}`,
    `91${normalized}`,
    `0${normalized}`,
  ];
}

export function parseCompanyDomain(
  website: string | null | undefined,
): string | null {
  if (!website?.trim()) return null;
  try {
    const url = website.includes("://")
      ? new URL(website)
      : new URL(`https://${website.trim()}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function buildContactData(row: ImportContactRow): Prisma.ContactCreateInput {
  const website = optionalString(row.companyWebsite);
  const companyDomain =
    optionalString(row.companyDomain) ?? parseCompanyDomain(website);

  return {
    name: row.name.trim(),
    firstName: optionalString(row.firstName),
    lastName: optionalString(row.lastName),
    title: optionalString(row.title),
    email: optionalString(row.email),
    emailStatus: EmailStatus.UNKNOWN,
    phone: normalizePhone(row.phone) ?? optionalString(row.phone),
    linkedinUrl: optionalString(row.linkedinUrl),
    companyName: optionalString(row.companyName),
    companyWebsite: website,
    companyDomain,
    companyEmployeeCount:
      typeof row.companyEmployeeCount === "number" &&
      Number.isFinite(row.companyEmployeeCount)
        ? row.companyEmployeeCount
        : null,
    companyIndustry: optionalString(row.companyIndustry),
    companyLocation: optionalString(row.companyLocation),
    companyLinkedinUrl: optionalString(row.companyLinkedinUrl),
    quality: LeadQuality.UNQUALIFIED,
    source: optionalString(row.source) ?? "csv-import",
    sourceUrl: optionalString(row.sourceUrl),
  };
}

async function findExistingContact(
  email: string | null,
  phone: string | null,
  companyDomain: string | null,
) {
  const or: Prisma.ContactWhereInput["OR"] = [];
  if (email) or.push({ email });
  if (companyDomain) or.push({ companyDomain });

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    for (const variant of phoneLookupVariants(normalizedPhone)) {
      or.push({ phone: variant });
    }
  } else if (phone) {
    or.push({ phone });
  }

  if (or.length === 0) {
    return null;
  }

  return prisma.contact.findFirst({
    where: { OR: or },
    select: { id: true },
  });
}

async function attachTag(contactId: string, tagId: string) {
  await prisma.contactTag.upsert({
    where: {
      contactId_tagId: { contactId, tagId },
    },
    create: { contactId, tagId },
    update: {},
  });
}

async function attachCampaign(contactId: string, campaignId: string) {
  await prisma.campaignContact.upsert({
    where: {
      campaignId_contactId: { campaignId, contactId },
    },
    create: { campaignId, contactId },
    update: {},
  });
}

export async function importContacts(
  input: ImportContactsInput,
): Promise<ImportContactsResult> {
  const result: ImportContactsResult = {
    total: input.contacts.length,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    createdContactIds: [],
  };

  const tag = await prisma.tag.findUnique({
    where: { id: input.tagId },
    select: { id: true },
  });
  if (!tag) {
    throw new Error("Tag not found");
  }

  if (input.campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
      select: { id: true },
    });
    if (!campaign) {
      throw new Error("Campaign not found");
    }
  }

  if (input.pipelineId) {
    if (!input.stageId) {
      throw new Error("stageId is required when pipelineId is set");
    }

    const stage = await prisma.stage.findFirst({
      where: { id: input.stageId, pipelineId: input.pipelineId },
      select: { id: true },
    });
    if (!stage) {
      throw new Error("Stage not found for pipeline");
    }
  }

  const pipelineContactIds: string[] = [];

  for (let index = 0; index < input.contacts.length; index++) {
    const row = input.contacts[index];
    const rowNumber = index + 1;

    if (!row.name?.trim()) {
      result.failed++;
      result.errors.push({ row: rowNumber, reason: "name is required" });
      continue;
    }

    const data = buildContactData(row);
    const email = data.email ?? null;
    const phone = data.phone ?? null;
    const companyDomain = data.companyDomain ?? null;

    if (!email && !phone && !companyDomain) {
      result.failed++;
      result.errors.push({
        row: rowNumber,
        reason:
          "email, phone, or company website/domain is required for deduplication",
      });
      continue;
    }

    try {
      const existing = await findExistingContact(
        email,
        phone,
        companyDomain,
      );
      if (existing) {
        result.skipped++;
        continue;
      }

      let contactId: string;

      try {
        const created = await prisma.contact.create({
          data,
          select: { id: true },
        });
        contactId = created.id;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          result.skipped++;
          continue;
        }
        throw err;
      }

      await attachTag(contactId, input.tagId);

      if (input.campaignId) {
        await attachCampaign(contactId, input.campaignId);
      }

      if (input.pipelineId && input.stageId) {
        pipelineContactIds.push(contactId);
      }

      result.created++;
      result.createdContactIds.push(contactId);
    } catch (err) {
      result.failed++;
      result.errors.push({
        row: rowNumber,
        reason: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  if (input.pipelineId && input.stageId && pipelineContactIds.length > 0) {
    const placement = await addContactsToStage(
      input.pipelineId,
      input.stageId,
      pipelineContactIds,
    );
    if (!placement) {
      throw new Error("Failed to place contacts in pipeline stage");
    }
  }

  if (input.gmScraperQueryId && result.createdContactIds.length > 0) {
    await prisma.gmScraperQueryContact.createMany({
      data: result.createdContactIds.map((contactId) => ({
        queryId: input.gmScraperQueryId!,
        contactId,
      })),
      skipDuplicates: true,
    });
  }

  return result;
}
