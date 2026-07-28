import {
  LeadListSource,
  OutreachPipeline,
} from "@/generated/prisma/client";

import { importContacts, type ImportContactRow } from "@/lib/contacts-import";
import { prisma } from "@/lib/prisma";
import { findOrCreateTagByName } from "@/lib/tags";

const SALES_NAV_ALIASES: Record<string, keyof ImportContactRow> = {
  "first name": "firstName",
  firstname: "firstName",
  "last name": "lastName",
  lastname: "lastName",
  name: "name",
  title: "title",
  email: "email",
  "email address": "email",
  "phone number": "phone",
  phone: "phone",
  company: "companyName",
  "company name": "companyName",
  organization: "companyName",
  website: "companyWebsite",
  "company website": "companyWebsite",
  industry: "companyIndustry",
  location: "companyLocation",
  "linkedin url": "linkedinUrl",
  "profile url": "linkedinUrl",
  url: "linkedinUrl",
  "person linkedin url": "linkedinUrl",
};

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapSalesNavRow(
  row: Record<string, string>,
  headers: string[],
): ImportContactRow | null {
  const mapped: Partial<ImportContactRow> = {
    source: "sales_navigator",
  };

  for (const header of headers) {
    const field = SALES_NAV_ALIASES[normalizeHeader(header)];
    if (!field) continue;
    const value = row[header]?.trim();
    if (!value) continue;
    (mapped as Record<string, string | null>)[field] = value;
  }

  if (!mapped.name) {
    const first = mapped.firstName ?? "";
    const last = mapped.lastName ?? "";
    const combined = `${first} ${last}`.trim();
    if (combined) mapped.name = combined;
  }

  if (!mapped.name && mapped.companyName) {
    mapped.name = mapped.companyName;
  }

  if (!mapped.name) return null;

  if (mapped.linkedinUrl && !mapped.linkedinUrl.includes("linkedin.com")) {
    mapped.linkedinUrl = null;
  }

  return mapped as ImportContactRow;
}

export async function importSalesNavigatorList(input: {
  listName: string;
  rows: Record<string, string>[];
  headers: string[];
  tagName?: string;
}) {
  const contacts = input.rows
    .map((row) => mapSalesNavRow(row, input.headers))
    .filter((row): row is ImportContactRow => row !== null);

  if (contacts.length === 0) {
    throw new Error("No valid rows found — map First Name, Last Name, or Company");
  }

  const tag = await findOrCreateTagByName(
    input.tagName?.trim() || "outreach-sales-nav",
  );

  const importResult = await importContacts({
    contacts,
    tagId: tag.id,
    region: "GB",
  });

  const list = await prisma.leadList.create({
    data: {
      name: input.listName.trim() || "Sales Navigator import",
      source: LeadListSource.SALES_NAVIGATOR,
      profileSlug: "dental-agency-uk",
      defaultPipeline: OutreachPipeline.LINKEDIN,
      members: {
        create: importResult.createdContactIds.map((contactId) => ({
          contactId,
        })),
      },
    },
    include: {
      _count: { select: { members: true } },
    },
  });

  return { list, importResult };
}
