/**
 * lab.ts — The experiment loop orchestrator.
 *
 * Runs the propose → run → score → decide cycle autonomously.
 * Uses Vercel AI SDK v6 — pass any model as "provider/model-id" string.
 *
 * Usage:
 *   npx tsx lab.ts
 *   MODEL=anthropic/claude-sonnet-4.5 npx tsx lab.ts
 *   MODEL=openai/gpt-4o npx tsx lab.ts
 *   MODEL=google/gemini-2.5-pro npx tsx lab.ts
 *
 * Environment variables:
 *   MODEL    — "provider/model-id" string (default: "anthropic/claude-sonnet-4.5")
 *   MAX_RUNS — Maximum experiments to run (default: unlimited)
 */

import "dotenv/config";
import { generateText } from "ai";
import { execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  copyFileSync,
  rmSync,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { EvalResult } from "./evaluate.ts";
import { score } from "./scorer.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = dirname(fileURLToPath(import.meta.url));
const STRATEGY_PATH = resolve(ROOT, "strategy.ts");
const STRATEGY_BACKUP = resolve(ROOT, ".strategy.backup.ts");
const PROGRAM_PATH = resolve(ROOT, "program.md");
const EXPERIMENTS_CSV = resolve(ROOT, "experiments.csv");
const EXPERIMENTS_DIR = resolve(ROOT, "experiments");

const MODEL = process.env.MODEL ?? "anthropic/claude-sonnet-4.6"; //"moonshotai/kimi-k2.5";
const MAX_RUNS = process.env.MAX_RUNS ? parseInt(process.env.MAX_RUNS) : 10;
const DRY_RUN = process.argv.includes("--dry-run");
const API_BASE = process.env.API_BASE ?? "http://localhost:5173/api/crs";

// ---------------------------------------------------------------------------
// System context — fetched once at startup, injected into every prompt
// ---------------------------------------------------------------------------

async function fetchSystemContext(): Promise<string> {
  // Read strategy.ts to get userId and cutoff
  const strategyContent = readFileSync(STRATEGY_PATH, "utf-8");
  const userIdMatch = strategyContent.match(/userId:\s*"([^"]+)"/);
  const cutoffMatch = strategyContent.match(/cutoff:\s*(\d+)/);

  if (!userIdMatch || !cutoffMatch) {
    console.warn(
      "Warning: Could not extract userId/cutoff from strategy.ts — skipping context fetch",
    );
    return "";
  }

  const userId = userIdMatch[1];
  const cutoff = parseInt(cutoffMatch[1]);

  try {
    console.log("Fetching system context from /api/crs/opportunities...");
    const res = await fetch(`${API_BASE}/opportunities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, cutoff }),
    });
    const data = await res.json();

    if (data.error) {
      console.warn(
        `Warning: Opportunities endpoint returned error: ${data.error}`,
      );
      return "";
    }

    return `\n## System Context (from /api/crs/opportunities)\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
  } catch (err) {
    console.warn(
      `Warning: Could not fetch opportunities: ${err instanceof Error ? err.message : err}`,
    );
    return "";
  }
}

// ---------------------------------------------------------------------------
// Strategy backup/restore (replaces git)
// ---------------------------------------------------------------------------

function backupStrategy() {
  copyFileSync(STRATEGY_PATH, STRATEGY_BACKUP);
}

function restoreStrategy() {
  copyFileSync(STRATEGY_BACKUP, STRATEGY_PATH);
}

// ---------------------------------------------------------------------------
// Experiment helpers
// ---------------------------------------------------------------------------

function padNum(n: number): string {
  return String(n).padStart(3, "0");
}

function ensureExperimentsCSV() {
  if (!existsSync(EXPERIMENTS_CSV)) {
    writeFileSync(
      EXPERIMENTS_CSV,
      "experiment,score,baseline_score,status,metrics,description,timestamp\n",
    );
  }
}

function readExperimentsCSV(): string {
  if (!existsSync(EXPERIMENTS_CSV)) return "(no experiments yet)";
  return readFileSync(EXPERIMENTS_CSV, "utf-8");
}

function appendExperiment(row: {
  experiment: string;
  score: number;
  baselineScore: number;
  status: string;
  metrics: string;
  description: string;
}) {
  const timestamp = new Date().toISOString();
  const line = `${row.experiment},${row.score},${row.baselineScore},${row.status},"${row.metrics}",${row.description},${timestamp}\n`;
  appendFileSync(EXPERIMENTS_CSV, line);
}

function saveExpArtifacts(expNum: number, files: Record<string, string>) {
  const dir = resolve(EXPERIMENTS_DIR, `exp_${padNum(expNum)}`);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(resolve(dir, name), content);
  }
}

