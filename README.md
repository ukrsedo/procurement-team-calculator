# Good Spending — Procurement Team Calculator

Buildless, English-only, browser-local Monte Carlo scenario calculator. Serve `docs/`. No API key or server-side data processing. Cooperative async calculations yield between trials, support cancellation and update the main dashboard automatically after a valid FTE change.

## What is optimised

Cost: lowest salary budget found within the tested integer total-FTE grid that meets the pooled SLA target for every procedure with demand. SLA: highest minimum pooled compliance across procedures within a salary budget. One manager per team in recommendation searches; manual scenarios allow manager changes. Headcount is not an optimisation objective. Seniors are capped at 50% of planned person headcount including managers; part-time roles count as people. Salary is an annualised budget for planned positions, including vacancies, not actual paid cash flow. No recruitment fees.

## Workflow and staffing

Open RFP 120 calendar days, Closed RFP 100, Single-source 60, RFQ 15, Contract extension 15. Annual volumes, SLAs, senior/junior effort, review effort and external waits are editable. Effort and waits are illustrative, not calibrated benchmarks. Eight-hour workdays. Manager procurement time 50%, others 80%; maximum personal productivity 10/10/5 parallel cases. Time fractions reduce hours only; partial FTE scales hours and the case limit, flooring the latter. New-hire ramp scales hours once.

Jobs have 55% of work, an external wait, then 45% and any required review. Senior/manager hours are used for junior review. Earliest-deadline priority applies to owned work and reviews; new junior reviews may use genuine unspent qualified hours the same day. Zero waits do not artificially add a working day. Integer waits are uniformly sampled; effort varies uniformly +/-20%. Awaiting cases retain an owner's parallel-case slot. Junior work has higher editable effort and requires editable review hours. Full task effort is retained through reassignment.

Cross-team support is explicit: separate team queues (default) or pooled qualified staff. Staffing totals are distributed evenly using whole positions before a fractional role. Separate queues can create large local bottlenecks; pooling assumes interchangeable skills and is not automatically valid for specialised categories. Management effectiveness is outside the model.

## Calendars and uncertainty

20 working days vacation in two blocks, 5 ordinary sick days annually, plus 10 sick days for a random 10% of planned people, with unbiased stochastic rounding. Own absence blocks do not overlap. A three-working-day handover uses 50% of sender and recipient procurement hours; simultaneous handovers add. Vacation/departure releases work under the allocation policy; sickness pauses owned work. Independent per-position annual departure probability defaults to 5%, followed by three actual calendar months of vacancy and six months at 50% new-hire productivity. Replacement workers inherit the position's planned absence calendar. Overlapping vacancy and leave are not modelled as additive lost days.

Demand is a seasonal Poisson process with normalised daily weights (expected annual demand equals the input). Arrivals continue through warm-up, measurement and observation years. Only requests received in the middle 365-day year are scored, including outstanding cases. Weekends are Saturday/Sunday; holidays are artificial. Month offsets use a synthetic timeline beginning Monday 4 Jan 2027. Fixed-position stable random streams keep incumbent ordinary sickness/vacation/turnover schedules comparable when staffing changes. Extra-sickness selection and handover recipients can legitimately change with the workforce.

Pooled compliance is separate from annual reliability. Results expose per-procedure annual P10/P90 compliance, per-procedure target frequency, and the probability all observed procedures reach their targets in the same simulated year, with a Wilson 95% Monte Carlo interval. These reflect randomness under fixed inputs, not uncertainty about input assumptions. When incomplete cases exist, P90 duration ranks them above observed completions to report a conservative upper bound, returning no estimate when no finite bound is identifiable. This is not a Kaplan–Meier estimate. Salary and annual reliability are not combined into a single arbitrary score.

## Verification and limits

`node check-model.cjs`, `node check-ui.cjs`, `node audit/check-audit.cjs`. The UI test runs actual async simulations through a DOM interaction harness; this is not a rendered browser test. Audit sensitivity results and independent-seed checks are in `audit/`. `audit/before-model.cjs` preserves the pre-audit model for reproducibility; `audit/pre-optimisation.cjs` captures the audited model before a numerically equivalent queue optimisation. The published audit page explains findings and remaining limitations.

No historical calibration or external validation. One warm-up year may not reach equilibrium for overloaded departments. Within-day work is aggregated, allocation/skills/routines and rework are simplified, absences mostly independent, no overtime, no operational management metric, and possible correlation of staffing shocks is not estimated. Search uses finite samples and the same sample set for selection, so borderline recommendations need independent seeds and sensitivity checks. A held-out recommendation check is performed in the audit but is not a production backtest. Do not treat pooled 95% compliance as 95% certainty of achieving the annual target.

## GitHub hosting

The public calculator files are in `docs/`. Configure GitHub Pages to deploy from the `main` branch, `/docs` folder. No build step, paid hosting, API key or backend is required. All calculations run in the visitor's browser.

Run the retained model, UI-contract and audit checks using `npm test` (Node.js 20 or later; no dependency installation is needed). Regenerate the audit report with `npm run audit:report`; sensitivity analysis is a separate longer task.

The original private prototype remains separate. This repository deliberately excludes its hosting manifest, project identity, credentials and Git metadata.
