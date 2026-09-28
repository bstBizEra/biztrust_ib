// Repository reuse inventory for the generated progress board.
const tiers = ["Existing", "Next", "Later", "Reference"];
const kinds = new Set(["Repository", "Topic", "Workflow"]);
const methods = new Set([
  "Package",
  "Upstream service",
  "Clone to inspect",
  "Reference only",
  "Conditional package",
  "Conditional service",
]);

function knownIds(values, label) {
  if (!values || typeof values[Symbol.iterator] !== "function")
    throw new Error(`Repository renderer requires ${label} IDs`);
  const entries = values instanceof Map ? values.keys() : values;
  return new Set(
    Array.from(entries, (item) => (typeof item === "string" ? item : item.id)),
  );
}

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Missing repository plan text: ${field}`);
  return value;
}

function safeUrl(value, field) {
  requiredText(value, field);
  if (
    !/^https:\/\//i.test(value) ||
    /[\s\\]/u.test(value) ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error(`Repository URL must be plain HTTPS: ${field}`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid repository URL: ${field}`);
  }
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  )
    throw new Error(`Unsafe repository URL: ${field}`);
  return parsed.href;
}

function references(values, known, field) {
  if (!Array.isArray(values) || !values.length)
    throw new Error(`Repository plan needs ${field} references`);
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== "string" || !known.has(value) || seen.has(value))
      throw new Error(`Invalid or duplicate repository ${field}: ${value}`);
    seen.add(value);
  }
}

