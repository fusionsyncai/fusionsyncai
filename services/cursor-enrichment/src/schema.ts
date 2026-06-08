import { z } from "zod";

const nullableString = z.string().trim().min(1).nullable();
const nullableNumber = z.number().int().positive().nullable();

// Templated Action bodies render missing contact fields as "" — treat empty /
// whitespace-only strings as null so an absent optional seed field is valid.
const optionalSeedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().min(1).nullable().optional(),
);

// A declared custom output field the caller wants the agent to produce. Mirrors
// Clay's "add a column with a prompt" — the key/type/description drive both the
// prompt and a dynamically-built validator for the agent's `custom` object.
export const outputFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "key must be a valid identifier"),
  type: z.enum(["string", "number", "boolean", "string[]"]).default("string"),
  description: z.string().trim().min(1),
  required: z.boolean().default(false),
});

export type OutputField = z.infer<typeof outputFieldSchema>;

export const enrichRequestSchema = z.object({
  contactId: z.string().trim().min(1),
  seed: z.object({
    name: optionalSeedString,
    title: optionalSeedString,
    linkedinUrl: optionalSeedString,
    companyName: optionalSeedString,
    companyWebsite: optionalSeedString,
    companyDomain: optionalSeedString,
  }),
  // Free-text guidance for the agent (campaign context, tone, goal).
  instructions: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  // Declared custom fields to produce and return under `custom`.
  outputs: z.array(outputFieldSchema).default([]),
  // When true, the agent also tries to find the contact's best work email and
  // returns it in `result.email` (the callback writes it to the email column).
  findEmail: z.boolean().default(false),
  // Opaque advancement gate echoed back in the callback so the CRM can decide
  // whether to advance the contact (e.g. only if `email` is now present). Not
  // interpreted by this service — it just round-trips it.
  advanceWhen: z
    .object({ hasField: z.string().trim().min(1) })
    .nullable()
    .optional(),
  callbackUrl: z.string().url(),
});

export type EnrichRequest = z.infer<typeof enrichRequestSchema>;

// Builds a zod validator for the agent's `custom` object from declared outputs.
// Required fields must be present and non-empty; optional ones may be null.
export function buildCustomSchema(
  outputs: OutputField[],
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of outputs) {
    let base: z.ZodTypeAny;
    switch (field.type) {
      case "number":
        base = z.number();
        break;
      case "boolean":
        base = z.boolean();
        break;
      case "string[]":
        base = z.array(z.string().trim().min(1));
        break;
      default:
        base = z.string().trim().min(1);
    }

    shape[field.key] = field.required ? base : base.nullable().optional();
  }

  return z.object(shape).passthrough() as z.ZodType<Record<string, unknown>>;
}

export const enrichmentResultSchema = z.object({
  // Best work email the agent found for the contact (only when findEmail). The
  // CRM callback writes this to the contact's email column when it's empty.
  email: z.string().trim().email().nullable().default(null),
  firmographics: z.object({
    companyName: nullableString,
    companyWebsite: nullableString,
    companyDomain: nullableString,
    industry: nullableString,
    employeeCountEstimate: nullableNumber,
    location: nullableString,
    description: nullableString,
    services: z.array(z.string().trim().min(1)).default([]),
    techStack: z.array(z.string().trim().min(1)).default([]),
  }),
  signals: z
    .array(
      z.object({
        type: z.enum(["hiring", "news", "launch", "funding", "partnership", "technology", "other"]),
        summary: z.string().trim().min(1),
        sourceUrl: z.string().url().nullable(),
      }),
    )
    .default([]),
  provenance: z.object({
    sources: z
      .array(
        z.object({
          title: z.string().trim().min(1).nullable(),
          url: z.string().url(),
          note: z.string().trim().min(1).nullable(),
        }),
      )
      .default([]),
    confidence: z.number().min(0).max(1),
    model: z.string().trim().min(1),
    ranAt: z.string().datetime(),
  }),
  // Caller-declared custom fields (validated separately against buildCustomSchema).
  custom: z.record(z.unknown()).default({}),
});

export type EnrichmentResult = z.infer<typeof enrichmentResultSchema>;

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type Job = {
  id: string;
  request: EnrichRequest;
  status: JobStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error: string | null;
};
