/** Normalized business row from the Maps scraper service. */
export type GmScrapedBusiness = {
  businessName: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  category?: string | null;
  rating?: string | null;
  reviewCount?: number | null;
  googleMapsUrl?: string | null;
};

export type GmScrapeResult = {
  businesses: GmScrapedBusiness[];
  query: string;
};
