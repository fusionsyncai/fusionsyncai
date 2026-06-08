import type { GmScrapeResult } from "./types";

const DEFAULT_BASE_URL = "http://localhost:5071";

function baseUrl() {
  return (process.env.GMAPS_HARVESTER_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

/** Phase 1 stub — returns fake listings when the harvester service is unavailable. */
function stubScrape(query: string, maxResults: number): GmScrapeResult {
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const count = Math.min(3, maxResults);
  const businesses = Array.from({ length: count }, (_, i) => ({
    businessName: `Stub Business ${i + 1} (${query})`,
    phone: `555-010${i}`,
    website: `https://${slug || "example"}-${i + 1}.example.com`,
    address: `123 Main St, ${query}`,
    category: "Stub category",
    googleMapsUrl: `https://www.google.com/maps/place/stub-${i + 1}`,
  }));

  return { query, businesses };
}

/**
 * Scrape Google Maps for a search query via the gmaps-harvester service.
 * Falls back to stub data when GMAPS_HARVESTER_STUB=true or the service is down.
 */
export async function scrapeGoogleMaps(
  query: string,
  maxResults: number,
): Promise<GmScrapeResult> {
  if (process.env.GMAPS_HARVESTER_STUB === "true") {
    return stubScrape(query, maxResults);
  }

  const url = `${baseUrl()}/scrape`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, maxResults }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Harvester returned HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }

    const data = (await response.json()) as GmScrapeResult;
    if (!Array.isArray(data.businesses)) {
      throw new Error("Harvester response missing businesses array");
    }

    return data;
  } catch (err) {
    if (process.env.GMAPS_HARVESTER_STUB === "fallback") {
      console.warn("[gm-scraper] harvester failed, using stub:", err);
      return stubScrape(query, maxResults);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
