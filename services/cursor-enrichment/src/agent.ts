import { spawn } from "node:child_process";
import { getConfig } from "./config.js";
import {
  buildCustomSchema,
  enrichmentResultSchema,
  type EnrichRequest,
  type EnrichmentResult,
} from "./schema.js";

export type AgentResult = {
  reply: string;
  sessionId: string | null;
  exitCode: number;
};

export function parseAgentJson(
  stdout: string,
  stderr: string,
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
            fallback,
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

function runCursorAgent(prompt: string): Promise<AgentResult> {
  const config = getConfig();
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

  cmd.push(prompt);

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd[0]!, cmd.slice(1), {
      cwd: config.cursorAgentCwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), 5_000).unref();
    }, config.requestTimeoutMs);

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout?.on("data", (data: Buffer) => chunks.push(data));
    proc.stderr?.on("data", (data: Buffer) => errChunks.push(data));

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const stdout = Buffer.concat(chunks).toString("utf8");
      const stderr = Buffer.concat(errChunks).toString("utf8");
      const { reply, sessionId } = parseAgentJson(stdout, stderr);
      resolve({
        reply,
        sessionId,
        exitCode: code ?? 0,
      });
    });
  });
}

function customShapeForPrompt(request: EnrichRequest): Record<string, string> {
  const shape: Record<string, string> = {};
  for (const field of request.outputs) {
    const requirement = field.required ? "required" : "null if unknown";
    shape[field.key] = `${field.type} (${requirement}) — ${field.description}`;
  }
  return shape;
}

function buildPrompt(request: EnrichRequest): string {
  const seed = request.seed;
  const hasCustom = request.outputs.length > 0;

  const lines = [
    "You are an AIOS CRM company-enrichment researcher.",
    "Research this contact/company using web search. Return ONLY valid JSON matching the schema below. Do not include markdown, comments, prose, or code fences.",
    "",
    "Rules:",
    "- Prefer factual data from the company website, LinkedIn/company pages, reputable directories, job boards, press/news, and public profiles.",
    "- Every signal must have a sourceUrl when available. Use null only if you cannot identify a durable URL.",
    "- Do not invent exact numbers. If employee count is uncertain, provide a conservative integer estimate or null.",
    "- Keep signals relevant to sales/outreach personalization: hiring, launches, funding, partnerships, technology, recent news.",
    "- confidence is 0..1 and should reflect source quality and agreement.",
    "- ranAt must be the current ISO timestamp.",
  ];

  if (hasCustom) {
    lines.push(
      "- Produce the `custom` object with EXACTLY the keys listed under the custom shape below. Ground every custom value in what you actually found; do not fabricate. Required keys must be present.",
    );
  }

  if (request.findEmail) {
    lines.push(
      "- Find the contact's best professional/work email. Prefer a verifiable address found on the company site, contact/about pages, or public profiles. If none is found, infer the most likely address from the company's confirmed email pattern + domain. Return it in `email`. Use null only if you cannot determine a plausible address. Never invent a random mailbox.",
    );
  }

  // Stable tool mechanics (the HOW). Only mention crawl4ai when it's configured.
  // The WHEN (which pages to crawl, what to extract) comes from the caller's
  // instructions below, so this stays generic and reusable across campaigns.
  const config = getConfig();
  if (config.crawl4aiUrl) {
    const authHeader = config.crawl4aiToken
      ? ` -H "Authorization: Bearer $CRAWL4AI_API_TOKEN"`
      : "";
    lines.push(
      "",
      "Tools available (run as shell commands):",
      "- crawl4ai renders JavaScript-gated pages (Facebook, Instagram, LinkedIn, etc.) that a plain HTTP fetch only sees as a login/pre-render shell. Use it when a static site hides contact info but a social/profile page likely exposes it. Call it like:",
      `  curl -s -m 60 -X POST ${config.crawl4aiUrl}/crawl -H "Content-Type: application/json"${authHeader} -d '{"urls":["<PAGE_URL>"],"crawler_config":{"type":"CrawlerRunConfig","params":{"cache_mode":"bypass"}}}'`,
      "  The JSON response has results[].markdown and results[].html — scan that text for what you need (e.g. an email address). You may crawl more than one URL by adding to the urls array.",
    );
  }

  if (request.instructions) {
    lines.push(
      "",
      "Caller instructions (campaign context — follow these for the custom fields):",
      request.instructions,
    );
  }

  lines.push(
    "",
    "Input:",
    JSON.stringify(
      {
        contactId: request.contactId,
        name: seed.name ?? null,
        title: seed.title ?? null,
        linkedinUrl: seed.linkedinUrl ?? null,
        companyName: seed.companyName ?? null,
        companyWebsite: seed.companyWebsite ?? null,
        companyDomain: seed.companyDomain ?? null,
      },
      null,
      2,
    ),
    "",
    "JSON schema shape:",
    JSON.stringify(
      {
        ...(request.findEmail ? { email: "string(email)|null" } : {}),
        firmographics: {
          companyName: "string|null",
          companyWebsite: "string|null",
          companyDomain: "string|null",
          industry: "string|null",
          employeeCountEstimate: "number|null",
          location: "string|null",
          description: "string|null",
          services: ["string"],
          techStack: ["string"],
        },
        signals: [
          {
            type: "hiring|news|launch|funding|partnership|technology|other",
            summary: "string",
            sourceUrl: "url|null",
          },
        ],
        provenance: {
          sources: [{ title: "string|null", url: "url", note: "string|null" }],
          confidence: "number 0..1",
          model: "cursor-agent",
          ranAt: new Date().toISOString(),
        },
        custom: hasCustom ? customShapeForPrompt(request) : {},
      },
      null,
      2,
    ),
  );

  return lines.join("\n");
}

function stripFences(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseEnrichment(
  reply: string,
  request: EnrichRequest,
): EnrichmentResult {
  const parsed = JSON.parse(stripFences(reply)) as unknown;
  const result = enrichmentResultSchema.parse(parsed);

  // Validate the declared custom fields against a schema built from `outputs`.
  if (request.outputs.length > 0) {
    result.custom = buildCustomSchema(request.outputs).parse(result.custom);
  }

  return result;
}

export async function researchCompany(
  request: EnrichRequest,
): Promise<EnrichmentResult> {
  const prompt = buildPrompt(request);

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await runCursorAgent(
      attempt === 1
        ? prompt
        : `${prompt}\n\nYour previous answer was invalid. Return ONLY a valid JSON object matching the schema. No markdown.`,
    );

    if (result.exitCode !== 0 && !result.reply.trim()) {
      throw new Error(`cursor-agent exited with code ${result.exitCode}`);
    }

    try {
      return parseEnrichment(result.reply, request);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Invalid enrichment JSON");
}
