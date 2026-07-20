# RM.2 Encryption and Protected Storage — Implementation Candidate

## Control objective

Production databases, uploaded files, and application backups remain
unreadable when copied outside their authorized runtime. Encryption keys are
managed separately from the persistent data and can be rotated without
replacing authoritative records.

## Candidate design pending Production validation

The managed key store for this release is Railway sealed service variables.
Railway controls encryption and access to its variable store; AMOS consumes the
three independently generated keyrings only as server-side runtime variables.
The variables are scoped to the Production backend service. Netlify receives
none of them.

| Data class | Protection | Key domain |
| --- | --- | --- |
| Operational SQLite | SQLCipher-compatible AES-256 database | database |
| Training SQLite | SQLCipher-compatible AES-256 database with separate HKDF context | database |
| Operational uploads | AES-256-GCM envelope; random DEK per object | upload |
| Training uploads | AES-256-GCM envelope; random DEK per object and separate context | upload |
| Application backups | Whole-artifact AES-256-GCM envelope | backup |
| Railway volume/snapshots | Railway-managed storage encryption plus AMOS ciphertext | platform |

The RM.1 Training upload directory is a nested child of the operational upload
root. Operational inventory explicitly excludes that child subtree; Training
inventory processes it separately with the `upload-training` cryptographic
purpose and Training-relative object identities. This separation is enforced
at migration, normal startup, and evidence collection.

The current provider is an exportable-key secret store, not a customer-managed
HSM or KMS. A future external store can replace Railway only if it supplies the
same 32-byte keys. A non-exportable KMS requires a new envelope version and a
controlled ciphertext migration; it is not a drop-in configuration change.

The database implementation is `better-sqlite3-multiple-ciphers` 12.11.1 with
SQLite3 Multiple Ciphers 2.3.5 in SQLCipher legacy-4 compatibility mode.
Startup verifies that exact engine and cipher selection. This build has not
been demonstrated as FIPS 140 validated.

## Required Production variables

RM.2 remains inert while `AMOS_RM2_STATUS=paused`. Activation is a separate
approved gate: set `AMOS_RM2_STATUS=active` only together with the complete
key contract and migration procedure below. A paused status must never be
changed by an authentication, route, or ordinary application release.

```dotenv
AMOS_RM2_STATUS=active
AMOS_STORAGE_ENCRYPTION_REQUIRED=true
AMOS_STORAGE_KEY_PROVIDER=railway-sealed-variables-v1
AMOS_STORAGE_MIGRATION_MODE=none

AMOS_DATABASE_ACTIVE_KEY_ID=database-YYYY-MM
AMOS_DATABASE_KEY_MANIFEST_JSON={"database-YYYY-MM":"AMOS_DATABASE_KEY_V1"}
AMOS_DATABASE_KEY_V1=<sealed 32-byte base64 key>
AMOS_UPLOAD_ACTIVE_KEY_ID=upload-YYYY-MM
AMOS_UPLOAD_KEY_MANIFEST_JSON={"upload-YYYY-MM":"AMOS_UPLOAD_KEY_V1"}
AMOS_UPLOAD_KEY_V1=<sealed 32-byte base64 key>
AMOS_BACKUP_ACTIVE_KEY_ID=backup-YYYY-MM
AMOS_BACKUP_KEY_MANIFEST_JSON={"backup-YYYY-MM":"AMOS_BACKUP_KEY_V1"}
AMOS_BACKUP_KEY_V1=<sealed 32-byte base64 key>
```

Each `*_KEY_MANIFEST_JSON` is non-secret and maps a versioned key ID to an
immutable Railway variable slot. Every `*_KEY_V*` value must be marked sealed.
Each key must be 32 cryptographically random bytes encoded as canonical base64.
Active identifiers contain only letters, digits, dot, underscore, or hyphen and
are 3-64 characters. Do not use the same key or sealed slot in two domains.

Only Production backend administrators may change these variables. Application
operators may deploy the service but should not receive key-value visibility.
Keyring values must never be copied to tickets, screenshots, logs, evidence
packages, SharePoint, source control, or Netlify.

Railway sealing is a platform control and cannot be proven from inside the
application process. Production evidence must include sanitized Railway
metadata showing every `*_KEY_V*` slot is sealed and non-retrievable. The
active IDs and manifests are non-secret; the slot values are secrets.

The Managing Director owns key-custody approval. A second designated security
administrator must witness creation, rotation, recovery tests, and retirement.
The immutable slot layout prevents rotation from requiring retrieval of an old
sealed value. Loss of the Railway project would still remove the runtime key
store; an approved external recovery escrow is therefore a Production
completion prerequisite, not something the application repository can supply.

## Plaintext migration gate

The launcher performs no automatic repair. The one-time conversion runs only
when both variables are intentionally staged:

```dotenv
AMOS_STORAGE_MIGRATION_MODE=encrypt-plaintext
AMOS_STORAGE_MIGRATION_CONFIRMATION=RM2_ENCRYPT_PRODUCTION_STORAGE
```

Before staging them:

1. Confirm a current locked Railway volume backup exists.
2. Record the deployment, volume, database counts, integrity, and upload
   inventory.
3. Confirm `/app/persistent` is the active mount and the canonical RM.1 paths
   have not changed.
4. Allow Railway's singleton-volume deployment transition to stop the prior
   process before the new launcher accesses the files.

The launcher then:

1. Reconfirms the exact persistent mount.
2. Rejects unsupported, legacy, malformed, or inaccessible application backup
   artifacts before the first authoritative database is changed.
