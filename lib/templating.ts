// Tiny, dependency-free {{path}} interpolation for action url/headers/body.
// Placeholders look like {{contact.email}} or {{contact.customData.someKey}}.
// Resolution walks dot paths against the provided context; a missing/null path
// renders as an empty string. Objects render as JSON.

export type TemplateContext = Record<string, unknown>;

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

function resolvePath(context: TemplateContext, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, context);
}

export function interpolateString(
  input: string,
  context: TemplateContext,
): string {
  return input.replace(PLACEHOLDER, (_match, path: string) => {
    const value = resolvePath(context, path);
    if (value == null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

// Recursively interpolates strings inside any JSON-like value (string, array,
// or plain object). Non-string leaves are returned unchanged.
export function interpolateValue(
  value: unknown,
  context: TemplateContext,
): unknown {
  if (typeof value === "string") {
    return interpolateString(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, context));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = interpolateValue(item, context);
    }
    return out;
  }
  return value;
}

// Interpolates a header map's VALUES (keys are left as-is).
export function interpolateHeaders(
  headers: Record<string, string>,
  context: TemplateContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = interpolateString(value, context);
  }
  return out;
}
