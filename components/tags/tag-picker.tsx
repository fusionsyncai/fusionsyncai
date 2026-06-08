"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TagOption = {
  id: string;
  name: string;
  color?: string | null;
};

type TagPickerProps = {
  tags: TagOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  // Creates a tag by name and returns its id (so it can be auto-selected).
  onCreate?: (name: string) => Promise<string | null>;
  disabled?: boolean;
  emptyHint?: string;
};

// Multi-select tag picker rendered as toggleable chips, with optional inline
// "create tag" input. Controlled: the parent owns the tag list + selected ids.
export function TagPicker({
  tags,
  value,
  onChange,
  onCreate,
  disabled,
  emptyHint = "No tags yet — create one below.",
}: TagPickerProps) {
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const selected = new Set(value);

  function toggle(id: string) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !onCreate || isCreating) return;

    setIsCreating(true);
    try {
      const id = await onCreate(name);
      if (id && !selected.has(id)) {
        onChange([...value, id]);
      }
      setNewName("");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      {tags.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const isSelected = selected.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                disabled={disabled}
                className="disabled:cursor-not-allowed disabled:opacity-50"
                aria-pressed={isSelected}
              >
                <Badge
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer gap-1 transition-colors",
                    !isSelected && "hover:bg-accent",
                  )}
                >
                  {isSelected ? <Check className="size-3" /> : null}
                  {tag.name}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {onCreate ? (
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="New tag name"
            className="h-8 w-48"
            disabled={disabled || isCreating}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCreate()}
            disabled={disabled || isCreating || !newName.trim()}
          >
            <Plus className="size-4" />
            Add tag
          </Button>
        </div>
      ) : null}
    </div>
  );
}
