import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type BulkDeleteFilter = {
  ids?: string[];
  tagId?: string | null;
  from?: Date | null;
  to?: Date | null;
};

// Deletes a single contact by id. Related rows (tags, campaign/pipeline links)
// cascade via the schema. Returns true if a row was deleted, false if missing.
export async function deleteContact(id: string): Promise<boolean> {
  try {
    await prisma.contact.delete({ where: { id } });
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return false;
    }
    throw err;
  }
}

// Builds the AND-combined where clause for a bulk delete. Returns null when no
// filter is provided so callers can refuse to delete the whole table.
export function buildBulkDeleteWhere(
  filter: BulkDeleteFilter,
): Prisma.ContactWhereInput | null {
  const and: Prisma.ContactWhereInput[] = [];

  if (filter.ids && filter.ids.length > 0) {
    and.push({ id: { in: filter.ids } });
  }

  if (filter.tagId) {
    and.push({ tags: { some: { tagId: filter.tagId } } });
  }

  if (filter.from || filter.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filter.from) createdAt.gte = filter.from;
    if (filter.to) createdAt.lte = filter.to;
    and.push({ createdAt });
  }

  if (and.length === 0) {
    return null;
  }

  return { AND: and };
}

// Bulk-deletes contacts matching the filter (ids AND tag AND date range).
// Returns the number deleted, or null when no filter was supplied.
export async function bulkDeleteContacts(
  filter: BulkDeleteFilter,
): Promise<number | null> {
  const where = buildBulkDeleteWhere(filter);
  if (!where) {
    return null;
  }

  const result = await prisma.contact.deleteMany({ where });
  return result.count;
}
