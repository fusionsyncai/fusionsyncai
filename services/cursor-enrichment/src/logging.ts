const SECRET_PATTERN =
  /(cursor_[A-Za-z0-9_-]+|Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/g;

export function redactSecrets(message: string): string {
  return message.replace(SECRET_PATTERN, (_match, prefix) =>
    prefix === "Bearer " ? "Bearer <REDACTED>" : "<REDACTED>",
  );
}

export function logInfo(...args: unknown[]): void {
  console.log(
    ...args.map((arg) =>
      typeof arg === "string" ? redactSecrets(arg) : arg,
    ),
  );
}

export function logWarn(...args: unknown[]): void {
  console.warn(
    ...args.map((arg) =>
      typeof arg === "string" ? redactSecrets(arg) : arg,
    ),
  );
}
