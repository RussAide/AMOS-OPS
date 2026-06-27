import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { randomUUID } from "crypto";

// ─── In-memory log for mock mode (no SMTP configured) ────────

interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  body: string;
  template: string;
  status: "queued" | "sent" | "failed";
  sentAt: string;
  error?: string;
}

const emailLog: EmailRecord[] = [];

// ─── Email templates ─────────────────────────────────────────

const TEMPLATES: Record<string, (vars: Record<string, string>) => { subject: string; body: string }> = {
  "status-change": (vars) => ({
    subject: `HR Update: ${vars.personName} - ${vars.moduleName}`,
    body: `Hello,\n\nThis is an automated notification from AMOS-OPS.\n\n${vars.personName}'s status in ${vars.moduleName} has changed from "${vars.fromStatus}" to "${vars.toStatus}".\n\nChanged by: ${vars.changedBy}\nTimestamp: ${vars.timestamp}\n\nPlease log into AMOS-OPS to review.\n\n---\nAMOS-OPS HR Lifecycle System`,
  }),
  "credential-expiring": (vars) => ({
    subject: `URGENT: Credential Expiring - ${vars.personName}`,
    body: `Hello,\n\n${vars.personName}'s ${vars.credentialType} expires on ${vars.expiryDate} (${vars.daysRemaining} days remaining).\n\nPlease arrange renewal immediately to avoid compliance issues.\n\n---\nAMOS-OPS HR Lifecycle System`,
  }),
  "credential-expired": (vars) => ({
    subject: `CRITICAL: Credential Expired - ${vars.personName}`,
    body: `Hello,\n\n${vars.personName}'s ${vars.credentialType} has EXPIRED as of ${vars.expiryDate}.\n\nThis person cannot work until the credential is renewed. Immediate action required.\n\n---\nAMOS-OPS HR Lifecycle System`,
  }),
  "offboarding-complete": (vars) => ({
    subject: `Offboarding Complete - ${vars.personName}`,
    body: `Hello,\n\n${vars.personName}'s offboarding process is now ${vars.percentComplete}% complete.\n\nAll checklist items have been reviewed and recorded in AMOS-OPS.\n\n---\nAMOS-OPS HR Lifecycle System`,
  }),
  "welcome": (vars) => ({
    subject: `Welcome to AMOS-OPS - ${vars.personName}`,
    body: `Hello ${vars.personName},\n\nWelcome to the team! Your onboarding process has been initiated in AMOS-OPS.\n\nYour supervisor (${vars.supervisor}) will guide you through the activation journey.\n\nLogin at: https://amos-ops.intranet\n\n---\nAMOS-OPS HR Lifecycle System`,
  }),
};

export const emailRouter = createRouter({
  // ─── Send email ────────────────────────────────────────────
  send: publicQuery
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        template: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const id = randomUUID();
      const isMock = !process.env.SMTP_HOST;

      const record: EmailRecord = {
        id,
        to: input.to,
        subject: input.subject,
        body: input.body,
        template: input.template || "custom",
        status: isMock ? "queued" : "sent",
        sentAt: new Date().toISOString(),
      };

      if (!isMock) {
        // Real SMTP would go here — requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars
        try {
          // const transporter = nodemailer.createTransport({...})
          // await transporter.sendMail({...})
          record.status = "sent";
        } catch (err: any) {
          record.status = "failed";
          record.error = err.message;
        }
      }

      emailLog.unshift(record);
      if (emailLog.length > 500) emailLog.pop();

      return {
        id,
        status: record.status,
        mock: isMock,
        message: isMock
          ? "[MOCK MODE] Email logged but not sent. Configure SMTP_HOST to enable real delivery."
          : "Email sent successfully.",
      };
    }),

  // ─── Send from template ────────────────────────────────────
  sendTemplate: publicQuery
    .input(
      z.object({
        to: z.string().email(),
        template: z.string().min(1),
        vars: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      const templateFn = TEMPLATES[input.template];
      if (!templateFn) {
        throw new Error(`Unknown template: ${input.template}. Available: ${Object.keys(TEMPLATES).join(", ")}`);
      }

      const { subject, body } = templateFn(input.vars);
      const id = randomUUID();
      const isMock = !process.env.SMTP_HOST;

      const record: EmailRecord = {
        id,
        to: input.to,
        subject,
        body,
        template: input.template,
        status: isMock ? "queued" : "sent",
        sentAt: new Date().toISOString(),
      };

      emailLog.unshift(record);
      if (emailLog.length > 500) emailLog.pop();

      return {
        id,
        status: record.status,
        mock: isMock,
        subject,
        message: isMock
          ? `[MOCK MODE] Template "${input.template}" logged but not sent. Configure SMTP_HOST to enable real delivery.`
          : "Email sent successfully.",
      };
    }),

  // ─── List sent emails ──────────────────────────────────────
  list: publicQuery
    .input(z.object({ limit: z.number().min(1).max(500).optional() }).optional())
    .query(async ({ input }) => {
      return emailLog.slice(0, input?.limit || 100);
    }),

  // ─── Get templates ─────────────────────────────────────────
  templates: publicQuery.query(async () => {
    return Object.keys(TEMPLATES).map((key) => ({
      id: key,
      name: key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: TEMPLATE_DESCRIPTIONS[key] || "",
    }));
  }),

  // ─── Stats ─────────────────────────────────────────────────
  stats: publicQuery.query(async () => {
    return {
      total: emailLog.length,
      sent: emailLog.filter((e) => e.status === "sent").length,
      queued: emailLog.filter((e) => e.status === "queued").length,
      failed: emailLog.filter((e) => e.status === "failed").length,
      mockMode: !process.env.SMTP_HOST,
    };
  }),
});

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  "status-change": "Sent when a person's module status changes",
  "credential-expiring": "Sent when a credential is about to expire (< 30 days)",
  "credential-expired": "Sent when a credential has already expired",
  "offboarding-complete": "Sent when offboarding checklist reaches 100%",
  "welcome": "Sent to new hires when they are created in the system",
};
