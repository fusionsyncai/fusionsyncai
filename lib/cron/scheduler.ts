import { runDueCronJobs } from "@/lib/cron/jobs";

const TICK_MS = 15_000; // how often we check for due jobs

let started = false;
let ticking = false;

// One tick: find due enabled jobs and run them. `ticking` prevents a slow tick
// from overlapping with the next interval callback.
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    await runDueCronJobs();
  } catch (err) {
    console.error("[cron] tick failed:", err);
  } finally {
    ticking = false;
  }
}

// Starts the in-app scheduler. Called once from instrumentation.ts when the
// Node server boots. While the CRM is running, enabled jobs fire automatically
// on their interval — no external cron/launchd needed.
export function startCronScheduler() {
  if (started) return;
  started = true;

  // First check shortly after boot so enabled jobs don't wait a full interval.
  setTimeout(() => void tick(), 2_000);
  setInterval(() => void tick(), TICK_MS);

  console.log(`[cron] scheduler started (tick every ${TICK_MS / 1000}s)`);
}
