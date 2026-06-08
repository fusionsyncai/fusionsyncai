import { EnrichmentStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveWaitingContact } from "@/lib/pipelines";

export const dynamic = "force-dynamic";

type CallbackBody = {
  jobId?: unknown;
  contactId?: unknown;
  status?: unknown;
  enrichment?: unknown;
  error?: unknown;
  // Advancement gate echoed by the enrichment service: advance the contact out
  // of its parked (WAITING) stage only if the named field is now present.
  advanceWhen?: unknown;
};

type Firmographics = {
  companyName?: unknown;
  companyWebsite?: unknown;
  companyDomain?: unknown;
  industry?: unknown;
  employeeCountEstimate?: unknown;
  location?: unknown;
  description?: unknown;
  services?: unknown;
  techStack?: unknown;
};

type EnrichmentPayload = {
  email?: unknown;
  firmographics?: Firmographics;
  signals?: unknown;
  provenance?: unknown;
  custom?: unknown;
};

// Parses "{ hasField: string }" gate, or null when absent/malformed.
function parseAdvanceWhen(value: unknown): { hasField: string } | null {
  if (!isRecord(value)) return null;
  const hasField = optionalString(value.hasField);
  return hasField ? { hasField } : null;
}

// True when `field` (a Contact column or top-level customData key) holds a
// non-empty value on the updated contact — used to evaluate the advance gate.
function fieldPresent(
  columns: Record<string, unknown>,
  customData: unknown,
  field: string,
): boolean {
  const column = columns[field];
  if (column !== undefined) {
    return column !== null && String(column).trim() !== "";
  }
  const cd = isRecord(customData) ? customData : {};
  const value = cd[field];
  return value !== null && value !== undefined && String(value).trim() !== "";
}

// Lightweight RFC-ish email check (the verify step does the real validation).
function optionalEmail(value: unknown): string | null {
  const str = optionalString(value);
  if (!str) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) ? str.toLowerCase() : null;
}

type MutableJsonObject = Record<string, Prisma.InputJsonValue | null>;

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalPositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonObject(value: unknown): MutableJsonObject {
  return isRecord(value) ? (value as MutableJsonObject) : {};
}

// Only allow primitive / string-array values to be promoted to top-level
// customData keys (the shapes our templates read). Skips objects/null.
function sanitizeCustomFields(value: unknown): MutableJsonObject {
  if (!isRecord(value)) return {};

  const out: MutableJsonObject = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;
    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      out[key] = raw;
    } else if (
      Array.isArray(raw) &&
      raw.every((item) => typeof item === "string")
    ) {
      out[key] = raw as Prisma.InputJsonValue;
    }
  }
  return out;
}

function mergeCustomData(
  existing: unknown,
  enrichment: MutableJsonObject,
  customFields: MutableJsonObject,
): MutableJsonObject {
  return {
    ...jsonObject(existing),
    ...customFields,
    enrichment,
  };
}

function parseStatus(value: unknown): EnrichmentStatus | null {
  if (value === "RUNNING") return EnrichmentStatus.RUNNING;
  if (value === "ENRICHED") return EnrichmentStatus.ENRICHED;
  if (value === "FAILED") return EnrichmentStatus.FAILED;
  return null;
}

