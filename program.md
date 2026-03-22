# Program: Cold Outreach Email Optimization

## Objective

Optimize cold outreach emails for **reply rate**. We send cold emails to potential B2B leads and want to maximize the percentage of recipients who reply.

## System Under Test

The `evaluate.ts` harness sends emails via our email API and tracks opens, clicks, and replies over a measurement window.

## Levers (What You Can Change)

You may modify **only** `strategy.ts`. The strategy exports:

- `subject` — The email subject line
- `body` — The email body (plain text or HTML)
- `sendTime` — Preferred send time (hour of day, UTC)
- `followUpDelay` — Hours to wait before follow-up
- `followUpBody` — The follow-up email body

## Metrics

The evaluator returns these raw metrics:

- `replyRate` — Percentage of recipients who replied (0-1). **This is the north star.**
- `openRate` — Percentage who opened the email (0-1)
- `clickRate` — Percentage who clicked a link (0-1)
- `unsubscribeRate` — Percentage who unsubscribed (0-1)
- `spamRate` — Percentage who marked as spam (0-1)

## Constraints

- `spamRate` must stay below 0.02 (2%). Any variant exceeding this is automatically skipped.
- `unsubscribeRate` must stay below 0.05 (5%).
- Email body must not contain false claims, fake urgency, or misleading content.
- Subject line must be under 80 characters.
- Body must be under 2000 characters.

## Scoring

The scorer combines metrics as follows:
- 70% reply rate
- 20% open rate
- 10% click rate
- Penalty: -1.0 if spam rate > 0.02 or unsubscribe rate > 0.05

## Decision Logic

- **Adopt** if the variant's score is higher than the baseline's score.
- **Skip** if the variant's score is equal or lower.
- **Error** if the evaluation fails — inspect the log, fix if trivial, skip if not.
- **Simplicity bias**: If two variants score similarly (within 0.005), prefer the shorter/simpler email.

## Experiment Guidelines

- Try one change at a time so we can isolate what works.
- Consider: tone (formal vs casual), length (short vs detailed), personalization, CTA placement, subject line patterns (question, stat, name-drop), send timing.
- Review the experiment history in `experiments.csv` before proposing. Don't repeat failed approaches unless combining with a new idea.
- Think about *why* a previous variant was adopted or skipped before proposing the next one.
