# AMOS-OPS Sprint Changelog

## v1.3.0 — Account-Level Training and Operational Access

- Added account-level Training and Operational access within one application deployment.
- Isolated Training records and files from Operational data and blocked Training access to Microsoft 365 and email connectors.
- Added sponsored invitations, expiry, clearance evidence, session revocation, and access-profile audit events.
- Added separate Training database and upload paths within the existing Railway service architecture.
- Reconciled public-release metadata and removed owner-specific test/example identifiers.
- Verified strict lint, TypeScript, 1,409 automated tests, and production client/server builds.

## From Previous State → Current State
## Date: 2026-07-05
## Tasks Completed: 143 (all 16 documents D-001 through D-016)

---

## Files Changed Summary

### NEW FILES (Created during sprint)

#### Frontend Pages (src/pages/) — 29 new pages
```
src/pages/workflows/WorkflowsPage.tsx                    (D002-04 placeholder)
src/pages/analytics/AnalyticsPage.tsx                     (D002-04 placeholder)
src/pages/knowledge/KnowledgePage.tsx                     (D002-04 placeholder)
src/pages/workflows/MyWorkTodayPage.tsx                   (D003-01, 875 lines)
src/pages/clinical/TreatmentPlansPage.tsx                 (D008-01)
src/pages/clinical/ClinicalSessionsPage.tsx               (D008-01)
src/pages/clinical/OutcomeMeasuresPage.tsx                (D008-01)
src/pages/clinical/InsurancePlansPage.tsx                 (D008-01)
src/pages/clinical/ReferralIntakePage.tsx                 (D008-01)
src/pages/clinical/CansAssessmentPage.tsx                 (D008-01)
src/pages/clinical/ServiceDeliveryPage.tsx                (D008-01)
src/pages/gro/ShiftLogPage.tsx                            (D008-02)
src/pages/gro/SafetyRoundPage.tsx                         (D008-02)
src/pages/gro/YouthCareLogPage.tsx                        (D008-02)
src/pages/gro/IncidentReportPage.tsx                      (D008-02)
src/pages/gro/SupervisionNotesPage.tsx                     (D008-02)
src/pages/gro/ShiftHandoffListPage.tsx                    (D008-02)
src/pages/qa/CAPTrackerPage.tsx                          (D008-03)
src/pages/qa/AuditBinderPage.tsx                          (D008-03)
src/pages/qa/EvidenceMatrixPage.tsx                       (D008-03)
src/pages/qa/ComplianceMemoPage.tsx                       (D008-03)
src/pages/qa/DeficiencyTrackingPage.tsx                   (D008-03)
src/pages/revenue/ClaimSubmissionPage.tsx                 (D008-04)
src/pages/revenue/AuthorizationManagementPage.tsx          (D008-04)
src/pages/revenue/PayerPacketBuilderPage.tsx              (D008-04)
src/pages/revenue/DenialManagementPage.tsx                 (D008-04)
src/pages/revenue/AgingQueuePage.tsx                      (D008-04)
src/pages/revenue/ProofOfServiceGatePage.tsx              (D008-04)
src/pages/hr/CredentialTrackingPage.tsx                   (D008-05)
src/pages/hr/SeparationManagementPage.tsx                 (D008-05)
src/pages/hr/TrainingAssignmentPage.tsx                   (D008-05)
src/pages/hr/PerformanceReviewPage.tsx                    (D008-05)
src/pages/hr/OnboardingWorkflowPage.tsx                   (D008-05)
src/pages/exec/StrategicProjectsHubPage.tsx               (D008-07)
src/pages/exec/MarketingSiteReviewPage.tsx                (D008-07)
src/pages/admin/EnhancementRegisterPage.tsx               (D014-02)
```

#### Frontend Components (src/components/) — 6 new components
```
src/components/agents/AgentPersonaIndicator.tsx            (D006-01, 869 lines)
src/components/agents/index.ts                            (D006-01 barrel export)
src/components/workflows/WorkTaskFilters.tsx              (D003-06)
src/components/help/AskAmosPanel.tsx                      (D014-01, 447 lines)
src/components/sentinel/SentinelControlBand.tsx           (D008-03)
src/components/sentinel/QASentinelFilters.tsx             (D008-03)
```

