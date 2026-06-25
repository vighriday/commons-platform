// File-upload safety for the live-submit path (C6).
//
// Order of defence (size-cap BEFORE buffering, then content-sniff, then sanitize):
//   1. multer memory storage with hard limits: 6 MB, ONE file, the field "photo".
//   2. an image-only MIME allow-list at the multer gate (cheap first filter).
//   3. processImage(): re-decode with sharp — this VERIFIES the bytes are really a
//      JPEG/PNG/WebP (a renamed non-image throws), STRIPS EXIF (GPS/privacy, C16),
//      and downscales to a safe web size. Output is a clean JPEG buffer.
// A zip/polyglot/oversized file is rejected before any model call.
import multer from "multer";
import sharp from "sharp";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB hard cap
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 8, parts: 12 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("UNSUPPORTED_MEDIA_TYPE"));
  },
}).single("photo");

export interface ProcessedImage {
  jpeg: Buffer; // EXIF-stripped, downscaled JPEG
  base64: string; // for the Gemini Vision inlineData part
  width: number;
  height: number;
}

// Verify + sanitize an uploaded image buffer. Throws on a non-image (sharp can't
// decode it) so a renamed bomb never reaches the model.
export async function processImage(buf: Buffer): Promise<ProcessedImage> {
  const pipeline = sharp(buf, { failOn: "error" })
    .rotate() // apply EXIF orientation before we strip metadata
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 }); // re-encode → drops all metadata (EXIF/GPS gone)
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { jpeg: data, base64: data.toString("base64"), width: info.width, height: info.height };
}
