"use client";

import type { OutreachDrafts } from "@/lib/outreach/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DraftPanelProps = {
  drafts: OutreachDrafts | null;
};

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function CopyBlock({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => copyText(text)}
        >
          Copy
        </Button>
      </div>
      <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
        {text}
      </pre>
    </div>
  );
}

export function DraftPanel({ drafts }: DraftPanelProps) {
  if (!drafts) {
    return (
      <p className="text-sm text-muted-foreground">No drafts generated yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {drafts.email ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CopyBlock label="Subject" text={drafts.email.subject} />
            <CopyBlock label="Body" text={drafts.email.body} />
          </CardContent>
        </Card>
      ) : null}

      {drafts.linkedin ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">LinkedIn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {drafts.linkedin.comment ? (
              <CopyBlock label="Comment" text={drafts.linkedin.comment} />
            ) : null}
            <CopyBlock
              label="Connection note"
              text={drafts.linkedin.connectionNote}
            />
          </CardContent>
        </Card>
      ) : null}

      {drafts.reddit ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reddit</CardTitle>
          </CardHeader>
          <CardContent>
            <CopyBlock label="Comment" text={drafts.reddit.comment} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
