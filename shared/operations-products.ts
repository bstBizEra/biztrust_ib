import type { FlexConfig, FlexSelection } from "./pricing.ts";

export interface OperationsProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  insurerId: string;
  insurer: string;
  productVersion: string;
  ruleVersion: string;
  effectiveFrom: string;
  effectiveTo: string;
  synthetic: true;
  demoAvailable: boolean;
  source: string;
  eligibility: string;
  conditions: string;
  coverage: string[];
  limit: string;
  exclusion: string;
  deductible: string;
  basePremium: number;
  period: "day" | "year";
  flex: FlexConfig;
}

export interface OperationsProductsResponse {
  synthetic: true;
  mode: "inspection";
  products: OperationsProduct[];
}

export interface ProductPreviewInput {
  productVersion: string;
  ruleVersion: string;
  age: number;
  days?: number;
  coverageAmount?: number;
  addons?: string[];
}

export interface ProductPreviewResponse {
  synthetic: true;
  previewOnly: true;
  mode: "preview";
  productId: string;
  productVersion: string;
  ruleVersion: string;
  input: FlexSelection;
  breakdown: {
    base: number;
    addons: {
      id: string;
      name: string;
      ratePercent: number;
      premium: number;
    }[];
  };
  premium: number;
  fee: number;
  total: number;
  currency: "LAK";
}
