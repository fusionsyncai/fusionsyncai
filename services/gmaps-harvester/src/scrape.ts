import { chromium, type Page } from "playwright";

export type ScrapedBusiness = {
  businessName: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  category?: string | null;
  rating?: string | null;
  reviewCount?: number | null;
  googleMapsUrl?: string | null;
};

function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

async function scrollFeed(page: Page, maxScrolls: number) {
  let noGrowth = 0;
  let lastCount = 0;

  for (let i = 0; i < maxScrolls && noGrowth < 3; i++) {
    const count = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return 0;
      return Array.from(feed.children).filter(
        (el) => el.textContent && el.textContent.trim().length > 20,
      ).length;
    });

    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return;
      let target: HTMLElement | null = feed as HTMLElement;
      if (feed.scrollHeight <= feed.clientHeight) {
        let parent = feed.parentElement;
        while (parent && parent !== document.body) {
          if (parent.scrollHeight > parent.clientHeight + 100) {
            target = parent;
            break;
          }
          parent = parent.parentElement;
        }
      }
      target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
    });

    await page.waitForTimeout(1200);

    if (count > lastCount) {
      lastCount = count;
      noGrowth = 0;
    } else {
      noGrowth++;
    }
  }
}

async function extractBusinesses(page: Page): Promise<ScrapedBusiness[]> {
  return page.evaluate(() => {
    const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    const feed = document.querySelector('div[role="feed"]');
    if (!feed) return [] as Array<Record<string, string | number | null>>;

    const containers = Array.from(feed.children).filter((el) => {
      if ((el.textContent?.trim().length ?? 0) < 20) return false;
      return (
        el.querySelector('[aria-label*="star"]') ||
        el.querySelector('a[href*="/maps/place/"]')
      );
    });

    const results: Array<Record<string, string | number | null>> = [];

    for (const container of containers) {
      const text = container.textContent ?? "";
      if (text.includes("Sponsored") || text.includes("Ad ·")) continue;

      const placeLink = container.querySelector(
        'a[href*="/maps/place/"]',
      ) as HTMLAnchorElement | null;
      const businessName =
        placeLink?.getAttribute("aria-label")?.trim() ||
        placeLink?.textContent?.trim() ||
        "";
      if (!businessName) continue;

      let phone: string | null = null;
      const tel = container.querySelector('a[href^="tel:"]') as
        | HTMLAnchorElement
        | null;
      if (tel) {
        phone = tel.href.replace("tel:", "").trim();
      } else {
        const match = text.match(phoneRegex);
        phone = match?.[0] ?? null;
      }

      let website: string | null = null;
      const links = container.querySelectorAll('a[href^="http"]');
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href;
        if (
          href.includes("google.com") ||
          href.includes("facebook.com") ||
          href.includes("instagram.com")
        ) {
          continue;
        }
        const label = (
          link.getAttribute("aria-label") ||
          link.textContent ||
          ""
        ).toLowerCase();
        if (label.includes("website") || label.includes("visit")) {
          website = href;
          break;
        }
      }

      let address: string | null = null;
      for (const el of container.querySelectorAll("div, span")) {
        const value = el.textContent?.trim() ?? "";
        if (value.length < 8 || value.length > 150) continue;
        if (!/\d/.test(value) || !/[a-zA-Z]/.test(value)) continue;
        if (phoneRegex.test(value)) continue;
        if (
          /\b(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|way|pl|place)\b/i.test(
            value,
          )
        ) {
          address = value.replace(/^[^·]+·\s*/, "").trim();
          break;
        }
      }

      let category: string | null = null;
      for (const el of container.querySelectorAll("div, span")) {
        const value = el.textContent?.trim() ?? "";
        if (
          value.length >= 3 &&
          value.length <= 40 &&
          value !== businessName &&
          value !== address &&
          !phoneRegex.test(value) &&
          !/^(Open|Closed|Website|Directions)/i.test(value)
        ) {
          category = value;
          break;
        }
      }

      let rating: string | null = null;
      let reviewCount: number | null = null;
      const star = container.querySelector('[aria-label*="star"]');
      if (star) {
        const label = star.getAttribute("aria-label") ?? "";
        const ratingMatch = label.match(/(\d+\.?\d*)\s*star/i);
        if (ratingMatch) rating = ratingMatch[1];
        const reviewMatch = label.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*review/i);
        if (reviewMatch) {
          reviewCount = parseInt(reviewMatch[1].replace(/,/g, ""), 10);
        }
      }

      results.push({
        businessName,
        phone,
        website,
        address,
        category,
        rating,
        reviewCount,
        googleMapsUrl: placeLink?.href ?? null,
      });
    }

    return results;
  }) as Promise<ScrapedBusiness[]>;
}

function dedupeBusinesses(rows: ScrapedBusiness[]) {
  const seen = new Set<string>();
  const out: ScrapedBusiness[] = [];

  for (const row of rows) {
    const key = `${row.businessName.toLowerCase()}|${(row.phone ?? "").replace(/\D/g, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

export async function scrapeGoogleMaps(
  query: string,
  maxResults: number,
): Promise<{ query: string; businesses: ScrapedBusiness[] }> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-US",
    });
    const page = await context.newPage();
    await page.goto(mapsSearchUrl(query), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await page.waitForSelector('div[role="feed"]', { timeout: 45_000 }).catch(() => {});

    const scrollBudget = Math.min(200, Math.max(10, Math.ceil(maxResults / 5)));
    await scrollFeed(page, scrollBudget);

    const businesses = dedupeBusinesses(await extractBusinesses(page)).slice(
      0,
      maxResults,
    );

    await context.close();
    return { query, businesses };
  } finally {
    await browser.close();
  }
}
