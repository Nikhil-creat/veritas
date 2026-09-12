import sharp from "sharp";
import exifr from "exifr";
import { fuseSignals } from "./scoreEngine";

// Known text signatures that image generators / editors embed in metadata.
const GENERATOR_SIGNATURES = [
  { pattern: /midjourney/i, label: "Midjourney" },
  { pattern: /dall-?e/i, label: "DALL·E" },
  { pattern: /stable ?diffusion/i, label: "Stable Diffusion" },
  { pattern: /firefly/i, label: "Adobe Firefly" },
  { pattern: /leonardo\.?ai/i, label: "Leonardo AI" },
  { pattern: /c2pa/i, label: "C2PA content credentials" },
  { pattern: /generative ?ai/i, label: "generic generative-AI tag" }
];

/**
 * Error Level Analysis: re-encode the image at a known JPEG quality and
 * diff it against the original. Regions that were edited or synthesized
 * after the last real compression pass tend to show a different error
 * level than the rest of the photo, because they were never compressed
 * at that pass. A single flat error level across the whole frame is
 * typical of an image that was generated whole-cloth rather than edited.
 */
async function runErrorLevelAnalysis(buffer) {
  const RECOMPRESS_QUALITY = 90;

  const original = sharp(buffer).ensureAlpha(false);
  const { width, height } = await original.metadata();
  if (!width || !height) {
    return { score: null, note: "Could not read image dimensions." };
  }

  const recompressed = await sharp(buffer)
    .jpeg({ quality: RECOMPRESS_QUALITY })
    .toBuffer();

  const [rawA, rawB] = await Promise.all([
    sharp(buffer).ensureAlpha(false).raw().toBuffer({ resolveWithObject: true }),
    sharp(recompressed).ensureAlpha(false).raw().toBuffer({ resolveWithObject: true })
  ]);

  const a = rawA.data;
  const b = rawB.data;
  const len = Math.min(a.length, b.length);

  // Break the frame into a coarse grid and compute mean absolute
  // difference per cell so we can measure how *uneven* the error is,
  // not just its average.
  const GRID = 8;
  const cellCounts = new Array(GRID * GRID).fill(0);
  const cellSums = new Array(GRID * GRID).fill(0);
  const channels = rawA.info.channels;
  const w = rawA.info.width;
  const h = rawA.info.height;

  for (let i = 0; i < len; i += channels) {
    const pixelIndex = i / channels;
    const x = pixelIndex % w;
    const y = Math.floor(pixelIndex / w);
    if (y >= h) break;
    const gx = Math.min(GRID - 1, Math.floor((x / w) * GRID));
    const gy = Math.min(GRID - 1, Math.floor((y / h) * GRID));
    const cell = gy * GRID + gx;

    let diff = 0;
    for (let c = 0; c < channels; c++) {
      diff += Math.abs(a[i + c] - b[i + c]);
    }
    cellSums[cell] += diff / channels;
    cellCounts[cell] += 1;
  }

  const cellMeans = cellSums.map((sum, idx) => (cellCounts[idx] ? sum / cellCounts[idx] : 0));
  const overallMean = cellMeans.reduce((s, v) => s + v, 0) / cellMeans.length;
  const variance =
    cellMeans.reduce((s, v) => s + (v - overallMean) ** 2, 0) / cellMeans.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation: low means the error level is unusually
  // uniform across the whole frame (consistent with a fully synthetic
  // image or a heavily post-processed one). High means localized edits
  // or a normal photo with varied texture/compression history.
  const coefficientOfVariation = overallMean > 0 ? stdDev / overallMean : 0;

  return {
    overallMean: Number(overallMean.toFixed(2)),
    coefficientOfVariation: Number(coefficientOfVariation.toFixed(3)),
    uniform: coefficientOfVariation < 0.35,
    grid: cellMeans.map((v) => Number(v.toFixed(2))),
    gridSize: GRID
  };
}

async function inspectMetadata(buffer) {
  let exifData = null;
  try {
    exifData = await exifr.parse(buffer, { xmp: true, iptc: true, icc: false });
  } catch {
    exifData = null;
  }

  const flatString = JSON.stringify(exifData || {});
  const matchedSignatures = GENERATOR_SIGNATURES.filter((sig) => sig.pattern.test(flatString)).map(
    (sig) => sig.label
  );

  const hasCameraMake = Boolean(exifData?.Make || exifData?.Model);
  const hasCaptureTimestamp = Boolean(exifData?.DateTimeOriginal || exifData?.CreateDate);
  const hasGPS = Boolean(exifData?.latitude || exifData?.GPSLatitude);

  return {
    matchedSignatures,
    hasCameraMake,
    hasCaptureTimestamp,
    hasGPS,
    strippedMetadata: !exifData || Object.keys(exifData).length === 0
  };
}

