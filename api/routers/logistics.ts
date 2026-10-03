import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { auditLog, createRouter, publicQuery } from "../middleware";
import {
  createLogisticsRequest,
  getLogisticsRequest,
  listLogisticsEvents,
  listLogisticsRequestsForRequester,
} from "../services/gad-logistics";
import { getRoleDef, isUserRole } from "../../src/constants/roles";

const serviceTypeSchema = z.enum([
  "facilities",
  "procurement",
  "inventory",
  "vendor",
  "transportation",
  "equipment",
  "technology",
  "workforce_training",
  "safety_emergency",
  "regulatory_support",
  "other",
]);

const prioritySchema = z.enum(["routine", "priority", "urgent", "critical"]);

const createRequestInput = z.object({
  serviceType: serviceTypeSchema,
  title: z.string().min(3).max(160),
  requirement: z.string().min(3).max(2000),
  priority: prioritySchema.default("routine"),
  needBy: z.string().min(8).max(40).nullable().optional(),
  facilityId: z.string().max(120).nullable().optional(),
  location: z.string().max(240).nullable().optional(),
});

function requireCanonicalRole(role: string) {
  if (!isUserRole(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Authenticated role is not in the canonical AMOS-OPS role registry.",
    });
  }
  return getRoleDef(role);
}

export const logisticsRouter = createRouter({
  createRequest: publicQuery
    .input(createRequestInput)
    .mutation(({ ctx, input }) => {
      const role = requireCanonicalRole(ctx.user.role);
      const request = createLogisticsRequest({
        originDivision: role.division,
        originDepartment: ctx.user.department,
        requesterUserId: ctx.user.id,
        requesterRole: ctx.user.role,
        facilityId: input.facilityId ?? null,
        location: input.location ?? null,
        serviceType: input.serviceType,
        title: input.title,
        requirement: input.requirement,
        priority: input.priority,
        needBy: input.needBy ?? null,
      });
      auditLog({
        action: "logistics_request_submitted",
        actor: ctx.user.email,
        resource: request.id,
        details: `${request.request_number}|${request.service_type}|${request.priority}`,
      });
      return request;
    }),

  listMyRequests: publicQuery.query(({ ctx }) =>
    listLogisticsRequestsForRequester(ctx.user.id),
  ),

  getMyRequest: publicQuery
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => {
      const request = getLogisticsRequest(input.id);
      if (!request || request.requester_user_id !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Logistics request not found.",
        });
      }
      return {
        ...request,
        events: listLogisticsEvents(request.id),
      };
    }),
});
