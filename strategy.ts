/**
 * strategy.ts — The current best strategy.
 *
 * This is the ONLY file the agent modifies.
 * It exports the inputs/parameters that get fed into the system under test.
 *
 * After each experiment:
 *   - If the variant is ADOPTED, this file reflects the new best strategy.
 *   - If the variant is SKIPPED, this file is reverted to the previous version.
 */

export const strategy = {
  subject: "{{company}}'s growth plans?",

  body: `Hi {{firstName}},

Saw that {{company}} recently {{recentEvent}} — impressive.

We help teams like yours save 10+ hours/week on prospecting.

Curious if this resonates with you?

{{senderName}}`,

  sendTime: 9, // hour of day, UTC

  followUpDelay: 48, // hours

  followUpBody: `Hi {{firstName}},

Circling back — worth exploring for {{company}}?

{{senderName}}`,
} as const;

export type Strategy = typeof strategy;
