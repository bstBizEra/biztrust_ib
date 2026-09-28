// Supplemental backend, domain coverage and production gates for the shared board.
export function renderPlan(source, milestones, escapeHtml, inline) {
  const normalized = source.replaceAll("\r\n", "\n");
  function table(heading, columns) {
    const section = normalized.split(`## ${heading}\n`)[1]?.split(/\n## /)[0];
    if (!section)
      throw new Error(`Missing implementation plan section: ${heading}`);
    const rows = section.split("\n").filter((line) => line.startsWith("|"));
    if (rows.length < 3) throw new Error(`Empty plan table: ${heading}`);
    return rows.slice(2).map((row) => {
      const cells = row
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length !== columns || cells.some((cell) => !cell))
        throw new Error(`Invalid ${heading} row: ${row}`);
      for (const id of row.match(/BT-\d+/g) ?? [])
        if (!milestones.has(id))
          throw new Error(`Unknown milestone ${id} in ${heading}`);
      return cells;
    });
  }
  const backend = table("Backend transaction flow", 6);
  const domains = table("Architecture domain coverage", 6);
  const gates = table("Production acceptance gates", 4);
  if (
    domains.map((row) => row[0]).join(",") !==
    Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, "0")).join(
      ",",
    )
  )
    throw new Error(
      "Architecture mapping must cover domains 01–15 exactly once",
    );
  if (backend.map((row) => row[0]).join(",") !== "01,02,03,04,05,06,07,08")
    throw new Error("Backend flow must include stages 01–08 exactly once");
  for (const row of domains)
    if (!/^P[0-7](, P[0-7])*$/.test(row[4]))
      throw new Error(`Unknown phase in domain ${row[0]}`);
  const refs = (value) =>
    inline(value).replace(
      /BT-\d+/g,
      (id) => `<a class="id-link" href="#${id}">${id}</a>`,
    );
  const dataTable = (headers, rows, label) =>
    `<div class="table-scroll" tabindex="0" role="region" aria-label="${label}"><table><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, i) => `<${i ? "td" : 'th scope="row"'}>${refs(cell)}</${i ? "td" : "th"}>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const stage = (number, x, y, type, note) => {
    const row = backend.find(([id]) => id === number);
    return `<g class="plan-stage ${row[2].toLowerCase()}"><rect x="${x}" y="${y}" width="280" height="100" rx="12"/><text class="plan-node-id" x="${x + 15}" y="${y + 23}">${number} · ${type}</text><text class="plan-node-title" x="${x + 15}" y="${y + 49}">${escapeHtml(row[1])}</text><text class="plan-node-note" x="${x + 15}" y="${y + 74}">${escapeHtml(note)}</text></g>`;
  };
  const arrow = (d, planned = false) =>
    `<path class="plan-arrow ${planned ? "future" : ""}" d="${d}" marker-end="url(#plan-arrowhead)"/>`;
  const diagram = `<div class="plan-diagram-scroll" tabindex="0" role="region" aria-label="Backend transaction diagram; scroll horizontally on small screens"><svg class="plan-commit-svg" viewBox="0 0 1000 625" role="img" aria-labelledby="plan-svg-title plan-svg-desc"><title id="plan-svg-title">Backend transaction and recovery boundaries</title><desc id="plan-svg-desc">A creates the application and invoice. Independently, signed payment intake commits durable receipt B before domain transaction C. C validates the locked invoice and writes payment outcome, audit and insurer outbox. Redelivery recovers crashes. Planned workers and authoritative insurer evidence are required before policy notification. Payment does not mean coverage.</desc><defs><marker id="plan-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#588575"/></marker></defs>
  ${arrow("M310 80 H355")}${arrow("M635 80 H680")}${arrow("M310 280 H355")}${arrow("M635 280 H680")}${arrow("M820 130 V230")}${arrow("M820 330 V470 H665 V520 H635", true)}${arrow("M355 520 H310", true)}
  ${stage("01", 30, 30, "CUSTOMER REQUEST", "Validate · price · snapshot")}
  ${stage("02", 355, 30, "TRANSACTION A", "Application + invoice + consent + audit")}
  <g class="plan-stage local"><rect x="680" y="30" width="280" height="100" rx="12"/><text class="plan-node-id" x="695" y="53">AUTHORITATIVE INVOICE</text><text class="plan-node-title" x="695" y="79">Expected payment</text><text class="plan-node-note" x="695" y="104">Reference · currency · amount · expiry</text></g>
  <text class="plan-edge-label" x="700" y="188">Invoice correlation and lock</text>
  ${stage("03", 30, 230, "INDEPENDENT PROVIDER EVENT", "Raw-body signature · timestamp · schema")}
  ${stage("04", 355, 230, "TRANSACTION B", "Commit immutable event identity + digest")}
  ${stage("05", 680, 230, "TRANSACTION C", "Payment outcome + outbox + audit")}
  <text class="plan-edge-label" x="40" y="378">Rejected intake: no receipt or state mutation.</text>
  <text class="plan-node-note" x="40" y="403">Same-event redelivery recovers crashes before / after C.</text>
  <text class="plan-node-note" x="40" y="426">Late or mismatched payments require reconciliation.</text>
  <text class="plan-edge-label" x="697" y="401">Valid outcome → outbox</text>
  ${stage("06", 355, 470, "TARGET WORKER · PARTIAL", "Today: explicit manual insurer simulation")}
  ${stage("07", 30, 470, "TARGET POLICY · PLANNED", "Separate insurer / broker / policy records")}
  <text class="plan-node-note" x="685" y="517">08 · Tracking exists locally.</text><text class="plan-node-note" x="685" y="541">Notices + ledger reporting are planned.</text>
  <text class="plan-edge-label" x="35" y="604">Payment received ≠ insurer accepted ≠ coverage in force.</text></svg></div>`;
  return `<div class="implementation-supplement">
  <section id="backend" aria-labelledby="backend-title"><div class="section-heading"><h2 id="backend-title">Backend transactions &amp; recovery</h2><p>Current commits → target delivery</p></div><p class="section-intro">The payment inbox commits before business processing. Browser sessions authorize customer requests; independently verified provider events enter through a separate boundary. Production still needs autonomous workers, finance records and authoritative insurer evidence.</p>${diagram}<details class="contract-details"><summary>Eight backend stages: endpoints, records and recovery checks</summary>${dataTable(["Step", "Stage", "State", "Backend behavior", "Record / transaction", "Acceptance / recovery"], backend, "Backend processing stages")}</details><p class="plan-boundary"><strong>Paid is not insured.</strong> Keep payment, submission, insurer response, broker decision and policy evidence distinct. The current synthetic document proves no insurance.</p></section>
  <section id="domains" aria-labelledby="domains-title"><div class="section-heading"><h2 id="domains-title">All 15 architecture domains mapped</h2><p>15 mapped · 0 fully complete</p></div><p class="section-intro">Multi-insurer brokerage across all insurance lines remains the scope. The 12-category synthetic catalogue is the demo baseline. Every real product/version and partner needs approved terms, rates, authority and acceptance evidence. Mapping a domain to work does not complete its implementation.</p><details class="contract-details"><summary>BIZTRUST-IB-ARCH-001: current coverage, remaining work and phase mapping</summary>${dataTable(["Domain", "Architecture scope", "Current position", "Remaining acceptance", "Phases", "Milestones"], domains, "Architecture domain coverage")}</details></section>
  <section id="production" aria-labelledby="production-title"><div class="section-heading"><h2 id="production-title">Production acceptance gates</h2><p>Six acceptance records pending</p></div><p class="section-intro">Attach dated acceptance to the exact product, provider, release and environment. Owners define service and recovery targets before testing. Follow the P0–P7 roadmap above; a release artifact alone does not authorize activation.</p><div class="plan-gate-grid">${gates.map(([title, evidence, owner, ids]) => `<article class="plan-acceptance"><h3>${escapeHtml(title)}</h3><p>${inline(evidence)}</p><p class="plan-owner">${escapeHtml(owner)}</p><div>${refs(ids)}</div></article>`).join("")}</div><div class="plan-next"><p class="eyebrow">Next implementation sequence</p><p><strong>Product/rating governance + tenant/role foundation → authorized staff work → payment/insurer processing → policy lifecycle and servicing → staging → approved production pilot.</strong></p><p>Collect business/provider decisions first; prepare contracts and infrastructure in parallel. Record dated evidence in <a href="progress-updates.md">progress updates</a>. The <a href="implementation-plan.md">backend and domain plan</a> is the source for these sections.</p></div></section></div>`;
}

