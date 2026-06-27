import { createRouter, publicQuery } from "./middleware";
import { hrRouter } from "./routers/hr";
import { documentsRouter } from "./routers/documents";
import { trainingRouter } from "./routers/training";
import { notificationsRouter } from "./routers/notifications";
import { workflowRouter } from "./routers/workflow";
import { analyticsRouter } from "./routers/analytics";
import { credentialsRouter } from "./routers/credentials";
import { performanceRouter } from "./routers/performance";
import { separationRouter } from "./routers/separation";
import { auditRouter } from "./routers/audit";
import { emailRouter } from "./routers/email";
import { formsRouter } from "./routers/forms";
import { bhcRouter } from "./routers/bhc";
import { revenueRouter } from "./routers/revenue";
import { qaRouter } from "./routers/qa";
import { gadRouter } from "./routers/gad";
import { personaRouter } from "./routers/persona";
import { groRouter } from "./routers/gro";
import { nilRouter } from "./routers/nil";
import { msGraphRouter } from "./routers/msgraph";
import { localAuthRouter } from "./routers/auth-local";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  auth: localAuthRouter,
  hr: hrRouter,
  documents: documentsRouter,
  training: trainingRouter,
  notifications: notificationsRouter,
  workflow: workflowRouter,
  analytics: analyticsRouter,
  credentials: credentialsRouter,
  performance: performanceRouter,
  separation: separationRouter,
  audit: auditRouter,
  email: emailRouter,
  forms: formsRouter,
  bhc: bhcRouter,
  revenue: revenueRouter,
  qa: qaRouter,
  gad: gadRouter,
  persona: personaRouter,
  gro: groRouter,
  nil: nilRouter,
  msgraph: msGraphRouter,
});

export type AppRouter = typeof appRouter;