#### Backend Routers (api/routers/) — 0 new routers, all existing enhanced
All 47 routers were modified to add `authedQuery`/`adminQuery` and new endpoints.

#### Database — 2 new migration files
```
db/migrations/0001_boundary_enforcement.sql               (D006-03)
db/seed-case2-incomplete-referral.ts                      (D012-02)
db/seed-case2-incomplete-referral.sql                     (D012-02)
db/seed-case2-incomplete-referral.js                      (D012-02)
```

#### Documentation — 4 new docs files
```
docs/icr/ICR-REGISTRY.md                                  (D015-01, 914 lines)
docs/RC-DECISION-LOG.md                                   (D016-01, 576 lines)
docs/icr/pilot-case2-evidence-report.md                   (D012-02)
docs/icr/pilot-case2-evidence.json                        (D012-02)
ENCRYPTION.md                                              (D013-04)
```

#### Deployment Config — 7 new files
```
Dockerfile                                                 (Railway deploy)
railway.toml                                               (Railway config)
railway.json                                               (Railway settings)
netlify.toml                                               (Netlify config)
.github/workflows/ci.yml                                   (CI checks)
.github/workflows/deploy-railway.yml                       (Auto Railway deploy)
.github/workflows/deploy-netlify.yml                       (Auto Netlify deploy)
DEPLOY.md                                                  (Deployment guide)
RAILWAY_NETLIFY_DEPLOY.md                                  (Full deploy guide)
```

### MODIFIED FILES (Key changes)

| File | What Changed |
|------|-------------|
| `api/router.ts` | 4 router renames + seed router removed + new routers registered |
| `api/middleware.ts` | +15 boundary enforcement exports, 3 new tables, phiGuardQuery hardened |
| `api/routers/ccmg.ts` | 4 publicQuery→authedQuery, 7→adminQuery, 7 as any removed |
| `api/routers/mhtcm.ts` | 8 publicQuery→authedQuery, 8→adminQuery, 7 as any removed |
| `api/routers/mhrs.ts` | 5 publicQuery→authedQuery, 6→adminQuery, 3 as any removed |
| `api/routers/gro-compliance.ts` | 7 publicQuery→authedQuery, 11→adminQuery, 3 as any removed |
| `api/routers/part2.ts` | 8 publicQuery→authedQuery, 10→adminQuery, 11 as any removed |
| `api/routers/mgma.ts` | 5 publicQuery→authedQuery, 4→adminQuery, 2 as any removed |
| `api/routers/m1.ts` | +getWorkQueueGrouped, +evidence validation, +escalation, +reassignment |
| `api/routers/m2.ts` | +7 DMS endpoints (document ID, lifecycle, approval, packets, retention, audit) |
| `api/routers/workflow.ts` | +64 endpoints for 8 workflows with evidence gates + 21 seed instances |
| `api/routers/persona.ts` | +5 endpoints (listPersonas, getPersona, listPilotPersonas, activate, deactivate) |
| `api/routers/bhc.ts` | +full clinical CRUD endpoints |
| `api/routers/gro.ts` | +40 endpoints for 6 residential features |
| `api/routers/m3.ts` | +25 endpoints for 5 QA features |
| `api/routers/m4.ts` | +17 endpoints for 7 revenue features |
| `api/routers/m7.ts` | +20 endpoints for 5 GAD features |
| `api/routers/m10.ts` | +8 endpoints (strategic projects, SOPs, marketing) |
| `api/routers/hr.ts` | +dashboard, delete endpoints |
| `api/routers/credentials.ts` | +verify, peopleWithIssues |
| `api/routers/separation.ts` | +listAll, dashboard, initiate |
| `api/routers/performance.ts` | +getById, signOff, dashboard |
| `api/routers/training.ts` | +createModule, updateModule, deleteModule, listProgress, dashboard |
| `api/routers/auth-local.ts` | Password complexity: 8 chars + uppercase + lowercase + number + symbol |
| `db/schema.ts` | +16 new tables (workflow, evidence, escalation, persona, GRO, GAD, retention, etc.) |
| `db/relations.ts` | Relations for all new tables |
| `db/seed.ts` | +workflow seeds, persona seeds, pilot case seeds |
| `src/data/navData.ts` | Flat 38-item → 7-section hierarchy (28 items), role visibility, 5 helpers |
| `src/components/shell/AppShellRoutes.tsx` | +~20 new routes, 3 orphan routes removed, imports updated |
| `src/components/shell/AppShell.tsx` | +AskAmosPanel integration |
| `src/components/shell/AppSidebar.tsx` | +ITEM_VISIBILITY_KEY for new routes |
| `src/hooks/useAuth.tsx` | +getRoleRedirectPath() for 33 roles |
| `src/pages/DashboardPage.tsx` | Complete rewrite: 36 KPIs connected to real data |
| `src/pages/MyWorkTodayPage.tsx` | Endpoint fixes: listWorkTasks→getWorkQueue, updateTask→transitionTaskStatus |
| `src/pages/clinical/ClinicalWorkspacePage.tsx` | +module navigation cards |
| `src/pages/gro/GROWorkspacePage.tsx` | tRPC-connected hub page |
| `src/pages/qa/QADashboardPage.tsx` | Rewritten with 5 module links |
| `src/pages/revenue/RevenueDashboardPage.tsx` | +7-module navigation grid |
| `src/pages/SOPKnowledgePage.tsx` | Replaced hardcoded data with tRPC queries |
| `.env.example` | +Microsoft boundary rules documentation |

