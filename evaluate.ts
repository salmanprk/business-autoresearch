import { strategy } from "./strategy";

export interface Metrics {
  [key: string]: number;
}

export interface EvalResult {
  metrics: Metrics;
  success: boolean;
  error?: string;
}

const API_BASE = "http://localhost:5173/api/crs";

export async function evaluate(
  strategyModule: Record<string, any>,
): Promise<EvalResult> {
  const strat = strategyModule.strategy ?? strategyModule;
  const userId = strat.userId;
  const cutoff = strat.cutoff;
  const selections = strat.selections ?? {};

  // Step 1: Get current state from opportunities endpoint
  let currentTotal: number;
  let originalGap: number;
  try {
    const oppRes = await fetch(`${API_BASE}/opportunities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, cutoff }),
    });
    const oppData = await oppRes.json();
    if (oppData.error) {
      return {
        metrics: {},
        success: false,
        error: `Opportunities error: ${oppData.error}`,
      };
    }
    currentTotal = oppData.currentTotal;
    originalGap = oppData.gap;
  } catch (err: any) {
    return {
      metrics: {},
      success: false,
      error: `Failed to call opportunities: ${err.message}`,
    };
  }

  // Step 2: If no selections, return baseline
  const numFactorsChanged = Object.keys(selections).length;
  if (numFactorsChanged === 0) {
    return {
      metrics: {
        simulatedTotal: currentTotal,
        currentTotal,
        diff: 0,
        remainingGap: originalGap,
        meetsTarget: currentTotal >= cutoff ? 1 : 0,
        numFactorsChanged: 0,
        gapClosurePercent: 0,
      },
      success: true,
    };
  }

  // Step 3: Run simulation
  try {
    const simRes = await fetch(`${API_BASE}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, selections, cutoff }),
    });
    const simData = await simRes.json();
    if (simData.error) {
      return {
        metrics: {},
        success: false,
        error: `Simulate error: ${simData.error}`,
      };
    }

    const gapClosurePercent =
      originalGap > 0
        ? Math.min(
            100,
            ((originalGap - simData.remainingGap) / originalGap) * 100,
          )
        : 100;

    return {
      metrics: {
        simulatedTotal: simData.simulatedTotal,
        currentTotal: simData.currentTotal,
        diff: simData.diff,
        remainingGap: simData.remainingGap,
        meetsTarget: simData.meetsTarget ? 1 : 0,
        numFactorsChanged,
        gapClosurePercent: Math.round(gapClosurePercent * 100) / 100,
      },
      success: true,
    };
  } catch (err: any) {
    return {
      metrics: {},
      success: false,
      error: `Failed to call simulate: ${err.message}`,
    };
  }
}

// Standalone mode — called by lab.ts as subprocess
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ""));
if (isMain) {
  const result = await evaluate({ strategy });
  process.stdout.write(JSON.stringify(result));
}