// ---------------------------------------------------------------------------
// Core: Propose a variant
// ---------------------------------------------------------------------------

// Mock variants for --dry-run mode (no API key needed)
const MOCK_VARIANTS = [
  {
    description:
      "Changed subject to use a question with first name personalization",
    subject: `{{firstName}}, quick question about {{company}}?`,
  },
  {
    description: "Shortened body to be more concise and direct",
    body: `Hi {{firstName}},\n\nSaw {{company}} just {{recentEvent}} — impressive.\n\nWe help similar companies cut 10+ hours/week from manual prospecting. Worth a 15-min chat?\n\n{{senderName}}`,
  },
  {
    description: "Changed send time to 10 AM for better open rates",
    sendTime: 10,
  },
  {
    description:
      "Added personalized question in subject referencing recent event",
    subject: `Loved seeing {{company}}'s {{recentEvent}} — quick question`,
  },
  {
    description: "Made CTA more specific with day suggestion",
    body: `Hi {{firstName}},\n\nI noticed {{company}} recently {{recentEvent}}. Congrats on that milestone.\n\nWe help companies like yours streamline their outbound pipeline — typically saving teams 10+ hours/week on manual prospecting.\n\nWould Tuesday or Wednesday work for a quick 15-min call?\n\nBest,\n{{senderName}}`,
  },
];

function buildMockStrategy(
  currentStrategy: string,
  expNum: number,
): { newStrategy: string; description: string } {
  const variant = MOCK_VARIANTS[(expNum - 1) % MOCK_VARIANTS.length];
  const { description, ...overrides } = variant;

  // Parse the current strategy to build a modified version
  let newStrategy = currentStrategy;
  for (const [key, value] of Object.entries(overrides)) {
    // Match the key and its value (string or number) in the strategy file
    const pattern =
      "(" + key + ":\\s*)(?:\"[^\"]*\"|'[^']*'|" + "`[^`]*`" + "|\\d+)";
    const regex = new RegExp(pattern, "s");
    if (typeof value === "string") {
      newStrategy = newStrategy.replace(regex, "$1" + "`" + value + "`");
    } else {
      newStrategy = newStrategy.replace(regex, "$1" + String(value));
    }
  }

  return { newStrategy, description };
}

