import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  FileText,
  Fingerprint,
  FlaskConical,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Unplug,
  X,
  type LucideIcon,
} from "lucide-react";
import "./ops-console.css";
import OpsProductInspector from "./OpsProductInspector";

interface StaffSession {
  authenticated: boolean;
  tenant?: string;
  role?: string;
  csrf: string;
  synthetic: boolean;
  identityConfigured: boolean;
  demoAvailable: boolean;
}
interface Overview {
  tenant: string;
  asOf: string;
  summary: {
    awaitingAction: number;
    paymentPending: number;
    paymentExpired: number;
    paymentExceptions: number;
    insurerTimeouts: number;
  };
  integration: {
    payment: string;
    insurer: string;
    verifiedExceptionEvents: number;
    outbox: Record<string, number>;
  };
  synthetic: boolean;
}
interface CaseRow {
  caseId: string;
  reference: string;
  productId: string;
  productVersion: string;
  insurerStatus: string;
  paymentStatus: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}
interface ExceptionProjection {
  tenant: string;
  asOf: string;
  count: number;
  limit: number;
  truncated: boolean;
  cases: CaseRow[];
  synthetic: boolean;
}
interface Evidence {
  tenant: string;
  caseId: string;
  reference: string;
  productId: string;
  productVersion: string;
  insurerStatus: string;
  insurerReference: string | null;
  payment: {
    status: string;
    amountMinor: number;
    currency: string;
    expiresAt: string;
  };
  createdAt: string;
  updatedAt: string;
  timeline: { source: string; action: string; at: string; eventId?: string }[];
  outbox: {
    id: string;
    kind: string;
    status: string;
    attempts: number;
    created_at: string;
    updated_at: string;
  }[];
  synthetic: boolean;
}
interface Integrations {
  asOf: string;
  adapters: {
    name: string;
    environment: string;
    status: string;
    credentialStatus: string;
  }[];
  retryRequired: number;
  oldestRetryAt: string | null;
  paymentInbox: {
    received: number;
    failed: number;
    processed: number;
    oldestPendingAt: string | null;
  };
  synthetic: boolean;
}
interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string;
}
type Page =
  "overview" | "products" | "cases" | "payments" | "integrations" | "system";
const pages: {
  id: Page;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Your operating picture, with the evidence behind every case.",
  },
  {
    id: "products",
    label: "Products & rating",
    icon: Layers3,
    description:
      "Inspect synthetic product versions and preview sample pricing without saving records.",
  },
  {
    id: "cases",
    label: "Cases",
    icon: FileText,
    description: "Follow applications from payment through insurer response.",
  },
  {
    id: "payments",
    label: "Payments",
    icon: CreditCard,
    description: "Review payment states and trace verified event evidence.",
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Unplug,
    description: "Inspect adapter availability and work awaiting retry.",
  },
  {
    id: "system",
    label: "System health",
    icon: Activity,
    description:
      "Inspect your session, service responses, and processing queues.",
  },
];
const caseStatuses = [
  "awaiting_payment",
  "queued",
  "processing",
  "referred",
  "additional_information",
  "rejected",
  "issued",
  "timeout",
];
const paymentStatuses = [
  "pending",
  "failed",
  "settled",
  "reconciliation_required",
  "expired",
];
const labels: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  queued: "Queued for insurer",
  processing: "Insurer processing",
  referred: "Referred for review",
  additional_information: "Information requested",
  rejected: "Rejected",
  issued: "Issued",
  timeout: "Response delayed",
  pending: "Pending",
  settled: "Settled",
  failed: "Failed",
  reconciliation_required: "Reconciliation required",
  expired: "Expired",
  simulator_only: "Simulator only",
  local_only: "Local credentials",
  not_applicable: "Not applicable",
  retry_required: "Retry required",
  completed: "Completed",
};
const label = (value: string) =>
  labels[value] ?? value.replaceAll("_", " ").replaceAll(".", " · ");
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const amount = (value: number, currency: string) =>
  `${currency} ${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value)}`;
