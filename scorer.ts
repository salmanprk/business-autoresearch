/**
 * scorer.ts — Combines raw metrics into a single comparable score.
 *
 * The score is a single number that determines whether a variant
 * gets adopted or skipped. Higher is better.
 *
 * Customize the weights and constraints to match your program.md.
 */

import type { Metrics } from "./evaluate.ts";

export interface ScoreResult {
  score: number;
  breakdown: Record<string, number>;
  violations: string[];
}

/**
 * Weights for each metric. These should match what's defined in program.md.
 * Positive weight = higher is better. Negative weight = lower is better.
 */
const WEIGHTS: Record<string, number> = {
  replyRate: 0.7,
  openRate: 0.2,
  clickRate: 0.1,
};

/**
 * Hard constraints. If any of these are violated, the variant is automatically skipped.
 * Format: metric name -> maximum allowed value.
 */
const CONSTRAINTS: Record<string, number> = {
  spamRate: 0.02,
  unsubscribeRate: 0.05,
};

const CONSTRAINT_PENALTY = -1.0;

export function score(metrics: Metrics): ScoreResult {
  const breakdown: Record<string, number> = {};
  const violations: string[] = [];

  // Weighted sum of target metrics
  let total = 0;
  for (const [metric, weight] of Object.entries(WEIGHTS)) {
    const value = metrics[metric] ?? 0;
    const contribution = value * weight;
    breakdown[metric] = contribution;
    total += contribution;
  }

  // Check hard constraints
  for (const [metric, maxValue] of Object.entries(CONSTRAINTS)) {
    const value = metrics[metric] ?? 0;
    if (value > maxValue) {
      violations.push(`${metric} (${value}) exceeds limit (${maxValue})`);
      total += CONSTRAINT_PENALTY;
      breakdown[`${metric}_penalty`] = CONSTRAINT_PENALTY;
    }
  }

  return {
    score: Math.round(total * 10000) / 10000,
    breakdown,
    violations,
  };
}
