import { listLogs } from "@/lib/logs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const result = await listLogs({
    page: Number(searchParams.get("page")) || undefined,
    pageSize: Number(searchParams.get("pageSize")) || undefined,
    category: searchParams.get("category"),
    level: searchParams.get("level"),
    entityType: searchParams.get("entityType"),
    entityId: searchParams.get("entityId"),
  });

  return Response.json(result);
}
