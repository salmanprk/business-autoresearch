# CRS Score Optimizer — Agent Instructions

## Objective

Find the most realistic and achievable combination of CRS (Comprehensive Ranking System) improvements for a specific immigration applicant to meet or exceed a target Express Entry draw cutoff score.

Optimize for: **meeting the cutoff with the fewest, most achievable changes possible.**

## System Under Test

A CRS score simulator API at `http://localhost:5173/api/crs/simulate`.

The API takes a userId, a set of scenario selections (which improvements to simulate), and a target cutoff score. It returns the simulated CRS total and whether the target is met.

## How CRS Scoring Works

The CRS score is the sum of 4 sections:

- **Core/Human Capital** (max 460-500): Age, Education, First & Second Language, Canadian Work Experience
- **Skill Transferability** (max 100): Combinations of education, language, and work experience. Two sub-sections capped at 50 each.
- **Additional Points** (max 600): French language, Canadian education, sibling in Canada, Provincial Nomination (600 pts alone)
- **Spouse/Partner** (max 40): Spouse's education, language, and Canadian work experience

Language abilities (Listening, Speaking, Reading, Writing) are simulated individually — not as a group.

Age is excluded — it cannot be improved.

## Levers (fields in strategy.ts)

The `selections` object maps factor keys to scenario indices. Each key is a CRS factor, each value is an index into that factor's scenario list.

### Available Factors and Their Scenarios

**IMPORTANT**: Before the first experiment, call the opportunities endpoint to get the user's actual current state and available upgrades:

## Specific Scenario — HARD CONSTRAINTS

This user is applying from **outside Canada**. The following factors are **OFF LIMITS** — do NOT include them in selections, even if the API allows it:

- **Canadian Work Experience** — cannot gain this without already being in Canada with a work permit
- **Provincial Nomination (PNP)** — competitive and uncertain, cannot be "planned" as an improvement step
- **Sibling in Canada** — a fact about the applicant, cannot be changed

Any variant that includes these factors must be considered **invalid and automatically skipped**.

### What IS realistically achievable from outside Canada:
- **English language improvement** (IELTS/CELPIP retakes with study)
- **French language study** (TEF/TCF — can be studied from anywhere)
- **Education upgrades** (Master's degree, or studying in Canada on a study permit)
- **Canadian education** — YES, this is achievable. The user can apply to a Canadian institution, get a study permit, and earn Canadian education bonus points. This is a common and proven immigration strategy.
- **Foreign work experience** — accumulates naturally over time
- **Spouse improvements** — if married, spouse can independently improve their language scores or education

## Realism Constraints — THINK LIKE A REAL APPLICANT

Prefer **gradual, achievable improvements**. The user needs a realistic action plan they can actually execute, not a theoretical maximum.

### English Language (IELTS/CELPIP → CLB)
- **CLB 10 (IELTS 8.5-9.0) is IMPOSSIBLE to plan for** — native speaker level, do NOT select this
- **CLB 9 (IELTS 8.0) is very hard** — only realistic if user is already at CLB 8 and near-fluent. Do NOT jump to CLB 9 from CLB 6-7
- **CLB 8 (IELTS 7.0) is the realistic ceiling** for most applicants with 3-6 months of dedicated study
- **CLB 7 (IELTS 6.0) is achievable** for most skilled workers with basic preparation
- **Always improve incrementally**: CLB 6→7, then 7→8. Never skip levels (e.g., CLB 6→9)
- Each skill (Listening, Speaking, Reading, Writing) should be improved individually — some are easier than others. Listening and Reading are usually easier to improve than Speaking and Writing.

### French Language (TEF/TCF → NCLC)
- This is a **high-value strategy** — NCLC 7+ in all French skills with CLB 5+ English gives 50 bonus points
- Starting from zero French: **NCLC 4-5 is realistic** with 12 months of dedicated study
- Starting from zero French: **NCLC 6-7 takes 18-24 months** — only faster if the user already speaks a Romance language (Spanish, Portuguese, Italian)
- With existing French background: **NCLC 7 is realistic** with focused preparation
- **NCLC 8+ from scratch is unrealistic** — do not select this unless user already speaks French fluently
- French study can be done from anywhere in the world — online courses, Alliance Française, etc.
- Even a lower French score (NCLC 5-6) combined with strong English can unlock some additional points

### Education
- **Doctoral degree is NOT realistic** unless the user is young (<25) and willing to spend 4-7 years — do NOT select this as a general improvement
- **Bachelor's → Master's is realistic** — 1-2 year commitment, many online/international options
- **Studying in Canada** is a proven strategy: apply to a Canadian institution, get a study permit, earn Canadian education points. After graduation, the user may also qualify for Canadian work experience through a Post-Graduation Work Permit (PGWP)
- Only suggest the next logical step up from the user's current education level

### Foreign Work Experience
- Cannot be rushed — it accumulates over time
- If the user is close to a threshold (e.g., 2 years → 3 years), note that waiting may help
- Do NOT suggest unrealistic jumps in work experience

### Spouse/Partner Factors
- If the user has a spouse, their language and education improvements count too
- Spouse taking IELTS is often an overlooked quick win
- Spouse education credential assessment (ECA) is just paperwork

### General Principles
1. **Start with the smallest, cheapest changes first** — language retakes are cheaper than a Master's degree
2. **Combine high-ROI moves** — French bonus (50 pts) + one CLB level up is often better than a degree upgrade
3. **Only escalate to bigger changes** (Master's degree, studying in Canada) if smaller ones prove insufficient based on experiment history
4. **If the target cannot be met with realistic changes, say so** — that's a valid and valuable finding. Don't propose fantasy improvements just to close the gap.
5. **Think about timeline** — language study (3-6 months) is faster than a Master's (1-2 years) which is faster than Canadian education + PGWP (3-4 years)
