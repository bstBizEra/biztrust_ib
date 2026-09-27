# Contribution and Git workflow

Use GitHub flow: a short-lived topic branch, a focused pull request, review and verification, then integration into `main`. `main` is the integration baseline for the synthetic demonstration. Release publication and production promotion follow [the release workflow](docs/releases.md).

This extends the existing release workflow. A permanent `develop` branch and Git Flow's release/hotfix topology require a separate strategy decision if the project begins supporting concurrent released versions. The Git Flow author's [2020 reflection](https://nvie.com/posts/a-successful-git-branching-model/) recommends a simpler flow for continuously delivered web applications; [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow) documents the branch and PR lifecycle.

## Start with a bounded change

Read [AGENTS.md](AGENTS.md), [progress](docs/progress.md), and the linked architecture or operation documents that the change affects. Identify the outcome, relevant `BT-XX` milestone, acceptance evidence and owned paths. Business decisions stay with the milestone's business owner. Guidance files and tests do not supply ADF or production authority.

Inspect the current workspace before changing it:

```powershell
git status --short
git branch --show-current
git worktree list
git diff --stat
git diff --cached --stat
```

Continue an existing task branch when the work belongs to it. Preserve other changes and inspect untracked files explicitly; `git diff` alone does not show their contents. For independent work, use a separate worktree from the agreed base. Assign one writer to shared files such as `AGENTS.md`, the progress board, workflow definitions and lockfiles; coordinate a handoff before overlapping edits.

For a new topic with a clean workspace, these commands refresh the integration reference and create a branch without switching through local `main`. Run them only when consistent with the task's Git/network restrictions:

```powershell
git fetch origin
git log -1 --oneline origin/main
git switch --no-track -c codex/docs/bt-17-git-workflow origin/main
```

The example name is illustrative: choose an unused name for the actual outcome. Never force a checkout to bypass local changes. A dependent branch must name its real base and dependency in its PR; retarget and verify after its prerequisite merges.

## Branch and commit conventions

Codex uses `codex/<type>/<description>`; human branches may use `<type>/<description>`. Use lowercase kebab-case descriptions, with a milestone or issue ID when applicable. Valid types are `feature`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`, `release` and `hotfix`. This repository extension takes precedence over a skill's narrower naming vocabulary. Existing branches need no cosmetic rename; Dependabot retains its generated names.

Examples: `codex/feature/bt-06-case-assignment`, `codex/fix/payment-redelivery`, `codex/docs/bt-17-git-workflow`, `codex/release/v0.3.0`. `hotfix` identifies urgency and follows the same review and release gates. Aim for branches measured in days; split large outcomes at independently verifiable boundaries.

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commits and PR titles:

```text
docs(workflow): define branch and skill selection rules

Explain the reason and relevant constraint when the subject is insufficient.

Refs: BT-17
```

Choose `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore` or `revert`. Scope is optional but useful (`auth`, `payments`, `ops`, `workflow`). Keep subjects concise, imperative and normally under 72 characters. Use `!` and a `BREAKING CHANGE:` explanation for incompatible contracts, including migration consequences. Do not invent issue numbers; `Closes #...` means the PR actually resolves that GitHub issue.

Stage explicit files or hunks belonging to the outcome. Review `git diff --cached` and `git diff --cached --check` before an authorized commit. Include required generated documentation, such as `docs/progress.html`, alongside its sources; exclude `dist/`, `node_modules/`, local databases, secrets and private customer/provider data. A commit request covers that coherent change, not all pre-existing workspace work.

## Verification and review

| Change                                                     | Evidence before handing off                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation/rules only                                   | Inspect the wording and local links; run targeted Prettier and `git diff --check`. For progression changes run `npm run progress:build` and `npm run progress:check`; check the latter before finishing any work under the progression instructions. |
| Application, API, database, dependencies or build behavior | Run relevant tests while iterating, then `npm run verify` in the configured isolated demo environment before calling the candidate fully verified. Record any blocker and partial results.                                                           |
| UI behavior or accessibility                               | Include the relevant browser journeys and screenshots; the full gate includes browser/accessibility checks.                                                                                                                                          |
| Release Actions or packaging                               | PR verification plus the branch-specific rehearsal described in [releases](docs/releases.md). A build with publication disabled does not prove publication.                                                                                          |

The existing `Verify BizTrust` workflow runs `npm run verify` on PRs and `main`, including the board freshness check, lint, types, tests, build, startup, browser checks and dependency audit. Hosted verification on the current PR revision remains the integration gate even when a local documentation change needs only targeted checks. Recheck evidence after conflict resolution or additional commits.

Use the [PR template](.github/pull_request_template.md). Describe the observable outcome, milestone, actual checks, remaining work and relevant risks. Keep draft PRs visibly incomplete. Use separate AP-01 security and AP-02 code-review agents for independent, exact-candidate engineering review; record their AI role, findings and re-review triggers. The author's self-review is not independent. Agent reports do not by themselves satisfy GitHub's current required approval count; keep a PR pending until its actual hosted rule is met or an authorized rule change is verified. Business, legal, regulated-risk, release and production decisions remain with accountable owners.

Prefer squash merge for a single coherent outcome, using a Conventional Commit PR title. A merge commit is acceptable when retaining meaningful commit history or reconciling a shared branch; explain the choice. Delete a merged branch only after confirming it has no unmerged work or active worktree users.

## Plan and board synchronization

| Trigger                                                                                                          | Update in the same coherent change                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaction behavior, architecture coverage, integration order or production acceptance requirements change      | Update `docs/implementation-plan.md`, its snapshot date and relevant linked design/operation document. Distinguish planned behavior from observed implementation.                                                               |
| A milestone advances, becomes blocked, loses supporting evidence, changes owner/scope or adds a distinct outcome | Update `docs/progress.md`, its snapshot date and the stable BT row; append newest-first evidence and remaining work to `docs/progress-updates.md`. Add an ID only for a distinct outcome with an owner and acceptance boundary. |
| A phase, module, contract or repository adoption decision changes                                                | Update the owning table in `docs/progress.md` or `docs/repository-plan.json` and its companion reuse guidance, as applicable. Do not duplicate status across documents.                                                         |
| Any board input changes, including wording                                                                       | Run `npm run progress:build`, include `docs/progress.html` with its inputs, then run `npm run progress:check`. The generator reads progress Markdown, implementation-plan Markdown and the repository register.                 |
| Wording-only correction with no scope/status change                                                              | Update the affected source and regenerate if it feeds the board; no milestone evidence entry or version bump is required.                                                                                                       |

Perform these updates before the work's commit/PR or local handoff, again after resolving integration conflicts, and when new acceptance evidence invalidates an earlier claim. Do not wait for a release. Do not refresh dates merely because a session started. Board freshness proves source synchronization, not acceptance or deployment.

### Coordination ownership

- **ADF:** project manager and orchestrator; coordinates scope, dependencies, prompts and handoffs within the user's task. It tracks owner decisions without manufacturing G00 or production authority.
- **BizTrust IB Progress Board:** owns the implementation plan, milestone evidence and generated HTML board; consolidates specialist evidence and runs build/check.
- **BizTrust Research & Data:** owns data correction, source validation and R&D; research remains distinct from approved production product data.
- **BizTrust Frontend:** supplies frontend changes, affected BT IDs, UX/accessibility/browser evidence and remaining work.
- **BizTrust Backend:** supplies API/schema/provider changes, contract/recovery/security evidence and remaining work.
- **Biztrust_ib Git:** integrates coherent changes, resolves conflicts with the originating work's intent, coordinates board regeneration with its owner, verifies the candidate and performs authorized GitHub/release actions.

Use one writer for shared progress sources, generated board, package versions and lockfile at a time. A handoff includes branch/base, candidate SHA (or explicit uncommitted diff), files, decisions, checks and dependencies. These role assignments do not themselves authorize cross-chat messages or delegation; use the user's existing coordination scope.

## GitHub synchronization checkpoints

| When                                                                      | Required action                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting a new topic, resuming stale work or accepting a dependent change | Inspect local status/worktrees, fetch the intended remote when network access is within scope, and inspect base changes before integrating. Never use an automatic pull over another task's dirty work. If fetch is restricted, record the known base and freshness limit. |
| A coherent increment is verified and ready for collaboration              | Review explicit staged files, commit when authorized, and push the topic branch/open or update its PR only within existing publication scope. Include plan/board/evidence changes together. Do not push every save.                                                        |
| Feedback is fixed or a dependency lands                                   | Reconcile the updated base, rerun affected checks and refresh the authorized PR. Incomplete shared work belongs in a clearly marked draft with failing/missing checks disclosed.                                                                                           |
| Before merge                                                              | Confirm current remote candidate SHA, required hosted checks, review acceptance and plan/board freshness. New commits invalidate stale evidence. Merge only within authorized scope.                                                                                       |
| After merge                                                               | Fetch and record the integrated SHA; dependent tasks update their own branches safely. Keep local uncommitted work intact. Do not tag or deploy merely because a PR merged.                                                                                                |
| A release candidate is accepted                                           | Follow the release guide, separately verify tag/publication authority and inspect the resulting GitHub release/package evidence. Publication is distinct from production activation.                                                                                       |

If the user has not authorized a push or PR, finish the local change and report it as local-only. Reuse existing authorization instead of asking again. GitHub code synchronization does not publish `docs/progress.html` as a website; hosting that board is a separate action. These are event-driven checkpoints, not a scheduled sync job.

## Synchronization and recovery

Fetch and review upstream changes before integrating them. Merge `origin/main` into a shared or already published topic branch. Rebase only private, unpublished commits when needed; do not rewrite another contributor's history. Resolve conflicts from both versions' intended behavior, regenerate derived files from the resolved sources, and run checks for the resulting change. Abort an unsuccessful merge/rebase to return to its starting state before choosing another approach.

Never force-push `main` or move published tags. Prefer a revert through a new PR for shared regressions. Destructive resets, clean commands and overwriting user files need explicit authorization for their targets. If a separately authorized exceptional topic-branch rewrite is necessary, coordinate it, preserve the old commit and use an explicit expected remote SHA with `--force-with-lease`.

## Hosted enforcement to configure

These are the required target settings for `main`; this local documentation change does not establish that GitHub has enforced them. The repository administrator owns activation and evidence:

- Require PRs, one independent approval, dismissal of stale approvals and resolution of review conversations.
- Require the actual successful verification check context from a hosted run on the current revision. Confirm its exact name in GitHub before configuring it; workflow display names alone may differ from check contexts. Require the branch to be up to date, or use a separately configured merge queue whose checks support it.
- Block force pushes and deletion; restrict bypass to an explicit, attributable owner exception. Keep release publication and deployment permissions separate.
- Prove the settings with a normal passing PR and evidence that missing checks/approval prevent integration. Record configured rules, relevant SHA/check links and any exceptions under BT-17.

Local Markdown guidance and the PR template assist contributors; they cannot enforce GitHub settings. BT-17 remains incomplete until hosted enforcement and review evidence exist.

## Reference choices

Primary references are [Git's branch model](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell), [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and the original [Git Flow model and reflection](https://nvie.com/posts/a-successful-git-branching-model/). The project's release guide remains the source for versioning and publication commands.

The supplied [DEV branch practices](https://dev.to/zenulabidin/git-branches-best-practices-46oo), [strategy comparison](https://dev.to/karmpatel/git-branching-strategies-a-comprehensive-guide-24kh), [Medium introduction](https://jakeash22.medium.com/crash-course-on-git-branches-and-merging-ac495428dff9), [INTERSECT tutorial](https://intersect-training.org/collaborative-git/branches.html), and [SitePoint introduction](https://www.sitepoint.com/the-designers-guide-to-git-or-how-i-learned-to-stop-worrying-and-love-the-repository/) provide background. Their commands and branch conventions are not adopted automatically. The supplied [Dev Genius article](https://blog.devgenius.io/learn-how-to-use-github-branches-seriously-b834d1fc96fa) could not be retrieved during this review. [DI-engine](https://github.com/opendilab/di-engine) is a reinforcement-learning project reference; it creates no requirement for this repository's branch topology or dependencies.
