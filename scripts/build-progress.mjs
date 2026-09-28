import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import { diagramSection, diagramStyles } from "./progress-diagrams.mjs";
import { renderPlan, planStyles, planScript } from "./progress-plan.mjs";
import {
  renderRepositories,
  repositoryStyles,
  repositoryScript,
} from "./progress-repositories.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "docs", "progress.md");
const outputPath = path.join(root, "docs", "progress.html");
const check = process.argv.includes("--check");
const source = await readFile(sourcePath, "utf8");
const implementationSource = await readFile(
  path.join(root, "docs", "implementation-plan.md"),
  "utf8",
);
const linkedFiles = new Set();
const repositoryPlan = JSON.parse(
  await readFile(path.join(root, "docs", "repository-plan.json"), "utf8"),
);

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(value) {
  return value
    .split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g)
    .map((part) => {
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const target = path.resolve(path.dirname(sourcePath), link[2]);
        if (
          !/^[\w./-]+\.(md|ts|tsx|json|sql|yml|yaml|html)$/.test(link[2]) ||
          !target.startsWith(root + path.sep)
        )
          throw new Error(`Unexpected progress link: ${link[2]}`);
        linkedFiles.add(target);
        return `<a href="${escapeHtml(link[2])}">${escapeHtml(link[1])}</a>`;
      }
      if (/^`[^`]+`$/.test(part))
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      return escapeHtml(part);
    })
    .join("");
}

function sectionTable(heading, columns) {
  const section = source.split(`## ${heading}`)[1]?.split(/\r?\n## /)[0];
  const rows = section?.split(/\r?\n/).filter((line) => line.startsWith("|"));
  if (!rows || rows.length < 3) throw new Error(`Missing ${heading} table`);
  return rows.slice(2).map((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== columns || cells.some((cell) => !cell))
      throw new Error(`Invalid ${heading} row: ${line}`);
    return cells;
  });
}

const snapshot = source.match(
  /^\*\*Snapshot:\*\* ([^·\n]+) · \*\*Version:\*\* ([^·\n]+) · \*\*Release boundary:\*\* ([^\n]+)/m,
);
if (!snapshot) throw new Error("progress.md snapshot is missing or malformed");
if (!source.includes("**Production status: blocked.**")) {
  throw new Error(
    "Production gate changed; review and update the HTML board generator",
  );
}

const scopeTable = source.match(
  /## At a glance\r?\n\r?\n\| Area[^\n]*\r?\n\|[-| :]+\|\r?\n([\s\S]*?)\r?\n\r?\n\*\*Production status/,
);
if (!scopeTable)
  throw new Error("progress.md at-a-glance table is missing or malformed");
const scope = scopeTable[1]
  .trim()
  .split(/\r?\n/)
  .map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim()),
  );
if (scope.some((cells) => cells.length !== 3))
  throw new Error("Invalid at-a-glance row");
const scopeCards = scope
  .map(
    ([area, current, next]) =>
      `<div class="scope"><h3>${escapeHtml(area)}</h3><p>${inline(current)}</p><small>Next: ${inline(next)}</small></div>`,
  )
  .join("\n");

const table = source.match(
  /## Milestones\r?\n[\s\S]*?\r?\n\| ID\s*\|[^\n]*\r?\n\|[-| :]+\|\r?\n([\s\S]*?)\r?\n\r?\n## Next working sequence/,
);
if (!table)
  throw new Error("progress.md milestone table is missing or malformed");

const allowed = new Set(["Verified", "In progress", "Planned", "Blocked"]);
const milestones = table[1]
  .trim()
  .split(/\r?\n/)
  .map((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (
      cells.length !== 5 ||
      !/^BT-\d{2,}$/.test(cells[0]) ||
      !allowed.has(cells[2])
    ) {
      throw new Error(`Invalid milestone row: ${line}`);
    }
    const separator = cells[1].indexOf(": ");
    return {
      id: cells[0],
      title: separator < 0 ? cells[1] : cells[1].slice(0, separator),
      detail: separator < 0 ? "" : cells[1].slice(separator + 2),
      status: cells[2],
      owner: cells[3],
      evidence: cells[4],
    };
  });
if (new Set(milestones.map((item) => item.id)).size !== milestones.length)
  throw new Error("Duplicate milestone ID");
const milestoneById = new Map(milestones.map((item) => [item.id, item]));

