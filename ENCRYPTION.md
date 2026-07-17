# AMOS-OPS Production Encryption Standard

**Control:** RM.2 — Encryption and protected storage

**Status:** Implementation candidate; Production validation is pending

**Detailed runbook:** `docs/RM2-ENCRYPTION.md`

AMOS-OPS uses defense in depth for Production data at rest:

1. Railway encrypts the underlying storage layer and retains the platform keys.
2. AMOS encrypts both SQLite databases with the SQLCipher-compatible
   `better-sqlite3-multiple-ciphers` build in AES-256 mode.
3. AMOS encrypts every uploaded file with an authenticated AES-256-GCM
   envelope and a random per-object data-encryption key.
4. AMOS encrypts every application backup as a complete AES-256-GCM envelope
   around a versioned authenticated manifest and SQLCipher database copy.
5. Database, upload, and backup key slots are independent and exist only in
   immutable Railway sealed service variables and process memory. Non-secret
   manifests map versioned key IDs to those slots. Raw keys are never stored
   in the repository, image, browser bundle, Netlify, or persistent volume.

Production fails closed when encryption is disabled, a required keyring is
missing, an active key cannot open a database, a file is plaintext, an
authentication tag is invalid, or an unauthorized backup key is presented.

The three sealed keyrings use versioned identifiers. The active database key
is derived separately for the operational and Training databases using
HKDF-SHA-256. Upload and backup master keys wrap random per-object AES-256 data
keys. Key rotation rekeys the databases and rewraps stored data keys without
exposing file plaintext.

Never reuse `APP_SECRET`, `JWT_SECRET`, a TOTP secret, or any user password as
storage key material. Never place storage variables behind a `VITE_` prefix.

Encrypted objects are authenticated against a hashed relative object identity;
moving ciphertext to another stored name does not authorize decryption. Backup
manifests record the inner database-key dependency, so removing a retained key
while any backup still needs it fails closed.

The database engine is SQLite3 Multiple Ciphers 2.3.5 in SQLCipher legacy-4
compatibility mode. It is version-locked and startup-verified, but is not
represented as FIPS 140 validated. Railway sealed variables are a same-platform
secret store, not a customer-controlled HSM/KMS.

RM.6 separately governs backup schedules, offsite replication, retention,
monitoring, and recurring recovery exercises.