async function proposeVariant(
  program: string,
  currentStrategy: string,
  history: string,
  baselineScore: number,
  baselineMetrics: Record<string, number>,
  expNum: number,
  systemContext: string,
): Promise<{ newStrategy: string; description: string }> {
  // Dry-run mode — return mock variants without calling an LLM
  if (DRY_RUN) {
    return buildMockStrategy(currentStrategy, expNum);
  }

  const prompt = `You are an autonomous experiment agent. Your job is to optimize a business system by modifying its strategy.

## Program (your instructions)
${program}
${systemContext}
## Current Strategy (strategy.ts)
\`\`\`typescript
${currentStrategy}
\`\`\`

## Current Baseline
- Score: ${baselineScore}
- Metrics: ${JSON.stringify(baselineMetrics, null, 2)}

## Experiment History
${history}

## Your Task
Propose a NEW variant of strategy.ts that you believe will produce a higher score than the current baseline.

Rules:
1. Output the COMPLETE new strategy.ts file content — not a diff, the entire file.
2. Change only the strategy values, not the structure or exports.
3. Try ONE meaningful change at a time so we can learn what works.
4. Review the experiment history — don't repeat approaches that were already skipped.
5. Include a one-line description of what you changed and why.

Respond in this exact format:

DESCRIPTION: <one-line description of what you changed and why>

STRATEGY:
\`\`\`typescript
<complete strategy.ts file content>
\`\`\``;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await generateText({
      model: MODEL,
      prompt:
        attempt === 1
          ? prompt
          : prompt +
            "\n\nIMPORTANT: Your previous response was not formatted correctly. You MUST include a ```typescript code block with the complete strategy.ts file.",
      // maxOutputTokens: 2000,
      // temperature: 0.7,
    });

    const text = result.text;

    // Parse description
    const descMatch = text.match(/DESCRIPTION:\s*(.+)/);
    const description = descMatch?.[1]?.trim() ?? "No description provided";

    // Parse strategy code block — try multiple formats
    const codeMatch =
      text.match(/```typescript\n([\s\S]*?)```/) ??
      text.match(/```ts\n([\s\S]*?)```/) ??
      text.match(/```\n([\s\S]*?)```/);

    if (codeMatch) {
      return { newStrategy: codeMatch[1].trim(), description };
    }

    if (attempt < MAX_RETRIES) {
      console.log(
        `   Retry ${attempt}/${MAX_RETRIES} — agent response missing code block`,
      );
    }
  }

  throw new Error(
    "Agent failed to return a valid strategy code block after 3 attempts",
  );
}

// ---------------------------------------------------------------------------
// Core: Run one experiment
// ---------------------------------------------------------------------------