const counts = Object.fromEntries(
  [...allowed].map((status) => [
    status,
    milestones.filter((item) => item.status === status).length,
  ]),
);
const statusClass = {
  Verified: "verified",
  "In progress": "in-progress",
  Planned: "planned",
  Blocked: "blocked",
};
const cards = milestones
  .map(
    (
      item,
    ) => `<article id="${item.id}" class="milestone" data-status="${statusClass[item.status]}" data-search="${escapeHtml(`${item.id} ${item.title} ${item.detail} ${item.owner} ${item.status}`.toLowerCase())}">
  <div class="milestone-top"><span class="milestone-id">${item.id}</span><span class="badge ${statusClass[item.status]}">${item.status}</span></div>
  <h3>${escapeHtml(item.title)}</h3>
  <p class="milestone-detail">${escapeHtml(item.detail)}</p>
  <div class="milestone-bottom"><p><span class="meta-label">Owner</span><strong>${escapeHtml(item.owner)}</strong></p><p><span class="meta-label">Evidence / dependency</span><span>${inline(item.evidence)}</span></p></div>
</article>`,
  )
  .join("\n");

const phases = sectionTable("Delivery phases", 5);
if (
  phases.map(([phase]) => phase.split(" ")[0]).join(",") !==
  "P0,P1,P2,P3,P4,P5,P6,P7"
)
  throw new Error("Delivery phases must cover P0 through P7 in order");
const modules = sectionTable("Module map", 6).map(
  ([id, title, layer, current, next, source]) => ({
    id,
    title,
    layer,
    current,
    next,
    source,
  }),
);
const moduleMap = new Map(modules.map((item) => [item.id, item]));
if (
  moduleMap.size !== modules.length ||
  modules.some((item) => !/^[a-z][a-z-]+$/.test(item.id))
)
  throw new Error("Module IDs must be unique lowercase slugs");
const connections = sectionTable("Module connections", 4).map(
  ([from, to, contract, delivery]) => ({ from, to, contract, delivery }),
);
for (const edge of connections) {
  if (
    !moduleMap.has(edge.from) ||
    !moduleMap.has(edge.to) ||
    !["Local", "Partial", "Planned"].includes(edge.delivery)
  )
    throw new Error(`Invalid module connection: ${JSON.stringify(edge)}`);
}
const journeys = sectionTable("Frontend journeys", 5);
const milestoneLinks = (value) =>
  inline(value).replace(/BT-\d{2,}/g, (id) => {
    if (!milestones.some((item) => item.id === id))
      throw new Error(`Unknown milestone: ${id}`);
    return `<a class="id-link" href="#${id}">${id}</a>`;
  });
const phaseCards = phases
  .map(([phase, outcome, refs, work, exit], index) => {
    const ids = [...new Set(refs.match(/BT-\d{2,}/g) ?? [])];
    if (!ids.length || ids.some((id) => !milestoneById.has(id)))
      throw new Error(`Invalid milestone references for ${phase}`);
    const verified = ids.filter(
      (id) => milestoneById.get(id).status === "Verified",
    ).length;
    return `
  <article class="phase" id="phase-P${index}"><div class="phase-index">${String(index).padStart(2, "0")}</div>
  <div><h3>${escapeHtml(phase)}</h3><p class="phase-outcome">${inline(outcome)}</p>
  <div class="phase-progress"><div class="phase-progress-label"><span>Locally verified milestones</span><strong>${verified} / ${ids.length}</strong></div>
  <progress max="${ids.length}" value="${verified}" aria-label="${escapeHtml(`${phase}: ${verified} of ${ids.length} linked milestones verified locally`)}">${verified} of ${ids.length}</progress></div>
  <div class="phase-refs">${milestoneLinks(refs)}</div>
  <details><summary>Work, dependencies &amp; exit evidence</summary>
  <p><span class="meta-label">Work and dependencies</span>${inline(work)}</p>
  <p><span class="meta-label">Exit evidence</span>${inline(exit)}</p></details></div></article>`;
  })
  .join("\n");
const moduleLink = (id) =>
  `<a href="#module-${id}">${escapeHtml(moduleMap.get(id).title)}</a>`;
