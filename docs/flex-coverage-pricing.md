# Flexible coverage and live sample premiums

Implemented and verified locally on 26 September 2026. Reference inspected: UniTrust at `http://localhost:4200/`, including `/insurance/motor/car-insurance`. UniTrust remains unchanged. BizTrust's implementation is at `http://127.0.0.1:3000/find-cover`.

## Behaviour

- Each of the 12 categories has a coverage amount slider with category-specific LAK bounds and increments. The synthetic range is 50%–200% of its baseline amount in 25% increments.
- Selecting optional benefits changes each insurer variant's premium and itemised benefit charges immediately. Removing the benefit reverses the charge. Existing included-feature filters are separately labelled and do not change a fixed plan's price.
- Applicable applicant-age and trip-duration controls also update estimates. Travel shows the total for the selected trip duration; annual plans show a yearly price.
- Price sorting uses the configured totals. Selected amounts and benefits survive page refresh in the same tab and are carried into comparison, review, saved quotes, application coverage snapshots and invoices.
- The application summary displays the selected limit and benefits after reload. Invalid or obsolete saved browser settings fall back to current defaults.

## Rating boundary

`shared/pricing.ts` implements one deterministic rule used by client previews and server quote calculation. The base premium is proportional to selected coverage, multiplied by travel days when applicable and by the existing age factor. Optional charges are calculated individually from that base and rounded to whole LAK. The total is the sum of the rounded base and charges.

The server accepts product identity and selection inputs, never a client-supplied premium. It validates category-specific ranges/increments, applicant bounds, available benefits and duplicate benefits. Product and pricing versions are now `demo-2026.2` and `demo-flex-pricing-2`; older product quotes must be recalculated before a new application. Previously submitted applications retain their original snapshots.

All coverage amounts, benefit names, eligibility and rates remain synthetic. This is a working pricing interaction, not an approved insurer quotation service.

## Verification

- 25 domain, contract and PostgreSQL integration tests passed, including new boundary, tampering, rounding, saved-configuration and invoice checks. This count includes the concurrently added staff API test.
- 6 browser journeys passed, including reversible optional pricing, slider changes, comparison persistence, selection refresh, configured quote submission and retained application/invoice values.
- 19 axe accessibility checks passed, with zero violations in the selected rules; zero page or asset-loading errors.
- Development startup, lint, TypeScript, formatting and whitespace checks passed. Built preview inspected at the exact BizTrust URL.
- Health Essential example: ₭150m cover → ₭3,600,000/year; ₭225m cover → ₭5,400,000; outpatient benefit → ₭5,832,000.
- Travel example: ₭450m cover, 7 days and baggage benefit → ₭272,160, unchanged through saved application and invoice.

Evidence: ignored `output/flex-browser-final.log`, `output/flex-build.log`, `output/playwright/`, and `output/flex-live-selected.txt`. The first browser run caught a pre-existing helper-text contrast issue in the newly checked quote form; its colour was corrected before the final passing run.
