import { useId } from "react";
import { money, type Product } from "./api";
import { type FlexSelection, defaultSelection } from "../shared/pricing";

export default function FlexControls({
  product,
  value,
  onChange,
  applicant = true,
}: {
  product: Product;
  value: FlexSelection;
  onChange: (value: FlexSelection) => void;
  applicant?: boolean;
}) {
  const id = useId();
  const config = product.flex;
  return (
    <div className="flex-controls">
      <div className="flex-title">
        <h3>Flex your cover</h3>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            onChange({
              ...defaultSelection(product),
              ...(!applicant ? { age: value.age, days: value.days } : {}),
            })
          }
        >
          Reset cover
        </button>
      </div>
      <p>
        Move the slider or add optional benefits. Each plan’s sample price
        updates immediately.
      </p>
      <label htmlFor={`${id}-amount`} className="flex-range-label">
        <span>{config.label}</span>
        <strong>{money(value.coverageAmount)}</strong>
      </label>
      <input
        id={`${id}-amount`}
        aria-label="Coverage amount"
        aria-valuetext={money(value.coverageAmount)}
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={value.coverageAmount}
        onChange={(e) =>
          onChange({ ...value, coverageAmount: Number(e.target.value) })
        }
      />
      <div className="flex-range-ends">
        <span>{money(config.min)}</span>
        <span>{money(config.max)}</span>
      </div>
      {applicant &&
        ["health", "life", "travel", "accident"].includes(product.category) && (
          <>
            <label htmlFor={`${id}-age`} className="flex-range-label">
              <span>Applicant age</span>
              <strong>{value.age} years</strong>
            </label>
            <input
              id={`${id}-age`}
              type="range"
              min={18}
              max={70}
              step={1}
              value={value.age}
              onChange={(e) =>
                onChange({ ...value, age: Number(e.target.value) })
              }
            />
          </>
        )}
      {applicant && product.period === "day" && (
        <>
          <label htmlFor={`${id}-days`} className="flex-range-label">
            <span>Trip duration</span>
            <strong>{value.days} days</strong>
          </label>
          <input
            id={`${id}-days`}
            type="range"
            min={1}
            max={90}
            step={1}
            value={value.days}
            onChange={(e) =>
              onChange({ ...value, days: Number(e.target.value) })
            }
          />
        </>
      )}
      <fieldset className="flex-addons">
        <legend>Optional cover · changes price</legend>
        {config.addons.map((addon) => (
          <label key={addon.id}>
            <input
              type="checkbox"
              checked={value.addons.includes(addon.id)}
              onChange={() =>
                onChange({
                  ...value,
                  addons: value.addons.includes(addon.id)
                    ? value.addons.filter((id) => id !== addon.id)
                    : [...value.addons, addon.id],
                })
              }
            />
            <span>{addon.name}</span>
          </label>
        ))}
      </fieldset>
      <p className="flex-footnote">
        Optional benefit prices vary by plan and appear in its breakdown. All
        rating rules and benefits are demonstration examples.
      </p>
    </div>
  );
}
