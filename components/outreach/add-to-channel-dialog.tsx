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

type AddToChannelDialogProps = {
  profileId: string;
  channel: string;
  onCreated?: () => void;
};

export function AddToChannelDialog({
  profileId,
  channel,
  onCreated,
}: AddToChannelDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [signalContext, setSignalContext] = useState("");

  function reset() {
    setName("");
    setCompanyName("");
    setEmail("");
    setLinkedinUrl("");
    setSourceUrl("");
    setSignalContext("");
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
          profileId,
          channel,
          name: name.trim(),
          companyName: companyName.trim() || undefined,
          email: email.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          signalContext: signalContext.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to add");
      }

      setOpen(false);
      reset();
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add manually
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
            <DialogTitle>Add to channel</DialogTitle>
            <DialogDescription>
              Manual entry for this profile channel — creates contact if needed.
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              placeholder="LinkedIn profile URL"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
            <Input
              placeholder="Post / thread URL"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
            <textarea
              className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Signal context — why now?"
              value={signalContext}
              onChange={(e) => setSignalContext(e.target.value)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? "Adding…" : "Add & draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
