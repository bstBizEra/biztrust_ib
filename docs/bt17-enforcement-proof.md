# BT-17 hosted enforcement proof

Scope: a uniquely named required CI job and a non-merged proof PR, based on
`467d15a19b2f2ecf7bd40c0defc20910034b5f2e`. No application behavior changes or
unpublished implementation-checkout files are included.

The ordinary verification and a skipped release-workflow job previously both
reported `verify`. The ordinary verification job now reports
`BizTrust required verification`; its commands, triggers and permissions remain
unchanged. Confirm the emitted check name and GitHub Actions source before
requiring it in branch protection.

Proposed main protection: require an up-to-date passing verification check from
GitHub Actions, one independent approval accepted by GitHub, dismissal of stale
approvals and resolved conversations. Enforce rules for administrators; allow no
routine bypass, force push or deletion.

Proof records must distinguish pending/failed checks, missing required approval,
stale approval and a fully passing current revision. AP-01 and AP-02 are agent
engineering review assignments; their findings alone do not prove an eligible
GitHub approval. No reviewer may approve their own authored PR. Until GitHub
accepts an independent eligible review, leave positive approval and stale-review
proof unrun and keep the PR open.

Record the actual PR head/base, check run, effective settings and observed merge
state in the project progress records. A blocked merge state alone does not prove
every individual protection. Do not attempt an invalid merge to test enforcement.

This proof does not authorize merging, tagging, release, deployment, live payment,
insurer issuance or insurance coverage. Preserve the rejection of `DEMO_MODE=false`.

## Planned non-merge enforcement cases (local candidates; unrun)

These documentation-only commits stage separate stale-review, missing-check and
recovery observations. They change no workflow, required context or protection.
Each hosted step needs its own current-head, base, review, check and policy
readback; a blocked merge state alone cannot identify which gate caused it.

**A — stale review.** After independent review of this candidate, an ordinary
push of commit A would move PR #13 from its currently approved head. Wait for the
new head's required `BizTrust required verification` check from GitHub Actions
App `15368` to succeed. Then inspect review `5330948194` for dismissal, the
current review decision and merge state. Count stale-review enforcement only if
the required check succeeds on the current candidate while approval is missing
and the PR remains blocked. Do not submit a replacement review in case A.

**B — missing current-head check.** A later documentation-only commit B would
carry `[skip ci]` in its commit message. GitHub documents that this skips
`push` and `pull_request` workflows and can leave a required check Pending;
verify the actual current-head check state rather than inferring absence from
an API omission or a skipped job with an accepted conclusion. After separate
review of B's exact tree, a separately authorized eligible review on B would
isolate the check gate only if GitHub reports approval accepted, the required
check remains pending or missing on B, and the PR remains blocked. An API
error, wrong check source, stale head, or another missing gate invalidates
that interpretation. Do not alter the required-check rule or fabricate a check.
