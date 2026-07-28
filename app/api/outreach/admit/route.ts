import { OutreachPipeline } from "@/generated/prisma/client";

import { admitContactToProfile } from "@/lib/outreach/service";

export const dynamic = "force-dynamic";

/**
 * Called by campaign pipeline stage action "Add to Outreach Profile".
 *
 * Action config example:
 *   URL: http://localhost:3010/api/outreach/admit
 *   Method: POST
 *   Body: { "contactId": "{{contact.id}}", "profileId": "<outreach-profile-uuid>" }
 *   Success: HTTP 2xx (or JSON_MATCH key=ok value=true)
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    contactId?: unknown;
    profileId?: unknown;
    signalContext?: unknown;
    pipeline?: unknown;
  } | null;

  const contactId =
    typeof body?.contactId === "string" ? body.contactId.trim() : "";
  const profileId =
    typeof body?.profileId === "string" ? body.profileId.trim() : "";

  if (!contactId || !profileId) {
    return Response.json(
      { ok: false, error: "contactId and profileId are required" },
      { status: 400 },
    );
  }

  const forcePipeline =
    typeof body?.pipeline === "string" &&
    Object.values(OutreachPipeline).includes(body.pipeline as OutreachPipeline)
      ? (body.pipeline as OutreachPipeline)
      : undefined;

  try {
    const result = await admitContactToProfile({
      contactId,
      profileId,
      signalContext:
        typeof body?.signalContext === "string" ? body.signalContext : null,
      forcePipeline,
    });

    return Response.json({
      ok: true,
      created: result.created,
      pipeline: result.pipeline,
      itemId: result.item.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Admit failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
