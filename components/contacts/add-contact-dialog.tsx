"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CampaignOption = { id: string; name: string };
type PipelineOption = {
  id: string;
  name: string;
  campaignId: string | null;
  campaignName: string | null;
  stages: { id: string; name: string; order: number }[];
};

type AddContactDialogProps = {
  onCreated?: () => void;
};

const NONE = "__none__";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  website: "",
  facebookUrl: "",
};

export function AddContactDialog({ onCreated }: AddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [campaignId, setCampaignId] = useState<string>(NONE);
  const [pipelineId, setPipelineId] = useState<string>(NONE);
  const [stageId, setStageId] = useState<string>("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    void (async () => {
      try {
        const [campaignsRes, pipelinesRes] = await Promise.all([
          fetch("/api/campaigns", { cache: "no-store" }),
          fetch("/api/pipelines", { cache: "no-store" }),
        ]);
        if (campaignsRes.ok) {
          const data = (await campaignsRes.json()) as {
            campaigns: CampaignOption[];
          };
          setCampaigns(data.campaigns);
        }
        if (pipelinesRes.ok) {
          const data = (await pipelinesRes.json()) as {
            pipelines: PipelineOption[];
          };
          setPipelines(data.pipelines);
        }
      } catch {
        /* options are optional; ignore load errors */
      }
    })();
  }, [open]);

  function reset() {
    setForm({ ...EMPTY_FORM });
    setShowAdvanced(false);
    setCampaignId(NONE);
    setPipelineId(NONE);
    setStageId("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // When a campaign is chosen, default the pipeline to that campaign's pipeline
  // (1:1), so the user usually only picks the stage.
  function handleCampaignChange(value: string) {
    setCampaignId(value);
    if (value === NONE) return;
    const owned = pipelines.find((p) => p.campaignId === value);
    if (owned) {
      setPipelineId(owned.id);
      setStageId("");
    }
  }

  function handlePipelineChange(value: string) {
    setPipelineId(value);
    setStageId("");
  }

  const selectedPipeline = pipelines.find((p) => p.id === pipelineId);
  const pipelineChosen = pipelineId !== NONE;

  async function handleSubmit() {
    if (isSaving) return;
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    if (pipelineChosen && !stageId) {
      setError("Select a stage for the chosen pipeline.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        companyWebsite: form.website.trim() || undefined,
        facebookUrl: form.facebookUrl.trim() || undefined,
      };
      if (campaignId !== NONE) payload.campaignIds = [campaignId];
      if (pipelineChosen && stageId) {
        payload.pipelineId = pipelineId;
        payload.stageId = stageId;
      }

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to create contact");
      }

      onCreated?.();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 size-4" />
        Add contact
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
            <DialogDescription>
              Create a single contact. Use Advanced to place it in a campaign
              and pipeline stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. AirMaster"
                autoFocus
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+1 813 670 8860"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Website</label>
              <Input
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Facebook URL</label>
              <Input
                value={form.facebookUrl}
                onChange={(e) => update("facebookUrl", e.target.value)}
                placeholder="https://facebook.com/yourpage"
              />
            </div>

            <div className="rounded-lg border">
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="flex w-full items-center gap-1.5 px-3 py-2.5 text-sm font-medium"
              >
                {showAdvanced ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
                Advanced — campaign &amp; pipeline
              </button>

              {showAdvanced ? (
                <div className="space-y-4 border-t p-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Campaign</label>
                    <Select
                      value={campaignId}
                      onValueChange={(value) =>
                        handleCampaignChange(value as string)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No campaign</SelectItem>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Pipeline</label>
                    <Select
                      value={pipelineId}
                      onValueChange={(value) =>
                        handlePipelineChange(value as string)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No pipeline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No pipeline</SelectItem>
                        {pipelines.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                            {pipeline.campaignName
                              ? ` (${pipeline.campaignName})`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {pipelineChosen && selectedPipeline ? (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        Stage <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={stageId || null}
                        onValueChange={(value) => setStageId(value as string)}
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
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSaving || !form.name.trim()}
            >
              {isSaving ? "Creating..." : "Create contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
