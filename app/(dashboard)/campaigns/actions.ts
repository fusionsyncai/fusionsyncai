"use server";

import { revalidatePath } from "next/cache";

import { createCampaignWithPipeline } from "@/lib/campaigns";

export async function createCampaign() {
  const campaign = await createCampaignWithPipeline({
    name: "Untitled campaign",
    description: "Local CRM campaign segment",
  });

  revalidatePath("/campaigns");
  revalidatePath("/api/campaigns");

  return { id: campaign.id };
}
