# RC1/RC2 Integration Decision Log

**Project:** AMOS Ops Platform  
**Document Version:** 1.0.0  
**Last Updated:** 2025-01-20  
**Status:** ACTIVE

---

## Overview

This document records all integration decisions for Release Candidate 1 (RC1) and Release Candidate 2 (RC2) features as they are incorporated into the main AMOS Ops platform. Each feature is evaluated against a disposition framework to determine its final state.

### Disposition Framework

| Disposition | Description | When to Apply |
|-------------|-------------|---------------|
| **RETAIN** | Keep the feature as-is with no changes | Feature is production-ready, meets all requirements, and integrates cleanly |
| **MERGE** | Combine with an existing feature or another RC feature | Features have overlapping functionality; consolidation reduces complexity |
| **REPLACE** | Replace an existing feature with the RC implementation | RC version is superior to current implementation |
| **RETIRE** | Remove the feature entirely | Feature is obsolete, superseded, or no longer aligns with product strategy |
| **DEFER** | Delay integration to a future sprint | Feature has value but dependencies, resources, or timing prevent immediate integration |

### Decision Process

1. **Feature Review:** Technical assessment of the RC feature
2. **Gap Analysis:** Compare against existing functionality and requirements
3. **Impact Assessment:** Evaluate integration effort, risk, and user impact
4. **Stakeholder Review:** Product and engineering alignment
5. **Decision Record:** Document final disposition with justification

---

## Decision Log

### Decision 1: Unified Authentication Portal (RC1-AUTH-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC1-AUTH-001 |
| **Feature Name** | Unified Authentication Portal |
| **RC Source** | RC1 |
| **Disposition** | **REPLACE** |
| **Priority** | High |
| **Owner** | Security Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Single sign-on portal supporting SAML 2.0, OIDC, and local authentication with session management and MFA support.

**Justification:**  
The current authentication system uses a legacy form-based login with custom session handling. RC1-AUTH-001 provides a standards-compliant solution with MFA support, better security posture, and reduced maintenance burden. The JWT-based API contract (ICR-API-001) is already designed to work with this new portal.

**Impact Assessment:**
- **Users:** Seamless migration; existing credentials remain valid
- **Integration:** Replaces legacy auth middleware; updates needed for 3 service endpoints
- **Risk:** Low - backward-compatible token format

**Action Items:**
- [ ] Migrate user credential hashes to new auth schema
- [ ] Update middleware in API gateway
- [ ] Configure SAML/OIDC identity providers
- [ ] Deprecate legacy auth endpoints (EOL: 2025-Q2)

---

### Decision 2: Real-Time KPI Dashboard v2 (RC1-DASH-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC1-DASH-001 |
| **Feature Name** | Real-Time KPI Dashboard v2 |
| **RC Source** | RC1 |
| **Disposition** | **MERGE** |
| **Priority** | High |
| **Owner** | Analytics Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
WebSocket-enabled real-time KPI dashboard with drag-and-drop widget configuration and custom alert thresholds.

**Justification:**  
The current dashboard displays static KPIs refreshed every 5 minutes. RC1-DASH-001 adds real-time updates and widget customization. Rather than replacing the entire dashboard, we will merge the real-time capabilities and widget system into the existing dashboard framework. The existing KPI data contract (ICR-DASH-001) provides the backend data layer.

**Impact Assessment:**
- **Users:** Enhanced dashboard experience; existing layouts preserved
- **Integration:** Merge WebSocket layer into current dashboard; reuse existing KPI API
- **Risk:** Medium - WebSocket scaling needs load testing

**Action Items:**
- [ ] Integrate WebSocket push into existing dashboard
- [ ] Port widget configuration from RC1 to current dashboard codebase
- [ ] Add user preference migration for widget layouts
- [ ] Performance test with 500 concurrent connections

---

### Decision 3: Legacy Report Generator (RC1-RPT-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC1-RPT-001 |
| **Feature Name** | Legacy Report Generator |
| **RC Source** | RC1 |
| **Disposition** | **RETIRE** |
| **Priority** | Medium |
| **Owner** | Product Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
PDF report generator using deprecated Crystal Reports templates with scheduled email delivery.

**Justification:**  
This feature has been superseded by RC2-RPT-001 (Analytics Report Engine) which uses modern web-based reporting with interactive charts, export to multiple formats (PDF, Excel, CSV), and a visual report builder. Maintaining Crystal Reports requires a legacy Windows server and specialized knowledge. The RC2 solution is superior in every dimension.

