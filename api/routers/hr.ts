import { z } from "zod";
import { createRouter, authedQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import { hrPeople, moduleStatuses, statusTransitions } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { triggerWorkflow } from "../lib/workflow";

export const hrRouter = createRouter({
  // ─── People CRUD ───────────────────────────────────────────

  listPeople: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(hrPeople).orderBy(desc(hrPeople.createdAt)).all();
  }),

  getPerson: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const person = await db.select().from(hrPeople).where(eq(hrPeople.id, input.id)).get();
      if (!person) throw new Error("Person not found");
      return person;
    }),

  createPerson: authedQuery
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        employeeId: z.string().optional(),
        role: z.string().min(1),
        department: z.string().min(1),
        lane: z.enum(["activation", "management"]).default("activation"),
        hireDate: z.string().optional(),
        supervisor: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const id = randomUUID();
      const actor = ctx.user?.email ?? "unknown";

      await db.insert(hrPeople).values({
        id,
        firstName: input.firstName,
        lastName: input.lastName,
        employeeId: input.employeeId ?? null,
        role: input.role,
        department: input.department,
        lane: input.lane,
        hireDate: input.hireDate ?? null,
        supervisor: input.supervisor ?? null,
      });

      const person = await db.select().from(hrPeople).where(eq(hrPeople.id, id)).get();

      auditLog({
        action: "hr:createPerson",
        actor,
        resource: `person:${id}`,
        details: `Created person "${input.firstName} ${input.lastName}" (${input.role}, ${input.department})`,
      });

      triggerWorkflow("hr.person-created", {
        personId: id,
        firstName: input.firstName,
        lastName: input.lastName,
        lane: input.lane,
        role: input.role,
        personName: `${input.firstName} ${input.lastName}`,
      }).catch((err) => console.error("[Workflow] Person created trigger failed:", err));

      return person;
    }),

  updatePerson: authedQuery
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        employeeId: z.string().optional(),
        role: z.string().min(1).optional(),
        department: z.string().min(1).optional(),
        lane: z.enum(["activation", "management"]).optional(),
        isActive: z.boolean().optional(),
        isEmployee: z.boolean().optional(),
        hireDate: z.string().optional(),
        supervisor: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const actor = ctx.user?.email ?? "unknown";

      const personBefore = await db.select().from(hrPeople).where(eq(hrPeople.id, id)).get();

      await db
        .update(hrPeople)
        .set(updates)
        .where(eq(hrPeople.id, id));

      auditLog({
        action: "hr:updatePerson",
        actor,
        resource: `person:${id}`,
        details: `Updated person "${personBefore?.firstName ?? ""} ${personBefore?.lastName ?? ""}" — fields: ${Object.keys(updates).join(", ")}`,
      });

      return db.select().from(hrPeople).where(eq(hrPeople.id, id)).get();
    }),

  deletePerson: authedQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";

      // Delete related records first
      await db.delete(moduleStatuses).where(eq(moduleStatuses.personId, input.id));
      await db.delete(statusTransitions).where(eq(statusTransitions.personId, input.id));
      await db.delete(hrPeople).where(eq(hrPeople.id, input.id));

      auditLog({
        action: "hr:deletePerson",
        actor,
        resource: `person:${input.id}`,
        details: `Deleted person and all related records`,
      });

      return { success: true };
    }),

  // ─── Module Statuses ───────────────────────────────────────

  getModuleStatuses: authedQuery
    .input(z.object({ personId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.personId) {
        return db.select().from(moduleStatuses).where(eq(moduleStatuses.personId, input.personId)).all();
      }
      return db.select().from(moduleStatuses).all();
    }),

  setModuleStatus: authedQuery
    .input(
      z.object({
        personId: z.string(),
        moduleId: z.string(),
        statusId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";

      // Get person info for workflow
      const person = await db.select().from(hrPeople).where(eq(hrPeople.id, input.personId)).get();

      // Check if status entry exists
      const existing = await db
        .select()
        .from(moduleStatuses)
        .where(
          and(
            eq(moduleStatuses.personId, input.personId),
            eq(moduleStatuses.moduleId, input.moduleId),
          ),
        )
        .get();

      const oldStatusId = existing?.statusId || "";

      let result;
      if (existing) {
        await db
          .update(moduleStatuses)
          .set({ statusId: input.statusId, updatedAt: new Date().toISOString() })
          .where(eq(moduleStatuses.id, existing.id));
        result = { ...existing, statusId: input.statusId };
      } else {
        const id = randomUUID();
        await db.insert(moduleStatuses).values({
          id,
          personId: input.personId,
          moduleId: input.moduleId,
          statusId: input.statusId,
        });
        result = await db.select().from(moduleStatuses).where(eq(moduleStatuses.id, id)).get();
      }

      auditLog({
        action: "hr:setModuleStatus",
        actor,
        resource: `person:${input.personId}`,
        details: `Set module "${input.moduleId}" to status "${input.statusId}" for ${person ? `${person.firstName} ${person.lastName}` : input.personId}`,
      });

      if (person) {
        const moduleNames: Record<string, string> = {
          recruitment: "Recruitment", screening: "Screening", interview: "Interview",
          offers: "Offers & Pre-Employment", orientation: "Orientation",
          onboarding: "Onboarding", clearance: "Clearance",
          "personnel-files": "Personnel Files", credentials: "Credentials",
          performance: "Performance", compliance: "Compliance & Corrective Action",
          separation: "Separation & Offboarding",
        };

        triggerWorkflow("hr.status-changed", {
          personId: input.personId,
          personName: `${person.firstName} ${person.lastName}`,
          moduleId: input.moduleId,
          moduleName: moduleNames[input.moduleId] || input.moduleId,
          fromStatus: oldStatusId,
          toStatus: input.statusId,
        }).catch((err) => console.error("[Workflow] Status change trigger failed:", err));
      }

      return result;
    }),

  // ─── Status Transitions (Audit Trail) ──────────────────────

  listTransitions: authedQuery
    .input(z.object({ personId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      if (input.personId) {
        return db
          .select()
          .from(statusTransitions)
          .where(eq(statusTransitions.personId, input.personId))
          .orderBy(desc(statusTransitions.changedAt))
          .all();
      }
      return db.select().from(statusTransitions).orderBy(desc(statusTransitions.changedAt)).all();
    }),

  createTransition: authedQuery
    .input(
      z.object({
        personId: z.string(),
        personName: z.string(),
        moduleId: z.string(),
        moduleName: z.string(),
        fromStatus: z.string(),
        toStatus: z.string(),
        changedBy: z.string(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? input.changedBy;
      const id = randomUUID();

      await db.insert(statusTransitions).values({
        id,
        personId: input.personId,
        personName: input.personName,
        moduleId: input.moduleId,
        moduleName: input.moduleName,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedBy: input.changedBy,
        note: input.note ?? null,
      });

      auditLog({
        action: "hr:createTransition",
        actor,
        resource: `person:${input.personId}`,
        details: `Status transition: "${input.moduleName}" from "${input.fromStatus}" to "${input.toStatus}"${input.note ? ` — ${input.note}` : ""}`,
      });

      return db.select().from(statusTransitions).where(eq(statusTransitions.id, id)).get();
    }),

  // ─── HR Dashboard Stats ────────────────────────────────────

  dashboard: authedQuery.query(async () => {
    const db = getDb();
    const allPeople = await db.select().from(hrPeople).all();
    const allStatuses = await db.select().from(moduleStatuses).all();
    const allTransitions = await db.select().from(statusTransitions).all();

    const totalPeople = allPeople.length;
    const employees = allPeople.filter((p) => p.isEmployee).length;
    const candidates = allPeople.filter((p) => !p.isEmployee).length;
    const activePeople = allPeople.filter((p) => p.isActive).length;

    // Activation pipeline stats
    const activationLane = allPeople.filter((p) => p.lane === "activation");
    const managementLane = allPeople.filter((p) => p.lane === "management");

    // Module breakdown
    const moduleStats: Record<string, { total: number; byStatus: Record<string, number> }> = {};
    for (const mod of ["recruitment", "screening", "offers", "orientation", "onboarding", "clearance", "personnel-files", "credentials", "performance", "compliance", "separation"]) {
      const modStatuses = allStatuses.filter((s) => s.moduleId === mod);
      const byStatus: Record<string, number> = {};
      for (const s of modStatuses) {
        byStatus[s.statusId] = (byStatus[s.statusId] || 0) + 1;
      }
      moduleStats[mod] = { total: modStatuses.length, byStatus };
    }

    // Recent transitions
    const recentTransitions = allTransitions
      .sort((a, b) => new Date(b.changedAt ?? 0).getTime() - new Date(a.changedAt ?? 0).getTime())
      .slice(0, 10);

    return {
      totalPeople,
      employees,
      candidates,
      activePeople,
      activationLane: activationLane.length,
      managementLane: managementLane.length,
      moduleStats,
      recentTransitions,
    };
  }),
});
