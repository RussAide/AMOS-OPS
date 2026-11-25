import { TRPCError } from "@trpc/server";

/**
 * M1.8 My Work: the task assignment is the access grant.
 *
 * This intentionally does not infer an entitlement from a generic division,
 * department, job title, or a user-supplied assignedTo query parameter.
 * The three named enterprise leadership roles retain oversight; all other
 * users must have an explicit assignment by immutable user ID or email.
 *
 * This module does not provision a contractor role or expand shared RBAC.
 */
export interface WorkQueuePrincipal {
  id: string;
  email: string;
  role: string;
}

export interface WorkQueueAssignment {
  assigned_to: string | null;
}

const oversightRoles = new Set(["super-admin", "managing-director", "administrator"]);

export function canOverseeWorkQueue(user: WorkQueuePrincipal): boolean {
  return oversightRoles.has(user.role);
}

export function isExplicitlyAssigned(
  task: WorkQueueAssignment,
  user: WorkQueuePrincipal,
): boolean {
  const assignee = task.assigned_to?.trim();
  if (!assignee) return false;
  if (assignee === user.id) return true;
  return Boolean(user.email && assignee.toLowerCase() === user.email.trim().toLowerCase());
}

export function assertWorkTaskAccess(
  task: WorkQueueAssignment,
  user: WorkQueuePrincipal,
): void {
  if (canOverseeWorkQueue(user) || isExplicitlyAssigned(task, user)) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Task access requires leadership or an explicit assigned task.",
  });
}

export function requireWorkQueueLeadership(user: WorkQueuePrincipal): void {
  if (canOverseeWorkQueue(user)) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Work allocation and cross-team escalation require enterprise leadership.",
  });
}

/**
 * Restrict the SQL query at the database boundary, before any other user
 * filters are applied. An `assignedTo` supplied by the caller can only
 * narrow the user's authorized result set, never broaden it.
 */
export function scopeWorkQueueSql(
  sql: string,
  params: string[],
  user: WorkQueuePrincipal,
): string {
  if (canOverseeWorkQueue(user)) return sql;
  params.push(user.id, user.email.trim());
  return sql + " AND (assigned_to = ? OR lower(assigned_to) = lower(?))";
}
