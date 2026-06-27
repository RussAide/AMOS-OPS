import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

function generateWONumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `WO-${year}-${seq}`;
}

export const gadRouter = createRouter({
  // ─── Work Orders ───────────────────────────────────────────

  listWorkOrders: publicQuery
    .input(z.object({ status: z.string().optional(), priority: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM work_orders";
      const conditions: string[] = [];
      const params: any[] = [];
      if (input?.status) { conditions.push("status = ?"); params.push(input.status); }
      if (input?.priority) { conditions.push("priority = ?"); params.push(input.priority); }
      if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
      sql += " ORDER BY created_at DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  createWorkOrder: publicQuery
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      category: z.string().optional(),
      assignedTo: z.string().optional(),
      dueDate: z.string().optional(),
      facility: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = randomUUID();
      const woNum = generateWONumber();
      sqlite.prepare(
        "INSERT INTO work_orders (id, wo_number, title, description, priority, status, category, assigned_to, due_date, facility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, datetime('now'), datetime('now'))"
      ).run(id, woNum, input.title, input.description ?? null, input.priority, input.category ?? null, input.assignedTo ?? null, input.dueDate ?? null, input.facility ?? null);
      return sqlite.prepare("SELECT * FROM work_orders WHERE id = ?").get(id);
    }),

  updateWorkOrder: publicQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["open", "in_progress", "pending_parts", "completed", "cancelled"]).optional(),
      assignedTo: z.string().optional(),
      completionNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      if (updates.status) sqlite.prepare("UPDATE work_orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(updates.status, id);
      if (updates.assignedTo) sqlite.prepare("UPDATE work_orders SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?").run(updates.assignedTo, id);
      if (updates.completionNotes) sqlite.prepare("UPDATE work_orders SET completion_notes = ?, updated_at = datetime('now') WHERE id = ?").run(updates.completionNotes, id);
      if (updates.status === "completed") sqlite.prepare("UPDATE work_orders SET completed_at = datetime('now') WHERE id = ?").run(id);
      return sqlite.prepare("SELECT * FROM work_orders WHERE id = ?").get(id);
    }),

  // ─── Vendors ───────────────────────────────────────────────

  listVendors: publicQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async () => {
      return sqlite.prepare("SELECT * FROM vendors WHERE is_active = 1 ORDER BY name").all() ?? [];
    }),

  createVendor: publicQuery
    .input(z.object({
      name: z.string().min(1),
      vendorType: z.string(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      services: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = randomUUID();
      sqlite.prepare(
        "INSERT INTO vendors (id, name, vendor_type, contact_name, contact_phone, contact_email, services, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))"
      ).run(id, input.name, input.vendorType, input.contactName ?? null, input.contactPhone ?? null, input.contactEmail ?? null, input.services ?? null);
      return sqlite.prepare("SELECT * FROM vendors WHERE id = ?").get(id);
    }),

  // ─── Facilities ────────────────────────────────────────────

  listFacilities: publicQuery.query(async () => {
    return sqlite.prepare("SELECT * FROM facilities WHERE is_active = 1 ORDER BY name").all() ?? [];
  }),

  createFacility: publicQuery
    .input(z.object({
      name: z.string().min(1),
      address: z.string().optional(),
      facilityType: z.string().optional(),
      squareFootage: z.number().optional(),
      rooms: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = randomUUID();
      sqlite.prepare(
        "INSERT INTO facilities (id, name, address, facility_type, square_footage, rooms, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))"
      ).run(id, input.name, input.address ?? null, input.facilityType ?? null, input.squareFootage ?? null, input.rooms ?? null);
      return sqlite.prepare("SELECT * FROM facilities WHERE id = ?").get(id);
    }),

  // ─── Dashboard ─────────────────────────────────────────────

  dashboardKPIs: publicQuery.query(async () => {
    const woResult = sqlite.prepare("SELECT status, COUNT(*) as count FROM work_orders GROUP BY status").all() ?? [];
    const vendorResult = sqlite.prepare("SELECT COUNT(*) as count FROM vendors WHERE is_active = 1").get() as any;
    const facilityResult = sqlite.prepare("SELECT COUNT(*) as count FROM facilities WHERE is_active = 1").get() as any;

    const woCounts: Record<string, number> = {};
    for (const row of woResult as any[]) woCounts[row.status] = row.count;

    return {
      totalWorkOrders: Object.values(woCounts).reduce((a: number, b: number) => a + b, 0),
      openWorkOrders: woCounts["open"] ?? 0,
      inProgressWorkOrders: woCounts["in_progress"] ?? 0,
      completedWorkOrders: woCounts["completed"] ?? 0,
      vendorCount: vendorResult?.count ?? 0,
      facilityCount: facilityResult?.count ?? 0,
    };
  }),
});
