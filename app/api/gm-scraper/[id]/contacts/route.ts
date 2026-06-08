import { listGmScraperQueryContacts } from "@/lib/gm-scraper/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contacts = await listGmScraperQueryContacts(id);
  return Response.json({ contacts });
}