export const planStyles = `
  .implementation-supplement section { margin-bottom: 34px; }
  .plan-diagram-scroll { overflow-x: auto; background: #f8fbf9; border: 1px solid #d9e5dd; border-radius: 12px; }
  .plan-diagram-scroll:focus-visible { outline: 3px solid #0b7a68; outline-offset: 3px; }
  .plan-commit-svg { width: 100%; min-width: 900px; height: auto; display: block; font-family: Inter, 'Segoe UI', Arial, sans-serif; }
  .plan-commit-svg .plan-stage rect { fill: white; stroke: #97bbab; stroke-width: 1.5; }
  .plan-commit-svg .plan-stage.partial rect { fill: #fffcf5; stroke: #b9a675; }
  .plan-commit-svg .plan-stage.planned rect { fill: #f3f7fa; stroke: #9aadb9; stroke-dasharray: 6 4; }
  .plan-node-id { font-size: 10px; font-weight: 800; fill: #4c6657; letter-spacing: .035em; }
  .plan-node-title { font-size: 16px; font-weight: 700; fill: #203e2e; }
  .plan-node-note { font-size: 12px; fill: #4a6053; }
  .plan-arrow { stroke: #588575; stroke-width: 1.6; fill: none; }
  .plan-arrow.future { stroke-dasharray: 5 4; }
  .plan-edge-label { font-size: 12px; font-weight: 650; fill: #3d614e; paint-order: stroke; stroke: #f8fbf9; stroke-width: 4px; }
  .plan-boundary { padding: 14px 18px; border-radius: 9px; background: #fff3e4; border: 1px solid #edd6b8; color: #684c2d; font-size: 12px; line-height: 1.6; }
  .implementation-supplement .contract-details { margin-top: 14px; }
  .implementation-supplement table { min-width: 1050px; }
  .implementation-supplement tbody th { text-align: left; vertical-align: top; padding: 12px; color: #315740; }
  .plan-gate-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .plan-acceptance { padding: 18px; border: 1px solid #e4d8c8; border-top: 3px solid #bc9570; border-radius: 9px; background: #fffcf8; }
  .plan-acceptance h3 { margin: 0 0 10px; font-size: 14px; color: #563f2b; }
  .plan-acceptance p { font-size: 12px; line-height: 1.6; color: #625746; }
  .plan-acceptance .plan-owner { font-weight: 700; font-size: 11px; border-top: 1px solid #eee1cf; padding-top: 10px; }
  .plan-next { margin-top: 20px; border-radius: 10px; background: #e7f1eb; padding: 20px; font-size: 13px; line-height: 1.6; }
  .plan-next p { margin: 0 0 8px; }
  .plan-next p:last-child { margin: 0; color: #506557; font-size: 12px; }
  @media (max-width: 1180px) { .plan-gate-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) { .plan-gate-grid { grid-template-columns: 1fr; } }
  @media print { .plan-diagram-scroll { overflow: visible; } .plan-commit-svg, .implementation-supplement table { min-width: 0; width: 100%; } .plan-acceptance { break-inside: avoid; } }
`;

export const planScript = `
  let closedBeforePrint = [];
  window.addEventListener('beforeprint', () => {
    closedBeforePrint = [...document.querySelectorAll('details:not([open])')];
    for (const item of closedBeforePrint) item.open = true;
  });
  window.addEventListener('afterprint', () => {
    for (const item of closedBeforePrint) item.open = false;
  });
`;
