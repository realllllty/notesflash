/**
 * Static registry for local semantic-search evaluation artifacts.
 *
 * The blind final query file is intentionally named here without being opened.
 * Callers must opt in before loading it; ordinary calibration, regression, and
 * audit commands operate only on query suites that have already been seen.
 */

export const CORPUS_FILES = Object.freeze({
  base: "corpus.json",
  general: "large/general-corpus.json",
  tech: "large/tech-corpus.json",
  blind: "large/blind-corpus.json",
});

export const CORPUS_SETS = Object.freeze({
  base: Object.freeze(["base"]),
  visible: Object.freeze(["base", "general", "tech"]),
  full: Object.freeze(["base", "general", "tech", "blind"]),
});

export const QUERY_FILES = Object.freeze({
  legacyCalibration: "golden.json",
  shortRegression: "regression-short-cross-language.json",
  generalCalibration: "large/general-calibration.json",
  generalHoldout: "large/general-holdout.json",
  techCalibration: "large/tech-calibration.json",
  techHoldout: "large/tech-holdout.json",
  blindFinal: "large/blind-final-holdout.json",
});

/** Query files safe to inspect during model and threshold development. */
export const VISIBLE_QUERY_FILES = Object.freeze([
  QUERY_FILES.legacyCalibration,
  QUERY_FILES.shortRegression,
  QUERY_FILES.generalCalibration,
  QUERY_FILES.generalHoldout,
  QUERY_FILES.techCalibration,
  QUERY_FILES.techHoldout,
]);

/** Literal collisions remain diagnostic-only for historical regression files. */
export const QUERY_FILE_POLICIES = Object.freeze({
  [QUERY_FILES.legacyCalibration]: Object.freeze({ role: "legacy-regression", allowLiteralCollisions: true }),
  [QUERY_FILES.shortRegression]: Object.freeze({ role: "regression", allowLiteralCollisions: true }),
  [QUERY_FILES.generalCalibration]: Object.freeze({ role: "calibration", allowLiteralCollisions: false }),
  [QUERY_FILES.generalHoldout]: Object.freeze({ role: "visible-holdout", allowLiteralCollisions: false }),
  [QUERY_FILES.techCalibration]: Object.freeze({ role: "calibration", allowLiteralCollisions: false }),
  [QUERY_FILES.techHoldout]: Object.freeze({ role: "visible-holdout", allowLiteralCollisions: false }),
  [QUERY_FILES.blindFinal]: Object.freeze({ role: "blind-final", allowLiteralCollisions: false }),
});

/**
 * Named CLI suites. Composite suites concatenate files in the declared order.
 * Large suites use the full 352-note corpus so blind documents remain unseen
 * query-independent distractors while models and thresholds are calibrated.
 */
export const SUITES = Object.freeze({
  calibration: Object.freeze({
    queryFiles: Object.freeze([QUERY_FILES.legacyCalibration]),
    corpusSet: "base",
    role: "legacy-regression",
    frozen: false,
  }),
  "legacy-regression": Object.freeze({
    queryFiles: Object.freeze([QUERY_FILES.legacyCalibration]),
    corpusSet: "base",
    role: "legacy-regression",
    frozen: false,
  }),
  "short-regression": Object.freeze({
    queryFiles: Object.freeze([QUERY_FILES.shortRegression]),
    corpusSet: "base",
    role: "regression",
    frozen: false,
  }),
  "general-calibration": Object.freeze({
    queryFiles: Object.freeze([QUERY_FILES.generalCalibration]),
    corpusSet: "full",
    role: "calibration",
    frozen: false,
  }),
  "general-holdout": Object.freeze({
    queryFiles: Object.freeze([QUERY_FILES.generalHoldout]),
    corpusSet: "full",
    role: "visible-holdout",
    frozen: true,
  }),
  "tech-calibration": Object.freeze({
    queryFiles: Object.freeze([QUERY_FILES.techCalibration]),
    corpusSet: "full",
    role: "calibration",
    frozen: false,
  }),
  "tech-holdout": Object.freeze({
    queryFiles: Object.freeze([QUERY_FILES.techHoldout]),
    corpusSet: "full",
    role: "visible-holdout",
    frozen: true,
  }),
  "visible-calibration": Object.freeze({
    queryFiles: Object.freeze([
      QUERY_FILES.generalCalibration,
      QUERY_FILES.techCalibration,
    ]),
    corpusSet: "full",
    role: "calibration",
    frozen: false,
  }),
  "visible-validation": Object.freeze({
    queryFiles: Object.freeze([
      QUERY_FILES.shortRegression,
      QUERY_FILES.generalHoldout,
      QUERY_FILES.techHoldout,
    ]),
    corpusSet: "full",
    role: "visible-validation",
    frozen: true,
  }),
  "all-visible": Object.freeze({
    queryFiles: VISIBLE_QUERY_FILES,
    corpusSet: "full",
    role: "diagnostic-only",
    frozen: true,
    allowThresholdGrid: false,
  }),
  "blind-final": Object.freeze({
    queryFiles: Object.freeze([QUERY_FILES.blindFinal]),
    corpusSet: "full",
    role: "blind-final",
    frozen: true,
    allowThresholdGrid: false,
    protected: true,
  }),
});

/** Backward-compatible names that no longer imply a true holdout. */
export const SUITE_ALIASES = Object.freeze({
  holdout: "short-regression",
  "short-holdout": "short-regression",
  all: "all-visible",
});

export function corpusFilesForSet(name) {
  const corpusNames = CORPUS_SETS[name];
  if (!corpusNames) {
    throw new Error(
      `Unknown corpus set "${name}". Available: ${Object.keys(CORPUS_SETS).join(", ")}`,
    );
  }
  return corpusNames.map((corpusName) => CORPUS_FILES[corpusName]);
}
