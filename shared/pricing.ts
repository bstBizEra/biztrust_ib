export interface FlexSelection {
  coverageAmount: number;
  addons: string[];
  age: number;
  days: number;
}
export interface FlexConfig {
  label: string;
  baseAmount: number;
  min: number;
  max: number;
  step: number;
  addons: { id: string; name: string; ratePercent: number }[];
}
interface RateablePlan {
  category: string;
  basePremium: number;
  period: string;
  flex: FlexConfig;
}

// Synthetic fixtures only. Live insurer rating and wording must replace these together.
const definitions: Record<string, [string, number, string, string]> = {
  motor: [
    "Vehicle value",
    200000000,
    "Windscreen benefit",
    "Passenger accident benefit",
  ],
  health: [
    "Annual medical limit",
    150000000,
    "Outpatient consultations",
    "Prescribed medicines benefit",
  ],
  travel: [
    "Emergency medical limit",
    300000000,
    "Baggage benefit",
    "Personal belongings benefit",
  ],
  property: [
    "Building value",
    500000000,
    "Contents benefit",
    "Alternative accommodation benefit",
  ],
  life: [
    "Life benefit",
    200000000,
    "Accidental death benefit",
    "Premium waiver benefit",
  ],
  accident: [
    "Accident benefit",
    100000000,
    "Hospital cash benefit",
    "Recovery assistance benefit",
  ],
  business: [
    "Combined business limit",
    1000000000,
    "Equipment benefit",
    "Money in transit benefit",
  ],
  liability: [
    "Liability limit",
    500000000,
    "Product liability extension",
    "Tenant liability extension",
  ],
  cargo: [
    "Cargo value",
    250000000,
    "Temporary storage extension",
    "Loading and unloading extension",
  ],
  engineering: [
    "Contract value",
    2000000000,
    "Construction equipment extension",
    "Debris removal benefit",
  ],
  agriculture: [
    "Crop value",
    100000000,
    "Replanting benefit",
    "Harvest transport benefit",
  ],
  marine: [
    "Specialist cover limit",
    2000000000,
    "Salvage expenses benefit",
    "Emergency towing benefit",
  ],
};
export function flexConfig(category: string, tier: number): FlexConfig {
  const [label, baseAmount, first, second] = definitions[category];
  return {
    label,
    baseAmount,
    min: baseAmount / 2,
    max: baseAmount * 2,
    step: baseAmount / 4,
    addons: [
      { id: `${category}-extra-1`, name: first, ratePercent: tier ? 6 : 8 },
      { id: `${category}-extra-2`, name: second, ratePercent: tier ? 10 : 12 },
    ],
  };
}
export function defaultSelection(product: RateablePlan): FlexSelection {
  return {
    coverageAmount: product.flex.baseAmount,
    addons: [],
    age: 30,
    days: 7,
  };
}
export function pricePlan(product: RateablePlan, selection: FlexSelection) {
  const { flex } = product;
  if (
    !Number.isSafeInteger(selection.coverageAmount) ||
    selection.coverageAmount < flex.min ||
    selection.coverageAmount > flex.max ||
    (selection.coverageAmount - flex.min) % flex.step !== 0
  )
    throw new Error(
      "Choose a coverage amount within this plan’s slider range and increments.",
    );
  if (
    !Number.isInteger(selection.age) ||
    selection.age < 18 ||
    selection.age > 70 ||
    !Number.isInteger(selection.days) ||
    selection.days < 1 ||
    selection.days > 90
  )
    throw new Error("Enter a valid age and duration for this demonstration.");
  if (
    !Array.isArray(selection.addons) ||
    new Set(selection.addons).size !== selection.addons.length ||
    selection.addons.some((id) => !flex.addons.some((addon) => addon.id === id))
  )
    throw new Error(
      "One or more optional benefits are unavailable for this plan.",
    );
  const units = product.period === "day" ? selection.days : 1;
  const agePercent =
    selection.age > 60 &&
    ["health", "life", "travel"].includes(product.category)
      ? 125
      : 100;
  const base = Math.round(
    (product.basePremium *
      (selection.coverageAmount / flex.baseAmount) *
      units *
      agePercent) /
      100,
  );
  const addons = flex.addons
    .filter((addon) => selection.addons.includes(addon.id))
    .map((addon) => ({
      ...addon,
      premium: Math.round((base * addon.ratePercent) / 100),
    }));
  return {
    base,
    addons,
    premium: base + addons.reduce((sum, addon) => sum + addon.premium, 0),
    units,
  };
}
export function selectedLimit(product: RateablePlan, selection: FlexSelection) {
  return `${product.flex.label}: ₭${selection.coverageAmount.toLocaleString("en-US")}`;
}
// Stored browser choices are untrusted; obsolete or corrupt settings revert to defaults.
export function restoreSelection(
  product: RateablePlan,
  value: unknown,
): FlexSelection {
  try {
    const selection = value as FlexSelection;
    pricePlan(product, selection);
    return {
      coverageAmount: selection.coverageAmount,
      addons: [...selection.addons],
      age: selection.age,
      days: selection.days,
    };
  } catch {
    return defaultSelection(product);
  }
}
