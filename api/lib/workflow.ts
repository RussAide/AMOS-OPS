// AMOS-OPS Workflow Engine
// Auto-triggers notifications on status changes, document actions, and training milestones

import { getDb } from "../queries/connection";
import { notifications } from "@db/schema";
import { randomUUID } from "crypto";

// ─── Workflow Rule Types ─────────────────────────────────────

export interface WorkflowRule {
  id: string;
  name: string;
  event: WorkflowEvent;
  condition?: WorkflowCondition;
  actions: WorkflowAction[];
  enabled: boolean;
}

export type WorkflowEvent =
  | "hr.status-changed"
  | "hr.person-created"
  | "document.uploaded"
  | "document.verified"
  | "document.rejected"
  | "document.expired"
  | "training.completed"
  | "training.quiz-passed";

export interface WorkflowCondition {
  moduleId?: string;
  toStatus?: string;
  fromStatus?: string;
  minHoursPending?: number;
}

export interface WorkflowAction {
  type: "notify" | "escalate" | "email";
  target: "hr-director" | "supervisor" | "person" | "all-admin" | "qa-officer" | "self";
  title: string;
  message: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

// ─── Default Rules ───────────────────────────────────────────

export const DEFAULT_WORKFLOW_RULES: WorkflowRule[] = [
  // ─── HR Status Change Rules ────────────────────────────────
  {
    id: "wf-hr-status-change",
    name: "HR Status Changed",
    event: "hr.status-changed",
    actions: [{
      type: "notify",
      target: "hr-director",
      title: "Status Updated: {personName}",
      message: "{personName} moved from {fromStatus} to {toStatus} in {moduleName}",
      priority: "normal",
    }],
    enabled: true,
  },
  {
    id: "wf-hr-person-created",
    name: "New Person Added",
    event: "hr.person-created",
    actions: [{
      type: "notify",
      target: "hr-director",
      title: "New {lane} Candidate",
      message: "{firstName} {lastName} has been added to the {lane} lane as {role}. Please review and assign appropriate modules.",
      priority: "normal",
    }],
    enabled: true,
  },
  {
    id: "wf-offer-accepted",
    name: "Offer Accepted",
    event: "hr.status-changed",
    condition: { moduleId: "offers", toStatus: "o-accepted" },
    actions: [{
      type: "notify",
      target: "hr-director",
      title: "Offer Accepted: {personName}",
      message: "{personName} has accepted their offer. Proceed to orientation assignment.",
      priority: "high",
    }],
    enabled: true,
  },
  {
    id: "wf-cleared-for-duty",
    name: "Cleared for Duty",
    event: "hr.status-changed",
    condition: { moduleId: "clearance", toStatus: "c-cleared" },
    actions: [
      {
        type: "notify",
        target: "hr-director",
        title: "Cleared for Duty: {personName}",
        message: "{personName} has passed all clearance checks and is cleared for duty.",
        priority: "high",
      },
      {
        type: "notify",
        target: "supervisor",
        title: "New Staff Cleared: {personName}",
        message: "{personName} is cleared for duty and ready for scheduling.",
        priority: "normal",
      },
    ],
    enabled: true,
  },
  {
    id: "wf-credential-expired",
    name: "Credential Expired",
    event: "hr.status-changed",
    condition: { moduleId: "credentials", toStatus: "cr-expired" },
    actions: [
      {
        type: "notify",
        target: "qa-officer",
        title: "Credential Expired: {personName}",
        message: "{personName}'s credential has expired. Immediate renewal required before next shift.",
        priority: "urgent",
      },
      {
        type: "notify",
        target: "hr-director",
        title: "Urgent: Expired Credential - {personName}",
        message: "{personName}'s credential has expired. They cannot work until renewed.",
        priority: "urgent",
      },
    ],
    enabled: true,
  },

  // ─── Document Rules ────────────────────────────────────────
  {
    id: "wf-doc-uploaded",
    name: "Document Uploaded",
    event: "document.uploaded",
    actions: [{
      type: "notify",
      target: "hr-director",
      title: "Document Uploaded",
      message: "A new document ({recordName}) has been uploaded for {personName} in {moduleName}.",
      priority: "low",
    }],
    enabled: true,
  },
  {
    id: "wf-doc-verified",
    name: "Document Verified",
    event: "document.verified",
    actions: [{
      type: "notify",
      target: "self",
      title: "Document Verified",
      message: "Your document ({recordName}) for {moduleName} has been verified.",
      priority: "normal",
    }],
    enabled: true,
  },
  {
    id: "wf-doc-rejected",
    name: "Document Rejected",
    event: "document.rejected",
    actions: [
      {
        type: "notify",
        target: "self",
        title: "Document Rejected",
        message: "Your document ({recordName}) for {moduleName} was rejected. Reason: {note}",
        priority: "high",
      },
      {
        type: "notify",
        target: "hr-director",
        title: "Document Rejected: {personName}",
        message: "{personName}'s document ({recordName}) was rejected in {moduleName}.",
        priority: "normal",
      },
    ],
    enabled: true,
  },

  // ─── Training Rules ────────────────────────────────────────
  {
    id: "wf-training-completed",
    name: "Training Completed",
    event: "training.completed",
    actions: [
      {
        type: "notify",
        target: "self",
        title: "Training Completed",
        message: "You have completed {moduleTitle}. Great work!",
        priority: "normal",
      },
      {
        type: "notify",
        target: "supervisor",
        title: "Training Complete: {userName}",
        message: "{userName} has completed {moduleTitle}.",
        priority: "normal",
      },
    ],
    enabled: true,
  },
  {
    id: "wf-quiz-passed",
    name: "Quiz Passed",
    event: "training.quiz-passed",
    actions: [{
      type: "notify",
      target: "self",
      title: "Quiz Passed: {moduleTitle}",
      message: "You scored {quizScore}% on the {moduleTitle} quiz. You passed!",
      priority: "normal",
    }],
    enabled: true,
  },
];

// ─── Template Engine ─────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// ─── Notification Creator ────────────────────────────────────

export async function createNotification(opts: {
  userId: string;
  type: "status-change" | "alert" | "document" | "training" | "system";
  title: string;
  message: string;
  personName?: string;
  moduleName?: string;
  actionHref?: string;
}) {
  const db = getDb();
  const id = randomUUID();

  await db.insert(notifications).values({
    id,
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    personName: opts.personName ?? null,
    moduleName: opts.moduleName ?? null,
    actionHref: opts.actionHref ?? null,
  });

  return id;
}

// ─── Workflow Trigger ────────────────────────────────────────

interface TriggerContext {
  personId?: string;
  personName?: string;
  moduleId?: string;
  moduleName?: string;
  fromStatus?: string;
  toStatus?: string;
  recordName?: string;
  note?: string;
  firstName?: string;
  lastName?: string;
  lane?: string;
  role?: string;
  userName?: string;
  moduleTitle?: string;
  quizScore?: string;
  changedBy?: string;
}

export async function triggerWorkflow(event: WorkflowEvent, ctx: TriggerContext) {
  const rules = DEFAULT_WORKFLOW_RULES.filter((r) => r.enabled && r.event === event);

  for (const rule of rules) {
    // Check conditions
    if (rule.condition) {
      if (rule.condition.moduleId && ctx.moduleId !== rule.condition.moduleId) continue;
      if (rule.condition.toStatus && ctx.toStatus !== rule.condition.toStatus) continue;
      if (rule.condition.fromStatus && ctx.fromStatus !== rule.condition.fromStatus) continue;
    }

    // Execute actions
    for (const action of rule.actions) {
      const vars: Record<string, string> = {
        personName: ctx.personName || "Unknown",
        personId: ctx.personId || "",
        moduleName: ctx.moduleName || "Unknown",
        moduleId: ctx.moduleId || "",
        fromStatus: ctx.fromStatus || "(none)",
        toStatus: ctx.toStatus || "(none)",
        recordName: ctx.recordName || "",
        note: ctx.note || "",
        firstName: ctx.firstName || "",
        lastName: ctx.lastName || "",
        lane: ctx.lane || "",
        role: ctx.role || "",
        userName: ctx.userName || "",
        moduleTitle: ctx.moduleTitle || "",
        quizScore: ctx.quizScore || "",
        changedBy: ctx.changedBy || "System",
      };

      const title = renderTemplate(action.title, vars);
      const message = renderTemplate(action.message, vars);

      // Determine notification type from event
      let notifType: "status-change" | "alert" | "document" | "training" | "system" = "system";
      if (event.startsWith("hr.status")) notifType = "status-change";
      else if (event.startsWith("document")) notifType = "document";
      else if (event.startsWith("training")) notifType = "training";
      else if (action.priority === "urgent") notifType = "alert";

      // Determine target user(s)
      const targetUsers = resolveTarget(action.target, ctx);

      for (const userId of targetUsers) {
        try {
          await createNotification({
            userId,
            type: notifType,
            title,
            message,
            personName: ctx.personName,
            moduleName: ctx.moduleName,
            actionHref: ctx.moduleId ? `#/hr/${ctx.moduleId}` : undefined,
          });
        } catch (err) {
          console.error(`[Workflow] Failed to create notification for ${userId}:`, err);
        }
      }
    }
  }
}

// ─── Target Resolution ───────────────────────────────────────

function resolveTarget(target: WorkflowAction["target"], ctx: TriggerContext): string[] {
  switch (target) {
    case "hr-director":
      return ["hr-director"]; // Will match the role-based notification filtering
    case "supervisor":
      return ["supervisor"];
    case "qa-officer":
      return ["qa-officer"];
    case "all-admin":
      return ["administrator", "hr-director"];
    case "self":
    case "person":
      return [ctx.personId || "demo-user"];
    default:
      return ["demo-user"];
  }
}
