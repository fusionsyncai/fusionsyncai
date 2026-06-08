"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { createCampaign } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  recallsyncCampaignId: string | null;
  createdAt: string;
  _count: {
    contacts: number;
  };
};

type CampaignsResponse = {
  campaigns: Campaign[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function fetchCampaigns() {
  const response = await fetch("/api/campaigns", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to load campaigns");
  }

  const data = (await response.json()) as CampaignsResponse;
  return data.campaigns;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        setError(null);
        setCampaigns(await fetchCampaigns());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    }

    void loadCampaigns();
  }, []);

  function handleCreateCampaign() {
    startTransition(async () => {
      await createCampaign();
      setCampaigns(await fetchCampaigns());
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Local CRM campaign segments mapped to RecallSync campaigns later.
          </p>
        </div>
        <Button onClick={handleCreateCampaign} disabled={isPending}>
          <Plus className="size-4" />
          {isPending ? "Creating..." : "New campaign"}
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">
            Loading campaigns...
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : campaigns.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No campaigns yet. Create one to group contacts before RecallSync
            sync.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>RecallSync campaign</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <Link
                        href={`/campaign/${campaign.id}`}
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.description ? (
                        <div className="text-xs text-muted-foreground">
                          {campaign.description}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{campaign._count.contacts}</TableCell>
                  <TableCell>
                    {campaign.recallsyncCampaignId ? (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {campaign.recallsyncCampaignId}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">Not mapped</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(campaign.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
