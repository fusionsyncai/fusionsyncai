export type WizardStep = "upload" | "mapping" | "config" | "importing" | "result";

export const CONTACT_FIELD_KEYS = [
  "name",
  "firstName",
  "lastName",
  "title",
  "email",
  "phone",
  "linkedinUrl",
  "companyName",
  "companyWebsite",
  "companyDomain",
  "companyEmployeeCount",
  "companyIndustry",
  "companyLocation",
  "companyLinkedinUrl",
  "source",
  "sourceUrl",
] as const;

export type ContactFieldKey = (typeof CONTACT_FIELD_KEYS)[number];

export const CONTACT_FIELD_LABELS: Record<ContactFieldKey, string> = {
  name: "Name",
  firstName: "First name",
  lastName: "Last name",
  title: "Title",
  email: "Email",
  phone: "Phone",
  linkedinUrl: "LinkedIn URL",
  companyName: "Company name",
  companyWebsite: "Company website",
  companyDomain: "Company domain",
  companyEmployeeCount: "Employee count",
  companyIndustry: "Industry",
  companyLocation: "Location",
  companyLinkedinUrl: "Company LinkedIn",
  source: "Source",
  sourceUrl: "Source URL",
};

export const REQUIRED_CONTACT_FIELDS: ContactFieldKey[] = ["name"];

export type CsvMapping = Partial<Record<ContactFieldKey, string>>;

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

export type ImportConfig = {
  tagId: string;
  campaignId: string | null;
  pipelineId: string | null;
  stageId: string | null;
};

export type ImportSummary = {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: { row: number; reason: string }[];
};

export type TagOption = {
  id: string;
  name: string;
  color: string | null;
};

export type CampaignOption = {
  id: string;
  name: string;
};

export type PipelineOption = {
  id: string;
  name: string;
  campaignName: string | null;
  stages: { id: string; name: string; order: number }[];
};

export function applyMapping(
  row: string[],
  headers: string[],
  mapping: CsvMapping,
): Record<string, string | number | null> {
  const byHeader = Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ""]),
  );

  const result: Record<string, string | number | null> = {};

  for (const field of CONTACT_FIELD_KEYS) {
    const csvColumn = mapping[field];
    if (!csvColumn) continue;

    const raw = (byHeader[csvColumn] ?? "").trim();
    if (!raw) {
      result[field] = null;
      continue;
    }

    if (field === "companyEmployeeCount") {
      const num = Number(raw);
      result[field] = Number.isFinite(num) ? num : null;
    } else {
      result[field] = raw;
    }
  }

  return result;
}
