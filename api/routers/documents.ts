import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { documents, hrPeople } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { triggerWorkflow } from "../lib/workflow";

export const documentsRouter = createRouter({
  list: publicQuery
    .input(z.object({ personId: z.string().optional(), moduleId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();

      if (input?.personId && input?.moduleId) {
        return db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.personId, input.personId),
              eq(documents.moduleId, input.moduleId),
            ),
          )
          .all();
      }

      if (input?.personId) {
        return db
          .select()
          .from(documents)
          .where(eq(documents.personId, input.personId))
          .all();
      }

      return db.select().from(documents).all();
    }),

  getById: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const doc = await db.select().from(documents).where(eq(documents.id, input.id)).get();
      if (!doc) throw new Error("Document not found");
      return doc;
    }),

  create: publicQuery
    .input(
      z.object({
        personId: z.string(),
        moduleId: z.string(),
        recordName: z.string().min(1),
        fileName: z.string().min(1),
        fileType: z.string().optional(),
        fileSize: z.number().optional(),
        filePath: z.string().optional(),
        uploadedBy: z.string().optional(),
        expiryDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(documents).values({
        id,
        personId: input.personId,
        moduleId: input.moduleId,
        recordName: input.recordName,
        fileName: input.fileName,
        fileType: input.fileType ?? null,
        fileSize: input.fileSize ?? null,
        filePath: input.filePath ?? null,
        uploadedBy: input.uploadedBy ?? null,
        expiryDate: input.expiryDate ?? null,
      });

      const doc = await db.select().from(documents).where(eq(documents.id, id)).get();

      // ─── Trigger workflow ──────────────────────────────────
      const person = await db.select().from(hrPeople).where(eq(hrPeople.id, input.personId)).get();
      triggerWorkflow("document.uploaded", {
        personId: input.personId,
        personName: person ? `${person.firstName} ${person.lastName}` : "Unknown",
        moduleId: input.moduleId,
        recordName: input.recordName,
      }).catch((err) => console.error("[Workflow] Document uploaded trigger failed:", err));

      return doc;
    }),

  updateStatus: publicQuery
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["uploaded", "verified", "rejected", "expired"]),
        verifiedBy: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const updates: Record<string, unknown> = { status: input.status };
      if (input.status === "verified") {
        updates.verifiedAt = new Date().toISOString();
        updates.verifiedBy = input.verifiedBy ?? null;
      }
      if (input.note !== undefined) {
        updates.note = input.note;
      }

      await db.update(documents).set(updates).where(eq(documents.id, input.id));
      const doc = await db.select().from(documents).where(eq(documents.id, input.id)).get();

      // ─── Trigger workflow ──────────────────────────────────
      if (doc) {
        const person = await db.select().from(hrPeople).where(eq(hrPeople.id, doc.personId)).get();
        const ctx = {
          personId: doc.personId,
          personName: person ? `${person.firstName} ${person.lastName}` : "Unknown",
          moduleId: doc.moduleId,
          moduleName: doc.moduleId,
          recordName: doc.recordName,
          note: input.note || "",
        };

        if (input.status === "verified") {
          triggerWorkflow("document.verified", ctx).catch((err) =>
            console.error("[Workflow] Document verified trigger failed:", err)
          );
        } else if (input.status === "rejected") {
          triggerWorkflow("document.rejected", ctx).catch((err) =>
            console.error("[Workflow] Document rejected trigger failed:", err)
          );
        }
      }

      return doc;
    }),

  delete: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(documents).where(eq(documents.id, input.id));
      return { success: true };
    }),

  getMissingDocuments: publicQuery
    .input(z.object({ personId: z.string() }))
    .query(async ({ input }) => {
      // This returns all non-verified documents for a person
      const db = getDb();
      return db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.personId, input.personId),
            eq(documents.status, "uploaded"),
          ),
        )
        .all();
    }),
});
