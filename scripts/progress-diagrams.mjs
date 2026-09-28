// Curated views of the module contracts in docs/progress.md. No network renderer.
const labels = {
  "customer-ui": ["Customer / distribution", "React frontend"],
  "staff-ui": ["Operations console", "/ops · separate bundle"],
  gateway: ["Confirmed edge gateway", "APISIX is a candidate"],
  "customer-api": ["Customer API", "/api · customer session"],
  "staff-api": ["Staff API", "/ops/v1 · staff audience"],
  identity: ["Identity & authorization", "Client, role, tenant, object"],
  catalog: ["Product catalogue", "Versioned product evidence"],
  rules: ["Eligibility & pricing", "Shared deterministic rules"],
  quotes: ["Quotes & applications", "Consent + product snapshot"],
  cases: ["Application / case state", "Synthetic insurer outcomes"],
  payments: ["Payment module", "Validate + map provider event"],
  insurer: ["Insurer adapter", "Contract-specific mapping"],
  events: ["Durable events", "Inbox / outbox + idempotency"],
  documents: ["Documents & evidence", "Restricted artifact access"],
  notifications: ["Notifications", "Approved delivery channels"],
  audit: ["Audit trail", "Scoped append-only evidence"],
  data: ["PostgreSQL / tenant data", "Transaction-local forced RLS"],
  kms: ["Restricted key service", "Keys, secrets, rotation"],
};

const node = (id, x, y, status = "Local", options = {}) => ({
  key: id,
  id,
  x,
  y,
  status,
  ...options,
});
const edge = (from, to, label, status = "Local", options = {}) => ({
  from,
  to,
  label,
  status,
  ...options,
});

