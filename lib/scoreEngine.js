// Shared across image and text analyzers so both speak the same
// scoring language: every signal contributes a weighted penalty rather
// than an arbitrary point deduction, and the result carries an explicit
// confidence level instead of pretending every score is equally certain.

const VERDICT_PENALTY = { clear: 0, caution: 0.4, flagged: 1 };

/**
 * @param {Array<{id: string, verdict: 'clear'|'caution'|'flagged', weight: number, title: string, detail: string}>} signals
 *   `weight` (0-1) is how much this signal should move the needle if it fires.
 *   A metadata quirk should weigh less than a structural forensic finding.
 */
export function fuseSignals(signals) {
  const weighted = signals.filter((s) => typeof s.weight === "number" && s.weight > 0);
  const totalWeight = weighted.reduce((sum, s) => sum + s.weight, 0) || 1;
  const weightedPenalty = weighted.reduce(
    (sum, s) => sum + s.weight * (VERDICT_PENALTY[s.verdict] ?? 0),
    0
  );
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - weightedPenalty / totalWeight))));

  const flagged = signals.filter((s) => s.verdict === "flagged");
  const caution = signals.filter((s) => s.verdict === "caution");
  const clear = signals.filter((s) => s.verdict === "clear");

  // Confidence reflects how much evidence agrees, not how extreme the
  // score is. A single flagged signal with everything else clear is
  // lower-confidence than three signals all pointing the same way.
  let confidence = "medium";
  if (signals.length >= 4 && (flagged.length === 0 || flagged.length >= 2)) {
    confidence = "high";
  }
  if (signals.length <= 2 || (flagged.length === 1 && clear.length === 0)) {
    confidence = "low";
  }

  const rankedFlags = [...flagged].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  let summary;
  if (rankedFlags.length === 0) {
    summary =
      "No strong signals of AI generation or manipulation were found. This does not certify authenticity — it means the checks run here did not trip on anything.";
  } else if (rankedFlags.length === 1) {
    summary = `The strongest signal here is: ${rankedFlags[0].title.toLowerCase()}. Treat this as one data point rather than a verdict, especially at ${confidence} confidence.`;
  } else {
    const names = rankedFlags.map((s) => s.title.toLowerCase()).join("; ");
    summary = `Multiple independent signals were flagged together (${names}), which is what raises this from a single quirk to a meaningful pattern.`;
  }

  return { score, confidence, summary };
}
