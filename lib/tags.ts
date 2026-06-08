import { prisma } from "@/lib/prisma";

export async function listTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      recallsyncCampaignId: true,
      createdAt: true,
      _count: { select: { contacts: true } },
    },
  });
}

type CreateTagInput = {
  name: string;
  color?: string | null;
  description?: string | null;
};

export async function createTag(input: CreateTagInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("name is required");
  }

  const existing = await prisma.tag.findUnique({ where: { name } });
  if (existing) {
    return existing;
  }

  return prisma.tag.create({
    data: {
      name,
      color: input.color?.trim() || null,
      description: input.description?.trim() || null,
    },
  });
}