### DELETED FILES
```
api/routers/seed.ts                                        (REVERTED in Stage 0)
src/pages/executive/ExecutiveDashboardPage.tsx             (C-02 duplicate removed)
src/pages/residential/ResidentialDashboard.tsx             (C-03 unused removed)
src/pages/Sprint3Dashboard.tsx                             (C-07 orphan removed)
src/pages/PersonaActivationPage.tsx                        (C-07 orphan removed)
src/pages/IcrRegistryPage.tsx                              (C-07 orphan removed)
```

---

## Database Changes

### New Tables (16)
1. `workflow_definitions_v2` — 8 workflow types
2. `workflow_instances_v2` — workflow instances with status
3. `workflow_transitions_v2` — status change log
4. `workflow_evidence_v2` — evidence submissions
5. `evidence_gates` — required evidence per workflow
6. `escalation_log` — escalation events
7. `reassignment_log` — reassignment audit
8. `agent_personas` — 13 persona definitions
9. `phi_access_log` — PHI access audit (D006-03)
10. `compliance_queue` — compliance findings queue (D006-03)
11. `boundary_violations` — blocked violation log (D006-03)
12. `document_id_sequences` — document ID auto-increment
13. `procurement_requests` — GAD procurement (D008-06)
14. `safety_inspections` — GAD safety (D008-06)
15. `vendor_contracts` — GAD vendors (D008-06)
16. `evidence_matrix` — QA evidence (D008-03)

### Security-Critical Changes
- All 6 unapproved routers: `publicQuery` → `authedQuery`/`adminQuery`
- Password complexity: min 8 chars, requires uppercase + lowercase + number + symbol
- JWT secret startup validation (refuses weak secrets in production)
- PHI access: role-based clearance matrix with 4 PHI levels
- Human-in-command: clinical review required, QA routing, all PHI logged
- Boundary violations: blocked and logged to `boundary_violations` table

---

## Deployment Checklist

### Pre-Deploy
- [ ] Backup current database
- [ ] Review this changelog
- [ ] Staging deploy first (if available)

### Deploy
- [ ] Push new files to GitHub
- [ ] Railway auto-deploys backend
- [ ] Netlify auto-deploys frontend
- [ ] Run database migrations
- [ ] Seed new data
- [ ] Verify health check

### Post-Deploy Verification
- [ ] Login works
- [ ] Dashboard loads with 36 KPIs
- [ ] Clinical workspace quick actions work
- [ ] GRO workspace quick actions work
- [ ] Navigation shows 7 sections
- [ ] No 404 errors on key routes
- [ ] API calls succeed (check browser network tab)

### Rollback (if needed)
- [ ] Railway: roll back to previous deployment
- [ ] Netlify: roll back to previous deploy
- [ ] Database: restore from backup
