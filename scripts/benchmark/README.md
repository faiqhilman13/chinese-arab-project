# Speech Benchmark Smoke Set

1. Copy `scripts/benchmark/smoke-set.sample.json` to `scripts/benchmark/smoke-set.json`.
2. Record short reference utterances and place them in `scripts/benchmark/audio/`.
3. Run:

```bash
node scripts/benchmark-speech.mjs --dataset scripts/benchmark/smoke-set.json --out docs/benchmark-baseline.md
```

The script reports exact match, near match, p50 latency, and p95 latency.
