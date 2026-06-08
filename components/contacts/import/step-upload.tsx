"use client";

import { useCallback, useRef, useState } from "react";
import Papa from "papaparse";
import { FileUp, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ParsedCsv } from "./types";

type StepUploadProps = {
  onParsed: (data: ParsedCsv, fileName: string) => void;
};

export function StepUpload({ onParsed }: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const parseFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Only CSV files are supported");
        return;
      }

      setIsParsing(true);
      setError(null);

      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: (results) => {
          setIsParsing(false);

          if (results.errors.length > 0) {
            setError(results.errors[0]?.message ?? "Failed to parse CSV");
            return;
          }

          const data = results.data.filter((row) =>
            row.some((cell) => cell && cell.trim() !== ""),
          );

          if (data.length < 2) {
            setError("CSV must include a header row and at least one data row");
            return;
          }

          const headers = data[0].map((h) => h.trim()).filter(Boolean);
          const rows = data.slice(1);

          if (headers.length === 0) {
            setError("CSV header row is empty");
            return;
          }

          onParsed({ headers, rows }, file.name);
        },
        error: (err) => {
          setIsParsing(false);
          setError(err.message);
        },
      });
    },
    [onParsed],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          {isParsing ? (
            <Upload className="size-6 animate-pulse text-muted-foreground" />
          ) : (
            <FileUp className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="text-center">
          <p className="font-medium">
            {isParsing ? "Parsing CSV..." : "Drop your CSV here"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse — CSV only
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isParsing}>
          Select file
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) parseFile(file);
          e.target.value = "";
        }}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
