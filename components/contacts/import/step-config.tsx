"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CampaignOption,
  ImportConfig,
  PipelineOption,
  TagOption,
} from "./types";

type StepConfigProps = {
  contactCount: number;
  config: ImportConfig;
  onConfigChange: (config: ImportConfig) => void;
};

export function StepConfig({
  contactCount,
  config,
  onConfigChange,
}: StepConfigProps) {
  const [tags, setTags] = useState<TagOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const [tagsRes, campaignsRes, pipelinesRes] = await Promise.all([
          fetch("/api/tags", { cache: "no-store" }),
          fetch("/api/campaigns", { cache: "no-store" }),
          fetch("/api/pipelines", { cache: "no-store" }),
        ]);

        if (!tagsRes.ok || !campaignsRes.ok || !pipelinesRes.ok) {
          throw new Error("Failed to load import options");
        }

        const tagsData = (await tagsRes.json()) as { tags: TagOption[] };
        const campaignsData = (await campaignsRes.json()) as {
          campaigns: CampaignOption[];
        };
        const pipelinesData = (await pipelinesRes.json()) as {
          pipelines: PipelineOption[];
        };

        setTags(tagsData.tags);
        setCampaigns(campaignsData.campaigns);
        setPipelines(pipelinesData.pipelines);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const selectedPipeline = pipelines.find((p) => p.id === config.pipelineId);

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;

    setIsCreatingTag(true);
    setError(null);

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to create tag");
      }

      const data = (await response.json()) as {
        tag: TagOption & { createdAt: string };
      };

      setTags((prev) => {
        const exists = prev.some((t) => t.id === data.tag.id);
        if (exists) return prev;
        return [...prev, { id: data.tag.id, name: data.tag.name, color: data.tag.color }];
      });
      onConfigChange({ ...config, tagId: data.tag.id });
      setNewTagName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
    } finally {
      setIsCreatingTag(false);
    }
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading options...</p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm">
          <span className="font-semibold">{contactCount}</span> contact
          {contactCount === 1 ? "" : "s"} will be imported
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Existing contacts (matched by email or phone) will be skipped.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Tag <span className="text-destructive">*</span>
        </label>
        <Select
          value={config.tagId || null}
          onValueChange={(tagId) => {
            if (tagId) onConfigChange({ ...config, tagId });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a tag" />
          </SelectTrigger>
          <SelectContent>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            placeholder="Create new tag"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createTag();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!newTagName.trim() || isCreatingTag}
            onClick={() => void createTag()}
          >
            <Plus className="mr-1 size-4" />
            Create
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Campaign (optional)</label>
        <Select
          value={config.campaignId ?? "__none__"}
          onValueChange={(value) =>
            onConfigChange({
              ...config,
              campaignId: value === "__none__" ? null : value,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No campaign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No campaign</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Pipeline (optional)</label>
        <Select
          value={config.pipelineId ?? "__none__"}
          onValueChange={(value) =>
            onConfigChange({
              ...config,
              pipelineId: value === "__none__" ? null : value,
              stageId: null,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No pipeline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No pipeline</SelectItem>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
                {pipeline.campaignName ? ` (${pipeline.campaignName})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {config.pipelineId && selectedPipeline ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Stage <span className="text-destructive">*</span>
          </label>
          <Select
            value={config.stageId ?? ""}
            onValueChange={(stageId) => {
              if (stageId) onConfigChange({ ...config, stageId });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a stage" />
            </SelectTrigger>
            <SelectContent>
              {selectedPipeline.stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