const diagrams = [
  {
    id: "system",
    title: "System overview",
    height: 590,
    description:
      "Target topology: two frontends and separate identity boundaries reach one authoritative domain layer. Gateway routes and production hosting still need confirmation. The local demo connects directly to its application server.",
    nodes: [
      node("customer-ui", 25, 75),
      node("staff-ui", 25, 285),
      node("gateway", 270, 180, "Planned"),
      node("customer-api", 515, 75),
      node("staff-api", 515, 285),
      node("cases", 760, 180, "Partial", {
        key: "domain",
        title: [
          "Authoritative domain layer",
          "Catalogue · quotes · cases",
          "Payments · insurer · audit",
        ],
        href: "#modules",
      }),
      node("data", 1005, 180),
      node("identity", 515, 460, "Partial"),
      node("events", 760, 460, "Partial"),
      node("kms", 1005, 460, "Planned"),
    ],
    edges: [
      edge("customer-ui", "gateway", "TLS", "Planned"),
      edge("staff-ui", "gateway", "TLS", "Planned"),
      edge("gateway", "customer-api", "customer", "Planned"),
      edge("gateway", "staff-api", "staff", "Planned"),
      edge("customer-api", "domain", "use case"),
      edge("staff-api", "domain", "use case"),
      edge("domain", "data", "scoped tx"),
      edge("identity", "staff-api", "authorize", "Partial"),
      edge("identity", "customer-api", "customer authorization", "Partial", {
        points: "515,508 500,508 500,25 615,25 615,75",
        lx: 565,
        ly: 16,
      }),
      edge("domain", "events", "durable work", "Partial"),
      edge("data", "kms", "key access", "Planned"),
    ],
    note: "Identity and tenant authorization apply to both APIs. Frontends have no database connection. Production storage encryption, restricted key access and autonomous workers remain to be built.",
  },
  {
    id: "customer",
    title: "Customer flow",
    height: 420,
    description:
      "Discovery → quote → application → tracking. These paths work with synthetic products and customer-owned demo records; distribution delegation and live products are still pending.",
    nodes: [
      node("customer-ui", 25, 60),
      node("customer-api", 270, 60),
      node("catalog", 515, 60),
      node("rules", 760, 60),
      node("quotes", 1005, 60),
      node("identity", 25, 285, "Partial"),
      node("documents", 270, 285),
      node("audit", 515, 285),
      node("data", 760, 285),
      node("cases", 1005, 285),
    ],
    edges: [
      edge("customer-ui", "customer-api", "requests"),
      edge("customer-api", "catalog", "catalogue"),
      edge("customer-api", "quotes", "quote / apply command", "Local", {
        points: "370,60 370,24 1105,24 1105,60",
        lx: 740,
        ly: 15,
      }),
      edge("catalog", "rules", "versioned rules"),
      edge("rules", "quotes", "rate + validate"),
      edge("quotes", "cases", "application"),
      edge("cases", "data", "persist / read"),
      edge("data", "audit", "atomic record"),
      edge("identity", "customer-ui", "sign-in", "Partial"),
      edge("documents", "customer-api", "owner access"),
    ],
    note: "Arrows describe logical contracts, not network microservices. The server recomputes pricing and enforces tenant/owner scope. Document output is synthetic; live capture, storage, payment and policy evidence need acceptance.",
  },
  {
    id: "staff",
    title: "Staff flow",
    height: 420,
    description:
      "An isolated operations frontend uses its own client/session and staff API. The current workbench reads tenant-scoped cases, exceptions and health. Specialized roles and write actions are planned.",
    nodes: [
      node("staff-ui", 25, 60),
      node("identity", 270, 60, "Partial"),
      node("staff-api", 515, 60),
      node("cases", 760, 60),
      node("data", 1005, 60),
      node("catalog", 515, 285, "Planned", {
        title: [
          "Controlled staff actions",
          "Catalogue · review · refunds",
          "Assigned use cases + audit",
        ],
      }),
      node("payments", 760, 285),
      node("audit", 1005, 285),
    ],
    edges: [
      edge("staff-ui", "identity", "staff login", "Partial"),
      edge("identity", "staff-api", "role + tenant", "Partial"),
      edge("staff-api", "cases", "read case"),
      edge("cases", "data", "scoped read"),
      edge("cases", "payments", "exceptions"),
      edge("data", "audit", "timeline"),
      edge("staff-api", "catalog", "authorized action", "Planned"),
    ],
    note: "Browser visibility never grants permission. Each future action must pass staff audience, role, tenant and object/assignment checks, then call the same domain service and record its outcome. An operations hostname has not been adopted.",
  },
  {
    id: "payment",
    title: "Payment events",
    height: 420,
    description:
      "Persist a verified receipt before processing. Local HMAC simulator delivery is implemented; a contracted provider, provider-specific signature or mTLS verification and autonomous retry worker remain pending.",
    nodes: [
      node("payments", 25, 60, "Partial", {
        key: "provider",
        title: ["Provider / simulator", "Webhook event + event ID"],
      }),
      node("payments", 270, 60, "Partial", {
        key: "ingress",
        title: [
          "Payment webhook ingress",
          "Raw-body verification",
          "Provider + tenant mapping",
        ],
      }),
      node("events", 515, 60, "Local", {
        key: "inbox",
        title: ["Durable payment inbox", "Commit verified receipt first"],
      }),
      node("payments", 760, 60, "Local", {
        key: "processor",
        title: ["Idempotent processor", "Amount, currency, reference"],
      }),
      node("data", 1005, 60),
      node("events", 515, 285, "Planned", {
        key: "worker",
        title: ["Autonomous worker", "Claim · retry · dead letter"],
      }),
      node("cases", 760, 285),
      node("audit", 1005, 285),
    ],
    edges: [
      edge("provider", "ingress", "signed event", "Partial"),
      edge("ingress", "inbox", "verified receipt"),
      edge("inbox", "processor", "after commit"),
      edge("processor", "data", "atomic update"),
      edge("processor", "cases", "payment state"),
      edge("data", "audit", "event evidence"),
      edge("worker", "inbox", "recover / retry", "Planned"),
    ],
    note: "Current recovery is redelivery-driven and processing runs inline after durable intake. Production must add background processing, settlement/reconciliation and authorized refunds. A browser callback or QR display is never payment evidence.",
  },
  {
    id: "insurer",
    title: "Insurer events",
    height: 420,
    description:
      "Target partner lifecycle: outgoing submission → contracted insurer → validated callback or poll → durable inbox → mapped policy state. The current insurer experience is an explicit simulator.",
    nodes: [
      node("events", 25, 60, "Partial", {
        key: "outbox",
        title: ["Submission outbox", "Durable delivery intent"],
      }),
      node("insurer", 270, 60, "Planned", {
        key: "adapter",
        title: ["Delivery adapter / worker", "Contract + retry policy"],
      }),
      node("insurer", 515, 60, "Planned", {
        key: "partner",
        title: ["Contracted insurer", "Webhook or status poll"],
      }),
      node("insurer", 760, 60, "Planned", {
        key: "intake",
        title: ["Authenticated intake", "Verify · map · validate"],
      }),
      node("events", 1005, 60, "Planned", {
        key: "inbox",
        title: ["Durable insurer inbox", "Deduplicate / order events"],
      }),
      node("notifications", 270, 285, "Planned"),
      node("documents", 515, 285, "Planned"),
      node("cases", 760, 285, "Planned", {
        title: ["Policy lifecycle", "Validate insurer evidence"],
      }),
      node("data", 1005, 285, "Planned", {
        title: ["Policy state + audit", "Transactional persistence"],
      }),
    ],
    edges: [
      edge("outbox", "adapter", "dispatch", "Planned"),
      edge("adapter", "partner", "submit", "Planned"),
      edge("partner", "intake", "callback / poll", "Planned"),
      edge("intake", "inbox", "valid event", "Planned"),
      edge("inbox", "cases", "validate transition", "Planned", {
        points: "1105,156 1105,212 860,212 860,285",
        lx: 965,
        ly: 203,
      }),
      edge("cases", "data", "state + audit", "Planned"),
      edge("cases", "documents", "policy evidence", "Planned"),
      edge("documents", "notifications", "notify", "Planned"),
    ],
    note: "Payment confirmation does not grant coverage. Issuance/binding authority and verified insurer artifacts must be explicit. Unknown or conflicting partner states go to authorized review; they must not be silently accepted.",
  },
  {
    id: "protection",
    title: "Data protection",
    height: 420,
    description:
      "Authorization precedes data access. Row isolation is present in the local backend; classified storage encryption and restricted key-service integration still require implementation and acceptance.",
    nodes: [
      node("identity", 25, 60, "Partial"),
      node("staff-api", 270, 60, "Local", {
        key: "api",
        title: ["Authenticated APIs", "Customer / staff separation"],
      }),
      node("cases", 515, 60, "Local", {
        key: "domain",
        title: ["Authorized use case", "Tenant + object scope"],
      }),
      node("data", 760, 60),
      node("kms", 1005, 60, "Planned"),
      node("documents", 515, 285, "Planned", {
        title: ["Classified object storage", "Scan · encrypt · retention"],
      }),
      node("audit", 760, 285),
      node("data", 1005, 285, "Planned", {
        key: "restore",
        title: ["Encrypted backup / restore", "Recovery targets + drills"],
      }),
    ],
    edges: [
      edge("identity", "api", "authenticate", "Partial"),
      edge("api", "domain", "authorize"),
      edge("domain", "data", "scoped tx"),
      edge("data", "kms", "restricted keys", "Planned"),
      edge("domain", "documents", "classified data", "Planned"),
      edge("data", "audit", "append evidence"),
      edge("kms", "restore", "key recovery", "Planned"),
    ],
    note: "Local customer details remain plaintext JSONB. Forced RLS is tenant isolation, not encryption. Production exit evidence must cover field/storage encryption, key policy, retention, restoration and privileged-access review.",
  },
];

