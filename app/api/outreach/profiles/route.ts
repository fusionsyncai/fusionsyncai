import {
  createOutreachProfile,
  listOutreachProfiles,
} from "@/lib/outreach/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const profiles = await listOutreachProfiles();
  return Response.json({
    profiles: profiles.map((profile) => ({
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    icpDescription?: unknown;
    voiceNotes?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const profile = await createOutreachProfile({
      name,
      icpDescription:
        typeof body?.icpDescription === "string" ? body.icpDescription : null,
      voiceNotes: typeof body?.voiceNotes === "string" ? body.voiceNotes : null,
    });

    return Response.json(
      {
        profile: {
          ...profile,
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create profile";
    return Response.json({ error: message }, { status: 400 });
  }
}
