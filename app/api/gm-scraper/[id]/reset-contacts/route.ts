import {
  resetGmScraperQueryContacts,
  type ResetGmScraperContactsMode,
} from "@/lib/gm-scraper/queries";

export const dynamic = "force-dynamic";

const VALID_MODES: ResetGmScraperContactsMode[] = [
  "pipeline_only",
  "reset_enrichment",
  "full_reset",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    mode?: unknown;
  } | null;

  const mode: ResetGmScraperContactsMode =
    typeof body?.mode === "string" &&
    VALID_MODES.includes(body.mode as ResetGmScraperContactsMode)
      ? (body.mode as ResetGmScraperContactsMode)
      : "full_reset";

  try {
    const result = await resetGmScraperQueryContacts(id, mode);
    if (!result) {
      return Response.json({ error: "Query not found" }, { status: 404 });
    }
    return Response.json({ mode, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reset query contacts";
    return Response.json({ error: message }, { status: 400 });
  }
}
