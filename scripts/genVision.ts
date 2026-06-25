// Build-time: REAL Gemini Vision over the committed evidence photos.
//
// For each evidence report that has a real (Creative-Commons) photo, this:
//   1. strips EXIF + downscales the image (privacy C16 + bundle size) via sharp,
//      writing a web-ready derivative the app serves;
//   2. makes a REAL Gemini Vision call that looks at the image and returns a
//      structured {observedFeatures, severitySignal, confidence, caption}.
// The output (seed/photoVision.json) is what the Evidence agent's `extracted`
// block is built from — so "the agent looked at the photo" is literally true,
// not a hand-authored annotation.
//
// Run once (needs GEMINI_API_KEY): npm run seed:vision
import { writeFileSync } from "node:fs";
import path from "node:path";
import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import sharp from "sharp";
import { z } from "zod";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PHOTOS = path.resolve(process.cwd(), "seed/photos");
const MODEL = "gemini-3.1-flash-lite";

// The evidence photos (real CC-licensed source files, committed in seed/photos/).
const PHOTOS_IN: { reportId: string; src: string; web: string; category: string }[] = [
  { reportId: "R033", src: "R033-drain.jpg", web: "R033-drain.web.jpg", category: "drainage" },
  { reportId: "R047", src: "R047-pothole.jpg", web: "R047-pothole.web.jpg", category: "roads" },
  { reportId: "R064", src: "R064-crack.jpg", web: "R064-crack.web.jpg", category: "structural" },
];

const VisionOut = z.object({
  caption: z.string().min(3),
  observedFeatures: z.array(z.string()).min(1).max(5),
  severitySignal: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
});
type VisionOut = z.infer<typeof VisionOut>;

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    caption: { type: Type.STRING },
    observedFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
    severitySignal: { type: Type.INTEGER },
    confidence: { type: Type.NUMBER },
  },
  required: ["caption", "observedFeatures", "severitySignal", "confidence"],
};

async function main(): Promise<void> {
  const out: Record<string, VisionOut & { web: string }> = {};

  for (const p of PHOTOS_IN) {
    process.stdout.write(`vision ${p.reportId} … `);

    // 1) EXIF-strip + downscale to a web derivative (sharp drops metadata by default).
    const webBuf = await sharp(path.join(PHOTOS, p.src))
      .rotate() // honour EXIF orientation before stripping it
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    writeFileSync(path.join(PHOTOS, p.web), webBuf);

    // 2) REAL Gemini Vision call over the derivative.
    const prompt =
      `You are a civic-infrastructure triage assistant. Look at this ${p.category} photo from a ` +
      `citizen report and describe ONLY what is visibly present. Return: a short caption; ` +
      `1-5 observedFeatures (concrete visual facts, e.g. "rusted metal grate", "standing water"); ` +
      `a severitySignal 1-5 for how serious the visible condition looks; and your confidence 0-1. ` +
      `Do not invent anything not visible.`;
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: webBuf.toString("base64") } },
          ],
        },
      ],
      config: { responseMimeType: "application/json", responseSchema: SCHEMA },
    });
    const parsed = VisionOut.parse(JSON.parse(res.text ?? "{}"));
    out[p.reportId] = { ...parsed, web: `seed/photos/${p.web}` };
    console.log(`sev ${parsed.severitySignal}, "${parsed.caption}"`);
  }

  writeFileSync(
    path.resolve(process.cwd(), "seed/photoVision.json"),
    `${JSON.stringify({ model: MODEL, generatedFrom: "real-CC-images", vision: out }, null, 2)}\n`,
  );
  console.log("done — real vision extractions written to seed/photoVision.json");
}

main().catch((e) => {
  console.error("genVision failed:", e);
  process.exit(1);
});
