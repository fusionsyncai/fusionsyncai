import { createTag, listTags } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function GET() {
  const tags = await listTags();

  return Response.json({
    tags: tags.map((tag) => ({
      ...tag,
      createdAt: tag.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    color?: unknown;
    description?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const tag = await createTag({
      name,
      color: typeof body?.color === "string" ? body.color : null,
      description:
        typeof body?.description === "string" ? body.description : null,
    });

    return Response.json(
      {
        tag: {
          ...tag,
          createdAt: tag.createdAt.toISOString(),
          updatedAt: tag.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create tag";
    return Response.json({ error: message }, { status: 400 });
  }
}
