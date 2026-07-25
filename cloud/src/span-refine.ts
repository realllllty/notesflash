/**
 * Narrow a matched chunk down to the phrase that actually carries the meaning.
 *
 * Retrieval works on line windows because short fragments embed poorly, but a
 * window can span three lines, which is too coarse to highlight. This module
 * re-scores candidate sub-spans of the winning chunk against the same query
 * vector, so the highlight lands on a phrase without any translation step or a
 * second retrieval pass. One batched Workers AI call covers every candidate.
 */
import { embedTexts } from "./embedding-models";
import type { SemanticConfig } from "./semantic-config";
import { cosineSimilarity, type ChunkHit } from "./semantic-core";
import type { Env } from "./types";

/** Clause boundaries used to cut a line into candidate phrases. */
const CLAUSE_BOUNDARY = /[，。；、：！？]/;
/** Latin boundaries are only honoured when whitespace follows, see below. */
const LATIN_CLAUSE_BOUNDARY = /[.,;:!?]/;
const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

export interface SpanRefineOptions {
  enabled: boolean;
  /** Chunks shorter than this are already precise enough to highlight. */
  minChunkChars: number;
  /** Candidate spans scored per request. */
  maxCandidates: number;
  /** Notes whose best match gets refined. */
  maxNotes: number;
  /**
   * A narrowed span is accepted only if it keeps at least this share of the
   * chunk score, so refinement never trades away match quality for brevity.
   */
  minRatio: number;
}

export const DEFAULT_SPAN_REFINE: SpanRefineOptions = {
  enabled: false,
  minChunkChars: 40,
  maxCandidates: 12,
  // Only the first result is refined: it is the line the user reads first, and
  // each extra note adds a batch of candidates to the same request.
  maxNotes: 1,
  // A narrowed span must score at least as well as the whole chunk. Anything
  // lower means the shorter text lost meaning, and the chunk is kept instead.
  minRatio: 1,
};

export interface SpanCandidate {
  /** Offsets relative to the chunk text. */
  start: number;
  end: number;
  text: string;
}

function isCjkHeavy(text: string): boolean {
  const cjk = [...text].filter((character) => CJK_PATTERN.test(character)).length;
  return cjk * 2 >= [...text].length;
}

function trimRange(text: string, start: number, end: number): SpanCandidate | null {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && /[\s，。；、,;:：!?！？]/.test(text[trimmedStart])) trimmedStart += 1;
  while (trimmedEnd > trimmedStart && /[\s，。；、,;:：!?！？]/.test(text[trimmedEnd - 1])) trimmedEnd -= 1;
  if (trimmedEnd - trimmedStart < 2) return null;
  return { start: trimmedStart, end: trimmedEnd, text: text.slice(trimmedStart, trimmedEnd) };
}

/**
 * Candidate sub-spans of a chunk: whole lines, clauses, and a few overlapping
 * windows so a phrase that straddles punctuation is still reachable.
 */