**Impact Assessment:**
- **Users:** 12 active scheduled reports need migration to new engine
- **Integration:** Remove Crystal Reports dependency; decommission legacy report server
- **Risk:** Low - RC2 replacement covers all existing functionality

**Action Items:**
- [ ] Migrate 12 active scheduled reports to RC2-RPT-001
- [ ] Notify affected users of report format changes
- [ ] Decommission legacy report server (target: 2025-03-01)
- [ ] Archive old report templates for compliance retention

---

### Decision 4: Role-Based Access Control Manager (RC1-AUTH-002)

| Field | Value |
|-------|-------|
| **Feature ID** | RC1-AUTH-002 |
| **Feature Name** | Role-Based Access Control Manager |
| **RC Source** | RC1 |
| **Disposition** | **RETAIN** |
| **Priority** | High |
| **Owner** | Security Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Comprehensive RBAC management UI for creating roles, assigning permissions, and managing section visibility with audit logging.

**Justification:**  
This feature directly implements the 33-role, 4-tier authorization system defined in ICR-AUTH-001. The implementation is production-ready, well-tested, and integrates cleanly with the existing user/session schema (ICR-DB-001). No modifications needed.

**Impact Assessment:**
- **Users:** New RBAC management capability for administrators
- **Integration:** Clean integration with existing auth schema
- **Risk:** Low - feature-complete and tested

**Action Items:**
- [ ] Deploy as-is to production
- [ ] Create administrator training documentation
- [ ] Enable audit logging for all RBAC changes

---

### Decision 5: Equipment Sensor Data Ingestion (RC1-IoT-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC1-IoT-001 |
| **Feature Name** | Equipment Sensor Data Ingestion |
| **RC Source** | RC1 |
| **Disposition** | **DEFER** |
| **Priority** | Medium |
| **Owner** | IoT Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
MQTT-based sensor data ingestion pipeline for real-time equipment monitoring with anomaly detection.

**Justification:**  
This feature provides significant value for predictive maintenance (feeds into MNT-001 and MNT-002 KPIs). However, integration requires the IoT gateway infrastructure to be fully deployed, which is scheduled for Sprint 15. Additionally, the NIL entity schema (ICR-NIL-001) needs an extension to support IoT device entities. Deferring to Sprint 16 to ensure proper infrastructure readiness.

**Impact Assessment:**
- **Users:** Maintenance teams will gain predictive capabilities when delivered
- **Integration:** Depends on IoT gateway (Sprint 15) and NIL schema extension
- **Risk:** Low - deferral is planned, not a blocker

**Action Items:**
- [ ] Complete IoT gateway deployment in Sprint 15
- [ ] Extend ICR-NIL-001 schema for IoT device entities
- [ ] Design anomaly detection rule engine
- [ ] Plan integration for Sprint 16

---

### Decision 6: Batch Data Import Tool (RC1-DATA-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC1-DATA-001 |
| **Feature Name** | Batch Data Import Tool |
| **RC Source** | RC1 |
| **Disposition** | **MERGE** |
| **Priority** | Medium |
| **Owner** | Data Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
CSV/Excel batch import utility with data validation, transformation rules, and import progress tracking.

**Justification:**  
The current system has a basic CSV uploader with limited validation. RC1-DATA-001 provides a robust import pipeline with schema validation, transformation rules, and progress tracking. Rather than maintaining two import tools, we will merge the validation engine and progress tracking into the existing uploader and retire the basic implementation.

**Impact Assessment:**
- **Users:** Improved import experience with validation feedback
- **Integration:** Replace validation layer in existing importer; add progress tracking UI
- **Risk:** Low - additive improvements to existing workflow

**Action Items:**
- [ ] Extract validation engine from RC1-DATA-001
- [ ] Integrate into existing CSV uploader
- [ ] Add progress tracking UI component
- [ ] Update user documentation

---

### Decision 7: Notification Center (RC2-NOTIFY-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC2-NOTIFY-001 |
| **Feature Name** | Notification Center |
| **RC Source** | RC2 |
| **Disposition** | **RETAIN** |
| **Priority** | High |
| **Owner** | Platform Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Centralized notification hub supporting in-app, email, SMS, and webhook channels with user preference management and notification grouping.

