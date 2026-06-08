"use client";

import { useMemo } from "react";
import { GripVertical, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACT_FIELD_KEYS,
  CONTACT_FIELD_LABELS,
  REQUIRED_CONTACT_FIELDS,
  type ContactFieldKey,
  type CsvMapping,
  type ParsedCsv,
} from "./types";

type StepMappingProps = {
  parsed: ParsedCsv;
  mapping: CsvMapping;
  onMappingChange: (mapping: CsvMapping) => void;
};

export function StepMapping({
  parsed,
  mapping,
  onMappingChange,
}: StepMappingProps) {
  const sampleByHeader = useMemo(() => {
    const sample: Record<string, string> = {};
    for (const header of parsed.headers) {
      const index = parsed.headers.indexOf(header);
      const value = parsed.rows.find((row) => row[index]?.trim())?.[index] ?? "";
      sample[header] = value.trim();
    }
    return sample;
  }, [parsed]);

  const usedColumns = new Set(
    Object.values(mapping).filter((v): v is string => Boolean(v)),
  );

  const unmappedHeaders = parsed.headers.filter((h) => !usedColumns.has(h));

  function setFieldMapping(field: ContactFieldKey, csvColumn: string | null) {
    const next = { ...mapping };
    if (!csvColumn) {
      delete next[field];
    } else {
      for (const key of CONTACT_FIELD_KEYS) {
        if (next[key] === csvColumn && key !== field) {
          delete next[key];
        }
      }
      next[field] = csvColumn;
    }
    onMappingChange(next);
  }

  function onDragStart(header: string) {
    return (event: React.DragEvent) => {
      event.dataTransfer.setData("text/csv-column", header);
      event.dataTransfer.effectAllowed = "move";
    };
  }

  function onDropField(field: ContactFieldKey) {
    return (event: React.DragEvent) => {
      event.preventDefault();
      const header = event.dataTransfer.getData("text/csv-column");
      if (header) setFieldMapping(field, header);
    };
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">CSV columns</h3>
          <p className="text-xs text-muted-foreground">
            Drag a column to a contact field on the right
          </p>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-3">
          {unmappedHeaders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All columns are mapped
            </p>
          ) : (
            unmappedHeaders.map((header) => (
              <div
                key={header}
                draggable
                onDragStart={onDragStart(header)}
                className="flex cursor-grab items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 active:cursor-grabbing"
              >
                <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{header}</p>
                  {sampleByHeader[header] ? (
                    <p className="truncate text-xs text-muted-foreground">
                      e.g. {sampleByHeader[header]}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} detected
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Contact fields</h3>
          <p className="text-xs text-muted-foreground">
            Drop CSV columns here or use the select
          </p>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-3">
          {CONTACT_FIELD_KEYS.map((field) => {
            const mapped = mapping[field];
            const isRequired = REQUIRED_CONTACT_FIELDS.includes(field);

            return (
              <div
                key={field}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropField(field)}
                className={`rounded-md border px-3 py-2 ${
                  mapped ? "border-primary/40 bg-primary/5" : "border-dashed"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {CONTACT_FIELD_LABELS[field]}
                    {isRequired ? (
                      <span className="ml-1 text-destructive">*</span>
                    ) : null}
                  </span>
                  {mapped ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0"
                      onClick={() => setFieldMapping(field, null)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : null}
                </div>

                {mapped ? (
                  <Badge variant="secondary" className="mt-1.5">
                    {mapped}
                  </Badge>
                ) : (
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value) setFieldMapping(field, value);
                    }}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue placeholder="Select column…" />
                    </SelectTrigger>
                    <SelectContent>
                      {parsed.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
