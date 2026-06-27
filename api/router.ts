import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { sqlite } from "./queries/connection";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const SALT = 10;
function hash(pwd: string) { return bcrypt.hashSync(pwd, SALT); }

// Auth sub-router - all paths prefixed with "auth."
const authRouter = createRouter({
  seedAdmin: publicQuery.mutation(async () => {
    const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("admin@adolbi.com");
    if (existing) return { created: false, message: "Admin already exists" };
    const id = randomUUID();
    sqlite.prepare("INSERT INTO users (id, email, password_hash, first_name, last_name, role, department, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))")
      .run(id, "admin@adolbi.com", hash("admin123"), "System", "Administrator", "administrator", "IT");
    return { created: true, email: "admin@adolbi.com", password: "admin123" };
  }),

  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const user = sqlite.prepare("SELECT * FROM users WHERE email = ? AND is_active = 1").get(input.email) as any;
      if (!user || !bcrypt.compareSync(input.password, user.password_hash)) throw new Error("Invalid credentials");
      const token = randomUUID();
      sqlite.prepare("INSERT OR REPLACE INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))").run(randomUUID(), user.id, token);
      return { token, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, name: `${user.first_name} ${user.last_name}`, role: user.role } };
    }),

  me: publicQuery
    .input(z.object({ token: z.string() }).optional())
    .query(async ({ input }) => {
      if (!input?.token) return null;
      const row = sqlite.prepare("SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").get(input.token) as any;
      if (!row) return null;
      return { id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name, name: `${row.first_name} ${row.last_name}`, role: row.role };
    }),

  logout: publicQuery.input(z.object({ token: z.string() })).mutation(async ({ input }) => {
    sqlite.prepare("DELETE FROM sessions WHERE token = ?").run(input.token);
    return { success: true };
  }),
});

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
