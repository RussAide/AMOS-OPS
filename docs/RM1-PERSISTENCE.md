# RM.1 Production Persistence Contract

## Purpose

RM.1 keeps authoritative Production data durable across container restart,
replacement, and deployment. It also prevents Production from silently falling
back to image-local storage or synthetic operational records.

The verified RM.0 Railway volume backup is the rollback point for this change.
Do not begin migration unless that backup still exists and can be identified by
its recorded backup ID `22f0e66d-7445-4951-a3e9-38ff4268aa48` and external ID
`vs_1784279774420_9srxs1tbyrw390ej`.

## Canonical Production layout

Railway must attach the AMOS-OPS persistent volume at exactly
`/app/persistent`. Configure these runtime variables:

```dotenv
PERSISTENT_ROOT=/app/persistent
RAILWAY_VOLUME_MOUNT_PATH=/app/persistent
DATABASE_PATH=/app/persistent/data/production/amos-ops.db
TRAINING_DATABASE_PATH=/app/persistent/data/production/training/amos-ops-training.db
UPLOAD_PATH=/app/persistent/uploads/production
TRAINING_UPLOAD_PATH=/app/persistent/uploads/production/training
BACKUP_PATH=/app/persistent/backups/production
```

Every database, upload, and backup path must be a strict descendant of
`PERSISTENT_ROOT`. Merely using a path with the same textual prefix is not
sufficient: path resolution must reject traversal, the root itself, sibling
paths, and look-alike names such as `/app/persistent-old`.

The Production image intentionally does not create `/app/persistent`. Before
opening either database, Production startup requires that exact path to appear
as an active mount point in `/proc/self/mountinfo`. Both configured database
files must already exist, contain the AMOS `users` schema, and pass SQLite
`integrity_check`; startup never creates a replacement Production database.

Demo and isolated-review paths remain outside the Production root:

```text
/app/data/demo/...
/app/uploads/demo/...
/app/data/staging/...
/app/uploads/staging/...
```

They must not read from or write to the Production volume.

## Production data boundary

Fresh Production databases install immutable migration DDL and checksum history
without migration fixture DML. This intentionally leaves operational and
prototype-reviewed reference tables empty until their configuration has been
validated and loaded through a controlled process. Demo, isolated review, and
authorized Training databases retain their accepted fixtures.

The 13 AMOS agent-persona definitions are canonical product configuration, not
operational records. They remain available in Production. Prototype clinical,
HR, notification, onboarding, analytics, compliance, and milestone-evidence
records do not: their Production providers return empty/unavailable, reject
volatile writes, filter synthetic evidence classes, or are blocked at the
Production API boundary. Historical immutable synthetic evidence may remain in
the database for lineage, but it is quarantined from Production operational
views and must not be blanket-deleted.

`BACKUP_PATH` establishes the persistent destination contract. Scheduled,
encrypted, offsite backup automation is separately governed by RM.2 and RM.6.

## Controlled migration gate

Before changing any Railway variable or deployment:

1. Confirm the RM.0 backup ID and creation time.
2. Reconfirm the volume state is ready and mounted at `/app/persistent`.
3. Record the active deployment ID, source commit, current path variables,
   database integrity result, record counts, and upload inventory.
4. Stop application writes for the shortest controlled maintenance window that
   can produce a consistent database-and-file copy.
5. Copy existing databases and uploads into the exact canonical destinations;
   do not synthesize, reseed, or replace authoritative records.
6. Verify file hashes, SQLite integrity, record counts, ownership, and access
   permissions before selecting the new paths.
7. Confirm both canonical database files exist before starting the RM.1 image.
8. Apply all path variables together and deploy the verified RM.1 artifact.

Partial path migration is a stop condition. The operational database, Training
database, operational uploads, Training uploads, and backup directory move as
one controlled change.

## Acceptance checks

RM.1 passes only when all of the following have evidence:

- Runtime configuration resolves every Production storage path beneath the
  mounted `/app/persistent` root.
- Both databases pass SQLite integrity checks and retain their pre-change record
  counts.
- The upload inventory and representative file hashes match the pre-change
  inventory.
- A controlled restart retains records and files.
- A subsequent deployment retains records and files.
- Missing authoritative provider data produces an unavailable or empty state,
  never synthetic/default operational data.
- Liveness, readiness, authentication, and authorized file access remain
  healthy after the change.

## Rollback

Stop and roll back if startup validation, integrity, inventory, health,
authentication, or persistence verification fails.

1. Prevent new writes.
2. Restore the verified RM.0 Railway volume backup using Railway's controlled
   restore workflow.
3. Restore the pre-change deployment and variables as one coordinated rollback.
4. Verify database integrity, record counts, upload hashes, liveness, readiness,
   and authentication.
5. Record the failed gate, rollback evidence, and any reconciliation required
   before another migration attempt.

Never mix restored pre-change data with post-change writes. If writes occurred
after migration, require an explicit reconciliation decision before restoration.