const moduleCards = modules
  .map((item) => {
    const outgoing = connections.filter((edge) => edge.from === item.id);
    const incoming = connections.filter((edge) => edge.to === item.id);
    return `<article class="module-card" id="module-${item.id}"><span class="module-layer">${escapeHtml(item.layer)}</span>
    <h3>${escapeHtml(item.title)}</h3><p><span class="meta-label">Current implementation</span>${inline(item.current)}</p>
    <p><span class="meta-label">Production completion</span>${inline(item.next)}</p>
    <details><summary>Connections &amp; source</summary>
    ${incoming.length ? `<p><span class="meta-label">Receives from</span>${[...new Set(incoming.map((edge) => edge.from))].map(moduleLink).join(" · ")}</p>` : ""}
    ${outgoing.length ? `<p><span class="meta-label">Sends to / calls</span>${[...new Set(outgoing.map((edge) => edge.to))].map(moduleLink).join(" · ")}</p>` : ""}
    <p><span class="meta-label">Source / design</span>${inline(item.source)}</p></details></article>`;
  })
  .join("\n");
const connectionRows = connections
  .map(
    (edge) =>
      `<tr><td>${moduleLink(edge.from)}</td><td>${moduleLink(edge.to)}</td><td>${inline(edge.contract)}</td><td><span class="connection-status ${edge.delivery.toLowerCase()}">${edge.delivery}</span></td></tr>`,
  )
  .join("\n");
const journeyModuleLinks = (value) =>
  value
    .split(",")
    .map((id) => {
      const key = id.trim();
      if (!moduleMap.has(key))
        throw new Error(`Unknown frontend journey module: ${key}`);
      return `<a href="#module-${key}">${escapeHtml(key)}</a>`;
    })
    .join(", ");
