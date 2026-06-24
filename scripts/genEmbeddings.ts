// COMMONS — precompute report embeddings ONCE, commit the result.
//
// Embeds all 96 report texts with gemini-embedding-001 and writes
// seed/embeddings.json ({ [reportId]: number[] }). This is the only bulk
// embedding spend in the project: the app reads this committed file and does
// in-process cosine, so demo/dev runs cost ZERO embedding calls.
//
// Usage: node --env-file=.env --import tsx scripts/genEmbeddings.ts
// Re-run only when report texts change.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { Report } from "../shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.resolve(__dirname, "../seed");
const MODEL = "gemini-embedding-001";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // eslint-disable-next-line no-console
  console.error("[genEmbeddings] GEMINI_API_KEY required (run with --env-file=.env).");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const reports = JSON.parse(readFileSync(path.join(SEED_DIR, "reports.json"), "utf8")) as Report[];

async function embed(text: string): Promise<number[]> {
  const res = await ai.models.embedContent({ model: MODEL, contents: text });
  const values = res.embeddings?.[0]?.values;
  if (!values || values.length === 0) throw new Error("empty embedding");
  return values;
}

async function main() {
  const out: Record<string, number[]> = {};
  let done = 0;
  for (const r of reports) {
    // Embed category + text together so clustering sees the issue type.
    const vec = await embed(`[${r.category}] ${r.text}`);
    out[r.reportId] = vec;
    done++;
    if (done % 12 === 0) {
      // eslint-disable-next-line no-console
      console.log(`[genEmbeddings] ${done}/${reports.length}`);
    }
  }
  const dims = out[reports[0].reportId].length;
  writeFileSync(
    path.join(SEED_DIR, "embeddings.json"),
    JSON.stringify({ model: MODEL, dim: dims, vectors: out }, null, 2),
  );
  // eslint-disable-next-line no-console
  console.log(`[genEmbeddings] OK — ${done} embeddings (dim ${dims}) → seed/embeddings.json`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[genEmbeddings] failed:", err);
  process.exit(1);
});
