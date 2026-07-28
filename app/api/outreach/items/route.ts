import { OutreachItemStatus, OutreachPipeline } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { channelToPipeline } from "@/lib/outreach/profiles";
import {
  createOutreachItem,
  serializeOutreachItem,
} from "@/lib/outreach/service";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value: string | null): OutreachItemStatus | undefined {
  if (!value) return undefined;
  return Object.values(OutreachItemStatus).includes(value as OutreachItemStatus)
    ? (value as OutreachItemStatus)
    : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const status = parseStatus(searchParams.get("status"));
  const profileId = searchParams.get("profileId")?.trim() || undefined;
  const channel = searchParams.get("channel")?.trim() || undefined;
  const pipeline = channel
    ? channelToPipeline(channel)
    : searchParams.get("pipeline")?.trim()
      ? (searchParams.get("pipeline") as OutreachPipeline)
      : undefined;

  if (!profileId) {
    return Response.json({ error: "profileId is required" }, { status: 400 });
  }

  const where = {
    profileId,
    ...(status ? { status } : {}),
    ...(pipeline ? { pipeline } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.outreachItem.count({ where }),
    prisma.outreachItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            linkedinUrl: true,
            companyName: true,
            companyShortName: true,
            companyEmployeeCount: true,
            customData: true,
          },
        },
        profile: { select: { id: true, name: true, slug: true } },
        timeline: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return Response.json({
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      timeline: item.timeline.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    })),
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    profileId?: unknown;
    contactId?: unknown;
    pipeline?: unknown;
    channel?: unknown;
    signalContext?: unknown;
    sourceUrl?: unknown;
    postTopic?: unknown;
    name?: unknown;
    email?: unknown;
    linkedinUrl?: unknown;
    companyName?: unknown;
  } | null;

  const profileId =
    typeof body?.profileId === "string" ? body.profileId.trim() : "";
  if (!profileId) {
    return Response.json({ error: "profileId is required" }, { status: 400 });
  }

  try {
    let contactId =
      typeof body?.contactId === "string" ? body.contactId.trim() : null;

    if (!contactId && typeof body?.name === "string" && body.name.trim()) {
      const contact = await prisma.contact.create({
        data: {
          name: body.name.trim(),
          email: typeof body.email === "string" ? body.email.trim() : null,
          linkedinUrl:
            typeof body.linkedinUrl === "string"
              ? body.linkedinUrl.trim()
              : null,
          companyName:
            typeof body.companyName === "string"
              ? body.companyName.trim()
              : null,
          source: "outreach_manual",
          country: "GB",
        },
      });
      contactId = contact.id;
    }

    const channelPipeline =
      typeof body?.channel === "string"
        ? channelToPipeline(body.channel)
        : null;

    const pipeline =
      typeof body?.pipeline === "string" &&
      Object.values(OutreachPipeline).includes(body.pipeline as OutreachPipeline)
        ? (body.pipeline as OutreachPipeline)
        : channelPipeline ?? undefined;

    const item = await createOutreachItem({
      profileId,
      contactId,
      pipeline,
      signalContext:
        typeof body?.signalContext === "string" ? body.signalContext : null,
      sourceUrl: typeof body?.sourceUrl === "string" ? body.sourceUrl : null,
      postTopic: typeof body?.postTopic === "string" ? body.postTopic : null,
    });

    return Response.json(
      { item: serializeOutreachItem(item) },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create item";
    return Response.json({ error: message }, { status: 400 });
  }
}
