# Large semantic-search experiment protocol

This protocol is fixed before the large Workers AI run. Its purpose is to stop
model, chunk, prompt, and threshold choices from drifting toward whichever
result happens to look best after a holdout has been opened.

## Dataset roles

- Candidate background: 352 synthetic notes (legacy 52, general 120,
  technical 120, blind-background 60).
- Development/calibration: 150 visible queries. Model, chunk shape, expansion
  text, absolute floors, and relative floors may be selected only here.
- Visible validation/regression: 105 queries. It is run only after one candidate
  is locked; failures may invalidate the candidate, but must not be used for a
  second threshold search.
- Final blind release gate: 60 frozen queries against the same 352-note
  background. It is opened and run exactly once after the implementation and
  configuration are locked. A failed blind set becomes a regression set; a new
  independently authored blind set is required before another release claim.

All strict semantic suites must have zero full-query literal collisions across
the complete 352-note corpus. Historical legacy regressions with a literal
collision are reported separately and never used for model or threshold
selection.

## Candidate matrix

The calibration run compares the same raw cosine evidence across:

- EmbeddingGemma, BGE-M3, and Qwen3-Embedding-0.6B;
- three-line windows, two-line windows, one-line chunks, title-context and a
  marker-free body-only control;
- the unchanged `0.3 / 0.6` primary path;
- a global `0.235 / 0.6` floor control;
- exact same-chunk raw/expanded consensus at default, looser, and stricter
  gates.

Alternative short-query wrappers may be compared only on the development
short-query/negative slice. The selected wrapper is then frozen before the
full development run. No dictionary translation or query-specific synonym is
allowed.

## Evidence validity gates

No quality number is accepted unless all of these hold:

1. Dataset audit has no blocking error and every artifact hash matches the
   record.
2. Every query has a proven complete brute-force cosine Top-40 capture. The
   legacy lab's Top-50-note reconstruction must prove that its 40th chunk is
   strictly above the best possible excluded note and that response boundaries
   map one-to-one to local chunk indexes.
3. Raw and expanded views use the same stable chunk identity. Any anchor or
   match truncation makes the run incomplete.
4. Synthetic keys never enter embedded title/body text. The legacy lab's common
   `[EVAL]` title prefix is disclosed; body-only chunks provide the marker-free
   control.
5. The experiment is labelled as brute-force retrieval, not as proof of
   Vectorize ANN recall. Production index health and latency are reported as a
   separate diagnostic.

## Candidate selection rule

First discard any configuration that has an incomplete capture, candidate
line recall at 40 below 96%, negative-clean below 88%, or forbidden-at-1 above
5% on development/calibration. Among the remaining configurations, select
lexicographically by:

1. required-rank pass rate;
2. line recall at 3;
3. note recall at 3;
4. mean reciprocal rank;
5. lower model-call cost and warm latency.

The consensus candidate must also preserve the primary path exactly for all
already-strong results. On non-short queries, note order, scores, and matches
must be byte-for-byte equivalent to the raw baseline. On short queries it may
only append a rescued result or an extra matched line; a primary result may not
be reordered or weakened.

## Visible validation gate

The locked candidate passes visible validation only when all conditions hold:

- candidate line recall at 40: at least 97%;
- note recall at 1 / 3 / 8: at least 78% / 90% / 95%;
- line recall at 1 / 3: at least 72% / 87%;
- required-rank pass: at least 88%;
- negative-clean: at least 88%;
- forbidden-at-1: at most 5%;
- no more than one newly noisy negative compared with the unchanged primary
  baseline;
- `entry` retrieves the Chinese note containing the recovery entry line within
  its declared required rank.

## Final blind gate

The single frozen blind run passes only when all conditions hold:

- all 60 queries are present; all captures and hashes are complete;
- candidate line recall at 40: at least 96%;
- note recall at 1 / 3 / 8: at least 78% / 90% / 96%;
- MRR: at least 0.84;
- line recall at 1 / 3: at least 72% / 88%;
- required-rank pass: at least 88%;
- at least 9 of 10 unanswerable negatives return no result;
- at most one forbidden note appears at rank 1, at most two at rank 3;
- no individual safety invariant or required product regression fails.

Percentages are always accompanied by numerator/denominator counts and Wilson
95% intervals for the main binomial metrics.

## Latency and cost gate

The eligible short-query path must keep raw and expanded texts in one Workers
AI batch (one AI request), run the two Vectorize queries concurrently, and do a
single D1 anchor resolution. It is rejected if it adds a second Workers AI
round trip or places embedding work on note saving. The projected warm semantic
critical path must remain at or below 1.2 seconds p95 using recorded query-AI,
Vectorize, D1-resolution, and optional span-refinement components; any estimate
must be labelled as projected until the exact candidate is deployed and measured.
