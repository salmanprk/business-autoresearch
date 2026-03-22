/**
 * evaluate.ts — The tamper-proof evaluation harness.
 *
 * DO NOT MODIFY THIS FILE during experiments.
 * It calls the real system and returns raw metrics.
 *
 * To use with your own system:
 *   1. Replace the `evaluate()` function body with your real API call.
 *   2. Keep the return type as `Metrics` — a flat object of numbers.
 *
 * The mock implementation below simulates an email campaign for demo purposes.
 */

export interface Metrics {
  [key: string]: number;
}

export interface EvalResult {
  metrics: Metrics;
  success: boolean;
  error?: string;
}

/**
 * Evaluate a strategy against the real system.
 *
 * @param strategyModule - The strategy object from strategy.ts
 * @returns Raw metrics from the system
 */
export async function evaluate(strategyModule: Record<string, any>): Promise<EvalResult> {
  try {
    const metrics = await runMockEvaluation(strategyModule);
    return { metrics, success: true };
  } catch (err) {
    return {
      metrics: {},
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Mock evaluator — replace this with your real system call
// ---------------------------------------------------------------------------

async function runMockEvaluation(strategy: Record<string, any>): Promise<Metrics> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 500));

  const subject: string = strategy.subject ?? "";
  const body: string = strategy.body ?? "";
  const sendTime: number = strategy.sendTime ?? 9;

  // --- Heuristic scoring to make the mock behave realistically ---

  // Subject line quality signals
  let subjectScore = 0.3;
  if (subject.length > 10 && subject.length < 60) subjectScore += 0.1;
  if (subject.includes("{{firstName}}") || subject.includes("{{company}}")) subjectScore += 0.1;
  if (subject.includes("?")) subjectScore += 0.05;
  if (subject.toLowerCase().includes("free") || subject.toLowerCase().includes("!!!")) subjectScore -= 0.15;
  if (subject.toUpperCase() === subject && subject.length > 5) subjectScore -= 0.2;

  // Body quality signals
  let bodyScore = 0.2;
  if (body.length > 100 && body.length < 1500) bodyScore += 0.1;
  if (body.includes("{{firstName}}") || body.includes("{{company}}")) bodyScore += 0.1;
  if (body.includes("?")) bodyScore += 0.05; // asks a question
  if (body.split("\n").length > 2 && body.split("\n").length < 15) bodyScore += 0.05;
  if (body.toLowerCase().includes("unsubscribe")) bodyScore -= 0.05;

  // Send time signal (9-11 AM and 2-4 PM are best)
  let timeBonus = 0;
  if ((sendTime >= 9 && sendTime <= 11) || (sendTime >= 14 && sendTime <= 16)) timeBonus = 0.05;
  if (sendTime >= 0 && sendTime <= 5) timeBonus = -0.05;

  // Add controlled randomness to simulate real-world variance
  const noise = () => (Math.random() - 0.5) * 0.04;

  const openRate = clamp(subjectScore + timeBonus + noise(), 0, 1);
  const clickRate = clamp(openRate * (0.3 + bodyScore * 0.5) + noise(), 0, 1);
  const replyRate = clamp(openRate * bodyScore * 1.2 + noise(), 0, 1);

  // Spam/unsubscribe rates — bad practices increase these
  let spamRate = 0.005 + Math.random() * 0.005;
  let unsubscribeRate = 0.01 + Math.random() * 0.01;
  if (subject.toUpperCase() === subject) spamRate += 0.03;
  if (body.toLowerCase().includes("act now") || body.toLowerCase().includes("limited time")) {
    spamRate += 0.02;
    unsubscribeRate += 0.02;
  }

  return {
    replyRate: round(replyRate),
    openRate: round(openRate),
    clickRate: round(clickRate),
    unsubscribeRate: round(clamp(unsubscribeRate, 0, 1)),
    spamRate: round(clamp(spamRate, 0, 1)),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round(n: number, decimals = 4): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

// Allow running standalone: `npx tsx evaluate.ts`
// Outputs JSON to stdout for lab.ts to parse
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ""));
if (isMain) {
  const { strategy } = await import("./strategy.ts");
  const result = await evaluate(strategy);
  // Write to stdout as clean JSON — lab.ts parses this
  process.stdout.write(JSON.stringify(result));
}