/**
 * Content-provenance manifest detection (C2PA / JUMBF).
 * This is a presence check, not cryptographic verification: it scans
 * the raw container for the box types and markers a C2PA manifest
 * uses (JUMBF superbox, 'cai ' / 'c2pa' identifiers). Actually
 * validating the signing chain against a trust list is a real project
 * in itself — flagged honestly in the signal detail and in the README.
 */
function detectProvenanceManifest(buffer) {
  const ascii = buffer.toString("latin1");
  const hasManifest = /c2pa/i.test(ascii) || /jumb/.test(ascii) || /cai\x20/.test(ascii);
  return { hasManifest };
}

/**
 * Perceptual hash (difference hash, 8x8) — a compact fingerprint that
 * stays stable across recompression and minor edits. Not used for
 * scoring yet (there's no reference database in this MVP), but it's
 * exposed in the raw report so a future version can flag "this exact
 * image was already analyzed" or diff against a known-image index.
 */
async function computePerceptualHash(buffer) {
  const size = 9;
  const { data } = await sharp(buffer)
    .resize(size, size - 1, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = "";
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const left = data[row * size + col];
      const right = data[row * size + col + 1];
      hash += left > right ? "1" : "0";
    }
  }
  // Pack the 64-bit binary string into hex for a compact fingerprint.
  return hash.match(/.{4}/g).map((nibble) => parseInt(nibble, 2).toString(16)).join("");
}

export async function analyzeImage(buffer) {
  const [ela, metadata, provenance, pHash] = await Promise.all([
    runErrorLevelAnalysis(buffer).catch((err) => ({ score: null, note: err.message })),
    inspectMetadata(buffer),
    Promise.resolve(detectProvenanceManifest(buffer)),
    computePerceptualHash(buffer).catch(() => null)
  ]);

  const signals = [];

  if (metadata.matchedSignatures.length > 0) {
    signals.push({
      id: "generator-signature",
      weight: 1,
      verdict: "flagged",
      title: "Generator signature found in metadata",
      detail: `Metadata references: ${metadata.matchedSignatures.join(", ")}.`
    });
  } else {
    signals.push({
      id: "generator-signature",
      weight: 1,
      verdict: "clear",
      title: "No known generator signature in metadata",
      detail: "No AI-tool tags were found in EXIF/XMP/IPTC fields."
    });
  }

  if (metadata.strippedMetadata) {
    signals.push({
      id: "metadata-presence",
      weight: 0.35,
      verdict: "caution",
      title: "Metadata is empty or stripped",
      detail:
        "Real camera photos almost always carry EXIF data. An empty metadata block is inconclusive on its own, but common after export from an image generator or a messaging app."
    });
  } else if (!metadata.hasCameraMake) {
    signals.push({
      id: "camera-make",
      weight: 0.35,
      verdict: "caution",
      title: "No camera make/model recorded",
      detail: "Metadata exists but does not identify a capturing device."
    });
  } else {
    signals.push({
      id: "camera-make",
      weight: 0.35,
      verdict: "clear",
      title: "Camera make/model present",
      detail: "Recorded device metadata is present, consistent with a real capture."
    });
  }

  if (ela.uniform === true) {
    signals.push({
      id: "error-level",
      weight: 0.85,
      verdict: "flagged",
      title: "Unusually uniform compression error level",
      detail: `Error-level variation across the frame is low (coefficient of variation ${ela.coefficientOfVariation}). Real photos usually show localized variation from lens softness, sensor noise, and prior edits; a flat error level is common in fully synthetic images.`
    });
  } else if (ela.uniform === false) {
    signals.push({
      id: "error-level",
      weight: 0.85,
      verdict: "clear",
      title: "Normal compression error variation",
      detail: `Error-level variation (coefficient of variation ${ela.coefficientOfVariation}) is consistent with an ordinary photograph or edited image.`
    });
  }

  if (provenance.hasManifest) {
    signals.push({
      id: "provenance-manifest",
      weight: 0.5,
      verdict: "clear",
      title: "Content-credentials (C2PA) manifest detected",
      detail:
        "A C2PA/JUMBF provenance structure was found in the file — used by Adobe, Leica, and others to record edit history. Note: this checks for manifest presence only, it does not cryptographically verify the signing chain."
    });
  } else {
    signals.push({
      id: "provenance-manifest",
      weight: 0.15,
      verdict: "caution",
      title: "No content-credentials manifest found",
      detail:
        "No C2PA/JUMBF provenance structure was detected. Most images today still don't carry one, so on its own this is weak evidence."
    });
  }

  const { score, confidence, summary } = fuseSignals(signals);

  return { score, confidence, summary, signals, fingerprint: pHash, raw: { ela, metadata, provenance } };
}
