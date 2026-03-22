// CRS Improvement Strategy
// The agent modifies these selections to find the optimal improvement plan.
// Each key is a CRS factor, each value is a scenario index from the breakdown data.
// Get valid keys and indices from: POST /api/crs/opportunities

export const strategy = {
  // Target configuration
  userId: "5c43278c-652e-4e25-bf41-e74ef35be671",
  cutoff: 524,

  // Scenario selections — the agent changes these
  // Format: { "FactorKey": scenarioIndex }
  // Upgrading English to CLB 9 on all 4 skills unlocks higher transferability tiers:
  //   - Education + First Language: Master's + CLB 9 all = 50 pts (up from 25, +25 gain)
  //   - Foreign Work + First Language: 3+ years + CLB 9 all = 50 pts (up from 25, +25 gain)
  // Combined with French NCLC 7+ bonus (50 pts) and French core points, this should close the gap.
  // CLB 9 is ambitious but included to test if it mathematically closes the gap.
  selections: {
    "First Official Language - Listening": 5,        // CLB 9 (+22 pts total vs current CLB 6)
    "First Official Language - Speaking": 5,          // CLB 9 (+22 pts total vs current CLB 6)
    "First Official Language - Reading": 5,           // CLB 9 (+22 pts total vs current CLB 6)
    "First Official Language - Writing": 5,           // CLB 9 (+22 pts total vs current CLB 6)
    "Second Official Language - Listening": 2,        // NCLC 7 or 8 (+3 pts, from French study)
    "Second Official Language - Speaking": 2,         // NCLC 7 or 8 (+3 pts, from French study)
    "Second Official Language - Reading": 2,          // NCLC 7 or 8 (+3 pts, from French study)
    "Second Official Language - Writing": 2,          // NCLC 7 or 8 (+3 pts, from French study)
    "French Language": 2,                             // NCLC 7+ all skills AND CLB 5+ English = 50 pts
    "Education + First Language": 13,                 // Master's degree AND CLB 9 all four = 50 pts (max)
    "Foreign Work + First Language": 6,               // 3+ years foreign work AND CLB 9 all = 50 pts (max)
  } as Record<string, number>,
} as const;

export type Strategy = typeof strategy;
