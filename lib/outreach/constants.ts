/** Client-safe outreach constants (no server/DB imports). */

export const OUTREACH_CHANNELS = [
  "email",
  "linkedin",
  "email-linkedin",
  "reddit",
] as const;

export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export function channelToPipeline(channel: string) {
  switch (channel.toLowerCase()) {
    case "email":
      return "EMAIL" as const;
    case "linkedin":
      return "LINKEDIN" as const;
    case "email-linkedin":
    case "email_linkedin":
      return "EMAIL_LINKEDIN" as const;
    case "reddit":
      return "REDDIT" as const;
    default:
      return null;
  }
}

export function pipelineToChannel(pipeline: string) {
  switch (pipeline) {
    case "EMAIL":
      return "email";
    case "LINKEDIN":
      return "linkedin";
    case "EMAIL_LINKEDIN":
      return "email-linkedin";
    case "REDDIT":
      return "reddit";
    default:
      return "email";
  }
}