function parseEnrichment(value: unknown): EnrichmentPayload | null {
  return isRecord(value) ? (value as EnrichmentPayload) : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const secret = process.env.ENRICHMENT_CALLBACK_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { error: "ENRICHMENT_CALLBACK_SECRET is not configured" },
      { status: 503 },
    );
  }

  if (bearerToken(request) !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as CallbackBody | null;
  const status = parseStatus(body?.status);
  const jobId = optionalString(body?.jobId);

  if (!status) {
    return Response.json({ error: "Invalid enrichment status" }, { status: 400 });
  }

  if (body?.contactId && body.contactId !== id) {
    return Response.json(
      { error: "Callback contactId does not match route id" },
      { status: 400 },
    );
  }

  const contact = await prisma.contact.findUnique({
    where: { id },
    select: { id: true, email: true, customData: true },
  });

  if (!contact) {
    return Response.json({ error: "Contact not found" }, { status: 404 });
  }

  const now = new Date();
  const data: Prisma.ContactUpdateInput = {
    enrichmentStatus: status,
  };

  const enrichmentBlock: MutableJsonObject = {
    status,
    jobId: jobId ?? null,
    updatedAt: now.toISOString(),
  };

  // Custom (caller-declared) fields promoted to top-level customData keys.
  let customFields: MutableJsonObject = {};

  if (status === EnrichmentStatus.RUNNING) {
    enrichmentBlock.startedAt = now.toISOString();
  }

  if (status === EnrichmentStatus.FAILED) {
    enrichmentBlock.error = optionalString(body?.error) ?? "Enrichment failed";
    data.enrichedAt = now;
  }

  if (status === EnrichmentStatus.ENRICHED) {
    const enrichment = parseEnrichment(body?.enrichment);
    const firmographics = enrichment?.firmographics;
    customFields = sanitizeCustomFields(enrichment?.custom);

    // Firmographics are best-effort; the deliverable may be custom fields. But
    // an ENRICHED callback with neither is empty — reject it.
    if (!firmographics && Object.keys(customFields).length === 0) {
      return Response.json(
        {
          error:
            "ENRICHED callback requires enrichment.firmographics or enrichment.custom",
        },
        { status: 400 },
      );
    }

    if (firmographics) {
      const companyName = optionalString(firmographics.companyName);
      const companyWebsite = optionalString(firmographics.companyWebsite);
      const companyDomain = optionalString(firmographics.companyDomain);
      const industry = optionalString(firmographics.industry);
      const employeeCount = optionalPositiveInt(
        firmographics.employeeCountEstimate,
      );
      const location = optionalString(firmographics.location);

      if (companyName) data.companyName = companyName;
      if (companyWebsite) data.companyWebsite = companyWebsite;
      if (companyDomain) data.companyDomain = companyDomain;
      if (industry) data.companyIndustry = industry;
      if (employeeCount) data.companyEmployeeCount = employeeCount;
      if (location) data.companyLocation = location;

      enrichmentBlock.firmographics = jsonObject(firmographics);
    }

    // Found email -> write to the email column only when empty and not already
    // taken by another contact (the column is unique). The verify step decides
    // validity; we leave emailStatus as-is (UNKNOWN) so it still gets verified.
    const foundEmail = optionalEmail(enrichment?.email);
    if (foundEmail && !contact.email) {
      const clash = await prisma.contact.findUnique({
        where: { email: foundEmail },
        select: { id: true },
      });
      if (!clash || clash.id === contact.id) {
        data.email = foundEmail;
      } else {
        enrichmentBlock.emailSkipped = `already used by another contact`;
      }
      enrichmentBlock.email = foundEmail;
    }

    data.enrichedAt = now;
    enrichmentBlock.signals = Array.isArray(enrichment?.signals)
      ? (enrichment?.signals as Prisma.InputJsonValue)
      : [];
    enrichmentBlock.provenance = jsonObject(enrichment?.provenance);
    // Keep a provenance copy of the raw custom object under enrichment.custom.
    enrichmentBlock.custom = jsonObject(enrichment?.custom);
  }

  data.customData = mergeCustomData(
    contact.customData,
    enrichmentBlock,
    customFields,
  );

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      companyWebsite: true,
      companyDomain: true,
      companyEmployeeCount: true,
      companyIndustry: true,
      companyLocation: true,
      enrichmentStatus: true,
      enrichedAt: true,
      customData: true,
    },
  });

  // Resolve any pipeline placement parked as WAITING by an async (non-advancing)
  // enrich action. FAILED enrichment never advances. On ENRICHED, an optional
  // gate (advanceWhen) requires a field (e.g. email) to be present; with no
  // gate we advance unconditionally.
  let advancement: Awaited<ReturnType<typeof resolveWaitingContact>> | null =
    null;

  if (status === EnrichmentStatus.FAILED) {
    advancement = await resolveWaitingContact(contact.id, false);
  } else if (status === EnrichmentStatus.ENRICHED) {
    const gate = parseAdvanceWhen(body?.advanceWhen);
    const advance = gate
      ? fieldPresent(
          updated as unknown as Record<string, unknown>,
          updated.customData,
          gate.hasField,
        )
      : true;
    advancement = await resolveWaitingContact(contact.id, advance);
  }

  return Response.json({
    contact: {
      ...updated,
      enrichedAt: updated.enrichedAt?.toISOString() ?? null,
    },
    advancement,
  });
}
