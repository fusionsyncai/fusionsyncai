"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

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

const PIPELINES = ["EMAIL", "LINKEDIN", "REDDIT", "EMAIL_LINKEDIN"] as const;

type AddOutreachDialogProps = {
  onCreated?: () => void;
};

export function AddOutreachDialog({ onCreated }: AddOutreachDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [signalContext, setSignalContext] = useState("");
  const [pipeline, setPipeline] = useState<string>("");

  function reset() {
    setName("");
    setCompanyName("");
    setEmail("");
    setLinkedinUrl("");
    setSourceUrl("");
    setSignalContext("");
    setPipeline("");
    setError(null);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/outreach/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyName: companyName.trim() || undefined,
          email: email.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          signalContext: signalContext.trim() || undefined,
          pipeline: pipeline || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create outreach item");
      }

      setOpen(false);
      reset();
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add to queue
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add to outreach queue</DialogTitle>
            <DialogDescription>
              Manual entry — creates a contact if needed and generates channel drafts.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              placeholder="Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              placeholder="LinkedIn profile URL"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
            <Input
              placeholder="Post / thread URL (Reddit or LinkedIn post)"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
            <textarea
              className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Signal context — why now? (e.g. hiring setter for dental clients)"
              value={signalContext}
              onChange={(e) => setSignalContext(e.target.value)}
            />
            <Select value={pipeline} onValueChange={(value) => setPipeline(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Pipeline (auto if empty)" />
              </SelectTrigger>
              <SelectContent>
                {PIPELINES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? "Creating…" : "Create & draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
