import type { Product } from "../server/catalog";
import type { FlexSelection } from "../shared/pricing";
export type { Product };
export interface Category {
  id: string;
  name: string;
  short: string;
}
export interface Insurer {
  id: string;
  name: string;
  initials: string;
  color: string;
}
export interface Catalog {
  categories: Category[];
  insurers: Insurer[];
  products: Product[];
}
export interface Session {
  user: { name: string; role: string; mode: string } | null;
  csrf: string;
  demo: boolean;
  oidcConfigured: boolean;
}
export interface Quote {
  id: string;
  product: Product;
  input: FlexSelection & { productId: string };
  breakdown: {
    base: number;
    addons: { id: string; name: string; premium: number }[];
  };
  premium: number;
  fee: number;
  total: number;
  currency: string;
  expiresAt: string;
}
export interface ApplicationSummary {
  reference: string;
  product_snapshot: Product;
  insurer_status: string;
  status: string;
  created_at: string;
  amount: string;
  currency: string;
  payment_status: string;
  expires_at: string;
}
export interface ApplicationDetail {
  application: {
    reference: string;
    product_snapshot: Product;
    insurer_status: string;
    created_at: string;
    customer: { fullName: string; email: string };
    evidence: null | { reference: string };
  };
  invoice: {
    id: string;
    status: string;
    amount: string;
    currency: string;
    expires_at: string;
  };
  quote: { premium: string; fee: string; total: string };
  history: {
    action: string;
    created_at: string;
    detail: Record<string, unknown>;
  }[];
}
let csrf = "";
export async function api<T>(
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(`/api${url}`, {
    credentials: "same-origin",
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-CSRF-Token": csrf }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error?.message ||
        "We could not complete this request. Please try again.",
    );
  if (data.csrf) csrf = data.csrf;
  return data as T;
}
export const money = (amount: number | string) =>
  `₭${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(amount))}`;
export const date = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const statusLabel = (value: string) =>
  ({
    awaiting_payment: "Awaiting payment",
    queued: "Ready for insurer",
    processing: "Insurer reviewing",
    referred: "Referred for review",
    additional_information: "Information requested",
    rejected: "Not accepted",
    issued: "Demo document available",
    timeout: "Response delayed",
    pending: "Payment pending",
    settled: "Demo payment verified",
    failed: "Payment unsuccessful",
    expired: "Payment expired",
    reconciliation_required: "Payment under review",
  })[value] || value.replaceAll("_", " ");