export function spanCandidates(text: string, maxCandidates: number): SpanCandidate[] {
  const candidates: SpanCandidate[] = [];
  const seen = new Set<string>();

  const push = (start: number, end: number) => {
    const candidate = trimRange(text, start, end);
    if (!candidate) return;
    const key = `${candidate.start}:${candidate.end}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  let lineStart = 0;
  for (const line of text.split("\n")) {
    const lineEnd = lineStart + line.length;
    if (line.trim().length > 0) {
      push(lineStart, lineEnd);

      // Clause splits only pay off on a longer line; a short line is already
      // the precise answer.
      if (line.length >= 24) {
        const cjk = isCjkHeavy(line);
        const boundary = cjk ? CLAUSE_BOUNDARY : LATIN_CLAUSE_BOUNDARY;
        let clauseStart = lineStart;
        for (let index = lineStart; index < lineEnd; index += 1) {
          if (!boundary.test(text[index])) continue;
          // A Latin boundary must be followed by whitespace, so "$0.012" or
          // "e.g." never splits inside a token.
          if (!cjk && index + 1 < lineEnd && !/\s/.test(text[index + 1])) continue;
          push(clauseStart, index + 1);
          clauseStart = index + 1;
        }
        if (clauseStart > lineStart && clauseStart < lineEnd) push(clauseStart, lineEnd);
      }
    }
    lineStart = lineEnd + 1;
  }

  // Prefer shorter candidates when trimming: they are what makes a highlight
  // feel precise, and the score guard still protects match quality.
  return candidates
    .sort((left, right) => (left.end - left.start) - (right.end - right.start))
    .slice(0, maxCandidates);
}

export interface SpanRefinementStats {
  aiCalls: number;
  candidateCount: number;
  refinedCount: number;
  durationMs: number;
}

/**
 * Refine the best body match of the strongest notes in place.
 *
 * Only the top matches are refined: it is the line the user reads first, and
 * every extra candidate costs tokens.
 */
export async function refineSpans(
  env: Env,
  config: SemanticConfig,
  queryVector: number[],
  notes: Array<{ matches: ChunkHit[] }>,
  options: SpanRefineOptions,
): Promise<SpanRefinementStats> {
  const startedAt = performance.now();
  const empty: SpanRefinementStats = {
    aiCalls: 0,
    candidateCount: 0,
    refinedCount: 0,
    durationMs: 0,
  };
  if (!options.enabled || notes.length === 0) return empty;

  interface Target {
    hit: ChunkHit;
    candidates: SpanCandidate[];
  }
  const targets: Target[] = [];
  for (const note of notes.slice(0, options.maxNotes)) {
    const hit = note.matches.find((match) => match.kind === "body");
    if (!hit || hit.charStart === null || hit.charEnd === null) continue;
    const text = hit.text ?? "";
    if (text.length < options.minChunkChars) continue;
    const candidates = spanCandidates(text, options.maxCandidates);
    if (candidates.length === 0) continue;
    targets.push({ hit, candidates });
  }
  if (targets.length === 0) return { ...empty, durationMs: performance.now() - startedAt };

  const texts = targets.flatMap((target) => target.candidates.map((candidate) => candidate.text));
  let vectors: number[][];
  let aiCalls = 0;
  try {
    const result = await embedTexts(env, config.spec, texts, "document", config.instruction);
    vectors = result.vectors;
    aiCalls = result.aiCalls;
  } catch (error) {
    // Refinement is cosmetic; a failure must never lose the match itself.
    console.warn("Span refinement failed; keeping chunk ranges", error);
    return { ...empty, durationMs: performance.now() - startedAt };
  }

  let cursor = 0;
  let refinedCount = 0;
  for (const target of targets) {
    let best: { candidate: SpanCandidate; score: number } | null = null;
    for (const candidate of target.candidates) {
      const score = cosineSimilarity(queryVector, vectors[cursor]);
      cursor += 1;
      if (!best || score > best.score) best = { candidate, score };
    }
    if (!best) continue;
    const chunkText = target.hit.text ?? "";
    if (best.score < target.hit.score * options.minRatio) continue;
    if (best.candidate.end - best.candidate.start >= chunkText.length) continue;

    const chunkStart = target.hit.charStart as number;
    // The anchor line follows the refined span so the client scrolls to the
    // line that is actually highlighted, not the start of the window.
    const newlinesBefore = (chunkText.slice(0, best.candidate.start).match(/\n/g) ?? []).length;
    if (target.hit.lineStart !== null) {
      target.hit.primaryLine = target.hit.lineStart + newlinesBefore;
    }
    target.hit.charStart = chunkStart + best.candidate.start;
    target.hit.charEnd = chunkStart + best.candidate.end;
    target.hit.text = best.candidate.text;
    refinedCount += 1;
  }

  return {
    aiCalls,
    candidateCount: texts.length,
    refinedCount,
    durationMs: performance.now() - startedAt,
  };
}