export function renderRepositories(
  plan,
  { escapeHtml, milestones, moduleIds },
) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.entries))
    throw new Error("Repository plan must contain entries");
  if (!plan.entries.length) throw new Error("Repository plan is empty");
  if (
    typeof plan.reviewedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(plan.reviewedAt) ||
    !Number.isFinite(Date.parse(plan.reviewedAt)) ||
    new Date(plan.reviewedAt).toISOString().slice(0, 10) !== plan.reviewedAt
  )
    throw new Error("Repository plan reviewedAt must be a valid ISO date");
  requiredText(plan.summary, "summary");
  if (typeof escapeHtml !== "function")
    throw new Error("Repository renderer requires escapeHtml");
  const knownMilestones = knownIds(milestones, "milestone");
  const knownModules = knownIds(moduleIds, "module");
  const knownPhases = new Set(Array.from({ length: 8 }, (_, i) => `P${i}`));
  const ids = new Set();
  const entries = plan.entries.map((entry) => {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.id) ||
      ids.has(entry.id)
    )
      throw new Error(`Invalid or duplicate repository ID: ${entry?.id}`);
    ids.add(entry.id);
    for (const field of [
      "name",
      "license",
      "purpose",
      "current",
      "integration",
      "acceptance",
      "forkPolicy",
      "versionPolicy",
    ])
      requiredText(entry[field], `${entry.id}.${field}`);
    if (!kinds.has(entry.kind))
      throw new Error(`Invalid repository kind: ${entry.id}`);
    if (!tiers.includes(entry.tier))
      throw new Error(`Invalid repository tier: ${entry.id}`);
    if (!methods.has(entry.method))
      throw new Error(`Invalid repository method: ${entry.id}`);
    if (entry.kind !== "Repository" && entry.method !== "Reference only")
      throw new Error(`Topic/workflow must be reference only: ${entry.id}`);
    references(entry.modules, knownModules, `${entry.id}.modules`);
    references(entry.phases, knownPhases, `${entry.id}.phases`);
    references(entry.milestones, knownMilestones, `${entry.id}.milestones`);
    if (!Array.isArray(entry.sources) || !entry.sources.length)
      throw new Error(`Repository source evidence is missing: ${entry.id}`);
    const sources = entry.sources.map((source, index) => {
      const field = `${entry.id}.sources[${index}]`;
      if (!source || typeof source !== "object")
        throw new Error(`Invalid repository source: ${field}`);
      return {
        label: requiredText(source.label, `${field}.label`),
        url: safeUrl(source.url, `${field}.url`),
      };
    });
    return { ...entry, url: safeUrl(entry.url, `${entry.id}.url`), sources };
  });
  const e = escapeHtml;
  const counts = Object.fromEntries(
    tiers.map((tier) => [
      tier,
      entries.filter((entry) => entry.tier === tier).length,
    ]),
  );
  const externalLink = (url, label) =>
    `<a href="${e(url)}" rel="noreferrer">${e(label)}</a>`;
  const referenceLinks = (values, prefix) =>
    values
      .map(
        (value) =>
          `<a class="id-link" href="#${prefix}${e(value)}">${e(value)}</a>`,
      )
      .join(" ");
  const cards = entries
    .map((entry) => {
      const search = [
        entry.id,
        entry.name,
        entry.kind,
        entry.tier,
        entry.method,
        entry.purpose,
        entry.current,
        entry.integration,
        entry.acceptance,
        entry.license,
        entry.forkPolicy,
        entry.versionPolicy,
        ...entry.modules,
        ...entry.phases,
        ...entry.milestones,
      ]
        .join(" ")
        .toLowerCase();
      return `<article id="repo-${e(entry.id)}" class="repo-card repo-tier-${entry.tier.toLowerCase()}" data-repo-tier="${e(entry.tier)}" data-repo-search="${e(search)}">
      <div class="repo-card-top"><span class="repo-kind">${e(entry.kind)}</span><span class="repo-tier">${e(entry.tier)}</span></div>
      <h3>${externalLink(entry.url, entry.name)}</h3><p class="repo-method">${e(entry.method)}</p>
      <p class="repo-purpose">${e(entry.purpose)}</p>
      <dl class="repo-mapping"><div><dt>Phases</dt><dd>${referenceLinks(entry.phases, "phase-")}</dd></div><div><dt>Modules</dt><dd>${referenceLinks(entry.modules, "module-")}</dd></div><div><dt>Milestones</dt><dd>${referenceLinks(entry.milestones, "")}</dd></div></dl>
      <p class="repo-current"><strong>Current position</strong>${e(entry.current)}</p>
      <details class="repo-details"><summary>Integration, acceptance &amp; reuse policy</summary><dl>
        <div><dt>Integration</dt><dd>${e(entry.integration)}</dd></div>
        <div><dt>Acceptance</dt><dd>${e(entry.acceptance)}</dd></div>
        <div><dt>License</dt><dd>${e(entry.license)}</dd></div>
        <div><dt>Fork policy</dt><dd>${e(entry.forkPolicy)}</dd></div>
        <div><dt>Version policy</dt><dd>${e(entry.versionPolicy)}</dd></div>
        <div><dt>Upstream evidence</dt><dd>${entry.sources.map((item) => externalLink(item.url, item.label)).join(" · ")}</dd></div>
      </dl></details>
    </article>`;
    })
    .join("");
  return `<section id="repositories" aria-labelledby="repositories-title">
    <div class="section-heading"><h2 id="repositories-title">Repository reuse plan</h2><p>Reviewed ${e(plan.reviewedAt)}</p></div>
    <p class="section-intro">${e(plan.summary)}</p>
    <div class="repo-metrics" aria-label="Repository plan totals"><div><strong>${entries.length}</strong><span>Upstream entries</span></div>${tiers.map((tier) => `<div><strong>${counts[tier]}</strong><span>${e(tier)}</span></div>`).join("")}</div>
    <p class="repo-guide">Existing = present in the local project. Next = proposed for the next relevant phase. Later = conditional on demonstrated need. Reference = guidance for engineering decisions. A topic page or workflow file is a reference, not a standalone repository.</p>
    <div class="repo-controls"><div class="repo-filters" role="group" aria-label="Filter repository plan by tier"><button type="button" class="repo-filter" data-repo-tier-filter="All" aria-pressed="true">All <span>${entries.length}</span></button>${tiers.map((tier) => `<button type="button" class="repo-filter" data-repo-tier-filter="${tier}" aria-pressed="false">${tier} <span>${counts[tier]}</span></button>`).join("")}</div><div class="repo-search-wrap"><label for="repo-search">Find a repository, module or milestone</label><input id="repo-search" type="search" placeholder="Search reuse plan…" autocomplete="off" /></div></div>
    <p id="repo-results" class="repo-result-count" role="status" aria-live="polite">Showing ${entries.length} of ${entries.length} entries</p>
    <div class="repo-grid">${cards}</div>
    <p class="repo-empty" hidden>No entries match this tier and search. Clear the search or select All.</p>
    <p class="repo-source">Plan and acquisition decisions: <a href="repository-reuse.md">repository reuse guide</a> · <a href="repository-plan.json">structured source</a>. The inventory records adoption intent; installation, cloning or a passing check does not satisfy the linked production acceptance boundary.</p>
  </section>`;
}

