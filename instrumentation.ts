// Runs once when the Next.js Node server starts (see next instrumentation docs).
// We use it to boot the in-app cron scheduler so dashboard-managed jobs actually
// fire while the CRM is running.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startCronScheduler } = await import("@/lib/cron/scheduler");
  startCronScheduler();
}