**Justification:**  
This is a new capability not present in the current system. The implementation is complete, supports all required channels, and integrates with the existing user schema. It will serve as the backbone for alert delivery from the Alert Center and KPI threshold notifications. No overlapping functionality exists to merge with.

**Impact Assessment:**
- **Users:** New notification management capability; opt-in per channel
- **Integration:** New service; clean integration points with existing features
- **Risk:** Low - standalone service with clear API boundaries

**Action Items:**
- [ ] Deploy notification service to production
- [ ] Configure email/SMS gateway credentials
- [ ] Integrate with Alert Center for alert delivery
- [ ] Integrate with KPI dashboard for threshold alerts
- [ ] Create user preference onboarding flow

---

### Decision 8: Mobile Responsive UI Framework (RC2-UI-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC2-UI-001 |
| **Feature Name** | Mobile Responsive UI Framework |
| **RC Source** | RC2 |
| **Disposition** | **REPLACE** |
| **Priority** | High |
| **Owner** | Frontend Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Complete mobile-responsive UI component library with touch-optimized controls, adaptive layouts, and offline capability.

**Justification:**  
The current UI is desktop-only and uses legacy CSS frameworks that are difficult to maintain. RC2-UI-001 provides a modern, component-based responsive framework built on current best practices. This replaces the existing frontend foundation and enables mobile access for floor operators and field technicians who need dashboard and alert access on tablets and phones.

**Impact Assessment:**
- **Users:** All users gain mobile access; layout adapts to device
- **Integration:** Full frontend replacement; phased rollout per module
- **Risk:** Medium - extensive regression testing required

**Action Items:**
- [ ] Set up new component library in codebase
- [ ] Port Dashboard module to responsive framework (Sprint 14)
- [ ] Port Entity Management module (Sprint 15)
- [ ] Port Alert Center module (Sprint 15)
- [ ] Port remaining modules (Sprint 16)
- [ ] Cross-browser and device testing

---

### Decision 9: Audit Log System (RC2-AUDIT-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC2-AUDIT-001 |
| **Feature Name** | Comprehensive Audit Log System |
| **RC Source** | RC2 |
| **Disposition** | **RETAIN** |
| **Priority** | High |
| **Owner** | Security Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Immutable audit logging system capturing all user actions, data changes, and system events with tamper-evident storage and advanced search/filter capabilities.

**Justification:**  
This is a critical compliance feature not present in the current system. The implementation uses append-only storage with cryptographic checksums, satisfying SOX and ISO 27001 requirements. It integrates cleanly with the RBAC system (ICR-AUTH-001) to track who accessed what. Required for Tier 1 and Tier 2 role audit log access.

**Impact Assessment:**
- **Users:** Admins and compliance officers gain full audit visibility
- **Integration:** New service; hooks into existing middleware for action capture
- **Risk:** Low - independent service with clear event contracts

**Action Items:**
- [ ] Deploy audit log service
- [ ] Configure log retention policies (7 years for compliance)
- [ ] Integrate middleware hooks for all data-modifying operations
- [ ] Enable audit log UI in admin section
- [ ] Set up automated compliance reporting

---

### Decision 10: Workflow Engine (RC2-WF-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC2-WF-001 |
| **Feature Name** | Business Process Workflow Engine |
| **RC Source** | RC2 |
| **Disposition** | **DEFER** |
| **Priority** | Medium |
| **Owner** | Product Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Visual workflow designer and execution engine for business processes including approval chains, automated actions, and conditional branching.

**Justification:**  
The workflow engine is a powerful addition that would enable custom approval processes for maintenance requests, change orders, and alert escalation. However, it requires significant integration work with the notification system (RC2-NOTIFY-001) and RBAC permissions (ICR-AUTH-001). Product team has prioritized mobile responsive UI and audit logging for the current quarter. Scheduling for Sprint 17.

**Impact Assessment:**
- **Users:** Future capability for process automation; not blocking current workflows
- **Integration:** Depends on notification center and RBAC integration points
- **Risk:** Low - deferral is strategic, not technical

**Action Items:**
- [ ] Complete dependency features (notifications, RBAC)
- [ ] Design workflow templates for common use cases
- [ ] Plan integration architecture for Sprint 17
- [ ] Gather user requirements for initial workflow templates

---

