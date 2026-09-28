# Development backup note — 27 September 2026

**Scope:** BT-09/P5 preparation for the two local BizTrust checkouts. This is a source and documentation safeguard during development, not a portable recovery drill, production backup policy or G4 acceptance. The recurring engineering loop remains **PAUSED**.

**Project Owner decision - 27 September 2026.** Defer portable recovery and retain the verified D: development backups. This does not add a device, key custodian, off-host copy or restore proof. D: remains same-host, CurrentUser-DPAPI protection; G4, production recovery targets and owner acceptance stay open. A future portable design/drill needs a new scoped decision.

## Local backup to D:

`D:` is currently available as the internal `Data-Backup` volume. Use a new, uniquely named run directory under `D:/BizTrust-Backups/development/`; keep the original checkout and the isolated implementation checkout as separate archives with their own source path, timestamp, manifest and SHA-256 digest. Preserve their dirty working files without resetting either checkout. Never overwrite or automatically delete an earlier run.

The planned development archive contains an explicit allowlist of application source, documentation, migrations, tests, public assets and non-secret project configuration needed to reconstruct the current work. Exclude `.git`, `.env` and credential/key files, `node_modules`, `output`, runtime data, raw databases and private records. Inspect the file manifest before encryption. Protect the archive with Windows DPAPI CurrentUser, verify archive and manifest hashes, and record the result without logging secrets. This DPAPI copy is recoverable only under the same Windows user and machine; `D:` is internal, so it does not protect against loss of this host.

The existing synthetic database `source.dump.dpapi` from [BT-09-S1](bt09-s1-isolated-recovery.md) may be preserved separately with its **original** date and digest. Copying it would not be a new database backup or new restore test. No live database or new credential use is in this development source backup scope.

## Hybrid cloud recommendation for later review

Use the D: copy for fast local development recovery, then add an independently recoverable encrypted off-host copy under approved custody and a tested restore on another machine. A managed object store with versioning/immutability is a candidate; an offline encrypted removable drive stored separately is another. Select provider, region, retention, cost ceiling, key custody and access controls through [BT-09 D01–D07](bt09-s1-isolated-recovery.md) before implementation. [Restic documents encrypted repositories with local and cloud backends](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html); [Backblaze documents object-lock retention](https://www.backblaze.com/docs/cloud-storage-object-lock). These are references, not selected services or an installation request.

`G:` is currently mounted as Google Drive. Uploading or syncing to it remains a **pending cloud-write decision**; availability of the mount is not permission to copy project files there. No G: write, cloud service setup, backup schedule or key service is authorized by this note. A future cloud copy must first have an approved data classification, exact destination, credential/access method, portable encryption key custody, retention and restore test. The local DPAPI archive alone is unsuitable as the off-host recovery copy because its decryption depends on the source user and machine.

For database recovery, a source archive is not enough: [PostgreSQL documents that `pg_dump` covers one database while global roles and tablespaces require separate handling](https://www.postgresql.org/docs/current/app-pgdump.html). Keep the existing BT-09 recovery inventory and negative tenant/RLS checks in any later authorized drill. Proposed 24-hour RPO and 4-hour RTO remain unapproved synthetic-pilot targets, not measured performance or production promises.

## Latest D: execution checkpoint — 27 September 2026

The unchanged implementation script `scripts/backup-development.ps1` exited 0 and created `D:/BizTrust-Backups/development/20260927T105009Z-eb4220745422/`, completed at `2026-09-27T10:50:15.713Z`. `summary.json` SHA-256 is `4BF6F14C49BBF36330F56D2A14B33747D8DAF0609AD2B6D5EAB04BC3243FFA9D`; readback of the dated summary confirmed both archives verified and both source checkouts unchanged. The original checkout archive has 100 files and SHA-256 `D179F60177F0CAACF3785EF2F8C254D07B5215E9378CB477844CF87321A08FB6`; the implementation checkout archive has 105 files and SHA-256 `14D5DBBAE9E15D57E4E835F6E352344B7DC61C4D7BB055A6FFB89AFC7F57D670`. The `D:` volume was observed as `Data-Backup` with available space; this is an internal same-host, CurrentUser-DPAPI source safeguard. It excludes `.env`, databases and G: uploads, and does not demonstrate off-host or different-user recovery. These documentation edits follow the immutable archive timestamp; do not rerun merely to include this note. D01–D07 owner decisions, portable key custody, another-machine restore and G4 acceptance remain pending.

## Earlier local execution checkpoint — 27 September 2026

`powershell -NoProfile -File scripts/backup-development.ps1` exited 0 in the implementation checkout. The implementation-only script SHA-256 was `D7FC4E3E36A1CFD0EEA0CA504F5C20B8D9575214F264E66E660313A46DBAC5A8`. Its run `D:/BizTrust-Backups/development/20260927T073123Z-58c9dfa3aa54/` completed at `2026-09-27T07:31:33.3918809Z`; `summary.json` SHA-256 is `ED839C00A3EC4A1C7899E3C1567DBC75DDF37D0ACD061DAD54C06B284B279C36`. The summary records decrypted ZIP readback, manifest/file-hash verification and unchanged sources for both archives. The worker reported passing synthetic encryption/readback, tamper/content/manifest rejection, target/allowlist guard and parser/whitespace checks. The source checkouts shared base `467d15a19b2f2ecf7bd40c0defc20910034b5f2e` but were archived separately, including their distinct working files:

| Source checkout | Archive                    | Files | SHA-256                                                            |
| --------------- | -------------------------- | ----: | ------------------------------------------------------------------ |
| Original        | `original.zip.dpapi`       |    97 | `F1CB556C5BF0DD52D27E18F8827B40C116BC0FDCBC2B2A93206D671810FFC321` |
| Implementation  | `implementation.zip.dpapi` |   105 | `93B810364E65108DEC54581B7C928000649A48243734B05AA487A3DEC3CC01E2` |

The run also separately preserved the **historical** synthetic `source.dump.dpapi` (SHA-256 `DDDE8204E259AC8D7C7E1C80F3C706EB5CD324DE72718A0788F89CF787D74FE8`) and its original summary (SHA-256 `87B1D370B9D095CDB5FEF466E5A99712C90734ACF2A7FE6232215CA9320C5A3C`). Copy hashes matched their dated originals; this was not a new database dump or drill. The source documentation and generated boards were edited **after** this archive timestamp and are outside the immutable run. No recursive backup was run to include its own evidence.

The run made no G: upload, used no live database or existing credentials, and did not restart a schedule. D: and DPAPI CurrentUser remain same-host/user safeguards, not off-host or key-loss recovery. **Next evidence:** named D01–D07 owners and approved target/key custody, followed by a separately authorized portable restore on another machine. G4 remains open.
