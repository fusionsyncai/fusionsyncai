// Catalog of columns the campaign Contacts-tab table can show. Per-campaign
// selection lives in Campaign.contactColumns (a JSON array of these keys). This
// module is pure (no prisma/server imports) so the client page can import it
// for rendering and the column picker.

export const CONTACT_COLUMNS = [
  { key: "action", label: "Action" },
  { key: "name", label: "Name" },
  { key: "companyName", label: "Company" },
  { key: "companyShortName", label: "Company (short)" },
  { key: "personalizedHighlight", label: "Personalized highlight" },
  { key: "mailbox", label: "Mailbox" },
  { key: "email", label: "Email" },
  { key: "stage", label: "Stage" },
  { key: "status", label: "Status" },
  { key: "quality", label: "Quality" },
  { key: "emailStatus", label: "Email status" },
] as const;

export type ContactColumnKey = (typeof CONTACT_COLUMNS)[number]["key"];

export const CONTACT_COLUMN_KEYS: readonly ContactColumnKey[] =
  CONTACT_COLUMNS.map((column) => column.key);

// Shown when a campaign has no explicit selection (mirrors the original table).
export const DEFAULT_CONTACT_COLUMNS: ContactColumnKey[] = [
  "action",
  "name",
  "stage",
  "quality",
  "emailStatus",
];

// Validates a stored/incoming value into a clean, de-duped list of known column
// keys (order preserved). Unknown keys are dropped; bad input -> [].
export function parseContactColumns(value: unknown): ContactColumnKey[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>(CONTACT_COLUMN_KEYS);
  const seen = new Set<string>();
  const out: ContactColumnKey[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !valid.has(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item as ContactColumnKey);
  }
  return out;
}