export const repositoryStyles = `
  #repositories { margin-bottom: 34px; }
  .repo-metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 18px 0 12px; }
  .repo-metrics > div { min-width: 0; padding: 15px 16px; border: 1px solid #dce5de; border-radius: 8px; background: #f4f8f5; }
  .repo-metrics strong { display: block; font-size: 24px; color: #254f3a; line-height: 1.2; }
  .repo-metrics span { display: block; margin-top: 5px; font-size: 11px; color: #4c6557; }
  .repo-guide, .repo-source { font-size: 12px; line-height: 1.65; color: #52675b; }
  .repo-controls { display: flex; align-items: end; justify-content: space-between; flex-wrap: wrap; gap: 15px; margin: 22px 0 12px; }
  .repo-filters { display: flex; flex-wrap: wrap; gap: 6px; }
  .repo-filter { padding: 8px 10px; border: 1px solid #cddcd2; background: #fff; border-radius: 6px; font: inherit; font-size: 11px; font-weight: 650; color: #345641; cursor: pointer; }
  .repo-filter span { margin-left: 3px; font-weight: 500; }
  .repo-filter[aria-pressed="true"] { color: #fff; background: #2f654b; border-color: #2f654b; }
  .repo-filter:focus-visible, #repo-search:focus-visible, .repo-details summary:focus-visible { outline: 3px solid #0b7a68; outline-offset: 3px; }
  .repo-search-wrap { min-width: 0; flex: 1 1 220px; max-width: 330px; }
  .repo-search-wrap label { display: block; font-size: 10px; font-weight: 700; color: #4c6557; margin-bottom: 6px; }
  #repo-search { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid #cddcd2; border-radius: 6px; padding: 9px 11px; font: inherit; font-size: 12px; background: #fff; color: #284733; }
  .repo-result-count { font-size: 11px; color: #52675b; margin: 0 0 13px; }
  .repo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 14px; }
  .repo-card { min-width: 0; overflow-wrap: anywhere; border: 1px solid #dce5de; border-top: 3px solid #93b9a2; border-radius: 9px; padding: 19px; background: #fff; }
  .repo-card[hidden], .repo-empty[hidden] { display: none; }
  .repo-card:target { outline: 3px solid #36836a; outline-offset: 3px; background: #f8fff9; }
  .repo-tier-next { border-top-color: #5a8fa7; }
  .repo-tier-later { border-top-color: #b29a70; }
  .repo-tier-reference { border-top-color: #aaa5b7; }
  .repo-card-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: center; }
  .repo-kind { text-transform: uppercase; letter-spacing: .1em; font-size: 9px; font-weight: 750; color: #52675b; }
  .repo-tier { padding: 3px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; background: #e9f2eb; color: #355f45; }
  .repo-tier-next .repo-tier { background: #e9f3f8; color: #315e76; }
  .repo-tier-later .repo-tier { background: #fbf1df; color: #745722; }
  .repo-tier-reference .repo-tier { background: #f0eef5; color: #63576f; }
  .repo-card h3 { margin: 12px 0 6px; font-size: 17px; line-height: 1.35; }
  .repo-card h3 a { color: #254f3a; text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .repo-method { margin: 0 0 11px; font-size: 10px; font-weight: 700; color: #52675b; }
  .repo-purpose, .repo-current { font-size: 12px; line-height: 1.65; color: #40594a; }
  .repo-mapping { margin: 15px 0; display: grid; gap: 8px; }
  .repo-mapping > div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; }
  .repo-mapping dt { font-size: 10px; font-weight: 700; color: #52675b; padding-top: 3px; }
  .repo-mapping dd { margin: 0; line-height: 1.8; }
  .repo-current { padding: 12px 13px; border-radius: 6px; background: #f4f8f5; margin: 0 0 12px; }
  .repo-current strong { display: block; font-size: 10px; margin-bottom: 4px; }
  .repo-details { border-top: 1px solid #e0e8e2; padding-top: 11px; }
  .repo-details summary { cursor: pointer; color: #355f45; font-size: 11px; font-weight: 700; line-height: 1.5; }
  .repo-details dl { display: grid; gap: 12px; margin: 16px 0 0; }
  .repo-details dt { color: #315740; font-size: 10px; font-weight: 750; margin-bottom: 4px; }
  .repo-details dd { color: #52675b; margin: 0; font-size: 12px; line-height: 1.65; }
  .repo-details dd a { color: #2d604a; }
  .repo-empty { padding: 24px; border: 1px dashed #c7d7cc; border-radius: 8px; color: #52675b; font-size: 13px; }
  .repo-source { margin: 16px 0 0; }
  @media (max-width: 800px) { .repo-grid { grid-template-columns: 1fr; } .repo-search-wrap { max-width: none; } }
  @media (max-width: 560px) { .repo-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .repo-metrics > div:first-child { grid-column: 1 / -1; } .repo-card { padding: 16px; } }
  @media print { .repo-controls, .repo-result-count, .repo-empty { display: none !important; } .repo-card, .repo-card[hidden] { display: block !important; break-inside: avoid; } .repo-grid { display: block; } .repo-card { margin-bottom: 12px; } }
`;

