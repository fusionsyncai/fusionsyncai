"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
import { ImportContactsDialog } from "@/components/contacts/import/import-contacts-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  emailStatus: string;
  phone: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyDomain: string | null;
  companyLocation: string | null;
  quality: string;
  score: number | null;
  customData: unknown;
  createdAt: string;
  _count: {
    campaigns: number;
    tags: number;
  };
};

type ContactsResponse = {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
};

const PAGE_SIZE = 25;

type PendingDelete =
  | { type: "single"; id: string; name: string }
  | { type: "bulk"; ids: string[] };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPersonalizedHighlight(customData: unknown) {
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) {
    return null;
  }

  const value = (customData as Record<string, unknown>).personalizedHighlight;
  return typeof value === "string" ? value : null;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async (targetPage: number) => {
    try {
      const response = await fetch(
        `/api/contacts?page=${targetPage}&pageSize=${PAGE_SIZE}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Failed to load contacts");
      }

      const data = (await response.json()) as ContactsResponse;
      setError(null);
      setContacts(data.contacts);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(page);
  }, [refresh, page]);

  const selectedContactIds = useMemo(() => {
    const ids = new Set(contacts.map((contact) => contact.id));
    return [...selected].filter((id) => ids.has(id));
  }, [contacts, selected]);

  const allSelected =
    contacts.length > 0 && selectedContactIds.length === contacts.length;
  const someSelected = selectedContactIds.length > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const confirmLabel = useMemo(() => {
    if (!pendingDelete) return "";
    if (pendingDelete.type === "single") {
      return `Delete "${pendingDelete.name}"? This cannot be undone.`;
    }
    const count = pendingDelete.ids.length;
    return `Delete ${count} contact${count === 1 ? "" : "s"}? This cannot be undone.`;
  }, [pendingDelete]);

  async function runDelete() {
    if (!pendingDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      if (pendingDelete.type === "single") {
        const response = await fetch(`/api/contacts/${pendingDelete.id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Failed to delete contact");
        }
      } else {
        const response = await fetch("/api/contacts/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: pendingDelete.ids }),
        });
        if (!response.ok) {
          throw new Error("Failed to delete contacts");
        }
      }

      const deletedCount =
        pendingDelete.type === "single" ? 1 : pendingDelete.ids.length;
      // If we just emptied the current page, step back one (but never below 1).
      const nextPage =
        page > 1 && deletedCount >= contacts.length ? page - 1 : page;

      setSelected(new Set());
      setPendingDelete(null);
      await refresh(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Enriched leads staged before they are synced to RecallSync.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddContactDialog onCreated={() => void refresh(1)} />
          <ImportContactsDialog onImported={() => void refresh(1)} />
        </div>
      </div>

      {selectedContactIds.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedContactIds.length} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() =>
              setPendingDelete({ type: "bulk", ids: selectedContactIds })
            }
          >
            <Trash2 className="mr-1.5 size-4" />
            Delete selected
          </Button>
        </div>
      ) : null}

      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">
            Loading contacts...
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : contacts.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No contacts yet. Scraped and enriched contacts will appear here.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all contacts"
                    className="size-4 cursor-pointer rounded border-input accent-primary"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Email status</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="w-72">Personalized highlight</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Campaigns</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  data-state={selected.has(contact.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${contact.name}`}
                      className="size-4 cursor-pointer rounded border-input accent-primary"
                      checked={selected.has(contact.id)}
                      onChange={() => toggleOne(contact.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="text-primary hover:underline"
                    >
                      {contact.name}
                    </Link>
                  </TableCell>
                  <TableCell>{contact.email ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formatLabel(contact.emailStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>{contact.phone ?? "-"}</TableCell>
                  <TableCell>
                  <div className="space-y-0.5">
                      <div>{contact.companyName ?? "-"}</div>
                      {contact.companyDomain ? (
                        <div className="text-xs text-muted-foreground">
                          {contact.companyDomain}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="w-72 max-w-72 whitespace-normal text-sm text-muted-foreground">
                    {getPersonalizedHighlight(contact.customData) ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge>{formatLabel(contact.quality)}</Badge>
                    {contact.score !== null ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {contact.score}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{contact._count.campaigns}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(contact.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${contact.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setPendingDelete({
                          type: "single",
                          id: contact.id,
                          name: contact.name,
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {!isLoading && !error && total > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + contacts.length}{" "}
            of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contacts</AlertDialogTitle>
            <AlertDialogDescription>{confirmLabel}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void runDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
