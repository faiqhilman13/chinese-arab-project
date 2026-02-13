function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

  for (let i = 0; i < rows; i += 1) {
    dp[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[rows - 1][cols - 1];
}

function similarityScore(a: string, b: string): number {
  if (!a.length && !b.length) {
    return 100;
  }

  const maxLen = Math.max(a.length, b.length, 1);
  const distance = levenshtein(a, b);
  const similarity = 1 - distance / maxLen;
  return Math.max(0, Math.min(100, Math.round(similarity * 100)));
}

export function evaluatePronunciation(args: {
  transcript: string;
  scriptText: string;
  transliteration?: string | null;
}) {
  const normalizedTranscript = normalize(args.transcript);
  const normalizedScript = normalize(args.scriptText);
  const normalizedTranslit = normalize(args.transliteration ?? "");

  const scores = [similarityScore(normalizedTranscript, normalizedScript)];

  if (normalizedTranslit) {
    scores.push(similarityScore(normalizedTranscript, normalizedTranslit));
  }

  const score = Math.max(...scores);

  const feedback =
    score >= 90
      ? "Excellent clarity. Keep this speed and rhythm."
      : score >= 75
        ? "Good pronunciation. Focus on one or two sounds for cleaner delivery."
        : score >= 55
          ? "Understandable. Repeat slowly and match syllable timing."
          : "Try again with slower pacing and short chunks.";

  return {
    score,
    feedback,
    confidence: normalizedTranscript.length < 3 ? "low" : "medium",
  };
}
