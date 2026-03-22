# Business Autoresearch

An autonomous experimentation loop for optimizing business systems. Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

An AI agent proposes variants of a strategy, tests them against your real system, and adopts improvements automatically — running experiments overnight while you sleep.

## How It Works

```
PROPOSE → RUN → SCORE → DECIDE → LOOP
```

1. **PROPOSE** — The agent reads `program.md` + experiment history + current `strategy.ts`, then proposes a variant
2. **RUN** — The variant is evaluated against the real system via `evaluate.ts`
3. **SCORE** — Raw metrics are combined into a single number by `scorer.ts`
4. **DECIDE** — If variant score > baseline score → **adopt** (keep), otherwise → **skip** (revert)
5. **LOOP** — Repeat

## File Structure

| File | Role | Who modifies it |
|---|---|---|
| `program.md` | Defines what to optimize, constraints, decision logic | You (human) |
| `strategy.ts` | Current best strategy — inputs to your system | Agent |
| `evaluate.ts` | Calls your real system, returns raw metrics | You (once, for setup) |
| `scorer.ts` | Combines metrics into a single comparable score | You (once, for setup) |
| `lab.ts` | The experiment loop orchestrator | Nobody (framework) |
| `experiments.csv` | Log of every experiment | Auto-generated |

## Quick Start

```bash
# Install dependencies
npm install

# Set your API key (works with any provider via Vercel AI Gateway)
export AI_GATEWAY_API_KEY=your-key-here

# Run the lab (default: Claude Sonnet)
npx tsx lab.ts

# Or specify any model
MODEL=anthropic/claude-sonnet-4.5 npx tsx lab.ts
MODEL=openai/gpt-4o npx tsx lab.ts
MODEL=google/gemini-2.5-pro npx tsx lab.ts

# Limit number of experiments
MAX_RUNS=10 npx tsx lab.ts
```

## Adapting to Your System

1. **Edit `program.md`** — Describe your system, what levers the agent can pull, what metrics matter, and any constraints.

2. **Edit `strategy.ts`** — Set up the initial strategy with your system's input parameters.

3. **Edit `evaluate.ts`** — Replace the mock evaluator with a real call to your system/API. Keep the `evaluate(strategy) → { metrics, success }` interface.

4. **Edit `scorer.ts`** — Set the weights and constraints that match your program.

5. **Run `npx tsx lab.ts`** — The agent takes it from here.

## Terminology

| Term | Meaning |
|---|---|
| **Strategy** | The current best set of inputs to your system |
| **Variant** | A modified strategy proposed by the agent |
| **Baseline** | The current best score to beat |
| **Adopt** | Variant beat the baseline → becomes the new strategy |
| **Skip** | Variant didn't improve → revert to previous strategy |
| **Lab** | The experiment loop |
| **Program** | Your instructions to the agent |
