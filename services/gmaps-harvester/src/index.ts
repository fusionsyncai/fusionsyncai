import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";

import { scrapeGoogleMaps } from "./scrape.js";

const PORT = Number(process.env.GMAPS_HARVESTER_PORT ?? 5071);
const scrapeBodySchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(500).optional(),
});

let busy = false;

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1024 * 1024) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, {
      status: "ok",
      busy,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/scrape") {
    if (busy) {
      json(res, 429, { error: "Harvester is busy" });
      return;
    }

    try {
      const body = scrapeBodySchema.parse(await readJson(req));
      busy = true;
      const result = await scrapeGoogleMaps(
        body.query,
        body.maxResults ?? 120,
      );
      json(res, 200, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scrape failed";
      json(res, 400, { error: message });
    } finally {
      busy = false;
    }
    return;
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`[gmaps-harvester] listening on http://localhost:${PORT}`);
});