### Decision 11: Data Export API (RC2-EXPORT-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC2-EXPORT-001 |
| **Feature Name** | Data Export API |
| **RC Source** | RC2 |
| **Disposition** | **MERGE** |
| **Priority** | Medium |
| **Owner** | Data Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
REST API for exporting data in multiple formats (CSV, Excel, JSON, Parquet) with filtering, pagination, and async processing for large datasets.

**Justification:**  
The current system has basic CSV export on several pages. RC2-EXPORT-001 provides a unified export service with multiple format support and async processing. We will merge this into the existing export buttons across all modules, replacing the ad-hoc export implementations with the standardized API. This aligns with the Data Export section access in ICR-AUTH-001.

**Impact Assessment:**
- **Users:** Consistent export experience across all modules; new format options
- **Integration:** Replace existing export handlers; unified export service
- **Risk:** Low - additive enhancement, existing data unchanged

**Action Items:**
- [ ] Deploy export API service
- [ ] Replace export handler in Dashboard module
- [ ] Replace export handler in Entity Management module
- [ ] Replace export handler in Report Builder module
- [ ] Add Excel and Parquet format options to UI

---

### Decision 12: Legacy Alert Notification System (RC1-ALERT-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC1-ALERT-001 |
| **Feature Name** | Legacy Alert Notification System |
| **RC Source** | RC1 |
| **Disposition** | **RETIRE** |
| **Priority** | High |
| **Owner** | Platform Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Email-only alert notification system with hardcoded alert rules and no user preference management.

**Justification:**  
This legacy system is being replaced by two superior features: RC2-NOTIFY-001 (Notification Center) provides multi-channel delivery with user preferences, and the existing Alert Center UI provides better rule management. The legacy system sends untargeted emails with no grouping, causing alert fatigue. Retiring it reduces maintenance and improves user experience.

**Impact Assessment:**
- **Users:** 45 users receiving legacy alert emails will transition to Notification Center
- **Integration:** Remove legacy email dispatcher; migrate alert rules to Alert Center
- **Risk:** Medium - need to ensure no critical alerts are lost in transition

**Action Items:**
- [ ] Inventory all active legacy alert rules (45 rules identified)
- [ ] Migrate alert rules to Alert Center with Notification Center delivery
- [ ] Notify all 45 affected users about new notification preferences
- [ ] Run parallel for 2 weeks before decommissioning
- [ ] Decommission legacy alert email service

---

### Decision 13: Entity Graph Visualization (RC2-VIZ-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC2-VIZ-001 |
| **Feature Name** | Entity Graph Visualization |
| **RC Source** | RC2 |
| **Disposition** | **RETAIN** |
| **Priority** | Medium |
| **Owner** | Data Architecture Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Interactive graph visualization for NIL entity relationships with force-directed layouts, filtering, and drill-down capabilities.

**Justification:**  
This is a new visualization capability that brings the NIL entity/relationship data (ICR-NIL-001) to life. It allows users to explore the entity graph visually, which is especially valuable for understanding equipment dependencies, facility layouts, and organizational hierarchies. The implementation is complete and performs well with up to 10,000 nodes.

**Impact Assessment:**
- **Users:** New capability for data architects, operations managers, and technicians
- **Integration:** Reads from existing NIL schema; no schema changes needed
- **Risk:** Low - read-only visualization, no data mutation

**Action Items:**
- [ ] Deploy graph visualization component
- [ ] Integrate into Entity Management module
- [ ] Add graph export functionality (PNG/SVG)
- [ ] Performance test with production entity volume

---

### Decision 14: Onboarding Wizard v1 (RC1-ONB-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC1-ONB-001 |
| **Feature Name** | Onboarding Wizard v1 |
| **RC Source** | RC1 |
| **Disposition** | **REPLACE** |
| **Priority** | High |
| **Owner** | Product Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Step-by-step user onboarding wizard with role selection, department assignment, and guided product tour.

**Justification:**  
The current onboarding is a static welcome page with no guidance. RC1-ONB-001 provides an interactive wizard that configures the new user's role (from the 33-role matrix in ICR-AUTH-001), assigns their department, and provides a contextual product tour based on their role's section access. This significantly improves new user activation and reduces support tickets.

**Impact Assessment:**
- **Users:** All new users get guided onboarding; reduces time-to-productivity
- **Integration:** Replaces static welcome page; integrates with RBAC for role assignment
- **Risk:** Low - user-facing feature, no critical path dependency

