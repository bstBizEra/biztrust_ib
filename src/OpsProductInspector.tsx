import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type {
  OperationsProduct,
  OperationsProductsResponse,
  ProductPreviewInput,
  ProductPreviewResponse,
} from "../shared/operations-products";
import { defaultSelection, type FlexSelection } from "../shared/pricing";

const money = (value: number) =>
  `LAK ${new Intl.NumberFormat("en-GB").format(value)}`;
const categoryName = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

class InspectionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new InspectionError(
      response.status === 409
        ? "The product or rating version changed. Refresh products before previewing again."
        : (data?.error?.message ??
            "The product service could not complete this request. Please try again."),
      response.status,
    );
  }
  if (!data)
    throw new Error(
      "The product service returned an unreadable response. Please try again.",
    );
  return data as T;
}

function ProductDetail({
  product,
  csrf,
  onExpired,
  onReload,
}: {
  product: OperationsProduct;
  csrf: string;
  onExpired: () => void;
  onReload: () => void;
}) {
  const id = useId();
  const [selection, setSelection] = useState<FlexSelection>(() =>
    defaultSelection(product),
  );
  const [result, setResult] = useState<ProductPreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  function change(next: FlexSelection) {
    pending.current?.abort();
    setSelection(next);
    setResult(null);
    setError("");
    setBusy(false);
  }

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setResult(null);
    setError("");
    const input: ProductPreviewInput = {
      productVersion: product.productVersion,
      ruleVersion: product.ruleVersion,
      ...selection,
    };
    try {
      const data = await request<ProductPreviewResponse>(
        `/ops/v1/products/${encodeURIComponent(product.id)}/preview`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify(input),
        },
      );
      if (controller.signal.aborted) return;
      if (
        !data.synthetic ||
        !data.previewOnly ||
        data.mode !== "preview" ||
        data.productId !== product.id ||
        data.productVersion !== product.productVersion ||
        data.ruleVersion !== product.ruleVersion
      ) {
        throw new Error(
          "The preview does not match this synthetic product version. Refresh products and try again.",
        );
      }
      setResult(data);
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof InspectionError && failure.status === 401)
        onExpired();
      if (failure instanceof InspectionError && failure.status === 409)
        setStale(true);
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not calculate the sample premium.",
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <section
      className="ops-panel ops-product-detail"
      aria-labelledby={`${id}-title`}
    >
      <div>
        <span className="ops-eyebrow">SYNTHETIC PRODUCT · READ ONLY</span>
        <h2 id={`${id}-title`}>{product.name}</h2>
        <p>{product.description}</p>
      </div>
      <dl className="ops-product-metadata">
        <div>
          <dt>Insurer</dt>
          <dd>{product.insurer}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{categoryName(product.category)}</dd>
        </div>
        <div>
          <dt>Product version</dt>
          <dd>{product.productVersion}</dd>
        </div>
        <div>
          <dt>Rating rule version</dt>
          <dd>{product.ruleVersion}</dd>
        </div>
        <div>
          <dt>Effective dates</dt>
          <dd>
            {product.effectiveFrom} – {product.effectiveTo}
          </dd>
        </div>
        <div>
          <dt>Demo availability</dt>
          <dd>
            {product.demoAvailable
              ? "Available in demo only"
              : "Unavailable in demo"}
          </dd>
        </div>
        <div>
          <dt>Sample base premium</dt>
          <dd>
            {money(product.basePremium)} / {product.period}
          </dd>
        </div>
        <div>
          <dt>Base coverage amount</dt>
          <dd>{money(product.flex.baseAmount)}</dd>
        </div>
      </dl>
      <dl className="ops-product-facts">
        <div>
          <dt>Coverage</dt>
          <dd>
            <ul>
              {product.coverage.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Limit</dt>
          <dd>{product.limit}</dd>
        </div>
        <div>
          <dt>Exclusions</dt>
          <dd>{product.exclusion}</dd>
        </div>
        <div>
          <dt>Deductible</dt>
          <dd>{product.deductible}</dd>
        </div>
        <div>
          <dt>Sample eligibility</dt>
          <dd>{product.eligibility}</dd>
        </div>
        <div>
          <dt>Conditions</dt>
          <dd>{product.conditions}</dd>
        </div>
      </dl>
      <p className="ops-product-source">
        <strong>Source:</strong> {product.source}. Demo availability is not
        insurer or publication approval.
      </p>
      <form
        className="ops-product-controls"
        onSubmit={(event) => void preview(event)}
        aria-label="Synthetic rating preview"
      >
        <div>
          <h3>Sample rating preview</h3>
          <p>
            Change sample inputs, then calculate with the server. No quote,
            application, payment or insurance cover is created.
          </p>
        </div>
        <div>
          <div className="ops-product-range-label">
            <label htmlFor={`${id}-coverage`}>Sample coverage amount</label>
            <output htmlFor={`${id}-coverage`}>
              {money(selection.coverageAmount)}
            </output>
          </div>
          <input
            id={`${id}-coverage`}
            type="range"
            min={product.flex.min}
            max={product.flex.max}
            step={product.flex.step}
            value={selection.coverageAmount}
            aria-valuetext={money(selection.coverageAmount)}
            onChange={(event) =>
              change({
                ...selection,
                coverageAmount: Number(event.target.value),
              })
            }
          />
          <p>
            {money(product.flex.min)} to {money(product.flex.max)} · steps of{" "}
            {money(product.flex.step)}
          </p>
        </div>
        <div className="ops-product-inputs">
          <label htmlFor={`${id}-age`}>
            Sample applicant age
            <input
              id={`${id}-age`}
              type="number"
              min={18}
              max={70}
              step={1}
              required
              value={selection.age}
              onChange={(event) =>
                change({ ...selection, age: Number(event.target.value) })
              }
            />
          </label>
          {product.period === "day" && (
            <label htmlFor={`${id}-days`}>
              Sample trip days
              <input
                id={`${id}-days`}
                type="number"
                min={1}
                max={90}
                step={1}
                required
                value={selection.days}
                onChange={(event) =>
                  change({ ...selection, days: Number(event.target.value) })
                }
              />
            </label>
          )}
        </div>
        <fieldset>
          <legend>Optional sample benefits</legend>
          {product.flex.addons.map((addon) => (
            <label className="ops-product-addon" key={addon.id}>
              <input
                type="checkbox"
                checked={selection.addons.includes(addon.id)}
                onChange={() =>
                  change({
                    ...selection,
                    addons: selection.addons.includes(addon.id)
                      ? selection.addons.filter((value) => value !== addon.id)
                      : [...selection.addons, addon.id],
                  })
                }
              />
              <span>
                {addon.name}{" "}
                <small>({addon.ratePercent}% of calculated base)</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="ops-product-actions">
          <button
            className="ops-button ops-button-primary"
            type="submit"
            disabled={busy || stale || !product.demoAvailable}
          >
            {busy ? "Calculating sample…" : "Calculate sample premium"}
          </button>
          <button
            className="ops-button"
            type="button"
            onClick={() => change(defaultSelection(product))}
          >
            Reset sample inputs
          </button>
          {stale && (
            <button className="ops-button" type="button" onClick={onReload}>
              Refresh products
            </button>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        <div role="status" aria-live="polite" aria-atomic="true">
          {busy
            ? "Calculating the sample premium…"
            : result
              ? `Sample preview ready. Total ${money(result.total)}. Not an offer or insurance cover.`
              : "No current preview. Calculate after changing the sample inputs."}
        </div>
      </form>
      {result && (
        <section
          className="ops-product-result"
          aria-label="Sample premium breakdown"
        >
          <h3>Sample premium breakdown</h3>
          <p>
            {result.productVersion} · {result.ruleVersion}
          </p>
          <dl>
            <div>
              <dt>Calculated base</dt>
              <dd>{money(result.breakdown.base)}</dd>
            </div>
            {result.breakdown.addons.map((addon) => (
              <div key={addon.id}>
                <dt>{addon.name}</dt>
                <dd>{money(addon.premium)}</dd>
              </div>
            ))}
            <div>
              <dt>Premium</dt>
              <dd>{money(result.premium)}</dd>
            </div>
            <div>
              <dt>Fee</dt>
              <dd>{money(result.fee)}</dd>
            </div>
            <div className="ops-product-total">
              <dt>Sample total</dt>
              <dd>{money(result.total)}</dd>
            </div>
          </dl>
          <p>
            Preview only. Nothing is saved. This is not an offer, approved rate
            or proof of coverage.
          </p>
        </section>
      )}
    </section>
  );
}

export default function OpsProductInspector({
  csrf,
  revision,
  onExpired,
}: {
  csrf: string;
  revision: number;
  onExpired: () => void;
}) {
  const filterId = useId();
  const [catalog, setCatalog] = useState<OperationsProductsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [category, setCategory] = useState("");
  const [insurer, setInsurer] = useState("");
  const [selected, setSelected] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setCatalog(null);
    setError("");
    request<OperationsProductsResponse>("/ops/v1/products", {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (
          !data.synthetic ||
          data.mode !== "inspection" ||
          !Array.isArray(data.products)
        )
          throw new Error("Synthetic product inspection is unavailable.");
        setCatalog(data);
        setSelected("");
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure instanceof InspectionError && failure.status === 401)
          onExpired();
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not load synthetic products.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision, retry, onExpired]);

  const products = catalog?.products ?? [];
  const categories = [...new Set(products.map((product) => product.category))];
  const insurers = [
    ...new Map(
      products.map((product) => [product.insurerId, product.insurer]),
    ).entries(),
  ];
  const visible = products.filter(
    (product) =>
      (!category || product.category === category) &&
      (!insurer || product.insurerId === insurer),
  );
  const product = visible.find((item) => item.id === selected);
  function resetFilters() {
    setCategory("");
    setInsurer("");
    setSelected("");
  }

  return (
    <div className="ops-products">
      <div className="ops-environment">
        <span>
          <strong>Synthetic inspection only.</strong> These shared fixtures are
          not tenant-owned governance records. No product edits, publication,
          approved offers or insurance cover.
        </span>
      </div>
      {loading ? (
        <p className="ops-product-message" role="status">
          Loading synthetic products…
        </p>
      ) : error ? (
        <div className="ops-panel ops-product-message">
          <p role="alert">{error}</p>
          <button
            className="ops-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry products
          </button>
        </div>
      ) : (
        <>
          <div className="ops-panel ops-product-filters">
            <div>
              <label htmlFor={`${filterId}-category`}>Product category</label>
              <select
                id={`${filterId}-category`}
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setSelected("");
                }}
              >
                <option value="">All categories</option>
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {categoryName(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${filterId}-insurer`}>Demo insurer</label>
              <select
                id={`${filterId}-insurer`}
                value={insurer}
                onChange={(event) => {
                  setInsurer(event.target.value);
                  setSelected("");
                }}
              >
                <option value="">All demo insurers</option>
                {insurers.map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <button className="ops-button" onClick={resetFilters}>
              Reset product filters
            </button>
          </div>
          <p role="status">
            {visible.length} of {products.length} synthetic products shown
          </p>
          {!visible.length ? (
            <div className="ops-panel ops-product-message">
              <h2>No synthetic products found</h2>
              <p>
                {products.length
                  ? "Try another category or insurer, or reset the filters."
                  : "No synthetic fixtures are available. Refresh products to check again."}
              </p>
              <button
                className="ops-button"
                onClick={
                  products.length
                    ? resetFilters
                    : () => setRetry((value) => value + 1)
                }
              >
                {products.length ? "Show all products" : "Refresh products"}
              </button>
            </div>
          ) : (
            <div className="ops-product-layout">
              <section
                className="ops-panel"
                aria-label="Synthetic product list"
              >
                <div className="ops-panel-heading">
                  <h2>Synthetic products</h2>
                </div>
                <div className="ops-product-list">
                  {visible.map((item) => (
                    <button
                      className="ops-product-choice"
                      key={item.id}
                      aria-pressed={selected === item.id}
                      onClick={() => setSelected(item.id)}
                    >
                      <strong>{item.name}</strong>
                      <span>{item.insurer}</span>
                      <span>{item.productVersion}</span>
                    </button>
                  ))}
                </div>
              </section>
              {product ? (
                <ProductDetail
                  key={`${product.id}:${product.productVersion}:${product.ruleVersion}`}
                  product={product}
                  csrf={csrf}
                  onExpired={onExpired}
                  onReload={() => setRetry((value) => value + 1)}
                />
              ) : (
                <div className="ops-panel ops-product-message">
                  <h2>Choose a synthetic product</h2>
                  <p>
                    Inspect its terms, versions and rating inputs, then
                    calculate a sample premium.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
