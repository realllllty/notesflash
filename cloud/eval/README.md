# Search calibration harness

These files exist so semantic search decisions are measured instead of guessed.
Workers AI is only reachable from a deployed Worker, so the harness drives the
operator search lab (`POST /api/internal/search-lab`) and scores its answers
locally.

## Files

| File | Purpose |
|---|---|
| `corpus.json` | 52 notes covering cross-language pairs, paraphrase, concepts, identifiers, dates, one-line needles, near-duplicate distractors, and unrelated filler. |
| `golden.json` | Legacy 30-query regression suite. Its historical literal distractors make it unsuitable for lexical-first threshold selection. |
| `regression-short-cross-language.json` | Non-frozen 25-query regression suite for `entry`, `exit`, app preferences, `auth`, and `upload`. It was used to design short-query rescue and is not a holdout. |
| `large/general-*.json` | 120 general-life notes, 60 calibration queries, and a 40-query visible frozen validation set. |
| `large/tech-*.json` | 120 technical notes, 60 calibration queries, and a 40-query visible frozen validation set. |
| `large/blind-corpus.json` | 60 query-independent distractor notes included in full-corpus calibration without exposing final prompts. |
| `large/blind-final-holdout.json` | Protected final query suite. Do not inspect, filter, tune on, or run repeatedly. |
| `dataset-manifest.mjs` | Canonical corpus sets, suite composition, roles, aliases, and blind-suite protection metadata. |
| `audit-datasets.mjs` | Offline structural audit for merged uniqueness, references, exact logical lines, metadata leakage, and literal collisions. It does not call Workers AI. |
| `strategies.json` | Named model/chunking/threshold presets. Fields map 1:1 onto `cloud/src/chunking.ts` and `cloud/src/semantic-core.ts`, so a winning preset can be promoted to `wrangler.jsonc` unchanged. |
| `metrics.mjs` | Candidate recall@40, note recall/MRR, end-to-end line recall@1/@3, forbidden-note rates@1/@3/@8, negative discipline, and score separation. Re-ranks recorded sweeps through the Worker's own aggregation code. |
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
node eval/audit-datasets.mjs                 # full 352-note audit; blind prompts stay unopened
node eval/run-eval.mjs probe                 # model availability and bilingual smoke check
node eval/run-eval.mjs seed --dataset full   # seed base + general + tech + blind distractor notes
node eval/run-eval.mjs sweep --suite visible-calibration --preset lines-gemma-raw,lines-bge,lines-qwen3
node eval/run-eval.mjs report --suite visible-calibration --thresholds
node eval/run-eval.mjs sweep --suite short-regression --preset lines-gemma
node eval/run-eval.mjs sweep --suite general-holdout --preset chosen-preset
node eval/run-eval.mjs sweep --suite tech-holdout --preset chosen-preset
node eval/run-eval.mjs stats                 # wait until every eval note is indexed
node eval/run-eval.mjs live --suite short-regression # retrieval-only deployed diagnostic
node eval/run-eval.mjs cleanup --prune-cache
```

`sweep` embeds in-request and caches vectors in D1, so repeated sweeps over the
same corpus cost no Workers AI calls. `report --thresholds` re-scores recorded
candidates, which means a threshold grid needs no new inference at all.

`--suite visible-calibration` is the default and combines the general and tech
calibration files. `--suite calibration` remains a compatibility name for the
old 30-query regression; prefer the explicit `--suite legacy-regression` name.
`short-holdout` and `holdout` remain compatibility aliases, but both resolve to
`short-regression` and never imply frozen data.

`general-holdout`, `tech-holdout`, `visible-validation`, `all-visible`, and
`blind-final` are frozen. The runner rejects `--thresholds`, `--query`, and
`--scenario` for frozen suites. The `all` alias resolves to `all-visible` and
cannot be used for threshold search. Opening `blind-final` additionally requires
`--confirm-blind-final`; use that explicit path only after every choice has been
locked. Each positive declares `requiredRank`, and the `target` report column is
the pass rate for those declared requirements.

The `live` command exercises deployed semantic retrieval and Vectorize only. It
does **not** prove lexical-first API behavior. The protected lab's `action=api`
calls the actual `/api/search/semantic` handler and is the correct diagnostic for
the lexical-first skip gate and response contract.

`seed --dataset` selects local files: `base` (52 notes), `visible` (base plus
general and tech), or `full` (all four corpora, 352 notes). Sweep `--corpus`
controls the deployed lab's database scope instead: `eval`, `real`, or `all`.
Sweeps default to `--corpus eval`, keeping model and threshold comparisons
reproducible instead of silently mixing in changing user notes. Use
`--corpus all` only as a separate robustness check.

The default static audit reads all four corpora but deliberately omits final
blind queries. A release operator may run
`node eval/audit-datasets.mjs --include-blind-final` exactly when authorized;
diagnostics use file/index locations and never echo query text.

## Leakage and completeness safeguards

The local harness sends `[EVAL:key]` only as seed input. The Worker removes it
before storage and keeps the key in a server-owned `mutation_id` namespace, so
both Queue/Vectorize indexing and in-request sweeps embed the real title only.
This preserves safe mapping and cleanup without leaking English keys such as
`deploy-zh` into cross-language document vectors. Old prefixed rows remain
cleanup-compatible but should be removed and reseeded before a live holdout.

Recorded raw candidates must contain the production retrieval depth of 40.
Reports mark candidate recall as `C@40`; an asterisk means completeness was not
proven. A captured array cannot certify its own universe size. Completion now
requires an authoritative pre-truncation chunk count, a declared capture depth,
and enough recorded candidates. Live Vectorize diagnostics lack a trustworthy
total universe count and therefore remain conservatively incomplete. A report
also warns when filters leave out any development-suite query, preventing a
partial run from being mistaken for a complete benchmark.

Every new sweep/live record stores SHA-256 hashes for both its exact suite files
and corpus files. `report` hard-fails when either hash is absent or differs from
the current artifacts; historical unhashed JSON cannot be presented as current
evidence. Offline `--thresholds` also refuses records with short-query consensus
enabled because raw-only `rescore()` cannot exactly reproduce the expanded-view
gate. Use a rescue-disabled calibration preset such as `lines-gemma-raw` for the
threshold grid, then evaluate the locked consensus configuration without
offline threshold replay.

`line@1` and `line@3` are end-to-end recall: a query counts only when the
expected note is retrieved within that rank *and* one of its returned matches
covers the expected logical line. Unlike the older conditional line-accuracy
metric, misses remain in the denominator. `F@1`, `F@3`, and `F@8` are violation
rates over queries that declare `forbid`; lower is better.

The previously published 30-query model table was measured before the synthetic
title-marker leak was discovered and must not be used for model or threshold
selection. That file is retained only as `legacy-regression`. Choose models and
thresholds on `visible-calibration`, lock configuration, run the visible frozen
sets without filtering, and reserve the protected blind suite for the final gate.

Always clean up (`cleanup`) after a calibration session so the instance holds
only real notes. The protected diagnostic route may remain enabled for ongoing
observability; keep its high-entropy token private, or set `LAB_ENABLED=false`
to close it completely.
