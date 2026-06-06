import { type ChildProcess, spawn } from "node:child_process";
import { config } from "./config.js";

export type AgentResult = {
  reply: string;
  sessionId: string | null;
  exitCode: number;
};

export function parseAgentJson(
  stdout: string,
  stderr: string
): { reply: string; sessionId: string | null } {
  const raw = stdout.trim();
  const fallback = raw || stderr.trim();

  if (!raw) return { reply: fallback, sessionId: null };

  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data === "object" && data !== null) {
      const reply =
        String(
          data.result ??
            data.response ??
            data.output ??
            data.message ??
            fallback
        ) || fallback;
      const sid = data.session_id ?? data.sessionId ?? data.session;
      const sessionId = typeof sid === "string" ? sid : null;
      return { reply, sessionId };
    }
  } catch {
    const last = raw.split("\n").filter(Boolean).pop();
    if (last) {
      try {
        const data = JSON.parse(last) as Record<string, unknown>;
        const reply = String(data.result ?? data.response ?? fallback);
        const sid = data.session_id ?? data.sessionId;
        const sessionId = typeof sid === "string" ? sid : null;
        return { reply, sessionId };
      } catch {
        /* fall through */
      }
    }
  }

  return { reply: fallback, sessionId: null };
}

export function runCursorAgent(
  prompt: string,
  sessionId: string | null,
  onProc?: (proc: ChildProcess) => void
): Promise<AgentResult> {
  const cmd = [
    config.cursorAgentBin,
    "-p",
    "--model",
    config.cursorModel,
    "--output-format",
    "json",
  ];

  if (config.autoApprove) {
    cmd.push("--force", "--trust");
  }
  if (config.approveMcps) {
    cmd.push("--approve-mcps");
  }
  if (sessionId) {
    cmd.push("--resume", sessionId);
  }
  cmd.push(prompt);

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd[0]!, cmd.slice(1), {
      cwd: config.cursorAgentCwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    onProc?.(proc);

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout?.on("data", (d: Buffer) => chunks.push(d));
    proc.stderr?.on("data", (d: Buffer) => errChunks.push(d));

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      const stdout = Buffer.concat(chunks).toString("utf8");
      const stderr = Buffer.concat(errChunks).toString("utf8");
      const { reply, sessionId: newSession } = parseAgentJson(stdout, stderr);
      resolve({
        reply,
        sessionId: newSession,
        exitCode: code ?? 0,
      });
    });
  });
}
