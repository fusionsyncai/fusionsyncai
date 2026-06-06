/** Scrub Telegram bot tokens from log lines (defense in depth). */
const TOKEN_PATTERN = /(\/bot)?\d{6,}:[A-Za-z0-9_-]{20,}/g;

export function redactSecrets(message: string): string {
  return message.replace(TOKEN_PATTERN, (_m, prefix) => `${prefix ?? ""}<REDACTED>`);
}

export function logInfo(...args: unknown[]): void {
  console.log(
    ...args.map((a) =>
      typeof a === "string" ? redactSecrets(a) : a
    )
  );
}

export function logWarn(...args: unknown[]): void {
  console.warn(
    ...args.map((a) =>
      typeof a === "string" ? redactSecrets(a) : a
    )
  );
}