const journeyCards = journeys
  .map(
    ([
      experience,
      screens,
      api,
      domain,
      next,
    ]) => `<article class="journey"><h3>${escapeHtml(experience)}</h3>
  <ol><li><span class="meta-label">Frontend</span>${inline(screens)}</li><li><span class="meta-label">API boundary</span>${inline(api)}</li><li><span class="meta-label">Domain modules</span>${journeyModuleLinks(domain)}</li></ol>
  <p><span class="meta-label">To complete for production</span>${inline(next)}</p></article>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Implementation plan · BizTrust</title>
    <style>
      :root { font-family: Inter, "Segoe UI", Arial, sans-serif; color: #26352f; background: #f4f7f5; font-synthesis: none; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      [hidden] { display: none !important; }
      [id] { scroll-margin-top: 24px; }
      a { color: #075d50; text-underline-offset: 3px; }
      a:hover { color: #034537; }
      a:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid #0b7a68; outline-offset: 3px; }
      .shell { min-height: 100vh; display: grid; grid-template-columns: 238px minmax(0, 1fr); }
      .rail { background: #173f30; color: #e9f3ed; padding: 30px 22px; display: flex; flex-direction: column; gap: 34px; }
      .brand { display: flex; align-items: center; gap: 11px; color: white; text-decoration: none; font-weight: 750; letter-spacing: .01em; font-size: 20px; }
      .brand img { width: 34px; height: 34px; background: white; padding: 4px; border-radius: 9px; }
      .rail-label { color: #aacabb; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; font-weight: 800; margin: 0 0 12px; }
      .rail nav { display: grid; gap: 6px; }
      .rail nav a { color: #dcece2; text-decoration: none; padding: 10px 12px; border-radius: 8px; font-size: 14px; }
      .rail nav a:hover, .rail nav a.active { background: #2c624c; color: white; }
      .rail-inner { position: sticky; top: 28px; display: grid; gap: 28px; min-width: 0; width: 100%; max-height: calc(100vh - 56px); overflow-y: auto; }
      .rail-inner > div { min-width: 0; }
      .rail-bottom { margin-top: auto; border-top: 1px solid #47735e; padding-top: 20px; color: #c2d9cb; font-size: 12px; line-height: 1.55; }
      .main { min-width: 0; }
      .topbar { height: 69px; background: #fff; border-bottom: 1px solid #dfe8e2; display: flex; align-items: center; justify-content: space-between; padding: 0 36px; gap: 12px; }
      .eyebrow { margin: 0; color: #587164; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
      .topbar-meta { color: #60736a; font-size: 12px; white-space: nowrap; }
      .content { max-width: 1470px; margin: 0 auto; padding: 32px 36px 70px; }
      .heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 25px; }
      h1 { font-size: clamp(26px, 2.2vw, 34px); line-height: 1.15; margin: 5px 0 8px; letter-spacing: -.035em; }
      .intro { margin: 0; color: #5c6e63; max-width: 760px; font-size: 14px; line-height: 1.6; }
      .text-link { font-size: 13px; font-weight: 700; white-space: nowrap; margin-top: 9px; }
      .gate { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 18px; border: 1px solid #d5ded8; border-left: 5px solid #bb7255; background: #fff; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; box-shadow: 0 2px 12px #173f3008; }
      .gate-icon { display: grid; place-items: center; width: 39px; height: 39px; border-radius: 9px; background: #fbebe3; color: #8b492e; font-weight: 800; font-size: 19px; }
      .gate h2 { font-size: 15px; margin: 0 0 4px; }
      .gate p { margin: 0; font-size: 13px; color: #596a60; line-height: 1.5; }
      .gate-tag { color: #84452d; background: #fbebe3; border: 1px solid #efd1c2; border-radius: 100px; padding: 7px 11px; text-transform: uppercase; font-weight: 800; letter-spacing: .07em; font-size: 10px; white-space: nowrap; }
      .overview { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px; }
      .metric { background: #fff; border: 1px solid #dfe8e2; border-radius: 10px; padding: 16px 18px; min-width: 0; }
      .metric span { display: block; color: #627469; text-transform: uppercase; letter-spacing: .09em; font-size: 10px; font-weight: 800; }
      .metric strong { display: block; font-size: 28px; line-height: 1.1; margin-top: 8px; letter-spacing: -.04em; color: #253d31; }
      .metric small { display: block; margin-top: 6px; color: #5d6d62; font-size: 11px; }
      .metric progress { margin-top: 12px; }
      progress { display: block; width: 100%; height: 8px; border: 0; border-radius: 99px; overflow: hidden; color: #0b7a68; background: #e2eae4; }
      progress::-webkit-progress-bar { background: #e2eae4; border-radius: 99px; }
      progress::-webkit-progress-value { background: #0b7a68; border-radius: 99px; }
      progress::-moz-progress-bar { background: #0b7a68; border-radius: 99px; }
      .section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; margin: 0 0 15px; }
      .section-heading h2 { margin: 0; font-size: 18px; letter-spacing: -.02em; }
      .section-heading p { margin: 0; font-size: 12px; color: #586b5e; }
      .scope-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 30px; }
      .scope { border-top: 3px solid #69c6b5; background: #fff; border-radius: 7px; padding: 15px 16px; min-width: 0; }
      .scope h3 { margin: 0 0 10px; font-size: 13px; }
      .scope p { margin: 0 0 9px; font-size: 12px; line-height: 1.45; color: #4c5f54; }
      .scope small { display: block; border-top: 1px solid #e5ebe7; padding-top: 8px; color: #68786e; line-height: 1.4; }
      .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
      .filters { display: flex; flex-wrap: wrap; gap: 6px; }
      .filters button { font: inherit; font-size: 12px; font-weight: 700; background: #fff; color: #52675b; border: 1px solid #d8e3dc; border-radius: 7px; padding: 8px 10px; cursor: pointer; }
      .filters button:hover { background: #edf5ef; }
      .filters button[aria-pressed="true"] { background: #173f30; border-color: #173f30; color: white; }
      .search { min-width: 210px; width: min(280px, 100%); border: 1px solid #cbdad0; border-radius: 7px; background: #fff; padding: 9px 11px; font: inherit; font-size: 12px; color: #26352f; }
      .board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .milestone { min-width: 0; background: #fff; border: 1px solid #dce5de; border-radius: 10px; padding: 17px 18px; display: flex; flex-direction: column; min-height: 217px; box-shadow: 0 2px 9px #173f3006; }
      .milestone[hidden] { display: none; }
      .milestone-top { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
      .milestone-id { color: #566f5f; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
      .badge { font-size: 10px; font-weight: 800; border-radius: 50px; padding: 5px 8px; white-space: nowrap; }
      .badge.verified { color: #125b43; background: #e0f2e6; }
      .badge.in-progress { color: #7b5c16; background: #f9edc9; }
      .badge.planned { color: #536575; background: #eaf0f5; }
      .badge.blocked { color: #8d432c; background: #f9e7df; }
      .milestone h3 { font-size: 17px; line-height: 1.3; letter-spacing: -.02em; margin: 16px 0 7px; }
      .milestone-detail { margin: 0 0 18px; color: #5d6d62; font-size: 12px; line-height: 1.5; }
      .milestone-bottom { border-top: 1px solid #e8eee9; margin-top: auto; padding-top: 10px; display: grid; gap: 8px; }
      .milestone-bottom p { margin: 0; font-size: 11px; line-height: 1.45; }
      .meta-label { display: block; color: #5b6f60; font-size: 9px; text-transform: uppercase; font-weight: 800; letter-spacing: .08em; margin-bottom: 2px; }
      .milestone-bottom strong { font-weight: 700; }
      .milestone-bottom a { font-weight: 650; }
      .empty { padding: 30px; border: 1px dashed #b7cbbd; border-radius: 9px; color: #5a6d60; text-align: center; }
      .empty[hidden] { display: none; }
      .footer { margin-top: 27px; font-size: 12px; color: #617366; line-height: 1.6; }
      .repo-shortcut { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: #e7f1eb; border: 1px solid #b7d1c2; border-radius: 10px; padding: 18px 20px; margin-bottom: 28px; text-decoration: none; }
      .repo-shortcut strong { display: block; font-size: 15px; margin-bottom: 6px; }
      .repo-shortcut small { display: block; font-size: 12px; line-height: 1.6; color: #405d4b; }
      .repo-shortcut > span:last-child { font-size: 12px; font-weight: 750; }
      .content > section { margin-bottom: 34px; }
      .section-intro { font-size: 13px; line-height: 1.7; color: #52675b; max-width: 950px; margin: -3px 0 18px; }
      .phase-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .phase { border: 1px solid #dce5de; border-radius: 10px; background: white; padding: 20px; display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 13px; align-content: start; }
      .phase-index { width: 35px; height: 35px; border-radius: 50%; display: grid; place-items: center; background: #e7f1eb; color: #25533f; font-size: 12px; font-weight: 800; }
      .phase h3 { margin: 7px 0 11px; font-size: 15px; }
      .phase-outcome { font-size: 12px; color: #52675b; line-height: 1.6; margin: 0 0 12px; }
      .phase-progress { margin: 8px 0 14px; }
      .phase-progress-label { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; color: #4d6356; font-size: 11px; line-height: 1.4; margin-bottom: 8px; }
      .phase-progress-label strong { white-space: nowrap; font-size: 12px; color: #214e3b; }
      .phase-refs { font-size: 11px; color: #607569; line-height: 2.4; }
      .id-link { display: inline-block; font-size: 10px; font-weight: 750; border: 1px solid #d5e3db; padding: 0 5px; line-height: 1.8; border-radius: 4px; text-decoration: none; }
      details { border-top: 1px solid #e1e9e3; padding-top: 12px; margin-top: 13px; }
      summary { font-size: 12px; font-weight: 700; color: #315e49; cursor: pointer; line-height: 1.6; }
      summary:focus-visible { outline: 3px solid #0b7a68; outline-offset: 4px; }
      details p { font-size: 12px; line-height: 1.7; color: #52675b; }
      .module-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .module-card { min-width: 0; background: #fff; border: 1px solid #dce5de; border-top: 3px solid #84af9a; border-radius: 8px; padding: 19px; }
      .module-card:target, .milestone:target { outline: 3px solid #36836a; outline-offset: 3px; background: #f8fff9; }
      .module-layer { font-size: 9px; color: #42614e; text-transform: uppercase; letter-spacing: .12em; font-weight: 800; }
      .module-card h3 { font-size: 15px; margin: 10px 0 14px; line-height: 1.4; }
      .module-card p { font-size: 12px; line-height: 1.6; color: #52675b; }
      .module-card .meta-label { font-size: 9px; margin-bottom: 4px; }
      .contract-details { background: white; border: 1px solid #dce5de; padding: 16px 20px; border-radius: 10px; margin-bottom: 16px; }
      .table-scroll { overflow-x: auto; margin-top: 15px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; min-width: 680px; }
      th { padding: 12px; background: #eff5f1; color: #3e5c49; }
      td { padding: 12px; border-bottom: 1px solid #e1e9e4; line-height: 1.6; vertical-align: top; }
      td:first-child, td:nth-child(2) { width: 20%; }
      .connection-status { display: inline-block; font-size: 10px; padding: 4px 7px; border-radius: 5px; white-space: nowrap; background: #e3f2e9; color: #215c43; }
      .connection-status.partial { background: #faf0d6; color: #795b19; }
      .connection-status.planned { background: #ebf0f5; color: #50677b; }
      .journey-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .journey { background: white; border: 1px solid #dce5de; border-radius: 10px; padding: 20px; }
      .journey h3 { margin: 0 0 18px; font-size: 15px; }
      .journey ol { padding-left: 24px; margin: 0; }
      .journey li { font-size: 12px; line-height: 1.65; color: #52675b; padding: 0 0 14px 6px; }
      .journey li::marker { color: #39664f; font-weight: 800; }
      .journey > p { font-size: 12px; line-height: 1.65; color: #52675b; border-top: 1px solid #e1e9e3; padding-top: 14px; margin-bottom: 0; }
      .skip-link { position: absolute; top: -80px; left: 12px; background: white; z-index: 10; padding: 10px; }
      .skip-link:focus { top: 10px; }
      code { overflow-wrap: anywhere; }
      ${diagramStyles}
      ${planStyles}
      ${repositoryStyles}
      @media (max-width: 1180px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } .scope-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 1180px) { .module-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .phase-grid { grid-template-columns: 1fr; } }
      @media (max-width: 800px) { .shell { display: block; } .rail { padding: 14px 18px; gap: 10px; } .rail nav { display: flex; overflow-x: auto; } .rail nav a { white-space: nowrap; } .rail-label, .rail-bottom { display: none; } .topbar { padding: 0 20px; height: 52px; } .content { padding: 23px 20px 50px; } .heading { display: block; } .overview { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 560px) { .topbar-meta { display: none; } .overview { gap: 8px; } .scope-grid, .board { grid-template-columns: 1fr; } .gate { grid-template-columns: auto 1fr; } .gate-tag { grid-column: 2; justify-self: start; } .toolbar { align-items: stretch; flex-direction: column; } .search { width: 100%; } .section-heading { display: block; } .section-heading p { margin-top: 4px; } }
      @media (max-width: 800px) { .rail-inner { position: static; gap: 12px; max-height: none; overflow: visible; } .journey-grid { grid-template-columns: 1fr; } }
      @media (max-width: 560px) { .module-grid { grid-template-columns: 1fr; } .phase { padding: 16px; gap: 10px; } .content { padding-left: 16px; padding-right: 16px; } }
      @media (prefers-reduced-motion: no-preference) { button, a { transition: background-color .15s ease, color .15s ease; } }
      @media print { .shell { display: block; } .rail, .toolbar { display: none; } .content { max-width: none; padding: 0; } .milestone { break-inside: avoid; box-shadow: none; } .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media print { .phase, .module-card, .journey { break-inside: avoid; } details > * { display: block; } .diagram-panel[hidden] { display: block !important; } }
    </style>
  </head>
  <body>
    <a class="skip-link" href="#overview">Skip to implementation plan</a>
    <div class="shell">
      <aside class="rail" aria-label="Project navigation">
        <div class="rail-inner"><a class="brand" href="../README.md"><img src="../public/brand/logo.svg" alt="" />BizTrust</a>
        <div><p class="rail-label">Implementation plan</p><nav aria-label="Plan sections"><a class="active" href="#overview">Overview</a><a href="#roadmap">Planning → production</a><a href="#repositories">Repositories &amp; reuse</a><a href="#system">System diagrams</a><a href="#frontends">Frontend journeys</a><a href="#modules">Module connections</a><a href="#backend">Backend transactions</a><a href="#domains">Architecture coverage</a><a href="#production">Production gates</a><a href="#milestones">Milestones &amp; owners</a></nav></div>
        <div><p class="rail-label">Project documents</p><nav aria-label="Project documents"><a href="progress.md">Plan source ↗</a><a href="progress-updates.md">Update history ↗</a><a href="architecture.md">Architecture ↗</a><a href="releases.md">Release gate ↗</a></nav></div>
        <p class="rail-bottom">Local demonstration · v${escapeHtml(snapshot[2].trim())}<br />Source: docs/progress.md</p></div>
      </aside>
      <div class="main">
        <header class="topbar"><p class="eyebrow">Project delivery / Implementation plan</p><span class="topbar-meta">Snapshot · ${escapeHtml(snapshot[1].trim())}</span></header>
        <main class="content">
          <div class="heading" id="overview"><div><p class="eyebrow">From planning to production</p><h1>BizTrust implementation plan</h1><p class="intro">One delivery path for the customer experience, operations console and authoritative backend. Explore the phases, follow the module flows, and track the evidence needed to launch.</p></div><a class="text-link" href="progress.md">Plan source ↗</a></div>
          <section class="gate" aria-label="Production release gate"><span class="gate-icon" aria-hidden="true">!</span><div><h2>Production activation is blocked</h2><p>The application rejects <code>DEMO_MODE=false</code>. Local verification and release artifacts do not authorize real payment, insurer issuance or coverage. <a href="system-boundary.md">Review the boundary</a>.</p></div><span class="gate-tag">Gate closed</span></section>
          <section class="overview" aria-label="Milestone counts"><div class="metric"><span>Tracked outcomes</span><strong>${milestones.length}</strong><small>Across demo and production work</small></div><div class="metric"><span>Verified locally</span><strong>${counts.Verified} / ${milestones.length}</strong><small>Demonstration scope only</small><progress max="${milestones.length}" value="${counts.Verified}" aria-label="${counts.Verified} of ${milestones.length} milestones verified locally">${counts.Verified} of ${milestones.length}</progress></div><div class="metric"><span>Blocked</span><strong>${counts.Blocked}</strong><small>Decision or external evidence needed</small></div><div class="metric"><span>Planned / in progress</span><strong>${counts.Planned + counts["In progress"]}</strong><small>Implementation or acceptance pending</small></div></section>
          <a class="repo-shortcut" href="#repositories"><span><strong>Repository reuse plan</strong><small>${repositoryPlan.entries.length} upstream entries · ${repositoryPlan.entries.filter((entry) => entry.tier === "Existing").length} existing · ${repositoryPlan.entries.filter((entry) => entry.tier === "Next").length} next candidates · ${repositoryPlan.entries.filter((entry) => entry.tier === "Later").length} later options · ${repositoryPlan.entries.filter((entry) => entry.tier === "Reference").length} references<br />Fork/clone approach, licenses, integration work and phase/module links.</small></span><span>View repositories →</span></a>
          <section aria-labelledby="scope-title"><div class="section-heading"><h2 id="scope-title">Current scope</h2><p>Release boundary · ${escapeHtml(snapshot[3].trim())}</p></div><div class="scope-grid">${scopeCards}</div></section>
          <section id="roadmap" aria-labelledby="roadmap-title"><div class="section-heading"><h2 id="roadmap-title">Planning → production</h2><p>${phases.length} phases · evidence before promotion</p></div><p class="section-intro">Each bar counts linked milestones marked Verified in the local demonstration; it is not a phase completion score or production approval. P2 has local demonstration evidence. Business decisions in P0/P1 and production work remain open. Expand each phase for work, accountable roles and exit evidence.</p><div class="phase-grid">${phaseCards}</div></section>
          ${renderRepositories(repositoryPlan, { escapeHtml, milestones: new Set(milestones.map((item) => item.id)), moduleIds: new Set(moduleMap.keys()) })}
          ${diagramSection(moduleMap)}
          <section id="frontends" aria-labelledby="frontends-title"><div class="section-heading"><h2 id="frontends-title">Frontend → API → domain</h2><p>${journeys.length} customer, distribution and staff journeys</p></div><p class="section-intro">Separate customer and operations experiences use the same authoritative domain services. Current screens use synthetic data. Planned actions require server authorization, tenant scope and audit evidence before activation.</p><div class="journey-grid">${journeyCards}</div></section>
          <section id="modules" aria-labelledby="modules-title"><div class="section-heading"><h2 id="modules-title">Module responsibilities &amp; connections</h2><p>${modules.length} logical modules · ${connections.length} contracts</p></div><p class="section-intro">The backend starts as a modular monolith. These are logical responsibilities, not ${modules.length} independent services. Each module lists its current scope, production work, incoming/outgoing connections and source.</p><details class="contract-details"><summary>Open all ${connections.length} module-to-module contracts</summary><div class="table-scroll" tabindex="0" role="region" aria-label="Module contracts"><table><caption>Local = synthetic path exists. Partial = implemented in part. Planned = target contract.</caption><thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Contract / data</th><th scope="col">Delivery</th></tr></thead><tbody>${connectionRows}</tbody></table></div></details><div class="module-grid">${moduleCards}</div></section>
          ${renderPlan(implementationSource, new Set(milestones.map((item) => item.id)), escapeHtml, inline)}
          <section id="milestones" aria-labelledby="milestones-title"><div class="section-heading"><h2 id="milestones-title">Milestones &amp; accountable owners</h2><p id="visible-count" aria-live="polite">Showing ${milestones.length} of ${milestones.length}</p></div><div class="toolbar"><div class="filters" role="group" aria-label="Filter by status"><button type="button" data-filter="all" aria-pressed="true">All (${milestones.length})</button><button type="button" data-filter="verified" aria-pressed="false">Verified (${counts.Verified})</button><button type="button" data-filter="in-progress" aria-pressed="false">In progress (${counts["In progress"]})</button><button type="button" data-filter="blocked" aria-pressed="false">Blocked (${counts.Blocked})</button><button type="button" data-filter="planned" aria-pressed="false">Planned (${counts.Planned})</button></div><input class="search" id="search" type="search" aria-label="Search milestones" placeholder="Search ID, owner or work…" /></div><div class="board" id="board">${cards}</div><p class="empty" id="empty" hidden>No milestones match this view.</p></section>
          <p class="footer">This board is a generated view. Change <a href="progress.md">progress.md</a>, the supplemental <a href="implementation-plan.md">backend plan</a> or <a href="repository-plan.json">repository register</a>, add evidence to <a href="progress-updates.md">progress-updates.md</a>, then run <code>npm run progress:build</code>. Counts describe tracked outcomes, not production readiness.</p>
        </main>
      </div>
    </div>
    <script>
      const buttons = [...document.querySelectorAll("[data-filter]")];
      const cards = [...document.querySelectorAll(".milestone")];
      const search = document.querySelector("#search");
      const visibleCount = document.querySelector("#visible-count");
      const empty = document.querySelector("#empty");
      let filter = "all";
      function render() {
        const query = search.value.trim().toLowerCase();
        let shown = 0;
        for (const card of cards) {
          const visible = (filter === "all" || card.dataset.status === filter) && card.dataset.search.includes(query);
          card.hidden = !visible;
          if (visible) shown++;
        }
        visibleCount.textContent = "Showing " + shown + " of " + cards.length;
        empty.hidden = shown !== 0;
      }
      for (const button of buttons) button.addEventListener("click", () => {
        filter = button.dataset.filter;
        for (const item of buttons) item.setAttribute("aria-pressed", String(item === button));
        render();
      });
      search.addEventListener("input", render);
      const diagramButtons = [...document.querySelectorAll("[data-diagram]")];
      for (const button of diagramButtons) button.addEventListener("click", () => {
        for (const item of diagramButtons) item.setAttribute("aria-pressed", String(item === button));
        for (const panel of document.querySelectorAll(".diagram-panel")) panel.hidden = panel.id !== "diagram-" + button.dataset.diagram;
      });
      function revealLinkedMilestone() {
        if (!/^#BT-\\d+$/.test(location.hash)) return;
        const target = document.getElementById(location.hash.slice(1));
        if (!target) return;
        filter = "all"; search.value = "";
        for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.filter === "all"));
        render(); target.scrollIntoView();
      }
      window.addEventListener("hashchange", revealLinkedMilestone);
      revealLinkedMilestone();
      function updateNavigation() {
        const hash = location.hash || "#overview";
        for (const link of document.querySelectorAll('[aria-label="Plan sections"] a')) {
          const active = link.getAttribute("href") === hash;
          link.classList.toggle("active", active);
          if (active) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current");
        }
      }
      window.addEventListener("hashchange", updateNavigation);
      updateNavigation();
      ${planScript}
      ${repositoryScript}
    </script>
  </body>
</html>`;

const formatted = await prettier.format(html, { filepath: outputPath });
await Promise.all([...linkedFiles].map((file) => access(file)));
if (check) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current.replaceAll("\r\n", "\n") !== formatted.replaceAll("\r\n", "\n")) {
    console.error("docs/progress.html is stale. Run npm run progress:build.");
    process.exitCode = 1;
  } else
    console.log(
      `Progress board current: ${milestones.length} milestones, ${phases.length} phases, ${modules.length} modules, ${connections.length} contracts`,
    );
} else {
  await writeFile(outputPath, formatted);
  console.log(
    `Generated docs/progress.html from ${milestones.length} milestones`,
  );
}
