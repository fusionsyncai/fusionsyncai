import {
  getOutreachProfile,
  updateOutreachProfile,
} from "@/lib/outreach/profiles";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const profile = await getOutreachProfile(id);

  if (!profile) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    profile: {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const optionalString = (key: string) => {
    if (!(key in body)) return undefined;
    const value = body[key];
    if (value === null) return null;
    if (typeof value === "string") return value;
    return undefined;
  };

  try {
    const profile = await updateOutreachProfile(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      icpDescription: optionalString("icpDescription"),
      voiceNotes: optionalString("voiceNotes"),
      signerName: optionalString("signerName"),
      emailSubjectTemplate: optionalString("emailSubjectTemplate"),
      emailBodyTemplate: optionalString("emailBodyTemplate"),
      linkedinConnectionTemplate: optionalString("linkedinConnectionTemplate"),
      linkedinCommentTemplate: optionalString("linkedinCommentTemplate"),
      redditCommentTemplate: optionalString("redditCommentTemplate"),
      enrichmentPrompt: optionalString("enrichmentPrompt"),
      active: typeof body.active === "boolean" ? body.active : undefined,
    });

    return Response.json({
      profile: {
        ...profile,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = message === "No fields to update" ? 400 : 404;
    return Response.json({ error: message }, { status });
  }
}
