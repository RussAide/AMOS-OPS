import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;

function base32Encode(value: Buffer): string {
  let bits = 0;
  let accumulator = 0;
  let encoded = "";
  for (const byte of value) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += BASE32_ALPHABET[(accumulator >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    encoded += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
  }
  return encoded;
}

function base32Decode(value: string): Buffer {
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/g, "")) {
    const digit = BASE32_ALPHABET.indexOf(character);
    if (digit < 0) throw new Error("Invalid Base32 TOTP secret.");
    accumulator = (accumulator << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totpCode(secret: string, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildTotpUri(
  secret: string,
  accountName: string,
  issuer = "AMOS-OPS",
): string {
  const label = `${issuer}:${accountName}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}

export function encryptTotpSecret(secret: string, keyMaterial: string): string {
  const key = createHash("sha256").update(keyMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTotpSecret(
  encrypted: string,
  keyMaterial: string,
): string {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid encrypted TOTP secret.");
  }
  const key = createHash("sha256").update(keyMaterial).digest();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function matchTotpCounter(
  secret: string,
  suppliedCode: string,
  at: Date,
  lastAcceptedCounter: number | null,
): number | null {
  const currentCounter = Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
  const supplied = Buffer.from(suppliedCode);
  for (const offset of [0, -1, 1]) {
    const counter = currentCounter + offset;
    if (counter <= (lastAcceptedCounter ?? -1)) continue;
    const expected = Buffer.from(totpCode(secret, counter));
    if (
      supplied.length === expected.length &&
      timingSafeEqual(supplied, expected)
    ) {
      return counter;
    }
  }
  return null;
}

export function totpCodeForTest(secret: string, at: Date): string {
  return totpCode(secret, Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS));
}
