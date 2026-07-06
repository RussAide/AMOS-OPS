import { z } from "zod";
import { createRouter, publicQuery, adminQuery, rateLimitedAuth } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const SESSION_DAYS = 7;

// ═══════════════════════════════════════════════════════════════
//  Password Complexity Requirements (Task D013-02)
//  Minimum 8 characters, requires at least one uppercase,
//  one lowercase, one number, and one special symbol.
// ═══════════════════════════════════════════════════════════════

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

function validatePasswordComplexity(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) {
    return { valid: false, reason: "Password must be at least 8 characters long" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one lowercase letter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one uppercase letter" };
  }
  if (!/\d/.test(password)) {
    return { valid: false, reason: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one special character (!@#$%^&* etc.)" };
  }
  return { valid: true };
}

function generateToken() {
  return randomUUID() + randomUUID();
}

export const localAuthRouter = createRouter({
  // ─── Register ──────────────────────────────────────────────

  register: rateLimitedAuth
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8).regex(
        PASSWORD_REGEX,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      ),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      role: z.string().default("staff"),
      department: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Runtime password complexity validation (D013-02)
      const pwCheck = validatePasswordComplexity(input.password);
      if (!pwCheck.valid) {
        throw new Error(`Password rejected: ${pwCheck.reason}`);
      }

      const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(input.email);
      if (existing) throw new Error("Email already registered");

      const id = randomUUID();
      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

      sqlite.prepare(
        "INSERT INTO users (id, email, password_hash, first_name, last_name, role, department, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))"
      ).run(id, input.email, passwordHash, input.firstName, input.lastName, input.role, input.department ?? null);

      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
      sqlite.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)").run(randomUUID(), id, token, expiresAt);

      const user = sqlite.prepare("SELECT id, email, first_name, last_name, role, department FROM users WHERE id = ?").get(id);
      return { user, token };
    }),

  // ─── Login ─────────────────────────────────────────────────

  login: rateLimitedAuth
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const user = sqlite.prepare("SELECT * FROM users WHERE email = ? AND is_active = 1").get(input.email) as any;
      if (!user) throw new Error("Invalid email or password");

      const valid = await bcrypt.compare(input.password, user.password_hash);
      if (!valid) throw new Error("Invalid email or password");

      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
      sqlite.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)").run(randomUUID(), user.id, token, expiresAt);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
          department: user.department,
        },
        token,
      };
    }),

  // ─── Me (current user) ─────────────────────────────────────

  me: publicQuery
    .input(z.object({ token: z.string() }).optional())
    .query(async ({ input }) => {
      if (!input?.token) return null;

      const session = sqlite.prepare(
        "SELECT s.*, u.id as uid, u.email, u.first_name, u.last_name, u.role, u.department FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1"
      ).get(input.token) as any;

      if (!session) return null;

      return {
        id: session.uid,
        email: session.email,
        firstName: session.first_name,
        lastName: session.last_name,
        name: `${session.first_name} ${session.last_name}`,
        role: session.role,
        department: session.department,
      };
    }),

  // ─── Logout ────────────────────────────────────────────────

  logout: publicQuery
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      sqlite.prepare("DELETE FROM sessions WHERE token = ?").run(input.token);
      return { success: true };
    }),

});
