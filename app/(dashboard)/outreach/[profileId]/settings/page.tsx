"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ProfileSettings = {
  id: string;
  name: string;
  icpDescription: string | null;
  voiceNotes: string | null;
  signerName: string | null;
  emailSubjectTemplate: string | null;
  emailBodyTemplate: string | null;
  linkedinConnectionTemplate: string | null;
  linkedinCommentTemplate: string | null;
  redditCommentTemplate: string | null;
  enrichmentPrompt: string | null;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

const textareaClass =
  "min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono";

export default function ProfileSettingsPage() {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;

  const [form, setForm] = useState<ProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/outreach/profiles/${profileId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load");
      setForm(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  function setField<K extends keyof ProfileSettings>(
    key: K,
    value: ProfileSettings[K],
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function save() {
    if (!form) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/outreach/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          icpDescription: form.icpDescription,
          voiceNotes: form.voiceNotes,
          signerName: form.signerName,
          emailSubjectTemplate: form.emailSubjectTemplate,
          emailBodyTemplate: form.emailBodyTemplate,
          linkedinConnectionTemplate: form.linkedinConnectionTemplate,
          linkedinCommentTemplate: form.linkedinCommentTemplate,
          redditCommentTemplate: form.redditCommentTemplate,
          enrichmentPrompt: form.enrichmentPrompt,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to save");
      setForm(data.profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link href={`/outreach/${profileId}/channels/email`} />
            }
          >
            <ArrowLeft className="mr-1.5 size-4" />
            Back to channels
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Profile settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit email templates and enrichment prompt for {form.name}. Vars:{" "}
            {"{{first_name}}"}, {"{{company_short}}"}, {"{{opening_hook}}"},{" "}
            {"{{your_name}}"}, {"{{post_topic}}"}.
          </p>
        </div>
        <Button type="button" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-muted-foreground">
          Saved. Redraft outreach items to pick up template changes.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
          </Field>
          <Field label="Signer name" hint="Used as {{your_name}} in templates">
            <Input
              value={form.signerName ?? ""}
              onChange={(e) => setField("signerName", e.target.value)}
            />
          </Field>
          <Field label="ICP description">
            <textarea
              className={textareaClass}
              value={form.icpDescription ?? ""}
              onChange={(e) => setField("icpDescription", e.target.value)}
            />
          </Field>
          <Field label="Voice notes">
            <textarea
              className={textareaClass}
              value={form.voiceNotes ?? ""}
              onChange={(e) => setField("voiceNotes", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Subject">
            <Input
              value={form.emailSubjectTemplate ?? ""}
              onChange={(e) =>
                setField("emailSubjectTemplate", e.target.value)
              }
            />
          </Field>
          <Field label="Body">
            <textarea
              className={`${textareaClass} min-h-56`}
              value={form.emailBodyTemplate ?? ""}
              onChange={(e) => setField("emailBodyTemplate", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">LinkedIn templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Connection note">
            <textarea
              className={textareaClass}
              value={form.linkedinConnectionTemplate ?? ""}
              onChange={(e) =>
                setField("linkedinConnectionTemplate", e.target.value)
              }
            />
          </Field>
          <Field label="Comment (when post URL present)">
            <textarea
              className={textareaClass}
              value={form.linkedinCommentTemplate ?? ""}
              onChange={(e) =>
                setField("linkedinCommentTemplate", e.target.value)
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reddit template</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Comment">
            <textarea
              className={`${textareaClass} min-h-40`}
              value={form.redditCommentTemplate ?? ""}
              onChange={(e) =>
                setField("redditCommentTemplate", e.target.value)
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrichment opener prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Field
            label="Prompt"
            hint="Few-shot instructions for personalizedHighlight. Saving also updates the Dental GM Enrich action."
          >
            <textarea
              className={`${textareaClass} min-h-48`}
              value={form.enrichmentPrompt ?? ""}
              onChange={(e) => setField("enrichmentPrompt", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button type="button" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
