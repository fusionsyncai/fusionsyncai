import { runGmScraperQueryById } from "@/lib/gm-scraper/runner";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await runGmScraperQueryById(id);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
