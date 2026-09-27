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
GitHub Actions, one independent human approval, dismissal of stale approvals and
resolved conversations. Enforce rules for administrators; allow no routine bypass,
force push or deletion.

Proof records must distinguish pending/failed checks, missing human approval,
stale approval and a fully passing current revision. Agent security and independent
code reviews are engineering evidence only; they do not supply a human GitHub
approval. No reviewer may approve their own authored PR. If no eligible human is
available, leave positive approval and stale-review proof unrun and keep the PR open.

Record the actual PR head/base, check run, effective settings and observed merge
state in the project progress records. A blocked merge state alone does not prove
every individual protection. Do not attempt an invalid merge to test enforcement.

This proof does not authorize merging, tagging, release, deployment, live payment,
insurer issuance or insurance coverage. Preserve the rejection of `DEMO_MODE=false`.
