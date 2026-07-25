# Search calibration harness

These files exist so semantic search decisions are measured instead of guessed.
Workers AI is only reachable from a deployed Worker, so the harness drives the
operator search lab (`POST /api/internal/search-lab`) and scores its answers
locally.

## Files

| File | Purpose |
|---|---|
| `corpus.json` | 50 notes covering cross-language pairs, paraphrase, concept questions, identifiers, dates, long notes with one relevant line, near-duplicate distractors, and unrelated filler. |
| `golden.json` | 30 queries with acceptable answers expressed as note key plus a substring of the expected line, so line numbers stay correct when the corpus is edited. |
| `strategies.json` | Named model/chunking/threshold presets. Fields map 1:1 onto `cloud/src/chunking.ts` and `cloud/src/semantic-core.ts`, so a winning preset can be promoted to `wrangler.jsonc` unchanged. |
| `metrics.mjs` | Recall@k, MRR, line accuracy, negative discipline, score separation. Re-ranks recorded sweeps through the Worker's own aggregation code. |
| `run-eval.mjs` | CLI: `probe`, `stats`, `seed`, `sweep`, `live`, `report`, `cleanup`. |
| `dump-chunks.mjs` | Prints the chunks and character offsets a note body produces. |

## Setup

The lab must be enabled on the target instance (`LAB_ENABLED=true` and
`LAB_TOKEN_SHA256` set to the SHA-256 hex of a 32-byte token). Provide the
plaintext token through `NOTESFLASH_LAB_TOKEN` or a gitignored
`cloud/.lab-token.local` file, and the instance URL through
`NOTESFLASH_LAB_URL`.

## Typical run

```bash
node eval/run-eval.mjs probe                 # which models answer, and how they score zh/en pairs
node eval/run-eval.mjs seed --no-enqueue     # insert the [EVAL:*] corpus without indexing it
node eval/run-eval.mjs sweep --preset lines-gemma,lines-bge,lines-qwen3
node eval/run-eval.mjs report --thresholds   # grid-search minCosine / relative ratio offline
node eval/run-eval.mjs live                  # score the deployed retrieval path and its latency
node eval/run-eval.mjs cleanup --prune-cache # remove the corpus and the embedding cache
```

`sweep` embeds in-request and caches vectors in D1, so repeated sweeps over the
same corpus cost no Workers AI calls. `report --thresholds` re-scores recorded
candidates, which means a threshold grid needs no new inference at all.

## Result that shaped the current defaults

| Strategy | R@1 | R@3 | MRR | Line accuracy | Negative queries clean | Positive/negative gap |
|---|---|---|---|---|---|---|
| `lines-gemma` (EmbeddingGemma, line windows) | 93% | 100% | 0.957 | 100% | 100% | +0.115 |
| `lines-qwen3-bilingual` | 89% | 96% | 0.927 | 100% | 0% | −0.013 |
| `lines-bge` (BGE-M3) | 67% | 89% | 0.793 | 100% | 0% | +0.001 |
| `note-level-bge` (pre-change shape) | 67% | 96% | 0.796 | 100% | 0% | +0.001 |

The gap column is what makes a threshold possible: it is the distance between the
weakest true positive and the strongest chunk any negative-only query reached.
Only EmbeddingGemma left room there, which is why `SEMANTIC_MIN_COSINE=0.3`
rejects unanswerable queries without dropping real matches.

Always clean up (`cleanup`) after a calibration session so the instance holds
only real notes, and disable the lab before any public release.