3. Checkpoints each SQLite WAL and closes the database.
4. Creates an adjacent restrictive-permission temporary copy. No plaintext
   rollback copy is retained on the volume.
5. Encrypts and verifies the copy with SQLCipher.
6. Verifies the approved SQLite3MC engine, cipher selection, and database
   integrity with the authorized key.
7. Atomically swaps the verified copy into the canonical path.
8. Encrypts each existing upload through an adjacent authenticated temporary
   and verifies it under the correct operational or Training purpose.
9. Starts the ordinary application only after both databases and all stored
   files pass the encryption gate.

Railway's health-check window is 300 seconds for this singleton-volume
transition because the launcher intentionally finishes verification before it
binds the HTTP listener. A timeout remains fail closed; it must be investigated
or rolled back rather than bypassed.

After the migration deployment is healthy, remove the confirmation and set
`AMOS_STORAGE_MIGRATION_MODE=none`. Redeploy and verify readiness again.

The pre-RM.2 backup contains pre-application-encryption data. A restore of that
backup must occur under maintenance and must rerun the plaintext migration
before serving traffic.

## Backup and restore

`createDatabaseBackup()` restricts Production destinations to strict
descendants of `BACKUP_PATH`. It creates a consistent SQLCipher database copy,
records its scope and inner database-key dependency in an authenticated
`AMOSDBB1` manifest, wraps the complete artifact with the independent backup
key, and verifies it before atomic publication. Ciphertext is bound to a hashed
relative object identity, so swapping two stored files is rejected.

`restoreDatabaseBackup()` accepts only an authenticated AMOS encrypted backup
inside `BACKUP_PATH`. It authenticates and decrypts to a restrictive adjacent
temporary, opens that file with the authorized database key, runs integrity
validation, and replaces the target only after every check passes. A missing,
wrong, or retired key leaves the target unchanged.

Plaintext and legacy envelope-only database backups are rejected rather than
blindly wrapped. If the pre-change inventory finds one, migration requires an
explicit operational/Training scope map and a separately tested conversion;
the launcher never infers scope from content or filename.

RM.6 adds scheduling, independent offsite storage, retention, alerts, and
recurring clean-environment exercises. RM.2 proves the cryptographic backup and
restore primitive.

## Rotation procedure

Rotate at least annually, on a governing-body-approved schedule, and
immediately after suspected disclosure. Use three new independent keys.

1. Create and lock a pre-rotation Railway backup.
2. Add one new immutable sealed `*_KEY_V*` variable per domain. Never retrieve,
   overwrite, or delete an older slot during rotation.
3. Add the new key IDs and slot names to each non-secret manifest while
   retaining every previous entry required by stored data or backups.
4. Select the new active identifiers.
5. Set `AMOS_STORAGE_MIGRATION_MODE=rotate` and stage the same explicit
   migration confirmation.
6. Deploy during the controlled maintenance window.
7. The launcher rekeys both encrypted databases and rewraps upload and backup
   DEKs under the new active keys.
8. Verify integrity, counts, file hashes, authorized reads, and denial with the
   retired-only keyring.
9. Return the migration mode to `none`, remove the confirmation, and redeploy.
10. Retain every previous database key until all inner SQLCipher backups made
    with it have expired or have been decrypted, rekeyed, re-enveloped, and
    successfully restored. Rewrapping only the outer backup envelope is not
    sufficient. Retain upload and backup keys until all dependent envelopes
    have been rewrapped and verified.
11. Remove retired manifest entries and sealed slots only after the dependency
    inventory is empty, then verify another restart and isolated restore.

Disabling or deleting the last key capable of opening retained data is a
destructive action requiring two-person approval and a verified recovery copy.

## Failure and rollback

Startup fails before listening when a required key is missing or wrong, a
database is plaintext or corrupt, a stored object is plaintext, or an envelope
authentication tag fails. There is no plaintext fallback.

If conversion fails before an atomic swap, the canonical file is unchanged. If
the deployment cannot become healthy after a completed swap, restore the
pre-RM.2 Railway backup, rerun the encryption migration, and reconcile any
writes made after the backup. Never deploy pre-RM.2 code against an encrypted
database.

## Verification requirements

- SQLCipher driver version is locked in `package-lock.json`.
- Both database headers lack the SQLite plaintext signature.
- Keyless and wrong-key database reads fail.
- Operational and Training database contexts cannot open one another.
- Upload plaintext markers do not appear in stored bytes.
- Upload tampering and wrong keys fail GCM authentication.
- Substituting ciphertext between object paths fails object authentication.
- Backup bytes contain no known database plaintext marker.
- Authorized backup restoration preserves schema and records.
- Unauthorized restore leaves the target byte-for-byte unchanged.
- Rotation makes the new key active and a retired-only keyring fails.
- Backup inventories prove every retained inner database-key dependency before
  any old sealed slot can be retired.
- Readiness reports encryption active without revealing key identifiers.
- The browser bundle and Netlify environment contain no storage secrets.

Evidence must contain only key identifiers, algorithms, counts, non-sensitive
hashes, timestamps, and pass/fail results—never key material.

After the normal-mode restart, run `npm run evidence:rm2:storage` inside the
backend service. Archive its JSON output. In mode `none`, the command does not
alter authoritative records or ciphertext; inventory may durably remove only
reserved, uncommitted `.amos-*-partial` crash residue. It reports authenticated
backup dependency key IDs, database engine and cipher provenance, inventory
counts, and keyless/wrong-key/cross-scope denial without printing key material
or regulated filenames.
