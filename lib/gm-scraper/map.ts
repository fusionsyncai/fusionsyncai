import {
  parseCompanyDomain,
  type ImportContactRow,
} from "@/lib/contacts-import";

import type { GmScrapedBusiness } from "./types";

export function mapBusinessToImportRow(
  business: GmScrapedBusiness,
): ImportContactRow | null {
  const name = business.businessName?.trim();
  if (!name) return null;

  const website = business.website?.trim() || null;

  return {
    name,
    companyName: name,
    phone: business.phone?.trim() || null,
    companyWebsite: website,
    companyDomain: parseCompanyDomain(website),
    companyLocation: business.address?.trim() || null,
    companyIndustry: business.category?.trim() || null,
    source: "gm-scraper",
    sourceUrl: business.googleMapsUrl?.trim() || null,
  };
}