**Action Items:**
- [ ] Deploy onboarding wizard to replace welcome page
- [ ] Configure role selection flow with ICR-AUTH-001 roles
- [ ] Create department assignment step
- [ ] Build role-specific product tour content
- [ ] Track onboarding completion metrics

---

### Decision 15: Advanced Analytics Engine (RC2-ANALYTICS-001)

| Field | Value |
|-------|-------|
| **Feature ID** | RC2-ANALYTICS-001 |
| **Feature Name** | Advanced Analytics Engine |
| **RC Source** | RC2 |
| **Disposition** | **DEFER** |
| **Priority** | Low |
| **Owner** | Analytics Team |
| **Decision Date** | 2025-01-20 |

**Description:**  
Machine learning-powered analytics engine for predictive KPI forecasting, anomaly detection, and automated insight generation.

**Justification:**  
This feature would add significant value by enabling predictive maintenance, demand forecasting, and automated anomaly detection on the 36 KPIs defined in ICR-DASH-001. However, it requires a substantial ML infrastructure investment and a clean historical dataset (minimum 12 months). The data pipeline is not yet mature enough to support reliable model training. Deferring to 2025-Q3.

**Impact Assessment:**
- **Users:** Future capability for predictive insights; current manual analysis sufficient
- **Integration:** Will feed into KPI dashboard and alert systems when deployed
- **Risk:** Low - deferral is due to data maturity, not technical feasibility

**Action Items:**
- [ ] Establish data pipeline maturity criteria for ML readiness
- [ ] Begin historical data quality assessment
- [ ] Evaluate ML platform options (cloud vs. on-premise)
- [ ] Plan for 2025-Q3 implementation
- [ ] Design initial model set (demand forecast, anomaly detection)

---

## Summary Statistics

### Disposition Breakdown

| Disposition | Count | Percentage |
|-------------|-------|------------|
| RETAIN | 4 | 26.7% |
| MERGE | 3 | 20.0% |
| REPLACE | 3 | 20.0% |
| RETIRE | 2 | 13.3% |
| DEFER | 3 | 20.0% |
| **Total** | **15** | **100%** |

### RC Source Breakdown

| Source | Features | RETAIN | MERGE | REPLACE | RETIRE | DEFER |
|--------|----------|--------|-------|---------|--------|-------|
| RC1 | 8 | 2 | 2 | 1 | 2 | 1 |
| RC2 | 7 | 2 | 1 | 2 | 0 | 2 |

### Priority Distribution

| Priority | Count |
|----------|-------|
| High | 8 |
| Medium | 6 |
| Low | 1 |

### Sprint Allocation

| Sprint | Items |
|--------|-------|
| Sprint 14 (Current) | RC1-AUTH-001, RC1-AUTH-002, RC2-NOTIFY-001, RC2-UI-001, RC2-AUDIT-001, RC1-ONB-001 |
| Sprint 15 | RC1-DASH-001, RC1-IoT-001, RC2-EXPORT-001 |
| Sprint 16 | RC1-DATA-001, RC2-VIZ-001, RC1-ALERT-001 |
| Sprint 17 | RC2-WF-001 |
| 2025-Q3 | RC2-ANALYTICS-001 |
| Immediate | RC1-RPT-001 (RETIRE) |

---

## Risk Register

| Risk ID | Description | Mitigation | Owner |
|---------|-------------|------------|-------|
| R-001 | User resistance to mobile UI changes | Phased rollout with feedback loops; maintain desktop parity | Frontend Team |
| R-002 | Alert gaps during legacy-to-new transition | 2-week parallel run; manual verification of critical alerts | Platform Team |
| R-003 | RBAC migration errors | Comprehensive testing in staging; rollback plan | Security Team |
| R-004 | Performance degradation with real-time KPIs | Load testing at 500 concurrent connections; caching strategy | Analytics Team |
| R-005 | Auth portal SSO configuration issues | Test with all IdPs in staging; fallback to local auth | Security Team |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Lead Architect | | | |
| Security Lead | | | |
| Engineering Manager | | | |

---

## Change Log

| Version | Date | Author | Change Description |
|---------|------|--------|-------------------|
| 1.0.0 | 2025-01-20 | Platform Team | Initial decision log with 15 RC feature dispositions. Framework defined, all decisions documented with justification and action items. |
