export interface Metrics {
  [key: string]: number;
}

export interface ScoreResult {
  score: number;
  breakdown: Record<string, number>;
  violations: string[];
}

// Simple scorer: just use gap closure percentage as the score.
// 0 = no improvement, 100 = fully closed the gap.
export function score(metrics: Metrics): ScoreResult {
  const gapClosure = metrics.gapClosurePercent ?? 0;

  return {
    score: gapClosure,
    breakdown: { gapClosurePercent: gapClosure },
    violations: [],
  };
}