class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
  });
  const data =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new RequestError(
      data?.error?.message ??
        "The operations service could not complete this request. Please try again.",
      response.status,
    );
  return data as T;
}
function useResource<T>(
  path: string | null,
  revision: number,
  onExpired: () => void,
): Resource<T> {
  const [state, setState] = useState<Resource<T>>({
    data: null,
    loading: false,
    error: "",
  });
  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, loading: true, error: "" });
    request<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, loading: false, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof RequestError && error.status === 401) onExpired();
        setState({
          data: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not load operations data.",
        });
      });
    return () => controller.abort();
  }, [path, revision, onExpired]);
  return state;
}
function Status({ value }: { value: string }) {
  const tone = [
    "failed",
    "rejected",
    "timeout",
    "reconciliation_required",
    "retry_required",
  ].includes(value)
    ? "attention"
    : ["settled", "issued", "completed"].includes(value)
      ? "success"
      : "neutral";
  return (
    <span className={`ops-status ops-status-${tone}`}>
      <span aria-hidden="true" />
      {label(value)}
    </span>
  );
}
function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`ops-notice ${error ? "ops-notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <CircleAlert size={17} />
      <span>{children}</span>
    </div>
  );
}
function Loading({
  children = "Loading operations data…",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="ops-loading" role="status">
      <RefreshCw size={18} className="ops-spin" />
      {children}
    </div>
  );
}
function Metric({
  title,
  value,
  description,
  icon: Icon,
  onInspect,
}: {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
  onInspect?: () => void;
}) {
  return (
    <article className="ops-metric">
      <div>
        <span>{title}</span>
        <Icon size={18} />
      </div>
      <strong>{value.toLocaleString()}</strong>
      <p>{description}</p>
      {onInspect && (
        <button
          className="ops-text-button"
          onClick={onInspect}
          aria-label={`Inspect ${title.toLowerCase()}`}
        >
          Inspect cases <ArrowRight size={15} />
        </button>
      )}
    </article>
  );
}
function CaseTable({
  rows,
  onSelect,
  emptyDescription = "Cases will appear here when an application is submitted in this tenant. Try clearing your filters.",
}: {
  rows: CaseRow[];
  onSelect: (id: string) => void;
  emptyDescription?: string;
}) {
  if (!rows.length)
    return (
      <div className="ops-empty">
        <FileText size={28} />
        <h3>No matching cases</h3>
        <p>{emptyDescription}</p>
      </div>
    );
  return (
    <div className="ops-table-scroll">
      <table className="ops-table">
        <thead>
          <tr>
            <th scope="col">Case / product</th>
            <th scope="col">Insurer status</th>
            <th scope="col">Payment</th>
            <th scope="col">Amount</th>
            <th scope="col">Updated</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.caseId}>
              <td>
                <button
                  className="ops-case-link"
                  onClick={() => onSelect(row.caseId)}
                >
                  {row.reference}
                </button>
                <span className="ops-table-secondary">
                  {row.productId} · v{row.productVersion}
                </span>
              </td>
              <td>
                <Status value={row.insurerStatus} />
              </td>
              <td>
                <Status value={row.paymentStatus} />
              </td>
              <td className="ops-number">
                {amount(row.amountMinor, row.currency)}
              </td>
              <td className="ops-table-date">{timestamp(row.updatedAt)}</td>
              <td>
                <button
                  className="ops-icon-button"
                  aria-label={`View ${row.reference}`}
                  onClick={() => onSelect(row.caseId)}
                >
                  <ChevronRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function EvidenceDialog({
  caseId,
  revision,
  onClose,
  onExpired,
}: {
  caseId: string;
  revision: number;
  onClose: () => void;
  onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [retry, setRetry] = useState(0);
  const { data, loading, error } = useResource<Evidence>(
    `/ops/v1/cases/${encodeURIComponent(caseId)}`,
    revision + retry,
    onExpired,
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="ops-dialog"
      aria-labelledby="ops-evidence-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <header className="ops-dialog-header">
        <div>
          <span className="ops-eyebrow">Case evidence</span>
          <h2 id="ops-evidence-title">
            {data?.reference ?? "Application detail"}
          </h2>
        </div>
        <button
          className="ops-icon-button"
          onClick={onClose}
          aria-label="Close case evidence"
        >
          <X size={21} />
        </button>
      </header>
      <div className="ops-dialog-body">
        {loading && <Loading>Loading case evidence…</Loading>}
        {error && (
          <>
            <Notice error>{error}</Notice>
            <button
              className="ops-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry evidence
            </button>
          </>
        )}
        {data && (
          <>
            {data.synthetic && (
              <div className="ops-demo-inline">
                <FlaskConical size={15} />
                Synthetic demonstration evidence
              </div>
            )}
            <div className="ops-detail-states">
              <Status value={data.insurerStatus} />
              <Status value={data.payment.status} />
            </div>
            <dl className="ops-detail-grid">
              <div>
                <dt>Product version</dt>
                <dd>
                  {data.productId} · v{data.productVersion}
                </dd>
              </div>
              <div>
                <dt>Invoice amount</dt>
                <dd>
                  {amount(data.payment.amountMinor, data.payment.currency)}
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{timestamp(data.createdAt)}</dd>
              </div>
              <div>
                <dt>Payment expiry</dt>
                <dd>{timestamp(data.payment.expiresAt)}</dd>
              </div>
              <div>
                <dt>Insurer reference</dt>
                <dd>{data.insurerReference ?? "Not yet available"}</dd>
              </div>
              <div>
                <dt>Tenant</dt>
                <dd className="ops-break">{data.tenant}</dd>
              </div>
            </dl>
            <section className="ops-detail-section">
              <h3>
                <Clock3 size={17} />
                Evidence timeline
              </h3>
              {data.timeline.length ? (
                <ol className="ops-timeline">
                  {data.timeline.map((event, index) => (
                    <li key={`${event.at}-${event.action}-${index}`}>
                      <span className="ops-timeline-dot" />
                      <div>
                        <strong>{label(event.action)}</strong>
                        <p>{label(event.source)}</p>
                        {event.eventId && (
                          <code className="ops-break">
                            Event {event.eventId}
                          </code>
                        )}
                      </div>
                      <time dateTime={event.at}>{timestamp(event.at)}</time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="ops-muted">
                  No audit events recorded for this case.
                </p>
              )}
            </section>
            <section className="ops-detail-section">
              <h3>
                <Layers3 size={17} />
                Delivery outbox
              </h3>
              {data.outbox.length ? (
                <div className="ops-work-list">
                  {data.outbox.map((work) => (
                    <div key={work.id}>
                      <div>
                        <strong>{label(work.kind)}</strong>
                        <p>
                          {work.attempts} attempt
                          {work.attempts === 1 ? "" : "s"} ·{" "}
                          {timestamp(work.updated_at)}
                        </p>
                      </div>
                      <Status value={work.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ops-muted">
                  No delivery work recorded for this case.
                </p>
              )}
            </section>
            <p className="ops-detail-note">
              <LockKeyhole size={15} />
              Evidence view. Case changes require an authorized domain workflow.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}

export default function OpsConsole() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [page, setPage] = useState<Page>("overview");
  const [exceptionView, setExceptionView] = useState<
    "payment" | "insurer" | null
  >(null);
  const exceptionTitle =
    exceptionView === "insurer" ? "Insurer timeouts" : "Payment exceptions";
  const exceptionHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (exceptionView) exceptionHeading.current?.focus();
  }, [exceptionView]);
  const [revision, setRevision] = useState(0);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [insurerFilter, setInsurerFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [query, setQuery] = useState("");
  const [filterError, setFilterError] = useState("");
  const loadSession = useCallback(async (preserveError = false) => {
    setSessionLoading(true);
    if (!preserveError) setSessionError("");
    try {
      setSession(await request<StaffSession>("/ops/v1/session"));
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Could not load your staff session.",
      );
    } finally {
      setSessionLoading(false);
    }
  }, []);
  useEffect(() => {
    document.title = "Operations · BizTrust";
    void loadSession();
  }, [loadSession]);
  const onExpired = useCallback(() => {
    setSession((current) =>
      current ? { ...current, authenticated: false } : null,
    );
    setSelectedCase(null);
    setSessionError(
      "Your staff session has expired. Sign in again to continue.",
    );
    void loadSession(true);
  }, [loadSession]);
  const authenticated = Boolean(session?.authenticated);
  const overview = useResource<Overview>(
    authenticated ? "/ops/v1/overview" : null,
    revision,
    onExpired,
  );
  const integrations = useResource<Integrations>(
    authenticated ? "/ops/v1/integrations" : null,
    revision,
    onExpired,
  );
  const cases = useResource<CaseRow[]>(
    authenticated &&
      !exceptionView &&
      ["overview", "cases", "payments"].includes(page)
      ? `/ops/v1/cases?${page === "overview" ? "limit=6" : query || "limit=50"}`
      : null,
    revision,
    onExpired,
  );
  const exceptions = useResource<ExceptionProjection>(
    authenticated && exceptionView
      ? `/ops/v1/${exceptionView === "insurer" ? "insurer-timeouts" : "payment-exceptions"}?limit=50`
      : null,
    revision,
    onExpired,
  );
  const visibleCases = exceptionView
    ? { ...exceptions, data: exceptions.data?.cases ?? null }
    : cases;
  const currentPage = pages.find((item) => item.id === page)!;
  const busy = overview.loading || integrations.loading || visibleCases.loading;
  async function authenticate(action: "demo" | "logout") {
    if (!session) return;
    setAuthBusy(true);
    setSessionError("");
    try {
      await request(`/ops/auth/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrf,
        },
        body: "{}",
      });
      if (action === "logout") {
        setSession(null);
        setSelectedCase(null);
      }
      await loadSession();
      setRevision((value) => value + 1);
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Could not update your staff session.",
      );
    } finally {
      setAuthBusy(false);
    }
  }
  function navigate(next: Page) {
    setExceptionView(null);
    setPage(next);
    setSelectedCase(null);
    setReference("");
    setInsurerFilter("");
    setPaymentFilter("");
    setQuery("");
    setFilterError("");
  }
  function inspectExceptions(kind: "payment" | "insurer") {
    navigate(kind === "payment" ? "payments" : "cases");
    setExceptionView(kind);
  }
  function filterCases(event: FormEvent) {
    event.preventDefault();
    const exact = reference.trim().toUpperCase();
    if (exact && !/^BT-[0-9]{4}-[A-F0-9]{10}$/.test(exact)) {
      setFilterError("Enter a full reference, for example BT-2026-A1B2C3D4E5.");
      return;
    }
    const params = new URLSearchParams({ limit: "50" });
    if (exact) params.set("reference", exact);
    if (insurerFilter) params.set("status", insurerFilter);
    if (paymentFilter) params.set("payment", paymentFilter);
    setReference(exact);
    setFilterError("");
    setQuery(params.toString());
    setRevision((value) => value + 1);
  }
  const summary = overview.data?.summary;
  return (
    <div className="ops-app">
      <a className="ops-skip" href="#ops-main">
        Skip to operations content
      </a>
      <aside className="ops-sidebar">
        <a
          className="ops-brand"
          href="/ops"
          aria-label="BizTrust operations home"
        >
          <img src="/brand/logoXhText.svg" alt="BizTrust Broker Insurance" />
        </a>
        <div className="ops-workspace-label">
          <span className="ops-square">
            <ShieldCheck size={18} />
          </span>
          <div>
            <strong>Operations console</strong>
            <span>Staff workspace</span>
          </div>
        </div>
        <nav aria-label="Operations" tabIndex={0}>
          <span className="ops-nav-label">WORKSPACE</span>
          {pages.map((item) => (
            <button
              key={item.id}
              className={`ops-nav-item ${page === item.id ? "active" : ""}`}
              disabled={!authenticated}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {page === item.id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="ops-sidebar-bottom">
          <div className="ops-access-note">
            <LockKeyhole size={17} />
            <div>
              <strong>Controlled access</strong>
              <p>Role and tenant scope are checked on every request.</p>
            </div>
          </div>
          <a href="/" className="ops-customer-link">
            Customer experience
            <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      <div className="ops-workspace">
        <header className="ops-topbar">
          <div className="ops-breadcrumb">
            Workspace
            <ChevronRight size={13} />
            <strong>
              {authenticated ? currentPage.label : "Staff access"}
            </strong>
          </div>
          <div className="ops-topbar-actions">
            {session?.synthetic && (
              <span className="ops-demo-badge">
                <FlaskConical size={14} />
                Synthetic demo
              </span>
            )}
            {authenticated && (
              <button
                className="ops-icon-button"
                onClick={() => void authenticate("logout")}
                disabled={authBusy}
                aria-label="Sign out of staff console"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        <main id="ops-main" className="ops-main" tabIndex={-1}>
          {!authenticated ? (
            <div className="ops-login">
              <div className="ops-login-art">
                <ShieldCheck size={35} strokeWidth={1.4} />
              </div>
              <span className="ops-eyebrow">BIZTRUST OPERATIONS</span>
              <h1>
                A clear view.
                <br />
                Controlled access.
              </h1>
              <p className="ops-login-copy">
                A dedicated workspace for case review, payment evidence, and
                partner operations.
              </p>
              {sessionLoading ? (
                <Loading>Checking staff access…</Loading>
              ) : (
                <>
                  {sessionError && <Notice error>{sessionError}</Notice>}
                  {session?.identityConfigured && (
                    <a
                      className="ops-button ops-button-primary"
                      href="/ops/auth/login"
                    >
                      <LockKeyhole size={16} />
                      Sign in with staff identity
                      <ArrowRight size={17} />
                    </a>
                  )}
                  {session?.demoAvailable && (
                    <button
                      className="ops-button ops-button-primary"
                      disabled={authBusy}
                      onClick={() => void authenticate("demo")}
                    >
                      <FlaskConical size={17} />
                      {authBusy
                        ? "Opening demonstration…"
                        : "Open isolated staff demo"}
                      <ArrowRight size={17} />
                    </button>
                  )}
                  {session &&
                    !session.identityConfigured &&
                    !session.demoAvailable && (
                      <Notice>
                        Staff sign-in is not configured. An administrator must
                        configure the operations identity client before this
                        workspace is available.
                      </Notice>
                    )}
                  {!session && (
                    <button
                      className="ops-button"
                      onClick={() => void loadSession()}
                    >
                      <RefreshCw size={16} />
                      Retry connection
                    </button>
                  )}
                  {session?.demoAvailable && (
                    <p className="ops-login-note">
                      The local demo uses synthetic records in an isolated
                      tenant. No live payments or insurance cover.
                    </p>
                  )}
                </>
              )}
              <div className="ops-login-footer">
                <Fingerprint size={17} />
                Separate staff identity · Tenant scoped
              </div>
            </div>
          ) : (
            <>
              <section className="ops-page-heading">
                <div>
                  <span className="ops-eyebrow">OPERATIONS WORKSPACE</span>
                  <h1>{currentPage.label}</h1>
                  <p>{currentPage.description}</p>
                </div>
                <button
                  className="ops-button"
                  disabled={busy}
                  onClick={() => setRevision((value) => value + 1)}
                >
                  <RefreshCw size={15} className={busy ? "ops-spin" : ""} />
                  Refresh
                </button>
              </section>
              <div className="ops-context">
                <div>
                  <Building2 size={16} />
                  <span>Tenant</span>
                  <strong title={session?.tenant}>{session?.tenant}</strong>
                </div>
                <div>
                  <ShieldCheck size={15} />
                  <span>{label(session?.role ?? "staff")} access</span>
                  <span className="ops-context-divider" />{" "}
                  <span>Evidence & monitoring</span>
                </div>
              </div>
              {session?.synthetic && (
                <div className="ops-environment">
                  <FlaskConical size={16} />
                  <span>
                    <strong>Local demonstration.</strong> Records and provider
                    adapters are synthetic. Live provider connectivity is not
                    configured.
                  </span>
                </div>
              )}
              {sessionError && <Notice error>{sessionError}</Notice>}
              {page === "products" && session && (
                <OpsProductInspector
                  key={session.tenant}
                  csrf={session.csrf}
                  revision={revision}
                  onExpired={onExpired}
                />
              )}
              {overview.error &&
                !exceptionView &&
                ["overview", "payments", "system"].includes(page) && (
                  <Notice error>{overview.error}</Notice>
                )}
              {!exceptionView &&
                (page === "overview" || page === "payments") && (
                  <>
                    {overview.loading && <Loading />}
                    {summary && (
                      <div className="ops-metrics">
                        {page === "overview" ? (
                          <>
                            <Metric
                              title="Awaiting action"
                              value={summary.awaitingAction}
                              description="Queued, referred, or delayed"
                              icon={FileText}
                            />
                            <Metric
                              title="Payment pending"
                              value={summary.paymentPending}
                              description="Within payment window"
                              icon={CreditCard}
                            />
                            <Metric
                              title="Payment exceptions"
                              value={summary.paymentExceptions}
                              description="Failed or needing reconciliation"
                              icon={CircleAlert}
                              onInspect={() => inspectExceptions("payment")}
                            />
                            <Metric
                              title="Insurer timeouts"
                              value={summary.insurerTimeouts}
                              description="Response needs follow-up"
                              icon={Clock3}
                              onInspect={() => inspectExceptions("insurer")}
                            />
                          </>
                        ) : (
                          <>
                            <Metric
                              title="Pending payments"
                              value={summary.paymentPending}
                              description="Within payment window"
                              icon={CreditCard}
                            />
                            <Metric
                              title="Expired payments"
                              value={summary.paymentExpired}
                              description="Payment window elapsed"
                              icon={Clock3}
                            />
                            <Metric
                              title="Payment exceptions"
                              value={summary.paymentExceptions}
                              description="Failed or needing reconciliation"
                              icon={CircleAlert}
                              onInspect={() => inspectExceptions("payment")}
                            />
                            <Metric
                              title="Exception events"
                              value={
                                overview.data!.integration
                                  .verifiedExceptionEvents
                              }
                              description="Verified events requiring review"
                              icon={Layers3}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              {["overview", "cases", "payments"].includes(page) && (
                <section className="ops-panel">
                  <div className="ops-panel-heading">
                    <div>
                      <h2
                        ref={exceptionHeading}
                        tabIndex={exceptionView ? -1 : undefined}
                      >
                        {exceptionView
                          ? exceptionTitle
                          : page === "overview"
                            ? "Recent cases"
                            : page === "payments"
                              ? "Payment review"
                              : "Case queue"}
                      </h2>
                      <p>
                        {exceptionView
                          ? exceptionView === "insurer"
                            ? "Insurer responses marked as timed out. Read-only synthetic evidence; payment and insurer status are independent and do not establish coverage."
                            : "Failed or reconciliation-required payments. Read-only synthetic evidence; payment does not establish coverage."
                          : page === "overview"
                            ? "The latest applications in your tenant"
                            : "Exact reference lookup and current state filters"}
                      </p>
                    </div>
                    {page === "overview" ? (
                      <button
                        className="ops-text-button"
                        onClick={() => navigate("cases")}
                      >
                        View all cases
                        <ArrowRight size={15} />
                      </button>
                    ) : (
                      <span className="ops-count">
                        {exceptionView && exceptions.data
                          ? `${exceptions.data.cases.length} of ${exceptions.data.count} shown${exceptions.data.truncated ? " · truncated" : ""}`
                          : visibleCases.data
                            ? `${visibleCases.data.length} shown · up to 50`
                            : "Up to 50 cases"}
                      </span>
                    )}
                  </div>
                  {exceptionView && (
                    <button
                      className="ops-text-button"
                      onClick={() =>
                        navigate(
                          exceptionView === "insurer" ? "cases" : "payments",
                        )
                      }
                    >
                      {exceptionView === "insurer"
                        ? "View all cases"
                        : "View all payments"}
                    </button>
                  )}
                  {page !== "overview" && !exceptionView && (
                    <form className="ops-filters" onSubmit={filterCases}>
                      <label className="ops-search-field">
                        <span>Exact case reference</span>
                        <div>
                          <Search size={16} />
                          <input
                            value={reference}
                            onChange={(event) =>
                              setReference(event.target.value)
                            }
                            placeholder="BT-2026-A1B2C3D4E5"
                            aria-describedby={
                              filterError ? "ops-filter-error" : undefined
                            }
                            aria-invalid={Boolean(filterError)}
                          />
                        </div>
                      </label>
                      <label>
                        <span>Insurer status</span>
                        <select
                          value={insurerFilter}
                          onChange={(event) =>
                            setInsurerFilter(event.target.value)
                          }
                        >
                          <option value="">All insurer states</option>
                          {caseStatuses.map((value) => (
                            <option key={value} value={value}>
                              {label(value)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Payment status</span>
                        <select
                          value={paymentFilter}
                          onChange={(event) =>
                            setPaymentFilter(event.target.value)
                          }
                        >
                          <option value="">All payment states</option>
                          {paymentStatuses.map((value) => (
                            <option key={value} value={value}>
                              {label(value)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="ops-button ops-button-primary"
                        type="submit"
                      >
                        Apply filters
                      </button>
                      {query && (
                        <button
                          className="ops-text-button"
                          type="button"
                          onClick={() => navigate(page)}
                        >
                          Clear
                        </button>
                      )}
                      {filterError && (
                        <p
                          id="ops-filter-error"
                          className="ops-filter-error"
                          role="alert"
                        >
                          {filterError}
                        </p>
                      )}
                    </form>
                  )}
                  {visibleCases.loading && (
                    <Loading>Loading case queue…</Loading>
                  )}
                  {visibleCases.error && (
                    <Notice error>{visibleCases.error}</Notice>
                  )}
                  {visibleCases.data && (
                    <CaseTable
                      rows={visibleCases.data}
                      onSelect={setSelectedCase}
                      emptyDescription={
                        exceptionView
                          ? `No ${exceptionTitle.toLowerCase()} in this snapshot.`
                          : undefined
                      }
                    />
                  )}
                  <div className="ops-panel-footer">
                    <ShieldCheck size={14} />
                    Tenant scoped · Customer details masked
                    <span>
                      {exceptionView
                        ? exceptions.data
                          ? `Snapshot ${timestamp(exceptions.data.asOf)}`
                          : "Refresh to retrieve latest state"
                        : overview.data
                          ? `Snapshot ${timestamp(overview.data.asOf)}`
                          : "Refresh to retrieve latest state"}
                    </span>
                  </div>
                </section>
              )}
              {page === "overview" && (
                <div className="ops-overview-bottom">
                  <section className="ops-panel ops-compact-panel">
                    <div className="ops-panel-heading">
                      <div>
                        <h2>Partner connectivity</h2>
                        <p>Configured adapters for this environment</p>
                      </div>
                      <Unplug size={19} />
                    </div>
                    {integrations.loading && <Loading />}
                    {integrations.error && (
                      <Notice error>{integrations.error}</Notice>
                    )}
                    {integrations.data?.adapters.map((adapter) => (
                      <div className="ops-adapter-row" key={adapter.name}>
                        <div className="ops-adapter-icon">
                          <Unplug size={17} />
                        </div>
                        <div>
                          <strong>{label(adapter.name)}</strong>
                          <p>{label(adapter.environment)} environment</p>
                        </div>
                        <Status value={adapter.status} />
                      </div>
                    ))}
                    <button
                      className="ops-text-button ops-panel-action"
                      onClick={() => navigate("integrations")}
                    >
                      Inspect integrations
                      <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="ops-panel ops-guidance">
                    <span className="ops-guidance-icon">
                      <Fingerprint size={24} />
                    </span>
                    <h2>Every case has a trail.</h2>
                    <p>
                      Open a case to review its audit timeline, verified payment
                      events, and insurer delivery attempts in one place.
                    </p>
                    <button
                      className="ops-text-button"
                      onClick={() => navigate("cases")}
                    >
                      Open case queue
                      <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
              )}
              {page === "integrations" && (
                <>
                  {integrations.loading && <Loading />}
                  {integrations.error && (
                    <Notice error>{integrations.error}</Notice>
                  )}
                  {integrations.data && (
                    <>
                      <div className="ops-integration-grid">
                        {integrations.data.adapters.map((adapter) => (
                          <section
                            key={adapter.name}
                            className="ops-panel ops-integration-card"
                          >
                            <div className="ops-integration-title">
                              <span className="ops-square">
                                <Unplug size={21} />
                              </span>
                              <Status value={adapter.status} />
                            </div>
                            <h2>{label(adapter.name)}</h2>
                            <dl className="ops-definition-list">
                              <div>
                                <dt>Environment</dt>
                                <dd>{label(adapter.environment)}</dd>
                              </div>
                              <div>
                                <dt>Credentials</dt>
                                <dd>{label(adapter.credentialStatus)}</dd>
                              </div>
                              <div>
                                <dt>Observed</dt>
                                <dd>{timestamp(integrations.data!.asOf)}</dd>
                              </div>
                            </dl>
                          </section>
                        ))}
                      </div>
                      <section className="ops-panel ops-retry-panel">
                        <div>
                          <h2>Delivery exceptions</h2>
                          <p>
                            Work items marked for retry by the domain service
                          </p>
                        </div>
                        <strong>{integrations.data.retryRequired}</strong>
                        <span>
                          {integrations.data.oldestRetryAt
                            ? `Oldest since ${timestamp(integrations.data.oldestRetryAt)}`
                            : "No retry backlog recorded"}
                        </span>
                      </section>
                    </>
                  )}
                </>
              )}
              {page === "system" && (
                <>
                  <section className="ops-panel">
                    <div className="ops-panel-heading">
                      <div>
                        <h2>Access & service responses</h2>
                        <p>Observed from this staff session</p>
                      </div>
                      <Activity size={19} />
                    </div>
                    <div className="ops-system-rows">
                      <div>
                        <Fingerprint size={20} />
                        <div>
                          <strong>Staff session</strong>
                          <p>Separate operations audience</p>
                        </div>
                        <Status value="authenticated" />
                      </div>
                      <div>
                        <Building2 size={20} />
                        <div>
                          <strong>Tenant scope</strong>
                          <p className="ops-break">{session?.tenant}</p>
                        </div>
                        <span className="ops-neutral-label">
                          {label(session?.role ?? "staff")}
                        </span>
                      </div>
                      <div>
                        <Activity size={20} />
                        <div>
                          <strong>Operations API</strong>
                          <p>
                            {overview.data
                              ? `Last response ${timestamp(overview.data.asOf)}`
                              : overview.loading
                                ? "Checking API response…"
                                : "No successful response in this refresh"}
                          </p>
                        </div>
                        {overview.data ? (
                          <span className="ops-health-ok">
                            <CheckCircle2 size={15} />
                            Responding
                          </span>
                        ) : (
                          <span className="ops-neutral-label">
                            {overview.loading ? "Checking" : "Unavailable"}
                          </span>
                        )}
                      </div>
                      <div>
                        <Unplug size={20} />
                        <div>
                          <strong>Integration status API</strong>
                          <p>
                            {integrations.data
                              ? `Last response ${timestamp(integrations.data.asOf)}`
                              : integrations.loading
                                ? "Checking API response…"
                                : "No successful response in this refresh"}
                          </p>
                        </div>
                        {integrations.data ? (
                          <span className="ops-health-ok">
                            <CheckCircle2 size={15} />
                            Responding
                          </span>
                        ) : (
                          <span className="ops-neutral-label">
                            {integrations.loading ? "Checking" : "Unavailable"}
                          </span>
                        )}
                      </div>
                    </div>
                  </section>
                  {integrations.error && (
                    <Notice error>{integrations.error}</Notice>
                  )}
                  <section className="ops-panel">
                    <div className="ops-panel-heading">
                      <div>
                        <h2>Processing outbox</h2>
                        <p>Recorded work by delivery state</p>
                      </div>
                      <Layers3 size={19} />
                    </div>
                    {overview.loading && <Loading />}
                    {overview.data &&
                      (Object.keys(overview.data.integration.outbox).length ? (
                        <div className="ops-outbox-counts">
                          {Object.entries(overview.data.integration.outbox).map(
                            ([state, count]) => (
                              <div key={state}>
                                <Status value={state} />
                                <strong>{count}</strong>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <div className="ops-empty">
                          <Layers3 size={27} />
                          <h3>No delivery work recorded</h3>
                          <p>
                            Queue counts will appear when this tenant submits
                            work.
                          </p>
                        </div>
                      ))}
                  </section>
                  <p className="ops-health-note">
                    These checks reflect API responses and tenant queues.
                    Infrastructure uptime, gateway readiness, and production key
                    management are not measured here.
                  </p>
                </>
              )}
              {["integrations", "system"].includes(page) &&
                integrations.data?.paymentInbox && (
                  <section className="ops-panel">
                    <div className="ops-panel-heading">
                      <div>
                        <h2>Payment event inbox</h2>
                        <p>Verified receipts retained for durable processing</p>
                      </div>
                      <CreditCard size={19} />
                    </div>
                    <div className="ops-outbox-counts">
                      <div>
                        <span className="ops-neutral-label">
                          Received · awaiting processing
                        </span>
                        <strong>
                          {integrations.data.paymentInbox.received}
                        </strong>
                      </div>
                      <div>
                        <span className="ops-neutral-label">
                          Failed processing
                        </span>
                        <strong>{integrations.data.paymentInbox.failed}</strong>
                      </div>
                      <div>
                        <span className="ops-neutral-label">Processed</span>
                        <strong>
                          {integrations.data.paymentInbox.processed}
                        </strong>
                      </div>
                    </div>
                    <div className="ops-panel-footer">
                      <Clock3 size={14} />
                      {integrations.data.paymentInbox.oldestPendingAt
                        ? `Oldest pending receipt: ${timestamp(integrations.data.paymentInbox.oldestPendingAt)}`
                        : "No pending payment receipts recorded"}
                    </div>
                  </section>
                )}
              <footer className="ops-footer">
                <span>BizTrust · Operations console</span>
                <span>
                  <LockKeyhole size={12} />
                  Staff access boundary
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {selectedCase && authenticated && (
        <EvidenceDialog
          key={selectedCase}
          caseId={selectedCase}
          revision={revision}
          onClose={() => setSelectedCase(null)}
          onExpired={onExpired}
        />
      )}
    </div>
  );
}
