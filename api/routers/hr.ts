import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { hrPeople, moduleStatuses, statusTransitions } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { triggerWorkflow } from "../lib/workflow";

export const hrRouter = createRouter({
  // ─── People CRUD ───────────────────────────────────────────

  listPeople: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(hrPeople).orderBy(desc(hrPeople.createdAt)).all();
  }),

  getPerson: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const person = await db.select().from(hrPeople).where(eq(hrPeople.id, input.id)).get();
      if (!person) throw new Error("Person not found");
      return person;
    }),

  createPerson: publicQuery
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

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

      // ─── Trigger workflow ──────────────────────────────────
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

  updatePerson: publicQuery
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      await db
        .update(hrPeople)
        .set(updates)
        .where(eq(hrPeople.id, id));

      return db.select().from(hrPeople).where(eq(hrPeople.id, id)).get();
    }),

  // ─── Module Statuses ───────────────────────────────────────

  getModuleStatuses: publicQuery
    .input(z.object({ personId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.personId) {
        return db.select().from(moduleStatuses).where(eq(moduleStatuses.personId, input.personId)).all();
      }
      return db.select().from(moduleStatuses).all();
    }),

  setModuleStatus: publicQuery
    .input(
      z.object({
        personId: z.string(),
        moduleId: z.string(),
        statusId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

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

      // ─── Trigger workflow ──────────────────────────────────
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

  listTransitions: publicQuery
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

  createTransition: publicQuery
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
    .mutation(async ({ input }) => {
      const db = getDb();
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

      return db.select().from(statusTransitions).where(eq(statusTransitions.id, id)).get();
    }),
});
