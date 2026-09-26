import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CarFront,
  HeartPulse,
  Plane,
  House,
  HeartHandshake,
  Umbrella,
  Building2,
  Scale,
  Package,
  HardHat,
  Sprout,
  Ship,
  LayoutGrid,
  ShieldCheck,
  SlidersHorizontal,
  Search,
  Globe2,
  Menu,
  X,
  CircleHelp,
  FileText,
  Clock3,
  LockKeyhole,
  Info,
  GitCompareArrows,
  CheckCircle2,
  Download,
  RefreshCw,
  LogOut,
  CircleAlert,
  Bookmark,
  type LucideIcon,
} from "lucide-react";
import {
  api,
  money,
  date,
  statusLabel,
  type Catalog,
  type Product,
  type Session,
  type Quote,
  type ApplicationDetail,
  type ApplicationSummary,
} from "./api";
import { translations, laoCategories, type Locale } from "./i18n";
import CoverFinder from "./CoverFinder";
import FlexControls from "./FlexControls";
import {
  defaultSelection,
  restoreSelection,
  pricePlan,
  selectedLimit,
  type FlexSelection,
} from "../shared/pricing";

const icons: Record<string, LucideIcon> = {
  all: LayoutGrid,
  motor: CarFront,
  health: HeartPulse,
  travel: Plane,
  property: House,
  life: HeartHandshake,
  accident: Umbrella,
  business: Building2,
  liability: Scale,
  cargo: Package,
  engineering: HardHat,
  agriculture: Sprout,
  marine: Ship,
};
const pathname = location.pathname;
function Icon({
  name,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Component = icons[name] || ShieldCheck;
  return <Component strokeWidth={1.6} {...props} />;
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="error-message" role="alert">
      <CircleAlert size={18} />
      <span>{message}</span>
    </div>
  ) : null;
}
function readSaved(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem("bt-compare") || "[]");
    return Array.isArray(data)
      ? data.filter((x) => typeof x === "string").slice(0, 3)
      : [];
  } catch {
    return [];
  }
}
function readConfigurations(): Record<string, FlexSelection> {
  try {
    const saved = JSON.parse(localStorage.getItem("bt-configurations") || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved
      : {};
  } catch {
    return {};
  }
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [session, setSession] = useState<Session>();
  const [locale, setLocale] = useState<Locale>(() =>
    localStorage.getItem("bt-locale") === "lo" ? "lo" : "en",
  );
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>(readSaved);
  const [product, setProduct] = useState<Product>();
  const [initialSelection, setInitialSelection] = useState<FlexSelection>();
  const [configurations, setConfigurations] = useState(readConfigurations);
  const [auth, setAuth] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [help, setHelp] = useState(false);
  const t = translations[locale];
  useEffect(() => {
    void (async () => {
      try {
        setSession(await api<Session>("/session"));
        setCatalog(await api<Catalog>("/catalog"));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);
  useEffect(() => {
    localStorage.setItem("bt-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    localStorage.setItem("bt-compare", JSON.stringify(selected));
  }, [selected]);
  useEffect(() => {
    localStorage.setItem("bt-configurations", JSON.stringify(configurations));
  }, [configurations]);
  useEffect(() => {
    if (notice) {
      const timeout = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(timeout);
    }
  }, [notice]);
  useEffect(() => {
    if (
      catalog &&
      session?.user &&
      new URLSearchParams(location.search).has("signed-in")
    ) {
      const id = sessionStorage.getItem("bt-plan");
      const restoredProduct = catalog.products.find((p) => p.id === id);
      if (restoredProduct) {
        let saved: unknown;
        try {
          const record = JSON.parse(
            sessionStorage.getItem("bt-flex") || "null",
          );
          if (record?.productId === id) saved = record.selection;
        } catch {
          /* Ignore corrupt browser data. */
        }
        setInitialSelection(restoreSelection(restoredProduct, saved));
        setProduct(restoredProduct);
      }
      history.replaceState(null, "", "/insurance");
    }
  }, [catalog, session]);
  function toggleCompare(id: string, selection?: FlexSelection) {
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id));
    else if (selected.length < 3) {
      setSelected([...selected, id]);
      const plan = catalog?.products.find((p) => p.id === id);
      if (plan)
        setConfigurations((previous) => ({
          ...previous,
          [id]: selection || defaultSelection(plan),
        }));
    } else
      setNotice("Compare up to 3 plans at a time. Remove one to add another.");
  }
  function updateCompared(category: string, selection: FlexSelection) {
    const ids =
      catalog?.products
        .filter((p) => p.category === category && selected.includes(p.id))
        .map((p) => p.id) || [];
    if (ids.length)
      setConfigurations((previous) => ({
        ...previous,
        ...Object.fromEntries(ids.map((id) => [id, selection])),
      }));
  }
  function choose(p: Product, selection = defaultSelection(p)) {
    setInitialSelection(selection);
    setProduct(p);
    sessionStorage.setItem("bt-plan", p.id);
    sessionStorage.setItem(
      "bt-flex",
      JSON.stringify({ productId: p.id, selection }),
    );
  }
  const home = pathname === "/";
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>
            <span className="status-dot" />
            {t.demo}{" "}
            <span className="utility-detail">
              · Explore sample plans. No real payments or insurance cover.
            </span>
          </span>
          <button onClick={() => setHelp(true)}>
            A little guidance? <CircleHelp size={13} />
          </button>
        </div>
      </div>
      <header className="site-header">
        <div className="container navigation">
          <a className="brand" href="/" aria-label="BizTrust home">
            <img
              src="/brand/logoXhText.svg"
              alt="BizTrust Broker Insurance"
              width="188"
              height="60"
            />
          </a>
          <nav
            className={menu ? "main-nav open" : "main-nav"}
            aria-label="Main navigation"
          >
            <a
              className={pathname === "/insurance" ? "active" : ""}
              href="/insurance"
            >
              {t.explore}
              <ChevronDown size={14} />
            </a>
            <a
              className={pathname === "/how-it-works" ? "active" : ""}
              href="/how-it-works"
            >
              {t.how}
            </a>
            <a
              className={pathname.startsWith("/applications") ? "active" : ""}
              href="/applications"
            >
              {t.applications}
            </a>
          </nav>
          <div className="header-actions">
            <button
              className="language-button"
              onClick={() => setLocale(locale === "en" ? "lo" : "en")}
              title="Toggle English and draft Lao navigation"
            >
              <Globe2 size={17} />
              <span>{locale === "en" ? "EN" : "ລາວ"}</span>
            </button>
            {session?.user ? (
              <a
                className="button small outline account-link"
                href="/applications"
              >
                {t.account}
                <ArrowUpRight size={16} />
              </a>
            ) : (
              <button
                className="button small primary"
                onClick={() => setAuth(true)}
              >
                {t.signIn}
                <ArrowRight size={16} />
              </button>
            )}
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        {error ? (
          <div className="container empty-state">
            <CircleAlert />
            <h1>We couldn’t load your options.</h1>
            <ErrorMessage message={error} />
            <button
              className="button primary"
              onClick={() => location.reload()}
            >
              Try again
            </button>
          </div>
        ) : !catalog ? (
          <div
            className="container loading-state"
            aria-label="Loading insurance plans"
            role="status"
          >
            <div className="skeleton skeleton-hero" />
            <div className="skeleton-grid">
              {[1, 2, 3].map((n) => (
                <div className="skeleton" key={n} />
              ))}
            </div>
            <span className="sr-only">Loading BizTrust…</span>
          </div>
        ) : (
          <>
            {home ? (
              <>
                <section className="hero container">
                  <div className="hero-copy">
                    <div className="eyebrow">
                      <span className="little-line" />
                      {t.eyebrow}
                    </div>
                    <h1>
                      {t.hero1}
                      <br />
                      <span>{t.hero2}</span>
                    </h1>
                    <p>{t.heroCopy}</p>
                    <div className="hero-actions">
                      <a className="button primary" href="/find-cover">
                        {t.compare}
                        <ArrowUpRight size={19} />
                      </a>
                      <a className="text-link" href="/how-it-works">
                        {t.learn}
                        <ArrowRight size={17} />
                      </a>
                    </div>
                    <div className="hero-assurance">
                      <span>
                        <CheckCircle2 size={15} />
                        Clear comparisons
                      </span>
                      <span>
                        <CheckCircle2 size={15} />
                        Your choice, always
                      </span>
                    </div>
                  </div>
                  <div className="hero-visual">
                    <img
                      className="hero-photo"
                      src="/images/mountains.jpg"
                      alt="Sunlit mountain peaks rising above a green alpine landscape"
                    />
                    <div className="photo-caption">
                      <span>FOR EVERYTHING AHEAD</span>
                      <h2>
                        More living.
                        <br />
                        Less wondering.
                      </h2>
                    </div>
                    <div className="hero-note">
                      <div className="hero-note-icon">
                        <ShieldCheck size={25} />
                      </div>
                      <div>
                        <strong>A world of possibilities.</strong>
                        <span>One place to explore your cover.</span>
                      </div>
                      <ArrowUpRight size={18} />
                    </div>
                    <div className="photo-line" />
                  </div>
                </section>
                <div className="container category-launcher">
                  <div className="category-label">
                    What would you
                    <br />
                    <strong>like to protect?</strong>
                  </div>
                  <div className="quick-categories">
                    {catalog.categories.slice(1, 7).map((c) => (
                      <a href={`/insurance?category=${c.id}`} key={c.id}>
                        <span className={`category-icon ${c.id}`}>
                          <Icon name={c.id} size={27} />
                        </span>
                        <span>
                          {locale === "lo" ? laoCategories[c.id] : c.short}
                        </span>
                      </a>
                    ))}
                    <a href="/insurance">
                      <span className="category-icon">
                        <LayoutGrid size={25} strokeWidth={1.6} />
                      </span>
                      <span>
                        View all
                        <ArrowUpRight size={12} />
                      </span>
                    </a>
                  </div>
                </div>
                <section className="featured-section container">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">COVER FOR EVERY CHAPTER</div>
                      <h2>{t.section}</h2>
                      <p>{t.sectionCopy}</p>
                    </div>
                    <a className="text-link" href="/insurance">
                      {t.browse}
                      <ArrowUpRight size={17} />
                    </a>
                  </div>
                  <div className="demo-inline">
                    <Info size={14} />
                    <span>
                      Illustrative plans and prices from demonstration insurers.
                      Actual products will appear after insurer approval.
                    </span>
                  </div>
                  <div className="product-grid">
                    {catalog.products
                      .filter((p) => p.popular)
                      .map((p) => (
                        <ProductCard
                          key={p.id}
                          p={p}
                          selected={selected.includes(p.id)}
                          onCompare={() => toggleCompare(p.id)}
                          onView={() => choose(p)}
                          locale={locale}
                        />
                      ))}
                  </div>
                </section>
                <section className="difference container">
                  <div className="difference-intro">
                    <div className="eyebrow">THE BIZTRUST WAY</div>
                    <h2>{t.help}</h2>
                    <p>{t.helpCopy}</p>
                    <a className="text-link" href="/how-it-works">
                      Get to know the process
                      <ArrowRight size={16} />
                    </a>
                  </div>
                  <div className="difference-item">
                    <GitCompareArrows />
                    <h3>See the whole picture</h3>
                    <p>
                      Compare cover, limits and exclusions side by side. Make
                      room for an informed choice.
                    </p>
                  </div>
                  <div className="difference-item">
                    <FileText />
                    <h3>Know where you stand</h3>
                    <p>
                      Follow your application and payment, with insurer
                      decisions shown separately.
                    </p>
                  </div>
                  <div className="difference-item">
                    <HeartHandshake />
                    <h3>You’re in control</h3>
                    <p>
                      Choose what matters to you. Review every detail before you
                      take the next step.
                    </p>
                  </div>
                </section>
                <section className="business-banner container">
                  <div className="business-illustration">
                    <Building2 size={50} strokeWidth={1.3} />
                    <span>
                      <ShieldCheck size={22} />
                    </span>
                  </div>
                  <div>
                    <span className="eyebrow">
                      FOR THE BUSINESS YOU’RE BUILDING
                    </span>
                    <h2>Big ambitions. Thoughtful protection.</h2>
                    <p>
                      Explore business, liability, cargo and specialist
                      insurance in one place.
                    </p>
                  </div>
                  <a
                    className="button outline"
                    href="/insurance?category=business"
                  >
                    Explore business cover
                    <ArrowUpRight size={18} />
                  </a>
                </section>
              </>
            ) : pathname === "/find-cover" ? (
              <CoverFinder
                catalog={catalog}
                selected={selected}
                onCompare={toggleCompare}
                onChoose={choose}
                onFlexChange={updateCompared}
                icon={(id) => <Icon name={id} size={28} />}
              />
            ) : pathname === "/insurance" ? (
              <CatalogPage
                catalog={catalog}
                selected={selected}
                toggleCompare={toggleCompare}
                choose={choose}
                locale={locale}
              />
            ) : pathname === "/compare" ? (
              <Comparison
                configurations={configurations}
                products={catalog.products.filter((p) =>
                  selected.includes(p.id),
                )}
                choose={choose}
                remove={toggleCompare}
              />
            ) : pathname === "/how-it-works" ? (
              <HowItWorks />
            ) : pathname === "/applications" ? (
              <Applications
                session={session}
                onSignIn={() => setAuth(true)}
                onSession={setSession}
              />
            ) : pathname.startsWith("/applications/") ? (
              <Tracking
                reference={decodeURIComponent(pathname.split("/")[2] || "")}
                session={session}
                onSignIn={() => setAuth(true)}
              />
            ) : (
              <div className="empty-state">
                <h1>Let’s get you back on track.</h1>
                <a className="button primary" href="/">
                  Back to BizTrust
                </a>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="site-footer">
        <div className="container footer-main">
          <div>
            <a className="brand" href="/">
              <img
                src="/brand/logoXhText.svg"
                alt="BizTrust Broker Insurance"
                width="188"
                height="60"
              />
            </a>
            <p>
              {t.footer}
              <br />
              Compare. Understand. Choose.
            </p>
          </div>
          <div>
            <h3>Explore</h3>
            <a href="/insurance">Personal insurance</a>
            <a href="/insurance?category=business">Business insurance</a>
            <a href="/insurance?category=marine">Specialist insurance</a>
          </div>
          <div>
            <h3>Your next step</h3>
            <a href="/how-it-works">How it works</a>
            <a href="/compare">Compare plans</a>
            <a href="/applications">Track an application</a>
          </div>
          <div className="footer-note">
            <ShieldCheck size={22} />
            <p>Clarity at every step.</p>
            <span>
              BizTrust connects your choices with insurer review. Only an
              authorized insurer can confirm coverage.
            </span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} BizTrust. All rights reserved.
          </span>
          <button onClick={() => setHelp(true)}>
            About this demonstration
          </button>
          <span>Built around your peace of mind.</span>
        </div>
      </footer>
      {selected.length > 0 &&
        ["/", "/insurance", "/find-cover"].includes(pathname) &&
        !product && (
          <div className="compare-tray">
            <div className="compare-tray-copy">
              <GitCompareArrows size={22} />
              <span>
                <strong>
                  {selected.length} {selected.length === 1 ? "plan" : "plans"}{" "}
                  selected
                </strong>
                <small>Compare up to 3 plans</small>
              </span>
            </div>
            <button className="text-button" onClick={() => setSelected([])}>
              Clear
            </button>
            <a className="button primary small" href="/compare">
              Compare plans
              <ArrowRight size={16} />
            </a>
          </div>
        )}
      {notice && (
        <div className="toast" role="status">
          <Info size={18} />
          {notice}
        </div>
      )}
      {auth && (
        <SignIn
          session={session}
          onClose={() => setAuth(false)}
          onSuccess={(s) => {
            setSession(s);
            setAuth(false);
          }}
        />
      )}
      {product && (
        <PlanFlow
          initialSelection={initialSelection}
          product={product}
          session={session}
          onSession={setSession}
          onClose={() => setProduct(undefined)}
        />
      )}
      {help && (
        <Modal
          title="Welcome to the BizTrust preview"
          onClose={() => setHelp(false)}
        >
          <div className="modal-body">
            <span className="pill">LOCAL DEMONSTRATION</span>
            <h3>A working experience, with sample cover.</h3>
            <p>
              Explore 12 insurance categories, compare sample plans and try an
              application from quote to insurer review.
            </p>
            <p>
              All insurers, prices, terms, payments and policy documents shown
              here are synthetic. The QR code cannot be used to make a real
              payment.
            </p>
            <p>
              Use fictional details when trying the application. Your demo
              session stays in this browser for up to 12 hours.
            </p>
            <p>
              Lao navigation is a draft translation. Product and disclosure
              wording remains in English pending review.
            </p>
            <a className="button primary" href="/how-it-works">
              Explore the journey
              <ArrowRight size={16} />
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}

function ProductCard({
  p,
  selected,
  onCompare,
  onView,
  locale,
}: {
  p: Product;
  selected: boolean;
  onCompare: () => void;
  onView: () => void;
  locale: Locale;
}) {
  const t = translations[locale];
  return (
    <article className={`product-card ${selected ? "is-selected" : ""}`}>
      <div className="product-card-top">
        <div className={`product-symbol ${p.category}`}>
          <Icon name={p.category} size={29} />
        </div>
        <span className="sample-badge">SAMPLE PLAN</span>
      </div>
      <div className="product-kind">
        {locale === "lo"
          ? laoCategories[p.category]
          : p.category === "property"
            ? "HOME & PROPERTY"
            : p.category.toUpperCase()}
      </div>
      <h3>{p.name}</h3>
      <p className="product-description">{p.description}</p>
      <div className="insurer-line">
        <span className={`insurer-avatar ${p.insurerId}`}>
          {p.insurer.slice(-1)}
        </span>
        {p.insurer}
        <Info size={12} />
      </div>
      <div className="card-divider" />
      <ul className="coverage-list">
        {[p.coverage[0], p.limit].map((c) => (
          <li key={c}>
            <Check size={15} />
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <div className="card-price">
        <div>
          <span>Illustrative premium from</span>
          <strong>
            {money(p.basePremium)}
            <small> / {p.period}</small>
          </strong>
        </div>
      </div>
      <div className="card-actions">
        <label className="compare-checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={onCompare}
            aria-label={`Compare ${p.name}`}
          />
          <span>{t.compareCheck}</span>
        </label>
        <button className="button light small" onClick={onView}>
          {t.plan}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </article>
  );
}

function CatalogPage({
  catalog,
  selected,
  toggleCompare,
  choose,
  locale,
}: {
  catalog: Catalog;
  selected: string[];
  toggleCompare: (id: string) => void;
  choose: (p: Product) => void;
  locale: Locale;
}) {
  const [category, setCategory] = useState(
    new URLSearchParams(location.search).get("category") || "all",
  );
  const [search, setSearch] = useState("");
  const [insurers, setInsurers] = useState<string[]>([]);
  const [sort, setSort] = useState("default");
  const [filters, setFilters] = useState(false);
  const t = translations[locale];
  const plans = catalog.products
    .filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!insurers.length || insurers.includes(p.insurerId)) &&
        `${p.name} ${p.coverage.join(" ")} ${p.insurer}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "price-low"
        ? a.basePremium - b.basePremium
        : sort === "price-high"
          ? b.basePremium - a.basePremium
          : 0,
    );
  function reset() {
    setCategory("all");
    setSearch("");
    setInsurers([]);
    setSort("default");
  }
  return (
    <>
      <section className="page-banner">
        <div className="container">
          <div className="breadcrumb">
            <a href="/">Home</a>
            <ChevronRight size={13} />
            <span>Explore insurance</span>
          </div>
          <div className="eyebrow">YOUR CHOICE. YOUR COVER.</div>
          <h1>{t.plans}</h1>
          <p>{t.plansCopy}</p>
          <a className="text-link finder-catalogue-link" href="/find-cover">
            Help me find my cover <ArrowRight size={16} />
          </a>
        </div>
      </section>
      <section className="container catalogue-layout">
        <aside className={`filters ${filters ? "filters-open" : ""}`}>
          <div className="filter-title">
            <h2>
              <SlidersHorizontal size={17} />
              Filters
            </h2>
            <button className="text-button" onClick={reset}>
              Reset
            </button>
          </div>
          <h3>{t.categories}</h3>
          <div className="category-filters">
            {catalog.categories.map((c) => (
              <button
                key={c.id}
                className={category === c.id ? "selected" : ""}
                onClick={() => {
                  setCategory(c.id);
                  setFilters(false);
                }}
              >
                <Icon name={c.id} size={18} />
                <span>{locale === "lo" ? laoCategories[c.id] : c.name}</span>
                <small>
                  {c.id === "all"
                    ? catalog.products.length
                    : catalog.products.filter((p) => p.category === c.id)
                        .length}
                </small>
              </button>
            ))}
          </div>
          <div className="filter-separator" />
          <h3>{t.insurers}</h3>
          {catalog.insurers.map((i) => (
            <label className="filter-check" key={i.id}>
              <input
                type="checkbox"
                checked={insurers.includes(i.id)}
                onChange={() =>
                  setInsurers(
                    insurers.includes(i.id)
                      ? insurers.filter((x) => x !== i.id)
                      : [...insurers, i.id],
                  )
                }
              />
              {i.name}
            </label>
          ))}
          <div className="filter-help">
            <CircleHelp size={23} />
            <h3>Start with what matters.</h3>
            <p>
              Look beyond the price. Compare limits, exclusions and deductibles
              too.
            </p>
            <a href="/how-it-works">
              Your comparison guide
              <ArrowUpRight size={15} />
            </a>
          </div>
        </aside>
        <div className="catalogue-results">
          <div className="catalogue-toolbar">
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label={t.search}
                placeholder={t.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <button
              className="button outline mobile-filter"
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal size={17} />
              Filters
            </button>
            <label className="sort-select">
              <span className="sr-only">Sort plans</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="default">Category order</option>
                <option value="price-low">Premium: low to high</option>
                <option value="price-high">Premium: high to low</option>
              </select>
            </label>
          </div>
          <div className="results-count">
            <p>
              <strong>{plans.length}</strong> sample plans{" "}
              {category !== "all" && (
                <>· {catalog.categories.find((c) => c.id === category)?.name}</>
              )}
            </p>
            <span>No sponsored ranking</span>
          </div>
          <div className="demo-inline">
            <Info size={15} />
            <span>
              Demonstration prices only. Periods and benefits differ; a lower
              premium does not mean better cover.
            </span>
          </div>
          {plans.length ? (
            <div className="product-grid catalogue-grid">
              {plans.map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  selected={selected.includes(p.id)}
                  onCompare={() => toggleCompare(p.id)}
                  onView={() => choose(p)}
                  locale={locale}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search />
              <h2>{t.noPlans}</h2>
              <p>Try a different category, insurer or search term.</p>
              <button className="button primary" onClick={reset}>
                {t.reset}
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Comparison({
  products,
  configurations,
  choose,
  remove,
}: {
  products: Product[];
  configurations: Record<string, FlexSelection>;
  choose: (p: Product, selection?: FlexSelection) => void;
  remove: (id: string) => void;
}) {
  const rows: [string, (p: Product) => string][] = [
    ["Insurance category", (p) => p.category],
    ["Insurer", (p) => p.insurer],
    [
      "Illustrative premium",
      (p) => {
        const selection = restoreSelection(p, configurations[p.id]);
        return `${money(pricePlan(p, selection).premium)} / ${p.period === "day" ? `${selection.days} days` : "year"}`;
      },
    ],
    ["Main coverage", (p) => p.coverage[0]],
    [
      "Coverage limit",
      (p) => selectedLimit(p, restoreSelection(p, configurations[p.id])),
    ],
    [
      "Optional cover",
      (p) =>
        pricePlan(p, restoreSelection(p, configurations[p.id]))
          .addons.map((addon) => addon.name)
          .join(", ") || "None selected",
    ],
    [
      "Applicant age",
      (p) => String(restoreSelection(p, configurations[p.id]).age),
    ],
    ["Deductible / excess", (p) => p.deductible],
    ["Key exclusions", (p) => p.exclusion],
    ["Eligibility", (p) => p.eligibility],
    ["Wording source", (p) => p.source],
    ["Conditions", (p) => p.conditions],
  ];
  return (
    <section className="container page-section">
      <div className="breadcrumb">
        <a href="/insurance">Explore insurance</a>
        <ChevronRight size={13} />
        <span>Compare plans</span>
      </div>
      <div className="eyebrow">THE DETAILS MAKE THE DIFFERENCE</div>
      <h1>Your options, side by side.</h1>
      <p className="page-intro">
        Compare benefits and limitations as carefully as you compare price.
      </p>
      {!products.length ? (
        <div className="empty-state">
          <GitCompareArrows size={36} />
          <h2>A clearer choice starts with a comparison.</h2>
          <p>
            Select up to three plans from the catalogue to see their details
            here.
          </p>
          <a className="button primary" href="/insurance">
            Explore insurance
            <ArrowRight size={17} />
          </a>
        </div>
      ) : (
        <>
          <div className="notice">
            <Info size={18} />
            <span>
              These are synthetic examples.{" "}
              {new Set(products.map((p) => p.category)).size > 1
                ? "You are comparing different insurance categories; cover and pricing are not equivalent."
                : "All terms require insurer approval before any real offer."}
            </span>
          </div>
          <div
            className="comparison-scroll"
            tabIndex={0}
            aria-label="Insurance comparison table; scroll horizontally on small screens"
          >
            <table className="comparison-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="comparison-label">A closer look</span>
                    <a href="/insurance">
                      Add another plan
                      <ArrowRight size={14} />
                    </a>
                  </th>
                  {products.map((p) => (
                    <th scope="col" key={p.id}>
                      <div className="comparison-top">
                        <span className="product-symbol">
                          <Icon name={p.category} size={25} />
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`Remove ${p.name}`}
                          onClick={() => remove(p.id)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <span className="sample-badge">SAMPLE PLAN</span>
                      <h2>{p.name}</h2>
                      <button
                        className="button primary small"
                        onClick={() =>
                          choose(p, restoreSelection(p, configurations[p.id]))
                        }
                      >
                        View plan
                        <ArrowUpRight size={16} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([name, value]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    {products.map((p) => (
                      <td key={p.id}>{value(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small-muted">
            Showing each plan’s source terms without weighting or a
            recommendation. Published insurer wording will take precedence when
            available.
          </p>
        </>
      )}
    </section>
  );
}

function SignIn({
  session,
  onClose,
  onSuccess,
}: {
  session: Session | undefined;
  onClose: () => void;
  onSuccess: (s: Session) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function demo() {
    setBusy(true);
    try {
      await api("/auth/demo", {});
      onSuccess(await api<Session>("/session"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Make yourself at home." onClose={onClose}>
      <div className="modal-body sign-in-body">
        <span className="large-symbol">
          <LockKeyhole size={30} />
        </span>
        <h3>Your cover, all in one place.</h3>
        <p>
          Sign in to save your application, review payment instructions and
          follow insurer updates.
        </p>
        {session?.oidcConfigured ? (
          <a className="button primary full" href="/api/auth/login">
            Continue with secure sign-in
            <ArrowRight size={17} />
          </a>
        ) : (
          <div className="notice">
            <Info size={18} />
            <span>
              Secure sign-in will be available after BizTrust’s identity service
              is connected.
            </span>
          </div>
        )}
        <div className="or-divider">
          <span>EXPLORE THE LOCAL PREVIEW</span>
        </div>
        <p className="small-muted">
          Create a private demo session in this browser. Use fictional details;
          no real insurance or payment is involved.
        </p>
        <button
          className="button primary full"
          onClick={demo}
          disabled={busy || !session?.demo}
        >
          {busy ? "Opening your demo…" : "Continue in demo mode"}
          <ArrowRight size={17} />
        </button>
        <ErrorMessage message={error} />
      </div>
    </Modal>
  );
}

function PlanFlow({
  product: p,
  initialSelection,
  session,
  onSession,
  onClose,
}: {
  product: Product;
  initialSelection?: FlexSelection;
  session: Session | undefined;
  onSession: (s: Session) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"details" | "quote" | "review">("details");
  const [quote, setQuote] = useState<Quote>();
  const [selection, setSelection] = useState(() =>
    restoreSelection(p, initialSelection),
  );
  const { age, days } = selection;
  const pricing = (() => {
    try {
      return pricePlan(p, selection);
    } catch {
      return undefined;
    }
  })();
  function changeSelection(next: FlexSelection) {
    setSelection(next);
    setQuote(undefined);
    sessionStorage.setItem(
      "bt-flex",
      JSON.stringify({ productId: p.id, selection: next }),
    );
  }
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [disclosure, setDisclosure] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  async function start() {
    setBusy(true);
    setError("");
    try {
      if (!session?.user) {
        if (session?.oidcConfigured) {
          sessionStorage.setItem("bt-plan", p.id);
          location.assign("/api/auth/login");
          return;
        }
        if (!session?.demo)
          throw new Error("Sign in before requesting a quote.");
        await api("/auth/demo", {});
        onSession(await api<Session>("/session"));
      }
      setStep("quote");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function calculate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setQuote(await api<Quote>("/quotes", { productId: p.id, ...selection }));
      setStep("review");
      key.current = crypto.randomUUID();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ reference: string }>(
        "/applications",
        { quoteId: quote!.id, fullName: name, email, consent, disclosure },
        { "Idempotency-Key": key.current },
      );
      location.assign(`/applications/${result.reference}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        step === "details"
          ? "Take a closer look"
          : step === "quote"
            ? "Your indicative quote"
            : "Review your application"
      }
      onClose={onClose}
      wide
    >
      <div className="plan-summary">
        <span className={`product-symbol ${p.category}`}>
          <Icon name={p.category} size={30} />
        </span>
        <div>
          <span className="product-kind">{p.insurer} · SAMPLE PLAN</span>
          <h3>{p.name}</h3>
          <p>{p.description}</p>
        </div>
      </div>
      <div className="modal-body">
        <div className="flow-steps">
          {["Plan details", "Your quote", "Review & apply"].map(
            (text, index) => (
              <span
                key={text}
                className={
                  ["details", "quote", "review"].indexOf(step) === index
                    ? "current"
                    : ""
                }
              >
                <b>{index + 1}</b>
                {text}
              </span>
            ),
          )}
        </div>
        {step === "details" ? (
          <>
            <div className="plan-facts">
              <div>
                <h4>What’s included</h4>
                {[
                  ...p.coverage,
                  ...p.flex.addons
                    .filter((addon) => selection.addons.includes(addon.id))
                    .map((addon) => addon.name),
                ].map((c) => (
                  <p key={c}>
                    <Check size={16} />
                    {c}
                  </p>
                ))}
              </div>
              <div>
                <h4>Coverage limit</h4>
                <p>{selectedLimit(p, selection)}</p>
              </div>
              <div>
                <h4>Deductible / excess</h4>
                <p>{p.deductible}</p>
              </div>
              <div>
                <h4>Key exclusions</h4>
                <p>{p.exclusion}</p>
              </div>
              <div>
                <h4>Eligibility</h4>
                <p>{p.eligibility}</p>
              </div>
              <div>
                <h4>Source & version</h4>
                <p>
                  {p.source}
                  <br />
                  {p.version}
                </p>
              </div>
            </div>
            <div className="notice">
              <Info size={18} />
              <span>{p.conditions}</span>
            </div>
            <div className="plan-bottom">
              <div className="card-price">
                <div>
                  <span>Illustrative premium from</span>
                  <strong>
                    {pricing
                      ? money(pricing.premium)
                      : "Enter valid quote details"}
                    <small>
                      {" "}
                      / {p.period === "day" ? `${days} days` : "year"}
                    </small>
                  </strong>
                </div>
              </div>
              <button
                className="button primary"
                onClick={start}
                disabled={busy}
              >
                {busy
                  ? "Opening…"
                  : session?.user
                    ? "Get a demo quote"
                    : session?.oidcConfigured
                      ? "Sign in to get a quote"
                      : "Start a demo quote"}
                <ArrowRight size={17} />
              </button>
            </div>
            {!session?.user && !session?.oidcConfigured && (
              <p className="small-muted">
                Starting creates a private, temporary demo session in this
                browser.
              </p>
            )}
          </>
        ) : step === "quote" ? (
          <form onSubmit={calculate}>
            <p className="small-muted">
              These inputs demonstrate a versioned pricing rule. Real
              underwriting requirements will be supplied by each insurer.
            </p>
            <div className="form-grid">
              <label>
                Your age
                <input
                  type="number"
                  required
                  min={18}
                  max={70}
                  value={age}
                  onChange={(e) =>
                    changeSelection({
                      ...selection,
                      age: Number(e.target.value),
                    })
                  }
                />
                <span>Demonstration eligibility: 18–70 years</span>
              </label>
              {p.period === "day" && (
                <label>
                  Trip duration (days)
                  <input
                    type="number"
                    required
                    min={1}
                    max={90}
                    value={days}
                    onChange={(e) =>
                      changeSelection({
                        ...selection,
                        days: Number(e.target.value),
                      })
                    }
                  />
                  <span>1–90 days in this demonstration</span>
                </label>
              )}
            </div>
            <FlexControls
              product={p}
              value={selection}
              onChange={changeSelection}
              applicant={false}
            />
            <div className="flex-quote-estimate" role="status">
              Live sample premium{" "}
              <strong>
                {pricing
                  ? money(pricing.premium)
                  : "Enter a valid age and duration"}
              </strong>
              <span>
                {p.period === "day" ? `for ${days} days` : "per year"}
              </span>
            </div>
            <div className="notice">
              <LockKeyhole size={18} />
              <span>
                Only the details needed for this sample quote are collected.
              </span>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="text-link"
                onClick={() => setStep("details")}
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Calculating…" : "Calculate demo quote"}
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
        ) : (
          quote && (
            <form onSubmit={submit}>
              <div className="quote-breakdown">
                <div>
                  <span>{p.flex.label}</span>
                  <strong>{money(quote.input.coverageAmount)}</strong>
                </div>
                <div>
                  <span>Base cover</span>
                  <strong>{money(quote.breakdown.base)}</strong>
                </div>
                {quote.breakdown.addons.map((addon) => (
                  <div key={addon.id}>
                    <span>{addon.name}</span>
                    <strong>+ {money(addon.premium)}</strong>
                  </div>
                ))}
                <div>
                  <span>Indicative premium</span>
                  <strong>{money(quote.premium)}</strong>
                </div>
                <div>
                  <span>Broker fee (demo)</span>
                  <strong>{money(quote.fee)}</strong>
                </div>
                <div className="total">
                  <span>Total · LAK</span>
                  <strong>{money(quote.total)}</strong>
                </div>
                <small>
                  <Clock3 size={13} />
                  Quote valid until{" "}
                  {new Date(quote.expiresAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {p.ruleVersion}
                </small>
              </div>
              <h3 className="form-section-title">
                Who is this application for?
              </h3>
              <p className="small-muted">
                Use fictional details for this demonstration.
              </p>
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    autoComplete="off"
                    required
                    minLength={2}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Demo Explorer"
                  />
                </label>
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="off"
                    required
                    maxLength={180}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="demo@example.com"
                  />
                </label>
              </div>
              <label className="consent-check">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I agree to store these fictional application details in this
                  local preview. I have reviewed the coverage, exclusions and
                  deductible.
                </span>
              </label>
              <label className="consent-check">
                <input
                  type="checkbox"
                  required
                  checked={disclosure}
                  onChange={(e) => setDisclosure(e.target.checked)}
                />
                <span>
                  I understand this is a demonstration. A quote, application or
                  payment does not confirm insurance coverage. Insurer
                  acceptance is a separate step.
                </span>
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setStep("quote")}
                >
                  <ArrowLeft size={16} />
                  Edit quote
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? "Saving application…" : "Submit demo application"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </form>
          )
        )}
        <ErrorMessage message={error} />
      </div>
    </Modal>
  );
}

function Applications({
  session,
  onSignIn,
  onSession,
}: {
  session: Session | undefined;
  onSignIn: () => void;
  onSession: (s: Session) => void;
}) {
  const [items, setItems] = useState<ApplicationSummary[]>();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (session?.user)
      void api<ApplicationSummary[]>("/applications")
        .then(setItems)
        .catch((e) => setError(e.message));
  }, [session]);
  async function logout() {
    try {
      await api("/auth/logout", {});
      onSession(await api<Session>("/session"));
      setItems(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const filtered = items?.filter((a) =>
    `${a.reference} ${a.product_snapshot.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="container page-section">
      <div className="section-heading">
        <div>
          <div className="eyebrow">YOUR BIZTRUST SPACE</div>
          <h1>Every next step, in one place.</h1>
          <p>Revisit your applications and keep track of what happens next.</p>
        </div>
        {session?.user && (
          <button className="text-link" onClick={logout}>
            Sign out
            <LogOut size={16} />
          </button>
        )}
      </div>
      <ErrorMessage message={error} />
      {!session?.user ? (
        <div className="empty-state">
          <LockKeyhole size={36} />
          <h2>Your applications belong to you.</h2>
          <p>Sign in to see your saved applications and insurer updates.</p>
          <button className="button primary" onClick={onSignIn}>
            Sign in to continue
            <ArrowRight size={17} />
          </button>
        </div>
      ) : !items && !error ? (
        <div
          className="skeleton skeleton-hero"
          aria-label="Loading applications"
        />
      ) : !items?.length ? (
        <div className="empty-state">
          <Bookmark size={36} />
          <h2>Your next chapter starts here.</h2>
          <p>
            You haven’t submitted an application yet. Explore plans at your own
            pace.
          </p>
          <a className="button primary" href="/insurance">
            Find your cover
            <ArrowUpRight size={17} />
          </a>
        </div>
      ) : (
        <>
          <div className="account-note">
            <ShieldCheck size={18} />
            <span>
              Demo workspace · This browser session lasts up to 12 hours.
              Signing out ends access to this temporary workspace.
            </span>
          </div>
          <label className="search-field application-search">
            <Search size={18} />
            <input
              aria-label="Search applications"
              placeholder="Search by reference or plan"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="application-list">
            {filtered?.map((a) => (
              <a
                className="application-row"
                key={a.reference}
                href={`/applications/${a.reference}`}
              >
                <span className="product-symbol">
                  <Icon name={a.product_snapshot.category} size={26} />
                </span>
                <div className="application-row-title">
                  <span className="reference">{a.reference}</span>
                  <h2>{a.product_snapshot.name}</h2>
                  <p>
                    {a.product_snapshot.insurer} · {date(a.created_at)}
                  </p>
                </div>
                <div className="application-row-status">
                  <Status value={a.insurer_status} />
                  <small>
                    {statusLabel(
                      a.payment_status === "pending" &&
                        new Date(a.expires_at).getTime() < Date.now()
                        ? "expired"
                        : a.payment_status,
                    )}
                  </small>
                </div>
                <strong>{money(a.amount)}</strong>
                <ChevronRight size={20} />
              </a>
            ))}
          </div>
          {filtered?.length === 0 && (
            <div className="empty-state">
              <h2>No matching applications</h2>
              <button className="text-link" onClick={() => setSearch("")}>
                Clear search
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className={`status-badge status-${value}`}>
      <span />
      {statusLabel(value)}
    </span>
  );
}
function Tracking({
  reference,
  session,
  onSignIn,
}: {
  reference: string;
  session: Session | undefined;
  onSignIn: () => void;
}) {
  const [detail, setDetail] = useState<ApplicationDetail>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [outcome, setOutcome] = useState("processing");
  async function refresh() {
    setError("");
    try {
      setDetail(await api<ApplicationDetail>(`/applications/${reference}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (session?.user) {
      void refresh();
      const timer = setInterval(() => {
        void refresh();
      }, 15000);
      return () => clearInterval(timer);
    }
  }, [session, reference]); // Polling shows server-owned states, never browser payment claims.
  async function simulate(kind: "payment" | "insurer") {
    setBusy(true);
    setError("");
    try {
      await api(
        `/demo/applications/${reference}/${kind}`,
        kind === "payment" ? {} : { outcome },
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Copy is unavailable. Select the reference text to copy it.");
    }
  }
  if (!session?.user)
    return (
      <section className="container empty-state">
        <LockKeyhole size={36} />
        <h1>Sign in to track your application.</h1>
        <p>
          Application details are only visible to the account that created them.
        </p>
        <button className="button primary" onClick={onSignIn}>
          Sign in
        </button>
      </section>
    );
  const app = detail?.application;
  const invoice = detail?.invoice;
  const paid = invoice?.status === "settled";
  const issued = app?.insurer_status === "issued";
  return (
    <section className="container page-section">
      <a href="/applications" className="text-link">
        <ArrowLeft size={16} />
        My applications
      </a>
      <div className="tracking-heading">
        <div>
          <div className="eyebrow">YOUR APPLICATION</div>
          <h1>A clear view of what’s next.</h1>
          <button className="reference-button" onClick={copy}>
            {reference}
            {copied ? <CheckCheck size={16} /> : <FileText size={15} />}
            <small>{copied ? "Copied" : "Copy reference"}</small>
          </button>
        </div>
        <button className="button outline small" onClick={refresh}>
          <RefreshCw size={15} />
          Refresh status
        </button>
      </div>
      <ErrorMessage message={error} />
      {!detail ? (
        !error && (
          <div
            className="skeleton skeleton-hero"
            aria-label="Loading application"
          />
        )
      ) : (
        <>
          <div className="notice">
            <Info size={18} />
            <span>
              This application is a demonstration. No actual payment is
              collected and no real insurance coverage is issued.
            </span>
          </div>
          <div className="tracking-layout">
            <div>
              <div className="panel">
                <div className="panel-header">
                  <h2>Your progress</h2>
                  <Status value={app!.insurer_status} />
                </div>
                <ol className="timeline">
                  <li className="complete">
                    <span className="timeline-mark">
                      <Check size={17} />
                    </span>
                    <div>
                      <h3>Application received</h3>
                      <p>
                        Saved on {date(app!.created_at)} with your quote and
                        consent.
                      </p>
                    </div>
                  </li>
                  <li className={paid ? "complete" : "current"}>
                    <span className="timeline-mark">
                      {paid ? <Check size={17} /> : 2}
                    </span>
                    <div>
                      <h3>
                        {paid
                          ? "Demo payment verified"
                          : "Payment instruction ready"}
                      </h3>
                      <p>
                        {paid
                          ? "The server verified the simulator’s signed payment event."
                          : statusLabel(invoice!.status) +
                            ". Payment is separate from insurer acceptance."}
                      </p>
                    </div>
                  </li>
                  <li className={issued ? "complete" : paid ? "current" : ""}>
                    <span className="timeline-mark">
                      {issued ? <Check size={17} /> : 3}
                    </span>
                    <div>
                      <h3>Insurer review</h3>
                      <p>
                        {paid
                          ? statusLabel(app!.insurer_status)
                          : "Begins after a verified payment event in this demonstration."}
                      </p>
                    </div>
                  </li>
                  <li className={issued ? "complete" : ""}>
                    <span className="timeline-mark">
                      {issued ? <Check size={17} /> : 4}
                    </span>
                    <div>
                      <h3>
                        {issued
                          ? "Demonstration document available"
                          : "Insurer outcome & documents"}
                      </h3>
                      <p>
                        {issued
                          ? "Synthetic insurer evidence was recorded. This does not provide coverage."
                          : "A policy can only follow authoritative insurer acceptance and evidence."}
                      </p>
                    </div>
                  </li>
                </ol>
                {issued && (
                  <a
                    className="button primary"
                    href={`/api/applications/${reference}/document`}
                  >
                    <Download size={17} />
                    Download demo record
                  </a>
                )}
                {[
                  "referred",
                  "additional_information",
                  "rejected",
                  "timeout",
                ].includes(app!.insurer_status) && (
                  <div className="notice">
                    <CircleAlert size={18} />
                    <span>
                      {app!.insurer_status === "additional_information"
                        ? "The demonstration insurer requests further information. A real request would specify the documents and a secure upload route."
                        : app!.insurer_status === "rejected"
                          ? "This sample application was not accepted. A refund review would be handled separately by authorized finance staff."
                          : app!.insurer_status === "timeout"
                            ? "The insurer response is delayed. The submission is marked for retry; its payment is preserved."
                            : "This application needs an insurer review. No coverage has been confirmed."}
                    </span>
                  </div>
                )}
              </div>
              <div className="panel">
                <h2>Activity</h2>
                <div className="activity-list">
                  {detail.history.map((h, i) => (
                    <div key={i}>
                      <span className="activity-dot" />
                      <div>
                        <strong>
                          {h.action.replaceAll(".", " · ").replaceAll("_", " ")}
                        </strong>
                        <small>
                          {new Date(h.created_at).toLocaleString("en-GB")}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {session.demo && (
                <div className="simulator-panel">
                  <span className="pill">DEMONSTRATION CONTROLS</span>
                  <h2>Try the next step.</h2>
                  <p>
                    These controls exercise the local payment and insurer
                    simulators.
                  </p>
                  {!paid ? (
                    <button
                      className="button outline"
                      disabled={busy || invoice!.status !== "pending"}
                      onClick={() => simulate("payment")}
                    >
                      {busy ? "Verifying…" : "Simulate verified payment"}
                      <ArrowRight size={17} />
                    </button>
                  ) : !["issued", "rejected"].includes(app!.insurer_status) ? (
                    <div className="simulator-controls">
                      <label>
                        <span className="sr-only">
                          Simulated insurer outcome
                        </span>
                        <select
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value)}
                        >
                          <option value="processing">Under review</option>
                          <option value="referred">Refer to insurer</option>
                          <option value="additional_information">
                            Request information
                          </option>
                          <option value="timeout">Response timeout</option>
                          <option value="rejected">Reject application</option>
                          <option value="issued">Issue demo document</option>
                        </select>
                      </label>
                      <button
                        className="button outline"
                        disabled={busy}
                        onClick={() => simulate("insurer")}
                      >
                        {busy ? "Updating…" : "Simulate insurer update"}
                      </button>
                    </div>
                  ) : (
                    <p>
                      <CheckCircle2 size={16} />
                      The simulator has reached a final insurer outcome.
                    </p>
                  )}
                </div>
              )}
            </div>
            <aside>
              <div className="panel application-summary">
                <span className="product-symbol">
                  <Icon name={app!.product_snapshot.category} size={30} />
                </span>
                <span className="product-kind">
                  {app!.product_snapshot.insurer}
                </span>
                <h2>{app!.product_snapshot.name}</h2>
                <div className="selected-cover-summary">
                  <h3>Selected cover</h3>
                  <p>{app!.product_snapshot.limit}</p>
                  <ul>
                    {app!.product_snapshot.coverage.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
                <div className="summary-line">
                  <span>Applicant</span>
                  <strong>{app!.customer.fullName}</strong>
                </div>
                <div className="summary-line">
                  <span>Premium</span>
                  <strong>{money(detail.quote.premium)}</strong>
                </div>
                <div className="summary-line">
                  <span>Broker fee</span>
                  <strong>{money(detail.quote.fee)}</strong>
                </div>
                <div className="summary-total">
                  <span>Total · LAK</span>
                  <strong>{money(invoice!.amount)}</strong>
                </div>
                <Status value={invoice!.status} />
              </div>
              {invoice!.status === "pending" && (
                <div className="panel qr-panel">
                  <h2>Demo payment instruction</h2>
                  <p>This is a non-payable demonstration QR.</p>
                  <img
                    src={`/api/applications/${reference}/qr`}
                    width="220"
                    height="220"
                    alt="Non-payable demonstration QR code linked to this application"
                  />
                  <strong>{money(invoice!.amount)}</strong>
                  <span>
                    Expires{" "}
                    {new Date(invoice!.expires_at).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <div className="small-muted">
                    <LockKeyhole size={13} />
                    Payment status is verified by the server.
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="container page-section how-page">
      <div className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</div>
      <h1>
        From a question
        <br />
        to a considered choice.
      </h1>
      <p className="page-intro">
        Insurance has a few steps. We help you see each one clearly.
      </p>
      <div className="how-grid">
        {[
          {
            icon: Search,
            title: "Explore your possibilities",
            text: "Start with what you want to protect. Browse across insurance categories and see the insurer behind each plan.",
          },
          {
            icon: GitCompareArrows,
            title: "Compare the details",
            text: "Look at coverage, limits, exclusions, deductibles and premium periods side by side. Different products protect against different risks.",
          },
          {
            icon: FileText,
            title: "Review and apply",
            text: "Get an indicative quote, review the conditions and submit your details. Your application receives a reference you can revisit.",
          },
          {
            icon: ShieldCheck,
            title: "Follow every next step",
            text: "Review your payment instruction and track insurer processing separately. Only authoritative insurer evidence confirms a policy.",
          },
        ].map((s, i) => (
          <article key={s.title}>
            <div className="how-number">
              0{i + 1}
              <s.icon size={27} />
            </div>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </article>
        ))}
      </div>
      <div className="how-bottom">
        <div>
          <h2>Questions worth asking.</h2>
          <p>
            Before you choose a plan, make sure you understand the essentials.
          </p>
        </div>
        <div className="faq">
          {[
            [
              "Does a quote mean I am covered?",
              "No. A quote is an indication subject to its terms and expiry. Applications and payments do not themselves confirm cover. Insurer acceptance and authoritative policy evidence are separate.",
            ],
            [
              "How are plans ranked?",
              "The catalogue starts in category order. You can filter by insurer and sort by illustrative premium. There is no paid placement, suitability recommendation or claim that the lowest price is the best option.",
            ],
            [
              "Can I compare different kinds of insurance?",
              "Yes, but different categories and premium periods are not equivalent. The comparison highlights these differences and shows exclusions and deductibles alongside benefits.",
            ],
            [
              "Can I buy real insurance in this preview?",
              "No. Every plan, insurer, price, QR payment and document in this local preview is synthetic. Real products require approved insurer terms and connected payment and insurer services.",
            ],
            [
              "What happens if a payment or insurer response is delayed?",
              "Your application remains saved. Late or mismatched payment events enter reconciliation review. Insurer timeouts remain visible for a safe retry; they are never treated as acceptance.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={17} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
      <div className="center-cta">
        <a className="button primary" href="/insurance">
          Explore your options
          <ArrowUpRight size={18} />
        </a>
      </div>
    </section>
  );
}
