import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const rootDir = resolve(import.meta.dirname, "..");

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function normalize(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\u0600-\u06FF\u4E00-\u9FFF]+/gu, "")
    .trim();
}

function levenshtein(a, b) {
  if (a === b) {
    return 0;
  }

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

function similarityScore(a, b) {
  if (!a.length && !b.length) {
    return 100;
  }

  const maxLen = Math.max(a.length, b.length, 1);
  const distance = levenshtein(a, b);
  const similarity = 1 - distance / maxLen;
  return Math.max(0, Math.min(100, Math.round(similarity * 100)));
}

function percentile(values, p) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function summarize(rows) {
  const latencies = rows.map((row) => row.latencyMs);
  const scores = rows.map((row) => row.score);
  const exact = rows.filter((row) => row.exact).length;
  const near = rows.filter((row) => row.near).length;

  return {
    count: rows.length,
    exactRate: rows.length ? (exact / rows.length) * 100 : 0,
    nearRate: rows.length ? (near / rows.length) * 100 : 0,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgScore: average(scores),
  };
}

function formatSummaryRow(name, summary) {
  return `| ${name} | ${summary.count} | ${summary.exactRate.toFixed(1)} | ${summary.nearRate.toFixed(1)} | ${summary.p50LatencyMs.toFixed(0)} | ${summary.p95LatencyMs.toFixed(0)} | ${summary.avgScore.toFixed(1)} |`;
}

async function scoreSample(baseUrl, sample, runIndex) {
  const expectedTranscript = sample.expectedTranscript ?? sample.targetText;
  const audioPath = resolve(rootDir, sample.audioPath);
  const audioBuffer = await readFile(audioPath);

  const form = new FormData();
  form.set("audio", new File([audioBuffer], basename(audioPath)));
  form.set("language", sample.language);
  form.set("target_text", sample.targetText);
  if (sample.transliteration) {
    form.set("transliteration", sample.transliteration);
  }

  const start = performance.now();
  const response = await fetch(`${baseUrl}/score`, {
    method: "POST",
    body: form,
  });
  const elapsed = performance.now() - start;
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = typeof payload?.detail === "string" ? payload.detail : JSON.stringify(payload);
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  const transcript = String(payload.transcript ?? "");
  const score = Number(payload.score ?? 0);

  const normalizedExpected = normalize(expectedTranscript);
  const normalizedTranscript = normalize(transcript);
  const similarity = similarityScore(normalizedTranscript, normalizedExpected);

  return {
    id: `${sample.id}#${runIndex + 1}`,
    language: sample.language,
    targetText: sample.targetText,
    expectedTranscript,
    transcript,
    score,
    latencyMs: elapsed,
    similarity,
    exact: normalizedTranscript === normalizedExpected,
    near: similarity >= 90,
  };
}

async function main() {
  const datasetPath = readArg("--dataset", "scripts/benchmark/smoke-set.json");
  const outputPath = readArg("--out", "");
  const baseUrl = (readArg("--base-url", process.env.LOCAL_SPEECH_URL ?? "http://127.0.0.1:8001")).replace(
    /\/$/,
    "",
  );

  const datasetRaw = await readFile(resolve(rootDir, datasetPath), "utf8");
  const dataset = JSON.parse(datasetRaw);
  if (!Array.isArray(dataset) || dataset.length === 0) {
    throw new Error("Dataset must be a non-empty array.");
  }

  const results = [];
  const failures = [];

  for (const sample of dataset) {
    const runs = Number(sample.runs ?? 1);
    for (let runIndex = 0; runIndex < runs; runIndex += 1) {
      try {
        const result = await scoreSample(baseUrl, sample, runIndex);
        results.push(result);
      } catch (error) {
        failures.push({
          id: `${sample.id}#${runIndex + 1}`,
          language: sample.language,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  if (!results.length) {
    throw new Error(`All benchmark requests failed (${failures.length} failures).`);
  }

  const overall = summarize(results);
  const byLanguage = {
    ar: summarize(results.filter((row) => row.language === "ar")),
    zh: summarize(results.filter((row) => row.language === "zh")),
  };

  const timestamp = new Date().toISOString();
  const lines = [
    "# Speech Benchmark Report",
    "",
    `- Generated: ${timestamp}`,
    `- Service: ${baseUrl}`,
    `- Dataset: ${datasetPath}`,
    "",
    "## Summary",
    "",
    "| Scope | Samples | Exact % | Near % (>=90 similarity) | p50 ms | p95 ms | Avg score |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    formatSummaryRow("overall", overall),
    formatSummaryRow("ar", byLanguage.ar),
    formatSummaryRow("zh", byLanguage.zh),
    "",
  ];

  if (failures.length) {
    lines.push("## Failures", "");
    for (const failure of failures) {
      lines.push(`- ${failure.id} (${failure.language}): ${failure.message}`);
    }
    lines.push("");
  }

  lines.push("## Raw Results", "");
  lines.push("| Id | Lang | Latency ms | Score | Similarity | Exact | Near | Transcript |");
  lines.push("| --- | --- | ---: | ---: | ---: | --- | --- | --- |");
  for (const row of results) {
    const transcript = row.transcript.replace(/\|/g, "\\|");
    lines.push(
      `| ${row.id} | ${row.language} | ${row.latencyMs.toFixed(0)} | ${row.score.toFixed(1)} | ${row.similarity.toFixed(1)} | ${row.exact ? "yes" : "no"} | ${row.near ? "yes" : "no"} | ${transcript} |`,
    );
  }

  const report = `${lines.join("\n")}\n`;
  if (outputPath) {
    await writeFile(resolve(rootDir, outputPath), report, "utf8");
  }
  process.stdout.write(report);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Benchmark failed: ${message}`);
  process.exit(1);
});
