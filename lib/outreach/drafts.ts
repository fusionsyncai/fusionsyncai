import { OutreachPipeline } from "@/generated/prisma/client";

import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_LINKEDIN_COMMENT,
  DEFAULT_LINKEDIN_CONNECTION,
  DEFAULT_REDDIT_COMMENT,
  DEFAULT_SIGNER_NAME,
} from "./defaults";
import type { ContactForDraft, OutreachDrafts } from "./types";

export type ProfileDraftConfig = {
  signerName?: string | null;
  emailSubjectTemplate?: string | null;
  emailBodyTemplate?: string | null;
  linkedinConnectionTemplate?: string | null;
  linkedinCommentTemplate?: string | null;
  redditCommentTemplate?: string | null;
};

type DraftContext = {
  contact: ContactForDraft;
  profile?: ProfileDraftConfig | null;
  signalContext?: string | null;
  sourceUrl?: string | null;
  postTopic?: string | null;
};

function customField(contact: ContactForDraft, key: string): string | null {
  const custom = contact.customData;
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) return null;
  const value = (custom as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstName(contact: ContactForDraft) {
  if (contact.firstName?.trim()) return contact.firstName.trim();
  const token = contact.name.trim().split(/\s+/)[0] ?? "there";
  if (
    /marketing|digital|agency|dental|expert|solutions|media|group|ltd|limited|uk/i.test(
      token,
    )
  ) {
    return "there";
  }
  return token;
}

function companyShort(contact: ContactForDraft) {
  return (
    contact.companyShortName?.trim() ||
    contact.companyName?.trim() ||
    "your agency"
  );
}

function openingHook(contact: ContactForDraft, signalContext?: string | null) {
  const signal = signalContext?.trim();
  if (signal) return signal.endsWith(".") ? signal : `${signal}.`;

  const highlight =
    customField(contact, "personalizedHighlight") ??
    customField(contact, "personalizationHighlight");
  if (highlight) return highlight.endsWith(".") ? highlight : `${highlight}.`;

  return `Came across ${companyShort(contact)} while looking at UK dental agencies.`;
}

function fill(template: string, vars: Record<string, string>) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out.replace(/\s+\n/g, "\n").trim();
}

export function buildDrafts(
  pipeline: OutreachPipeline,
  ctx: DraftContext,
): OutreachDrafts {
  const profile = ctx.profile ?? {};
  const vars = {
    first_name: firstName(ctx.contact),
    company_short: companyShort(ctx.contact),
    opening_hook: openingHook(ctx.contact, ctx.signalContext),
    post_topic:
      ctx.postTopic?.trim() ||
      ctx.signalContext?.trim() ||
      "scaling delivery for dental clients",
    your_name: profile.signerName?.trim() || DEFAULT_SIGNER_NAME,
  };

  const drafts: OutreachDrafts = {};

  if (
    pipeline === OutreachPipeline.EMAIL ||
    pipeline === OutreachPipeline.EMAIL_LINKEDIN
  ) {
    drafts.email = {
      subject: fill(
        profile.emailSubjectTemplate?.trim() || DEFAULT_EMAIL_SUBJECT,
        vars,
      ),
      body: fill(
        profile.emailBodyTemplate?.trim() || DEFAULT_EMAIL_BODY,
        vars,
      ),
    };
  }

  if (
    pipeline === OutreachPipeline.LINKEDIN ||
    pipeline === OutreachPipeline.EMAIL_LINKEDIN
  ) {
    const hasPost = Boolean(ctx.sourceUrl?.includes("linkedin.com"));
    drafts.linkedin = {
      connectionNote: fill(
        profile.linkedinConnectionTemplate?.trim() ||
          DEFAULT_LINKEDIN_CONNECTION,
        vars,
      ).slice(0, 300),
      comment: hasPost
        ? fill(
            profile.linkedinCommentTemplate?.trim() || DEFAULT_LINKEDIN_COMMENT,
            vars,
          )
        : undefined,
    };
  }

  if (pipeline === OutreachPipeline.REDDIT) {
    drafts.reddit = {
      comment: fill(
        profile.redditCommentTemplate?.trim() || DEFAULT_REDDIT_COMMENT,
        vars,
      ),
    };
  }

  return drafts;
}

export function draftsToTimelineSummary(
  pipeline: OutreachPipeline,
  drafts: OutreachDrafts,
): string {
  const parts: string[] = [`Draft generated (${pipeline.toLowerCase()})`];
  if (drafts.email?.subject) {
    parts.push(`Email subject: ${drafts.email.subject}`);
  }
  if (drafts.linkedin?.connectionNote) {
    parts.push("LinkedIn connection note ready");
  }
  if (drafts.linkedin?.comment) {
    parts.push("LinkedIn comment ready");
  }
  if (drafts.reddit?.comment) {
    parts.push("Reddit comment ready");
  }
  return parts.join(" · ");
}
