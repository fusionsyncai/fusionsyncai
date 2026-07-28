import { OutreachItemStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const item = await prisma.outreachItem.findUnique({
    where: { id },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          title: true,
          email: true,
          linkedinUrl: true,
          companyName: true,
          companyShortName: true,
          companyWebsite: true,
          companyLocation: true,
        },
      },
        profile: { select: { id: true, name: true, slug: true } },
        timeline: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!item) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    item: {
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      timeline: item.timeline.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    signalContext?: unknown;
  } | null;

  const status =
    typeof body?.status === "string" &&
    Object.values(OutreachItemStatus).includes(body.status as OutreachItemStatus)
      ? (body.status as OutreachItemStatus)
      : undefined;

  if (!status && body?.signalContext === undefined) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const item = await prisma.outreachItem.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(typeof body?.signalContext === "string"
          ? { signalContext: body.signalContext.trim() }
          : {}),
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            linkedinUrl: true,
            companyName: true,
            companyShortName: true,
          },
        },
        profile: { select: { id: true, name: true, slug: true } },
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });

    return Response.json({
      item: {
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        timeline: item.timeline.map((entry) => ({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
        })),
      },
    });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