async function runExperiment(
  expNum: number,
  baselineScore: number,
  baselineMetrics: Record<string, number>,
  systemContext: string,
) {
  const program = readFileSync(PROGRAM_PATH, "utf-8");
  const currentStrategy = readFileSync(STRATEGY_PATH, "utf-8");
  const history = readExperimentsCSV();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Experiment #${padNum(expNum)}`);
  console.log(`  Baseline score: ${baselineScore}`);
  console.log(`${"=".repeat(60)}\n`);

  // Back up current strategy before modifying
  backupStrategy();

  // 1. PROPOSE
  console.log("1. PROPOSE — Agent is thinking...");
  const { newStrategy, description } = await proposeVariant(
    program,
    currentStrategy,
    history,
    baselineScore,
    baselineMetrics,
    expNum,
    systemContext,
  );
  console.log(`   Hypothesis: ${description}`);

  // Write the variant
  writeFileSync(STRATEGY_PATH, newStrategy + "\n");

  // 2. RUN — evaluate the variant in a subprocess (avoids module cache)
  console.log("2. RUN — Evaluating variant...");
  let evalResult: EvalResult;
  try {
    const output = execSync("npx tsx evaluate.ts", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    evalResult = JSON.parse(output.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ERROR: ${msg}`);
    restoreStrategy();
    saveExpArtifacts(expNum, {
      "variant.ts": newStrategy,
      "output.log": msg,
    });
    appendExperiment({
      experiment: `exp_${padNum(expNum)}`,
      score: 0,
      baselineScore,
      status: "error",
      metrics: "{}",
      description,
    });
    return { adopted: false, score: baselineScore, metrics: baselineMetrics };
  }

  if (!evalResult.success) {
    console.log(`   Evaluation failed: ${evalResult.error}`);
    restoreStrategy();
    saveExpArtifacts(expNum, {
      "variant.ts": newStrategy,
      "output.log": evalResult.error ?? "unknown error",
    });
    appendExperiment({
      experiment: `exp_${padNum(expNum)}`,
      score: 0,
      baselineScore,
      status: "error",
      metrics: "{}",
      description,
    });
    return { adopted: false, score: baselineScore, metrics: baselineMetrics };
  }

  // 3. SCORE
  console.log("3. SCORE — Computing score...");
  const scoreResult = score(evalResult.metrics);
  console.log(
    `   Variant score: ${scoreResult.score} (baseline: ${baselineScore})`,
  );
  console.log(`   Breakdown: ${JSON.stringify(scoreResult.breakdown)}`);
  if (scoreResult.violations.length > 0) {
    console.log(`   Violations: ${scoreResult.violations.join(", ")}`);
  }

  // 4. DECIDE
  const adopted = scoreResult.score > baselineScore;
  const status = adopted ? "adopt" : "skip";
  console.log(`4. DECIDE — ${adopted ? "ADOPT" : "SKIP"}`);

  if (adopted) {
    // Variant is already written to strategy.ts — it stays
    console.log("   Strategy updated.");
  } else {
    // Restore baseline
    restoreStrategy();
    console.log("   Reverted to baseline.");
  }

  // Save artifacts
  saveExpArtifacts(expNum, {
    "variant.ts": newStrategy,
    "metrics.json": JSON.stringify(evalResult.metrics, null, 2),
    "score.json": JSON.stringify(scoreResult, null, 2),
    "output.log": `Description: ${description}\nStatus: ${status}\nScore: ${scoreResult.score}\nBaseline: ${baselineScore}\nMetrics: ${JSON.stringify(evalResult.metrics, null, 2)}`,
  });

  // Log to CSV
  appendExperiment({
    experiment: `exp_${padNum(expNum)}`,
    score: scoreResult.score,
    baselineScore,
    status,
    metrics: JSON.stringify(evalResult.metrics),
    description,
  });

  return {
    adopted,
    score: adopted ? scoreResult.score : baselineScore,
    metrics: adopted ? evalResult.metrics : baselineMetrics,
  };
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
  console.log("Business Autoresearch Lab");
  console.log(`Model: ${MODEL}`);
  console.log(`Max runs: ${MAX_RUNS === Infinity ? "unlimited" : MAX_RUNS}`);

  // Reset from previous run
  console.log("Resetting from previous run...");

  // Clear old experiments
  if (existsSync(EXPERIMENTS_DIR)) rmSync(EXPERIMENTS_DIR, { recursive: true });
  if (existsSync(EXPERIMENTS_CSV)) rmSync(EXPERIMENTS_CSV);

  // Reset strategy.ts selections to empty (preserve userId and cutoff)
  const strategyContent = readFileSync(STRATEGY_PATH, "utf-8");
  const resetStrategy = strategyContent.replace(
    /selections:\s*\{[^}]*\}\s*as\s*Record<string,\s*number>/s,
    "selections: {} as Record<string, number>",
  );
  writeFileSync(STRATEGY_PATH, resetStrategy);

  // Setup
  ensureExperimentsCSV();
  mkdirSync(EXPERIMENTS_DIR, { recursive: true });

  // Run baseline evaluation via subprocess
  console.log("\nRunning baseline evaluation...");
  let baselineEval: EvalResult = undefined!;
  try {
    const output = execSync("npx tsx evaluate.ts", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    baselineEval = JSON.parse(output.trim());
  } catch (err) {
    console.error(
      "Baseline evaluation failed:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }

  if (!baselineEval.success) {
    console.error("Baseline evaluation failed:", baselineEval.error);
    process.exit(1);
  }

  const baselineScoreResult = score(baselineEval.metrics);

  console.log(
    `Baseline metrics: ${JSON.stringify(baselineEval.metrics, null, 2)}`,
  );
  console.log(`Baseline score: ${baselineScoreResult.score}`);

  // Fetch system context once (e.g., available opportunities from API)
  const systemContext = await fetchSystemContext();

  // Loop
  let currentScore = baselineScoreResult.score;
  let currentMetrics = baselineEval.metrics;
  let expNum = 1;

  while (expNum <= MAX_RUNS) {
    try {
      const result = await runExperiment(
        expNum,
        currentScore,
        currentMetrics,
        systemContext,
      );
      currentScore = result.score;
      currentMetrics = result.metrics;
    } catch (err) {
      console.error(`\nExperiment ${expNum} crashed:`, err);
      // Ensure strategy.ts is clean
      try {
        restoreStrategy();
      } catch {
        // ignore — backup may not exist on first run crash
      }
    }
    expNum++;
  }

  console.log("\n" + "=".repeat(60));
  console.log("Lab complete.");
  console.log(`Final score: ${currentScore}`);
  console.log(`Total experiments: ${expNum - 1}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
