import {
  OutreachPipeline,
  type Contact,
} from "@/generated/prisma/client";

export type OutreachDrafts = {
  email?: {
    subject: string;
    body: string;
  };
  linkedin?: {
    comment?: string;
    connectionNote: string;
  };
  reddit?: {
    comment: string;
  };
};

export type ContactForDraft = Pick<
  Contact,
  | "name"
  | "firstName"
  | "lastName"
  | "title"
  | "email"
  | "linkedinUrl"
  | "companyName"
  | "companyShortName"
  | "companyWebsite"
  | "companyIndustry"
  | "companyLocation"
  | "customData"
>;

export const OUTREACH_PIPELINES = [
  "EMAIL",
  "LINKEDIN",
  "REDDIT",
  "EMAIL_LINKEDIN",
] as const;

export const OUTREACH_STATUSES = [
  "PENDING",
  "SENT",
  "REPLIED",
  "SUCCESS",
  "SKIP",
] as const;

export function resolvePipeline(input: {
  pipeline?: OutreachPipeline | null;
  email?: string | null;
  linkedinUrl?: string | null;
  sourceUrl?: string | null;
  defaultPipeline?: OutreachPipeline | null;
}): OutreachPipeline {
  if (input.pipeline) return input.pipeline;

  if (input.defaultPipeline) return input.defaultPipeline;

  const hasEmail = Boolean(input.email?.trim());
  const hasLinkedIn = Boolean(input.linkedinUrl?.trim());
  const isReddit =
    input.sourceUrl?.includes("reddit.com") ||
    input.sourceUrl?.includes("redd.it");

  if (isReddit) return OutreachPipeline.REDDIT;
  if (hasEmail && hasLinkedIn) return OutreachPipeline.EMAIL_LINKEDIN;
  if (hasEmail) return OutreachPipeline.EMAIL;
  if (hasLinkedIn) return OutreachPipeline.LINKEDIN;

  return OutreachPipeline.LINKEDIN;
}

export function formatPipelineLabel(pipeline: OutreachPipeline) {
  return pipeline
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatStatusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
