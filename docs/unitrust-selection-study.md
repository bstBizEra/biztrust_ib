# UniTrust insurance selection study

Reviewed locally on 26 September 2026. UniTrust was read as a design reference; its files were not changed and its insurer, legal or distribution claims were not adopted as verified BizTrust data.

## What makes its selection useful

UniTrust separates an insurance **category**, a specific **cover type**, and an **insurer offer**. Customers first choose what they want to protect, then supply relevant details and compare offers for that same type. This is more useful than sorting unrelated products by their starting premium.

| Pattern in UniTrust                               | Value for BizTrust                                           | This implementation                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Personal/business audience filters                | A shorter, relevant starting list                            | Added to `/find-cover`, across all 12 current categories                                                    |
| Category → specific cover type → insurer offer    | Supports many products without overwhelming customers        | Added category → sample offers; detailed cover-type taxonomy remains future catalogue work                  |
| Must-have coverage and explicit missing features  | Makes trade-offs visible                                     | Added coverage matching using the actual sample plan coverage arrays, with optional matching-only filtering |
| Price, limits, deductible and exclusions together | Prevents a starting price from dominating the decision       | All shown on each offer, within one category and premium period                                             |
| Online, broker quote, pilot and external routes   | Separates self-service from underwriting and special schemes | Documented for future integration; current flows remain explicitly synthetic                                |
| Product-specific questions and calculations       | Contextual comparisons for vehicle, trip, person or business | Existing validated applicant/quote flow retained; no duplicate client pricing engine added                  |
| Selection preserved into enquiry                  | Avoids repeating choices                                     | Chosen sample plan opens its existing review/application flow; category links survive refresh               |

The new entry point is linked from the homepage **Find your cover** action and the catalogue **Help me find my cover** link. The existing full catalogue and comparison tray remain available. Personal/business grouping describes the current sample products, not an exhaustive market eligibility rule. Must-have matches only mean a feature appears in a sample plan; they do not establish suitability, eligibility or actual cover.

## Next catalogue model

Use separate category, cover-type and insurer-offer records. A cover type should have an audience, availability route, input schema and coverage feature definitions. An insurer offer should carry versioned wording, explicit eligibility, pricing authority, limits, exclusions, insurer identity and distribution approval. Publish online pricing only when the approved pricing inputs and insurer integration exist; otherwise route to a real broker enquiry workflow.

Examples from the reference include motor liability versus own-damage versus fleet, and term life versus savings versus loan protection. These are useful taxonomy distinctions, not interchangeable tiers of one plan. Do not map them to the existing generic Essential/Plus fixtures and imply actual product coverage.

UniTrust's compulsory-product labels, real insurer lists, partnership implications and indicative rating assumptions need separate evidence before use. Its permissive numeric fallbacks should not replace BizTrust's strict server validation. No live insurer offers were added by this change.

## Source files examined

- `C:/laragon/www/unitrust/src/lib/catalog.ts`: category, product, audience and availability model.
- `C:/laragon/www/unitrust/src/lib/quotes.ts`: contextual inputs, feature sets and sample offer rating.
- `C:/laragon/www/unitrust/src/components/OfferComparator.tsx`: needs matching, missing-feature explanation, filtering, sorting and selection handoff.
- `C:/laragon/www/unitrust/src/components/ProductCard.tsx`: cover-type discovery cards.
- `C:/laragon/www/unitrust/src/app/(site)/insurance/page.tsx`: audience filters and grouped catalogue.
- `C:/laragon/www/unitrust/src/app/(site)/insurance/[category]/page.tsx`: category navigation.
- `C:/laragon/www/unitrust/src/app/(site)/insurance/[category]/[product]/page.tsx`: offer comparison versus enquiry routing.

## White-screen repair

The original running development server returned `504 Outdated Optimize Dep` for React, React DOM and the JSX runtime. The document loaded successfully, but React never mounted. The previous browser checks used a separate built-asset server, so they did not detect the stale development listener delivered to the user.

The preview at `http://127.0.0.1:3000` now serves built assets. Development, build and startup-test caches are isolated under `.data/vite-*`; development optimizer artifacts are rebuilt when the server restarts. The startup test cannot invalidate an active developer's dependency cache. Stop and restart the development server after installing/changing dependencies.

The HTML now contains a visible startup/reload surface before JavaScript loads. A small independent bootstrap catches application-module import failures. Regression checks cover development routes, failed script/style requests, built browser journeys, simulated module failure and reload recovery, and JavaScript-disabled fallback. A health endpoint alone is not evidence of a working page.
