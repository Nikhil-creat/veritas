import { fuseSignals } from "./scoreEngine";

// Lightweight, fully local stylometric heuristics. None of these are a
// single ground truth on their own — they're the same class of signal
// a human editor uses (evenness, vocabulary range, stock phrasing) and
// are combined into one score with a transparent breakdown.

const AI_STOCK_PHRASES = [
  "in conclusion",
  "it is important to note",
  "delve into",
  "in today's fast-paced world",
  "on the other hand",
  "furthermore",
  "moreover",
  "as an ai language model",
  "in summary",
  "plays a crucial role",
  "it is worth noting",
  "in the realm of",
  "navigating the",
  "unlock the potential",
  "tapestry of"
];

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitWords(text) {
  return text
    .toLowerCase()
    .match(/[a-z0-9']+/g) || [];
}

function stddev(arr) {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return { mean, stddev: Math.sqrt(variance) };
}

export function analyzeText(text) {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  const signals = [];

  if (words.length < 40) {
    signals.push({
      id: "sample-size",
      weight: 0.2,
      verdict: "caution",
      title: "Sample is short",
      detail: `Only ${words.length} words were analyzed. Stylometric signals are more reliable above ~150 words; treat this score as low-confidence.`
    });
  }

  // --- Burstiness: real human writing mixes short and long sentences.
  // Very even sentence lengths are a known tell of default LLM output.
  const sentenceLengths = sentences.map((s) => splitWords(s).length).filter((n) => n > 0);
  const { mean: meanLen, stddev: lenStd } = stddev(sentenceLengths);
  const burstiness = meanLen > 0 ? lenStd / meanLen : 0;

  if (sentenceLengths.length >= 4) {
    if (burstiness < 0.35) {
      signals.push({
        id: "burstiness",
        weight: 0.9,
        verdict: "flagged",
        title: "Low sentence-length variation (\"burstiness\")",
        detail: `Sentence lengths average ${meanLen.toFixed(
          1
        )} words with low variation (burstiness ${burstiness.toFixed(
          2
        )}). Human writing typically mixes short and long sentences; unusually even rhythm is a common trait of default LLM output.`
      });
    } else {
      signals.push({
        id: "burstiness",
        weight: 0.9,
        verdict: "clear",
        title: "Natural sentence-length variation",
        detail: `Burstiness score ${burstiness.toFixed(2)} is within the range typical of human writing.`
      });
    }
  }

  // --- Vocabulary richness: type-token ratio (unique words / total words).
  // AI text under default settings tends toward safer, more repetitive
  // word choice over long passages.
  const uniqueWords = new Set(words);
  const ttr = words.length > 0 ? uniqueWords.size / words.length : 0;

  if (words.length >= 60) {
    if (ttr < 0.4) {
      signals.push({
        id: "vocabulary-richness",
        weight: 0.5,
        verdict: "flagged",
        title: "Low vocabulary variety",
        detail: `Type-token ratio ${ttr.toFixed(
          2
        )} indicates fairly repetitive word choice for this length of text.`
      });
    } else {
      signals.push({
        id: "vocabulary-richness",
        weight: 0.5,
        verdict: "clear",
        title: "Normal vocabulary variety",
        detail: `Type-token ratio ${ttr.toFixed(2)} is within a typical human range.`
      });
    }
  }

  // --- Stock-phrase density: known filler/hedge phrases overrepresented
  // in default LLM output.
  const lowerText = text.toLowerCase();
  const matchedPhrases = AI_STOCK_PHRASES.filter((phrase) => lowerText.includes(phrase));
  const phraseDensityPer1000 = words.length > 0 ? (matchedPhrases.length / words.length) * 1000 : 0;

  if (matchedPhrases.length >= 2) {
    signals.push({
      id: "stock-phrases",
      weight: 0.8,
      verdict: "flagged",
      title: "Multiple stock LLM phrases detected",
      detail: `Found: ${matchedPhrases.slice(0, 5).join(", ")}. These hedging/transition phrases are disproportionately common in default LLM output compared to human writing on the same topics.`
    });
  } else if (matchedPhrases.length === 1) {
    signals.push({
      id: "stock-phrases",
      weight: 0.8,
      verdict: "caution",
      title: "One stock LLM phrase detected",
      detail: `Found: "${matchedPhrases[0]}". A single instance is common in human writing too; treated as weak evidence only.`
    });
  } else {
    signals.push({
      id: "stock-phrases",
      weight: 0.8,
      verdict: "clear",
      title: "No stock LLM phrases detected",
      detail: "None of the tracked filler/hedge phrases were found."
    });
  }

  const { score, confidence, summary } = fuseSignals(signals);

  return {
    score,
    confidence,
    summary,
    signals,
    raw: {
      wordCount: words.length,
      sentenceCount: sentences.length,
      burstiness: Number(burstiness.toFixed(3)),
      typeTokenRatio: Number(ttr.toFixed(3)),
      matchedPhrases
    }
  };
}
