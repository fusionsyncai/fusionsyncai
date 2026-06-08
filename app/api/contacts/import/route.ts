import {
  importContacts,
  type ImportContactRow,
} from "@/lib/contacts-import";

export const dynamic = "force-dynamic";

type ImportBody = {
  contacts?: unknown;
  tagId?: unknown;
  campaignId?: unknown;
  pipelineId?: unknown;
  stageId?: unknown;
};

function parseContactRow(value: unknown): ImportContactRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) {
    return null;
  }

  const optionalStr = (key: string) =>
    typeof row[key] === "string" ? row[key] : null;

  const employeeCount =
    typeof row.companyEmployeeCount === "number"
      ? row.companyEmployeeCount
      : typeof row.companyEmployeeCount === "string" &&
          row.companyEmployeeCount.trim()
        ? Number(row.companyEmployeeCount)
        : null;

  return {
    name,
    firstName: optionalStr("firstName"),
    lastName: optionalStr("lastName"),
    title: optionalStr("title"),
    email: optionalStr("email"),
    phone: optionalStr("phone"),
    linkedinUrl: optionalStr("linkedinUrl"),
    companyName: optionalStr("companyName"),
    companyWebsite: optionalStr("companyWebsite"),
    companyDomain: optionalStr("companyDomain"),
    companyEmployeeCount:
      employeeCount !== null && Number.isFinite(employeeCount)
        ? employeeCount
        : null,
    companyIndustry: optionalStr("companyIndustry"),
    companyLocation: optionalStr("companyLocation"),
    companyLinkedinUrl: optionalStr("companyLinkedinUrl"),
    source: optionalStr("source"),
    sourceUrl: optionalStr("sourceUrl"),
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ImportBody | null;

  const tagId = typeof body?.tagId === "string" ? body.tagId.trim() : "";
  if (!tagId) {
    return Response.json({ error: "tagId is required" }, { status: 400 });
  }

  const rawContacts = Array.isArray(body?.contacts) ? body.contacts : [];
  const contacts = rawContacts
    .map(parseContactRow)
    .filter((row): row is ImportContactRow => row !== null);

  if (contacts.length === 0) {
    return Response.json(
      { error: "contacts must be a non-empty array with valid rows" },
      { status: 400 },
    );
  }

  const campaignId =
    typeof body?.campaignId === "string" && body.campaignId.trim()
      ? body.campaignId.trim()
      : null;
  const pipelineId =
    typeof body?.pipelineId === "string" && body.pipelineId.trim()
      ? body.pipelineId.trim()
      : null;
  const stageId =
    typeof body?.stageId === "string" && body.stageId.trim()
      ? body.stageId.trim()
      : null;

  if (pipelineId && !stageId) {
    return Response.json(
      { error: "stageId is required when pipelineId is set" },
      { status: 400 },
    );
  }

  try {
    const result = await importContacts({
      contacts,
      tagId,
      campaignId,
      pipelineId,
      stageId,
    });

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
