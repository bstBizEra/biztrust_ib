import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Info,
  ShieldCheck,
} from "lucide-react";
import { money, type Catalog, type Product } from "./api";
import "./cover-finder.css";
import FlexControls from "./FlexControls";
import {
  defaultSelection,
  restoreSelection,
  pricePlan,
  selectedLimit,
  type FlexSelection,
} from "../shared/pricing";

const personal = new Set([
  "motor",
  "health",
  "travel",
  "property",
  "life",
  "accident",
]);
function savedSelection(plan: Product) {
  try {
    return restoreSelection(
      plan,
      JSON.parse(
        sessionStorage.getItem(`bt-finder-${plan.category}`) || "null",
      ),
    );
  } catch {
    return defaultSelection(plan);
  }
}

export default function CoverFinder({
  catalog,
  selected,
  onCompare,
  onChoose,
  onFlexChange,
  icon,
}: {
  catalog: Catalog;
  selected: string[];
  onCompare: (id: string, selection?: FlexSelection) => void;
  onChoose: (product: Product, selection?: FlexSelection) => void;
  onFlexChange: (category: string, selection: FlexSelection) => void;
  icon: (category: string) => ReactNode;
}) {
  const params = new URLSearchParams(location.search);
  const [audience, setAudience] = useState(params.get("audience") || "all");
  const [category, setCategory] = useState(() =>
    catalog.categories.some(
      (c) => c.id !== "all" && c.id === params.get("category"),
    )
      ? params.get("category")!
      : "",
  );
  const [needs, setNeeds] = useState<string[]>([]);
  const [matchingOnly, setMatchingOnly] = useState(false);
  const [sort, setSort] = useState("price-low");
  const [selection, setSelection] = useState(() =>
    savedSelection(
      catalog.products.find((p) => p.category === category) ||
        catalog.products[0],
    ),
  );
  const categoryName = catalog.categories.find((c) => c.id === category)?.name;
  const categoryPlans = catalog.products.filter((p) => p.category === category);
  const features = [...new Set(categoryPlans.flatMap((p) => p.coverage))];
  const matches = (p: Product) =>
    needs.every((need) => p.coverage.includes(need));
  const plans = categoryPlans
    .filter((p) => !matchingOnly || matches(p))
    .sort((a, b) =>
      sort === "price-high"
        ? pricePlan(b, selection).premium - pricePlan(a, selection).premium
        : pricePlan(a, selection).premium - pricePlan(b, selection).premium,
    );
  const categories = catalog.categories.filter(
    (c) =>
      c.id !== "all" &&
      (audience === "all" || personal.has(c.id) === (audience === "personal")),
  );
  function selectCategory(id: string) {
    setCategory(id);
    setNeeds([]);
    setMatchingOnly(false);
    setSort("price-low");
    const plan = catalog.products.find((p) => p.category === id);
    if (plan) {
      const next = savedSelection(plan);
      setSelection(next);
      onFlexChange(id, next);
    }
    history.replaceState(
      null,
      "",
      `/find-cover?audience=${encodeURIComponent(audience)}${id ? `&category=${encodeURIComponent(id)}` : ""}`,
    );
  }
  return (
    <>
      <section className="page-banner finder-banner">
        <div className="container">
          <div className="breadcrumb">
            <a href="/">Home</a>
            <ChevronRight size={13} />
            <span>Find your cover</span>
          </div>
          <div className="eyebrow">ONE BROKER. MORE CHOICE.</div>
          <h1>Start with what matters to you.</h1>
          <p>
            Find a type of cover, choose what you need, and see the differences
            between insurers.
          </p>
          <ol className="finder-steps" aria-label="Cover selection steps">
            <li
              className={!category ? "current" : ""}
              aria-current={!category ? "step" : undefined}
            >
              <span>01</span> Choose your cover
            </li>
            <li
              className={category ? "current" : ""}
              aria-current={category ? "step" : undefined}
            >
              <span>02</span> Compare your options
            </li>
            <li>
              <span>03</span> Review & apply
            </li>
          </ol>
        </div>
      </section>
      <section className="container finder-body">
        {!category ? (
          <>
            <div className="finder-heading">
              <div>
                <h2>What would you like to protect?</h2>
                <p>Explore all 12 insurance categories.</p>
              </div>
              <a className="text-link" href="/insurance">
                Browse all sample plans <ArrowRight size={16} />
              </a>
            </div>
            <div
              className="audience-options"
              role="group"
              aria-label="Who is the cover for?"
            >
              {[
                ["all", "All insurance"],
                ["personal", "Me & my family"],
                ["business", "My business"],
              ].map(([id, name]) => (
                <button
                  key={id}
                  aria-pressed={audience === id}
                  onClick={() => {
                    setAudience(id);
                    history.replaceState(
                      null,
                      "",
                      `/find-cover?audience=${id}`,
                    );
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="finder-categories">
              {categories.map((c) => (
                <button
                  className="finder-category"
                  key={c.id}
                  onClick={() => selectCategory(c.id)}
                >
                  <span className={`product-symbol ${c.id}`}>{icon(c.id)}</span>
                  <strong>{c.name}</strong>
                  <span className="finder-description">
                    {
                      catalog.products.find((p) => p.category === c.id)
                        ?.description
                    }
                  </span>
                  <span className="finder-category-foot">
                    Explore sample plans <ArrowRight size={17} />
                  </span>
                </button>
              ))}
            </div>
            <div className="finder-note">
              <ShieldCheck size={23} />
              <div>
                <strong>Explore broadly. Compare carefully.</strong>
                <p>
                  Categories help you find a starting point. Each plan has its
                  own eligibility, limits and exclusions. All plans in this
                  preview are illustrative.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <button
              className="text-link finder-back"
              onClick={() => selectCategory("")}
            >
              <ArrowLeft size={16} /> Change insurance category
            </button>
            <div className="finder-heading">
              <div>
                <h2>{categoryName} cover, side by side.</h2>
                <p>
                  Compare {categoryPlans.length} sample plans from{" "}
                  {new Set(categoryPlans.map((p) => p.insurerId)).size}{" "}
                  demonstration insurers.
                </p>
              </div>
              <a
                className="text-link"
                href={`/insurance?category=${encodeURIComponent(category)}`}
              >
                Open catalogue <ArrowRight size={16} />
              </a>
            </div>
            <div className="finder-layout">
              <aside className="finder-needs">
                <FlexControls
                  product={categoryPlans[0]}
                  value={selection}
                  onChange={(next) => {
                    setSelection(next);
                    sessionStorage.setItem(
                      `bt-finder-${category}`,
                      JSON.stringify(next),
                    );
                    onFlexChange(category, next);
                  }}
                />
                <div className="finder-needs-separator" />
                <fieldset>
                  <legend>Filter by included features</legend>
                  <p>
                    These filters do not change a plan’s price. Plans with
                    missing features stay visible so you can understand the
                    trade-offs.
                  </p>
                  {features.map((feature) => (
                    <label key={feature}>
                      <input
                        type="checkbox"
                        checked={needs.includes(feature)}
                        onChange={() =>
                          setNeeds((current) =>
                            current.includes(feature)
                              ? current.filter((n) => n !== feature)
                              : [...current, feature],
                          )
                        }
                      />
                      <span>{feature}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="finder-needs-separator" />
                <label className="finder-matching">
                  <input
                    type="checkbox"
                    checked={matchingOnly}
                    onChange={(e) => setMatchingOnly(e.target.checked)}
                  />{" "}
                  Matching plans only
                </label>
                <button
                  className="text-button"
                  onClick={() => {
                    setNeeds([]);
                    setMatchingOnly(false);
                  }}
                >
                  Reset needs
                </button>
                <div className="finder-advice">
                  <Info size={18} />
                  <p>
                    A match means the sample plan lists your selected features.
                    It is not a suitability recommendation or confirmation of
                    cover.
                  </p>
                </div>
              </aside>
              <div className="finder-results">
                <div className="finder-toolbar">
                  <p role="status">
                    <strong>{plans.length}</strong> sample plans ·{" "}
                    {categoryPlans.filter(matches).length} match your needs
                  </p>
                  <label>
                    <span className="sr-only">Sort matching plans</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="price-low">Premium: low to high</option>
                      <option value="price-high">Premium: high to low</option>
                    </select>
                  </label>
                </div>
                <div className="demo-inline">
                  <Info size={16} />
                  <span>
                    Live sample estimates for your selected cover. No sponsored
                    ranking. The server validates the same selection when you
                    save a quote.
                  </span>
                </div>
                {plans.map((p) => {
                  const pricing = pricePlan(p, selection);
                  return (
                    <article className="finder-offer" key={p.id}>
                      <div className="finder-offer-heading">
                        <div>
                          <div className="insurer-line">
                            <span className={`insurer-avatar ${p.insurerId}`}>
                              {p.insurer.slice(-1)}
                            </span>
                            {p.insurer}
                          </div>
                          <h3>{p.name}</h3>
                        </div>
                        <span className="sample-badge">SAMPLE PLAN</span>
                      </div>
                      {needs.length > 0 && (
                        <div
                          className={`finder-match ${matches(p) ? "matched" : "missing"}`}
                        >
                          {matches(p) ? (
                            <>
                              <Check size={15} /> Lists all selected features
                            </>
                          ) : (
                            <>
                              <Info size={15} /> Missing:{" "}
                              {needs
                                .filter((n) => !p.coverage.includes(n))
                                .join("; ")}
                            </>
                          )}
                        </div>
                      )}
                      <div className="finder-offer-body">
                        <div>
                          <ul className="coverage-list">
                            {[
                              ...p.coverage,
                              ...pricing.addons.map((addon) => addon.name),
                            ].map((feature) => (
                              <li key={feature}>
                                <Check size={15} />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                          <dl>
                            <div>
                              <dt>Limit</dt>
                              <dd>{selectedLimit(p, selection)}</dd>
                            </div>
                            <div>
                              <dt>Deductible</dt>
                              <dd>{p.deductible}</dd>
                            </div>
                            <div>
                              <dt>Key exclusions</dt>
                              <dd>{p.exclusion}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="finder-offer-price">
                          <span>Your sample premium</span>
                          <strong
                            aria-live="polite"
                            aria-label={`${p.name} premium`}
                          >
                            {money(pricing.premium)}
                          </strong>
                          <span>
                            {p.period === "day"
                              ? `for ${selection.days} days`
                              : "per year"}
                          </span>
                          <dl className="flex-price-breakdown">
                            <div>
                              <dt>Base cover</dt>
                              <dd>{money(pricing.base)}</dd>
                            </div>
                            {pricing.addons.map((addon) => (
                              <div key={addon.id}>
                                <dt>{addon.name}</dt>
                                <dd>+ {money(addon.premium)}</dd>
                              </div>
                            ))}
                          </dl>
                          <button
                            className="button primary small"
                            onClick={() => onChoose(p, selection)}
                          >
                            Review plan <ArrowRight size={16} />
                          </button>
                          <label className="compare-checkbox">
                            <input
                              type="checkbox"
                              checked={selected.includes(p.id)}
                              onChange={() => onCompare(p.id, selection)}
                              aria-label={`Compare ${p.name}`}
                            />{" "}
                            Add to comparison
                          </label>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!plans.length && (
                  <div className="empty-state">
                    <h3>No sample plan includes every selected feature.</h3>
                    <p>
                      Adjust your needs or show all plans to review the
                      differences.
                    </p>
                    <button
                      className="button light"
                      onClick={() => setMatchingOnly(false)}
                    >
                      Show all plans
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
