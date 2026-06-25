// Build-time: generate the real evidence photos with Gemini's image model.
//
// The four load-bearing evidence reports (the hidden crises) reference a photo.
// Rather than ship a placeholder, we GENERATE a real image per report with a
// Gemini image model and commit it. A separate step (genVision.ts) then runs a
// real Gemini Vision call over these images to extract the observed features —
// so the "the Evidence agent looked at the photo" claim becomes literally true.
//
// Run once (needs GEMINI_API_KEY): npm run seed:photos
import { writeFileSync } from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const OUT = path.resolve(process.cwd(), "seed/photos");
const MODEL = "gemini-2.5-flash-image";

// One realistic, documentary-style civic photo per evidence report. Prompts are
// written to look like a citizen's phone snap of the actual problem.
const SHOTS: { reportId: string; file: string; prompt: string }[] = [
  {
    reportId: "R033",
    file: "R033-drain.png",
    prompt:
      "A realistic smartphone photo taken by a resident: an urban roadside stormwater drain in Bengaluru choked with silt, mud and plastic waste, stagnant dark water not flowing, monsoon debris, daytime, documentary style, slightly imperfect framing.",
  },
  {
    reportId: "R047",
    file: "R047-pothole.png",
    prompt:
      "A realistic smartphone photo taken by a resident: a small shallow pothole on a residential asphalt street in Bengaluru, minor, some loose gravel, dry, daytime, documentary style, ordinary neighbourhood road.",
  },
  {
    reportId: "R058",
    file: "R058-subsidence.png",
    prompt:
      "A realistic smartphone photo taken by a resident: a section of road near a junction in Bengaluru that has sunk and depressed, visible road subsidence and cracking around a dip, daytime, documentary style.",
  },
  {
    reportId: "R064",
    file: "R064-crack.png",
    prompt:
      "A realistic smartphone photo taken by a resident: a long diagonal structural crack running up an exterior load-bearing wall of a low-rise concrete tenement building in Bengaluru, crack wider than 3mm, plaster flaking, daytime, documentary style, close-ish handheld shot.",
  },
];

async function main(): Promise<void> {
  for (const shot of SHOTS) {
    process.stdout.write(`generating ${shot.file} … `);
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: shot.prompt,
    });
    // The image comes back as inlineData (base64) on a part.
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    if (!imgPart?.inlineData?.data) {
      console.log("NO IMAGE RETURNED");
      continue;
    }
    const buf = Buffer.from(imgPart.inlineData.data, "base64");
    writeFileSync(path.join(OUT, shot.file), buf);
    console.log(`${Math.round(buf.length / 1024)} KB`);
  }
  console.log("done — real evidence photos written to seed/photos/");
}

main().catch((e) => {
  console.error("genPhotos failed:", e);
  process.exit(1);
});
