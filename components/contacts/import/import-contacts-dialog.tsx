"use client";

import { useCallback, useMemo, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StepConfig } from "./step-config";
import { StepMapping } from "./step-mapping";
import { StepResult } from "./step-result";
import { StepUpload } from "./step-upload";
import {
  REQUIRED_CONTACT_FIELDS,
  applyMapping,
  type CsvMapping,
  type ImportConfig,
  type ImportSummary,
  type ParsedCsv,
  type WizardStep,
} from "./types";

const BATCH_SIZE = 250;

type ImportContactsDialogProps = {
  onImported?: () => void;
};

const INITIAL_CONFIG: ImportConfig = {
  tagId: "",
  campaignId: null,
  pipelineId: null,
  stageId: null,
};

const INITIAL_SUMMARY: ImportSummary = {
  total: 0,
  created: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

export function ImportContactsDialog({ onImported }: ImportContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [config, setConfig] = useState<ImportConfig>(INITIAL_CONFIG);
  const [summary, setSummary] = useState<ImportSummary>(INITIAL_SUMMARY);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const mappedRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) =>
      applyMapping(row, parsed.headers, mapping),
    );
  }, [parsed, mapping]);

  const canProceedMapping = REQUIRED_CONTACT_FIELDS.every(
    (field) => Boolean(mapping[field]),
  );

  const canProceedConfig =
    Boolean(config.tagId) &&
    (!config.pipelineId || Boolean(config.stageId));

  function reset() {
    setStep("upload");
    setFileName(null);
    setParsed(null);
    setMapping({});
    setConfig(INITIAL_CONFIG);
    setSummary(INITIAL_SUMMARY);
    setProgress({ processed: 0, total: 0 });
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  const runImport = useCallback(async () => {
    if (!parsed) return;

    setStep("importing");
    setError(null);

    const contacts = mappedRows.filter((row) => row.name);
    const total = contacts.length;
    setProgress({ processed: 0, total });

    const accumulated: ImportSummary = {
      total,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    try {
      for (let offset = 0; offset < contacts.length; offset += BATCH_SIZE) {
        const batch = contacts.slice(offset, offset + BATCH_SIZE);
        const response = await fetch("/api/contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: batch,
            tagId: config.tagId,
            campaignId: config.campaignId,
            pipelineId: config.pipelineId,
            stageId: config.stageId,
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "Import batch failed");
        }

        const batchResult = (await response.json()) as ImportSummary;

        accumulated.created += batchResult.created;
        accumulated.skipped += batchResult.skipped;
        accumulated.failed += batchResult.failed;
        accumulated.errors.push(
          ...batchResult.errors.map((err) => ({
            ...err,
            row: err.row + offset,
          })),
        );

        setProgress({
          processed: Math.min(offset + batch.length, total),
          total,
        });
      }

      setSummary(accumulated);
      setStep("result");
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("config");
    }
  }, [parsed, mappedRows, config, onImported]);

  const stepTitle: Record<WizardStep, string> = {
    upload: "Import CSV",
    mapping: "Map fields",
    config: "Import settings",
    importing: "Importing",
    result: "Import complete",
  };

  const stepDescription: Record<WizardStep, string> = {
    upload: "Upload a CSV file with your contacts.",
    mapping: "Match CSV columns to contact fields.",
    config: "Choose tag, campaign, and pipeline options.",
    importing: "Processing your contacts...",
    result: "Summary of the import run.",
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Upload className="mr-2 size-4" />
        Import CSV
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          size={step === "mapping" ? "xl" : "lg"}
          className="max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{stepTitle[step]}</DialogTitle>
            <DialogDescription>{stepDescription[step]}</DialogDescription>
            {fileName ? (
              <p className="text-xs text-muted-foreground">{fileName}</p>
            ) : null}
          </DialogHeader>

          {step === "upload" ? (
            <StepUpload
              onParsed={(data, name) => {
                setParsed(data);
                setFileName(name);
                setMapping({});
                setStep("mapping");
              }}
            />
          ) : null}

          {step === "mapping" && parsed ? (
            <StepMapping
              parsed={parsed}
              mapping={mapping}
              onMappingChange={setMapping}
            />
          ) : null}

          {step === "config" ? (
            <StepConfig
              contactCount={mappedRows.length}
              config={config}
              onConfigChange={setConfig}
            />
          ) : null}

          {step === "importing" || step === "result" ? (
            <StepResult
              summary={summary}
              isImporting={step === "importing"}
              progress={progress}
            />
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            {step === "mapping" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("upload")}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={!canProceedMapping}
                  onClick={() => setStep("config")}
                >
                  Continue
                </Button>
              </>
            ) : null}

            {step === "config" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("mapping")}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={!canProceedConfig}
                  onClick={() => void runImport()}
                >
                  Start import
                </Button>
              </>
            ) : null}

            {step === "result" ? (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
