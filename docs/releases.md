# Versioning and release workflow

## Current boundary

The application is a local demonstration. Production startup is intentionally blocked by `validateConfig()` until real products, contracts, identity acceptance, payment and insurer adapters, and operational controls are implemented and reviewed. The release pipeline publishes source and a versioned container artifact; it does not deploy or activate production. Never use customer data or represent simulator issuance as coverage.

## Day-to-day flow

1. Create a short-lived branch from `main`. Commit one coherent change at a time and open a pull request.
2. The Verify BizTrust workflow runs on pull requests and `main`. It checks lint, TypeScript, domain/integration/contract tests, build, startup, browser journeys, accessibility and production dependency advisories against isolated PostgreSQL. Review test evidence and the actual change before merging.
3. Merge after checks pass and review is complete. Keep `main` deployable as a demonstration. Do not tag a failed or unreviewed commit.
4. For a release, update `CHANGELOG.md` with the release notes and run the full verification against a clean checkout. Tag only a commit already on `main`.
5. The Release BizTrust workflow checks the tag/version match and `main` ancestry, reruns verification, publishes a versioned image to GHCR, and then publishes a GitHub Release. A failed package build leaves no successful release.

GitHub Actions must be enabled and account billing healthy. If Actions cannot start, do not claim automated verification or package publication. A manually published source prerelease must clearly say that its package is pending.

## Release rehearsal

The Release BizTrust workflow can be run manually against a reviewed branch using `gh workflow run release.yml --ref <branch>`. The rehearsal checks package and lockfile version agreement, fetches full Git history, checks that the latest existing version tag is reachable from `main`, authenticates to GHCR with a read-only token, and builds the container with `push: false`. It creates no tag, package or GitHub Release. The tag-triggered jobs are explicitly limited to version-tag pushes.

Run the rehearsal on the exact branch containing proposed release-action updates, then review its job steps and the pull request verification before merging. The rehearsal does not prove that GHCR accepts a package push or that GitHub Release publication succeeds. Validate those effects only through a separately reviewed demonstration prerelease. Neither result authorizes production deployment.

## Version rules

Use SemVer tags `vMAJOR.MINOR.PATCH`. Pre-production `0.x` releases are marked prerelease and are never marked `latest` by the workflow. `MAJOR` is for an incompatible public contract or migration; `MINOR` is for backward-compatible capability; `PATCH` is for compatible fixes. Review migration and API compatibility before any major release. Pre-release suffixes `-alpha.N`, `-beta.N`, and `-rc.N` are supported.

From a clean release branch based on current `main`, run one of:

```powershell
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
npm version patch --no-git-tag-version
```

These commands update both `package.json` and `package-lock.json`. Use only the applicable command. Update `CHANGELOG.md`, commit, review, and merge. After `main` passes verification, create and push an annotated tag for the exact package version:

```powershell
$version = node -p "require('./package.json').version"
node scripts/check-release.mjs "v$version"
git tag -a "v$version" -m "BizTrust v$version"
git push origin "v$version"
```

The release workflow refuses a tag whose version differs from package metadata or whose commit is not reachable from `main`. Tags and release images are immutable version identifiers; fix a failed release with a new patch or pre-release version, never a moved tag. The container image is `ghcr.io/bstbizera/biztrust_ib:vX.Y.Z`; an exact SHA tag is published too. No floating `latest` container tag is published.

## Production promotion gate

Before a production release, owners must provide approved insurer products and legal authority, live provider/payment contracts and adapters, OIDC and staff policy acceptance, regulatory/legal/Lao wording, secrets and key rotation, backup restoration evidence, monitoring and incident ownership, environment details, and a reviewed rollout/rollback procedure. Then implement and verify the production path, remove the startup gate in a reviewed change, run integration/security and recovery checks against the chosen staging environment, and obtain explicit promotion approval. The current pipeline deliberately has no deployment job or production environment credentials.