const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");

function renderDiagram(diagram, moduleMap) {
  const nodes = new Map(diagram.nodes.map((item) => [item.key, item]));
  const lines = diagram.edges
    .map((item) => {
      const from = nodes.get(item.from),
        to = nodes.get(item.to);
      if (!from || !to)
        throw new Error(`Invalid diagram edge in ${diagram.id}`);
      let points,
        lx,
        ly,
        anchor = "middle";
      if (item.points) {
        points = item.points;
        lx = item.lx;
        ly = item.ly;
      } else if (from.y === to.y) {
        const right = to.x > from.x;
        const x1 = from.x + (right ? 200 : 0),
          x2 = to.x + (right ? 0 : 200);
        points = `${x1},${from.y + 48} ${x2},${to.y + 48}`;
        lx = (x1 + x2) / 2;
        ly = from.y + 35;
      } else if (from.x === to.x) {
        const down = to.y > from.y;
        const y1 = from.y + (down ? 96 : 0),
          y2 = to.y + (down ? 0 : 96);
        points = `${from.x + 100},${y1} ${to.x + 100},${y2}`;
        lx = from.x + 110;
        ly = (y1 + y2) / 2;
        anchor = "start";
      } else {
        const x1 = from.x + 200,
          x2 = to.x,
          mx = (x1 + x2) / 2;
        points = `${x1},${from.y + 48} ${mx},${from.y + 48} ${mx},${to.y + 48} ${x2},${to.y + 48}`;
        lx = mx + 5;
        ly = (from.y + to.y) / 2 + 48;
        anchor = "start";
      }
      return `<g class="edge ${item.status.toLowerCase()}"><polyline points="${points}" marker-end="url(#arrow-${diagram.id}-${item.status.toLowerCase()})"/><text x="${lx}" y="${ly}" text-anchor="${anchor}">${escape(item.label)}</text></g>`;
    })
    .join("");
  const boxes = diagram.nodes
    .map((item) => {
      if (!moduleMap.has(item.id))
        throw new Error(`Unknown diagram module ${item.id}`);
      const title = item.title || labels[item.id];
      if (!title) throw new Error(`Missing diagram label ${item.id}`);
      return `<a href="${item.href || `#module-${item.id}`}" class="diagram-node ${item.status.toLowerCase()}" aria-label="${escape(title.join(". "))}. ${item.status}. View module details"><rect x="${item.x}" y="${item.y}" width="200" height="96" rx="10"/><text x="${item.x + 13}" y="${item.y + 23}" class="node-title">${escape(title[0])}</text>${title
        .slice(1)
        .map(
          (line, index) =>
            `<text x="${item.x + 13}" y="${item.y + 43 + index * 16}" class="node-detail">${escape(line)}</text>`,
        )
        .join(
          "",
        )}<text x="${item.x + 13}" y="${item.y + 82}" class="node-state">${item.status === "Local" ? "LOCAL DEMO" : item.status.toUpperCase()}</text></a>`;
    })
    .join("");
  return `<section class="diagram-panel" id="diagram-${diagram.id}" aria-labelledby="diagram-title-${diagram.id}" ${diagram.id === "system" ? "" : "hidden"}>
    <h3 id="diagram-title-${diagram.id}">${diagram.title}</h3><p class="diagram-description">${escape(diagram.description)}</p>
    <div class="diagram-scroll" tabindex="0" role="region" aria-label="${diagram.title} diagram, scroll horizontally on narrow screens">
    <svg viewBox="0 0 1230 ${diagram.height}" xmlns="http://www.w3.org/2000/svg" role="group" aria-labelledby="svg-title-${diagram.id} svg-desc-${diagram.id}"><title id="svg-title-${diagram.id}">${diagram.title}</title><desc id="svg-desc-${diagram.id}">${escape(diagram.description)} Each node links to its module details. Connections are also listed in the module contract table below.</desc><defs>${["local", "partial", "planned"].map((status) => `<marker id="arrow-${diagram.id}-${status}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${status === "local" ? "#277c68" : status === "partial" ? "#986319" : "#687888"}"/></marker>`).join("")}</defs>${lines}${boxes}</svg></div>
    <p class="diagram-note">${escape(diagram.note)}</p></section>`;
}

export function diagramSection(moduleMap) {
  return `<section id="system" aria-labelledby="system-title"><div class="section-heading"><h2 id="system-title">System &amp; module flows</h2><p>Choose a flow · select a node for module detail</p></div>
    <div class="diagram-controls" role="group" aria-label="Choose system diagram">${diagrams.map((item) => `<button type="button" data-diagram="${item.id}" aria-controls="diagram-${item.id}" aria-pressed="${item.id === "system"}">${item.title}</button>`).join("")}</div>
    <p class="diagram-legend"><span class="local">Solid: local path</span><span class="partial">Dotted: partial / live acceptance pending</span><span class="planned">Dashed: planned</span></p>
    ${diagrams.map((item) => renderDiagram(item, moduleMap)).join("\n")}</section>`;
}

export const diagramStyles = `
  .diagram-controls { display: flex; flex-wrap: wrap; gap: 7px; }
  .diagram-controls button { border: 1px solid #cedbd3; background: white; color: #435d4e; padding: 10px 13px; border-radius: 7px; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
  .diagram-controls button[aria-pressed="true"] { background: #173f30; color: white; border-color: #173f30; }
  .diagram-legend { display: flex; flex-wrap: wrap; gap: 12px 22px; font-size: 11px; color: #52675b; margin: 15px 0; }
  .diagram-legend span::before { content: ""; width: 23px; display: inline-block; border-top: 2px solid #277c68; vertical-align: middle; margin-right: 6px; }
  .diagram-legend .partial::before { border-top: 3px dotted #986319; } .diagram-legend .planned::before { border-top: 2px dashed #687888; }
  .diagram-panel { background: white; border: 1px solid #dce5de; border-radius: 12px; overflow: hidden; }
  .diagram-panel[hidden] { display: none; }
  .diagram-panel h3 { font-size: 15px; margin: 22px 24px 8px; }
  .diagram-description { font-size: 13px; line-height: 1.6; color: #52675b; margin: 0 24px; max-width: 940px; }
  .diagram-scroll { overflow: auto; padding: 0 12px; }
  .diagram-scroll svg { width: 100%; min-width: 1000px; display: block; }
  .diagram-node rect { fill: #f2faf5; stroke: #86b8a5; stroke-width: 1.3; }
  .diagram-node.partial rect { fill: #fffbf0; stroke: #bba471; }
  .diagram-node.planned rect { fill: #f6f8fb; stroke: #8a9cac; stroke-dasharray: 6 4; }
  .diagram-node:hover rect, .diagram-node:focus rect { stroke: #064c3f; stroke-width: 3; }
  .node-title { font-size: 12px; font-weight: 750; fill: #233d30; }
  .node-detail { font-size: 10.5px; fill: #4a6053; }
  .node-state { font-size: 8.5px; font-weight: 800; letter-spacing: .08em; fill: #455c50; }
  .edge polyline { fill: none; stroke: #277c68; stroke-width: 1.8; }
  .edge.partial polyline { stroke: #986319; stroke-dasharray: 2 4; } .edge.planned polyline { stroke: #687888; stroke-dasharray: 6 4; }
  .edge text { font-size: 9px; fill: #43594c; paint-order: stroke; stroke: white; stroke-width: 4px; stroke-linejoin: round; }
  .diagram-note { font-size: 12px; color: #4a6153; padding: 15px 24px; margin: 0; background: #f2f6f3; border-top: 1px solid #dce5de; line-height: 1.6; }
  @media print { .diagram-controls { display: none; } .diagram-panel[hidden] { display: block; } .diagram-panel { break-inside: avoid; margin-bottom: 16px; } .diagram-scroll svg { min-width: 0; } }
`;