export const repositoryScript = `
  (() => {
    const repoSection = document.getElementById('repositories');
    if (!repoSection) return;
    const repoCards = [...repoSection.querySelectorAll('[data-repo-tier]')];
    const repoButtons = [...repoSection.querySelectorAll('[data-repo-tier-filter]')];
    const repoSearch = repoSection.querySelector('#repo-search');
    const repoResults = repoSection.querySelector('#repo-results');
    const repoEmpty = repoSection.querySelector('.repo-empty');
    let repoActiveTier = 'All';
    function filterRepositories() {
      const terms = repoSearch.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);
      let visible = 0;
      for (const card of repoCards) {
        card.hidden = !(repoActiveTier === 'All' || card.dataset.repoTier === repoActiveTier) || !terms.every(term => card.dataset.repoSearch.includes(term));
        if (!card.hidden) visible += 1;
      }
      for (const button of repoButtons) button.setAttribute('aria-pressed', String(button.dataset.repoTierFilter === repoActiveTier));
      repoResults.textContent = 'Showing ' + visible + ' of ' + repoCards.length + ' entries';
      repoEmpty.hidden = visible !== 0;
    }
    for (const button of repoButtons) button.addEventListener('click', () => {
      repoActiveTier = button.dataset.repoTierFilter;
      filterRepositories();
    });
    repoSearch.addEventListener('input', filterRepositories);
    function revealLinkedRepository() {
      const id = window.location.hash.slice(1);
      const card = repoCards.find(item => item.id === id);
      if (!card || !card.hidden) return;
      repoActiveTier = 'All';
      repoSearch.value = '';
      filterRepositories();
      card.scrollIntoView({ block: 'start' });
    }
    window.addEventListener('hashchange', revealLinkedRepository);
    revealLinkedRepository();
  })();
`;
