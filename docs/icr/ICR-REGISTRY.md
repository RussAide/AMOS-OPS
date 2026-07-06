# Interface Contract Registry (ICR)

**Project:** AMOS Ops Platform  
**Registry Version:** 1.0.0  
**Last Updated:** 2025-01-20  
**Status:** ACTIVE

---

## Overview

The Interface Contract Registry (ICR) documents all stable API contracts, database schemas, and integration boundaries within the AMOS Ops platform. Each entry defines the schema specification, example payloads, version history, and owning team.

---

## Quick Reference

| ID | Name | Category | Version | Status |
|---|---|---|---|---|
| ICR-API-001 | Authentication API | API Contract | 1.0 | Active |
| ICR-DB-001 | User/Session Schema | Database | 1.0 | Active |
| ICR-AUTH-001 | Role/Permission Matrix | Authorization | 1.0 | Active |
| ICR-NIL-001 | Entity/Relationship Schema | Database | 1.0 | Active |
| ICR-DASH-001 | KPI Data Contract | Dashboard API | 1.0 | Active |

---

## ICR-API-001: Authentication API

**Category:** API Contract  
**Owner:** Platform Team  
**Status:** Active  
**Version:** 1.0  
**Date Created:** 2025-01-20  

### Schema

JWT-based token authentication system. All protected endpoints require a valid `Authorization: Bearer <token>` header.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/login | Authenticate user and issue token |
| POST | /api/v1/auth/logout | Invalidate current session |
| POST | /api/v1/auth/refresh | Refresh an expiring token |

### Request Schema: Login

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["username", "password"],
  "properties": {
    "username": {
      "type": "string",
      "minLength": 3,
      "maxLength": 64,
      "description": "User's unique login identifier"
    },
    "password": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128,
      "description": "User's password (transmitted over HTTPS)"
    }
  }
}
```

### Response Schema: Login Success (200 OK)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["success", "data"],
  "properties": {
    "success": { "type": "boolean", "const": true },
    "data": {
      "type": "object",
      "required": ["token", "user"],
      "properties": {
        "token": {
          "type": "string",
          "description": "JWT access token valid for 24 hours"
        },
        "refreshToken": {
          "type": "string",
          "description": "Long-lived refresh token (7 days)"
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "description": "Token expiration timestamp"
        },
        "user": {
          "type": "object",
          "required": ["id", "username", "role"],
          "properties": {
            "id": { "type": "string", "format": "uuid" },
            "username": { "type": "string" },
            "displayName": { "type": "string" },
            "role": { "type": "string", "description": "Primary role identifier" },
            "permissions": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

### Example: Login Request

```http
POST /api/v1/auth/login HTTP/1.1
Host: api.amos-ops.internal
Content-Type: application/json

{
  "username": "ops.admin",
  "password": "SecurePass123!"
}
```

### Example: Login Response (Success)

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "expiresAt": "2025-01-21T14:30:00Z",
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "username": "ops.admin",
      "displayName": "Operations Administrator",
      "role": "ops_manager",
      "permissions": ["dashboard.view", "kpi.read", "users.manage", "alerts.configure"]
    }
  }
}
```

### Example: Login Response (Failure - 401 Unauthorized)

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "The username or password provided is incorrect.",
    "details": {
      "attempt": 1,
      "maxAttempts": 5,
      "lockoutDurationMinutes": 30
    }
  }
}
```

### Change History

| Version | Date | Author | Change Description |
|---------|------|--------|-------------------|
| v1.0 | 2025-01-20 | Platform Team | Initial schema definition. JWT token-based auth with access/refresh token pair. |

---

## ICR-DB-001: User/Session Schema

**Category:** Database Schema  
**Owner:** Platform Team  
**Status:** Active  
**Version:** 1.0  
**Date Created:** 2025-01-20  

### Schema

Relational database schema for user management and session tracking. All tables use UUID primary keys and include `created_at` / `updated_at` timestamps.

### Table: users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(64) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(128),
    role_id         UUID NOT NULL REFERENCES roles(id),
    department      VARCHAR(64),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

**Key Constraints:**
- `username`: 3-64 characters, alphanumeric + underscore
- `email`: Standard email format validation
- `password_hash`: bcrypt hashed, never store plain text
- `role_id`: Foreign key to roles table (see ICR-AUTH-001)

### Table: sessions

```sql
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    ip_address      INET,
    user_agent      VARCHAR(512),
    started_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    refreshed_at    TIMESTAMP WITH TIME ZONE,
    terminated_at   TIMESTAMP WITH TIME ZONE,
    termination_reason VARCHAR(32),
    is_active       BOOLEAN NOT NULL DEFAULT true
);
```

**Key Constraints:**
- `token_hash`: SHA-256 hash of the issued JWT token
- `expires_at`: Calculated at creation (now + 24 hours)
- `termination_reason`: ENUM values - `logout`, `expired`, `revoked`, `security`
- One user may have multiple active sessions (multi-device support)

### Example: User Record

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "username": "ops.admin",
  "email": "admin@amos-ops.internal",
  "password_hash": "$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "display_name": "Operations Administrator",
  "role_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "department": "Operations",
  "is_active": true,
  "last_login_at": "2025-01-20T14:30:00Z",
  "created_at": "2025-01-15T09:00:00Z",
  "updated_at": "2025-01-20T14:30:00Z"
}
```

### Example: Session Record

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "token_hash": "sha256:abc123def456...",
  "refresh_token_hash": "sha256:xyz789uvw012...",
  "ip_address": "10.0.1.15",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "started_at": "2025-01-20T14:30:00Z",
  "expires_at": "2025-01-21T14:30:00Z",
  "refreshed_at": null,
  "terminated_at": null,
  "termination_reason": null,
  "is_active": true
}
```

### Indexing Strategy

```sql
-- For login lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- For session validation
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash) WHERE is_active = true;
CREATE INDEX idx_sessions_user_active ON sessions(user_id) WHERE is_active = true;
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE is_active = true;
```

### Change History

| Version | Date | Author | Change Description |
|---------|------|--------|-------------------|
| v1.0 | 2025-01-20 | Platform Team | Initial schema. Core user and session tables with full audit trail support. |

---

## ICR-AUTH-001: Role/Permission Matrix

**Category:** Authorization Schema  
**Owner:** Security Team  
**Status:** Active  
**Version:** 1.0  
**Date Created:** 2025-01-20  

### Schema

Hierarchical role-based access control (RBAC) system with 33 distinct roles organized across 4 authorization tiers. Section visibility is controlled per-role to ensure principle of least privilege.

### Authorization Tiers

| Tier | Name | Description | Role Count |
|------|------|-------------|------------|
| 1 | System Administrator | Full platform access, user management, system configuration | 3 |
| 2 | Operations Manager | Cross-functional operational oversight, KPI access, alert management | 8 |
| 3 | Department Lead | Department-specific dashboards and data entry | 12 |
| 4 | Standard User | Read-only access to assigned sections, limited data entry | 10 |

### Table: roles

```sql
CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(32) NOT NULL UNIQUE,
    name            VARCHAR(64) NOT NULL,
    tier            INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4),
    description     TEXT,
    permissions     JSONB NOT NULL DEFAULT '[]',
    section_access  JSONB NOT NULL DEFAULT '[]',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### Permission Structure

```json
{
  "permissions": [
    {
      "resource": "dashboard",
      "actions": ["view", "configure"]
    },
    {
      "resource": "kpi",
      "actions": ["read", "export", "update"]
    },
    {
      "resource": "users",
      "actions": ["read", "create", "update", "delete"]
    },
    {
      "resource": "alerts",
      "actions": ["read", "configure", "acknowledge"]
    },
    {
      "resource": "entities",
      "actions": ["read", "create", "update", "delete", "merge"]
    },
    {
      "resource": "reports",
      "actions": ["read", "create", "export", "schedule"]
    },
    {
      "resource": "settings",
      "actions": ["read", "update"]
    }
  ]
}
```

### Section Visibility Matrix

| Section | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---------|--------|--------|--------|--------|
| System Settings | R/W | R | - | - |
| User Management | R/W | R | - | - |
| KPI Overview | R/W | R/W | R | R |
| Operational Dashboard | R/W | R/W | R/W | R |
| Department Analytics | R/W | R/W | R/W | R* |
| Entity Management | R/W | R/W | R/W | R |
| Alert Center | R/W | R/W | R | R |
| Report Builder | R/W | R/W | R/W | R |
| Data Export | R/W | R/W | R | - |
| Audit Logs | R/W | R | - | - |

*Tier 4: Read-only for assigned departments only

### Example: Role Definition (Operations Manager)

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "code": "ops_manager",
  "name": "Operations Manager",
  "tier": 2,
  "description": "Oversees daily operations with cross-department visibility. Can manage alerts, view all KPIs, and generate reports.",
  "permissions": [
    { "resource": "dashboard", "actions": ["view", "configure"] },
    { "resource": "kpi", "actions": ["read", "export"] },
    { "resource": "users", "actions": ["read"] },
    { "resource": "alerts", "actions": ["read", "configure", "acknowledge"] },
    { "resource": "entities", "actions": ["read", "create", "update"] },
    { "resource": "reports", "actions": ["read", "create", "export"] },
    { "resource": "settings", "actions": ["read"] }
  ],
  "section_access": [
    { "section": "kpi_overview", "access": "read" },
    { "section": "operational_dashboard", "access": "read_write" },
    { "section": "department_analytics", "access": "read" },
    { "section": "entity_management", "access": "read_write" },
    { "section": "alert_center", "access": "read_write" },
    { "section": "report_builder", "access": "read_write" },
    { "section": "data_export", "access": "read" },
    { "section": "audit_logs", "access": "read" }
  ],
  "is_active": true,
  "created_at": "2025-01-15T09:00:00Z",
  "updated_at": "2025-01-20T10:00:00Z"
}
```

### Complete Role Listing (33 Roles)

**Tier 1 - System Administrator (3 roles):**
- `sys_superadmin` - Platform Super Administrator
- `sys_admin` - System Administrator
- `sys_security_admin` - Security Administrator

**Tier 2 - Operations Manager (8 roles):**
- `ops_manager` - Operations Manager
- `ops_shift_lead` - Shift Lead Supervisor
- `ops_quality_manager` - Quality Assurance Manager
- `ops_compliance_officer` - Compliance Officer
- `ops_safety_manager` - Safety Manager
- `ops_maintenance_lead` - Maintenance Lead
- `ops_logistics_coordinator` - Logistics Coordinator
- `ops_production_planner` - Production Planner

**Tier 3 - Department Lead (12 roles):**
- `dept_operations_lead` - Operations Department Lead
- `dept_maintenance_lead` - Maintenance Department Lead
- `dept_quality_lead` - Quality Department Lead
- `dept_safety_lead` - Safety Department Lead
- `dept_logistics_lead` - Logistics Department Lead
- `dept_production_lead` - Production Department Lead
- `dept_engineering_lead` - Engineering Department Lead
- `dept_hr_lead` - HR Department Lead
- `dept_finance_lead` - Finance Department Lead
- `dept_it_lead` - IT Department Lead
- `dept_procurement_lead` - Procurement Department Lead
- `dept_warehouse_lead` - Warehouse Department Lead

**Tier 4 - Standard User (10 roles):**
- `user_operator` - Equipment Operator
- `user_technician` - Maintenance Technician
- `user_inspector` - Quality Inspector
- `user_analyst` - Data Analyst
- `user_coordinator` - General Coordinator
- `user_specialist` - Operations Specialist
- `user_support` - Support Staff
- `user_trainee` - Trainee
- `user_contractor` - External Contractor
- `user_viewer` - Read-Only Viewer

### Change History

| Version | Date | Author | Change Description |
|---------|------|--------|-------------------|
| v1.0 | 2025-01-20 | Security Team | Initial RBAC schema. 33 roles across 4 tiers with section-level visibility controls. |

---

## ICR-NIL-001: Entity/Relationship Schema

**Category:** Database Schema  
**Owner:** Data Architecture Team  
**Status:** Active  
**Version:** 1.0  
**Date Created:** 2025-01-20  

### Schema

Core entity-relationship model for the NIL (Networked Information Layer) system. Stores business entities and their relationships with full provenance tracking.

### Table: nil_entities

```sql
CREATE TABLE nil_entities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(32) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL UNIQUE,
    attributes      JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by      UUID NOT NULL REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_entity_type CHECK (entity_type IN (
        'facility', 'equipment', 'product', 'supplier', 
        'customer', 'project', 'team', 'location', 'asset'
    )),
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'archived', 'pending'))
);
```

### Entity Types

| Type | Description | Key Attributes |
|------|-------------|----------------|
| facility | Physical facility/plant | location, capacity, operating_hours |
| equipment | Machinery or equipment | model, serial_number, manufacturer, install_date |
| product | Product or SKU | sku_code, category, unit_of_measure |
| supplier | External supplier/vendor | contact_info, contract_expiry, rating |
| customer | Customer account | account_code, tier, region |
| project | Internal project | start_date, end_date, budget, owner |
| team | Organizational team | department, head_count, lead_id |
| location | Physical location | address, coordinates, timezone |
| asset | Generic tracked asset | asset_tag, value, depreciation_schedule |

### Table: nil_relationships

```sql
CREATE TABLE nil_relationships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_type VARCHAR(32) NOT NULL,
    source_id       UUID NOT NULL REFERENCES nil_entities(id),
    target_id       UUID NOT NULL REFERENCES nil_entities(id),
    attributes      JSONB NOT NULL DEFAULT '{}',
    weight          DECIMAL(5,4) DEFAULT 1.0,
    status          VARCHAR(16) NOT NULL DEFAULT 'active',
    valid_from      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_until     TIMESTAMP WITH TIME ZONE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_relationship_type CHECK (relationship_type IN (
        'contains', 'depends_on', 'supplies', 'operates_at', 
        'belongs_to', 'reports_to', 'located_at', 'associated_with'
    )),
    CONSTRAINT valid_rel_status CHECK (status IN ('active', 'inactive', 'pending')),
    CONSTRAINT no_self_reference CHECK (source_id <> target_id)
);
```

### Relationship Types

| Type | Directionality | Description |
|------|----------------|-------------|
| contains | parent -> child | Hierarchical containment (facility contains equipment) |
| depends_on | dependent -> dependency | Dependency relationship |
| supplies | supplier -> recipient | Supply chain relationship |
| operates_at | operator -> location | Operational assignment |
| belongs_to | child -> parent | Membership/categorization |
| reports_to | subordinate -> manager | Reporting hierarchy |
| located_at | entity -> location | Geographic placement |
| associated_with | A -> B | Generic bidirectional association |

### Example: Entity Record (Equipment)

```json
{
  "id": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "entity_type": "equipment",
  "name": "CNC Milling Machine #04",
  "slug": "cnc-milling-machine-04",
  "attributes": {
    "model": "DMG Mori NHX 5000",
    "serial_number": "SN789456123",
    "manufacturer": "DMG Mori",
    "install_date": "2022-03-15",
    "warranty_expiry": "2027-03-15",
    "max_rpm": 12000,
    "power_rating_kw": 37,
    "maintenance_schedule": "monthly",
    "criticality": "high"
  },
  "status": "active",
  "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "updated_by": null,
  "created_at": "2025-01-10T08:00:00Z",
  "updated_at": "2025-01-10T08:00:00Z",
  "deleted_at": null
}
```

### Example: Relationship Record

```json
{
  "id": "d4e5f6a7-b8c9-0123-defa-456789012345",
  "relationship_type": "located_at",
  "source_id": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "target_id": "e5f6a7b8-c9d0-1234-efab-567890123456",
  "attributes": {
    "floor": "2",
    "bay": "B",
    "position": "north_wall",
    "installed_date": "2022-03-15"
  },
  "weight": 1.0,
  "status": "active",
  "valid_from": "2022-03-15T00:00:00Z",
  "valid_until": null,
  "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "created_at": "2025-01-10T08:00:00Z",
  "updated_at": "2025-01-10T08:00:00Z"
}
```

### Indexing Strategy

```sql
-- Entity lookups
CREATE INDEX idx_entities_type ON nil_entities(entity_type);
CREATE INDEX idx_entities_status ON nil_entities(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_entities_slug ON nil_entities(slug);
CREATE INDEX idx_entities_attrs_gin ON nil_entities USING GIN(attributes);

-- Relationship traversal
CREATE INDEX idx_relationships_source ON nil_relationships(source_id, status);
CREATE INDEX idx_relationships_target ON nil_relationships(target_id, status);
CREATE INDEX idx_relationships_type ON nil_relationships(relationship_type);
CREATE INDEX idx_relationships_attrs_gin ON nil_relationships USING GIN(attributes);
```

### Change History

| Version | Date | Author | Change Description |
|---------|------|--------|-------------------|
| v1.0 | 2025-01-20 | Data Architecture Team | Initial NIL schema. 9 entity types, 8 relationship types with temporal validity support. |

---

## ICR-DASH-001: KPI Data Contract

**Category:** Dashboard API  
**Owner:** Analytics Team  
**Status:** Active  
**Version:** 1.0  
**Date Created:** 2025-01-20  

### Schema

Standardized KPI data contract for dashboard consumption. KPIs are organized into 6 categories with a total of 36 individual metrics. All KPI values include metadata for freshness, source, and confidence.

### KPI Categories

| Category ID | Name | Description | KPI Count |
|-------------|------|-------------|-----------|
| OPS | Operational | Core operational efficiency metrics | 8 |
| QLT | Quality | Quality control and assurance metrics | 6 |
| SAF | Safety | Workplace safety and incident metrics | 6 |
| MNT | Maintenance | Equipment maintenance and reliability | 6 |
| FIN | Financial | Cost and financial performance metrics | 5 |
| SUST | Sustainability | Environmental and sustainability metrics | 5 |

### KPI Definition Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["kpi_id", "category", "name", "value", "unit", "timestamp"],
  "properties": {
    "kpi_id": { "type": "string", "pattern": "^[A-Z]{3}-[A-Z0-9]{3}$" },
    "category": { "type": "string", "enum": ["OPS", "QLT", "SAF", "MNT", "FIN", "SUST"] },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "value": { "type": "number" },
    "unit": { "type": "string" },
    "formatted_value": { "type": "string" },
    "target": { "type": "number" },
    "threshold": {
      "type": "object",
      "properties": {
        "warning": { "type": "number" },
        "critical": { "type": "number" }
      }
    },
    "trend": { "type": "string", "enum": ["up", "down", "stable"] },
    "trend_percentage": { "type": "number" },
    "comparison_period": { "type": "string", "enum": ["day", "week", "month", "quarter", "year"] },
    "timestamp": { "type": "string", "format": "date-time" },
    "data_source": { "type": "string" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "dimensions": {
      "type": "object",
      "additionalProperties": true
    }
  }
}
```

### Complete KPI Catalog (36 KPIs)

**Operational (OPS-001 through OPS-008):**
| ID | Name | Unit | Description |
|----|------|------|-------------|
| OPS-001 | Overall Equipment Effectiveness | % | OEE across all production lines |
| OPS-002 | Production Throughput | units/hr | Average hourly production rate |
| OPS-003 | On-Time Delivery Rate | % | Orders delivered on or before promise date |
| OPS-004 | Schedule Adherence | % | Production schedule compliance |
| OPS-005 | Cycle Time | minutes | Average production cycle time |
| OPS-006 | Capacity Utilization | % | Used capacity vs. available capacity |
| OPS-007 | First Pass Yield | % | Units passing QC on first attempt |
| OPS-008 | Inventory Turnover | ratio | Cost of goods sold / average inventory |

**Quality (QLT-001 through QLT-006):**
| ID | Name | Unit | Description |
|----|------|------|-------------|
| QLT-001 | Defect Rate | PPM | Parts per million defect rate |
| QLT-002 | Customer Complaint Rate | /1000 | Complaints per 1000 shipments |
| QLT-003 | Audit Score | % | Internal quality audit score |
| QLT-004 | Supplier Quality Index | score | Weighted supplier quality rating |
| QLT-005 | Rework Rate | % | Percentage of units requiring rework |
| QLT-006 | Certification Compliance | % | ISO/quality standard compliance rate |

**Safety (SAF-001 through SAF-006):**
| ID | Name | Unit | Description |
|----|------|------|-------------|
| SAF-001 | Lost Time Injury Frequency | /1M hrs | LTIFR per million hours worked |
| SAF-002 | Near Miss Reporting Rate | /month | Near miss incidents reported monthly |
| SAF-003 | Safety Training Completion | % | Workforce with current safety training |
| SAF-004 | Hazard Resolution Time | days | Average time to resolve reported hazards |
| SAF-005 | PPE Compliance Rate | % | Personal protective equipment compliance |
| SAF-006 | Emergency Drill Score | % | Average emergency preparedness drill score |

**Maintenance (MNT-001 through MNT-006):**
| ID | Name | Unit | Description |
|----|------|------|-------------|
| MNT-001 | Mean Time Between Failures | hours | MTBF for critical equipment |
| MNT-002 | Mean Time To Repair | hours | MTTR for equipment repairs |
| MNT-003 | Preventive Maintenance Completion | % | Scheduled PM tasks completed on time |
| MNT-004 | Maintenance Backlog | count | Overdue maintenance tasks |
| MNT-005 | Spare Parts Availability | % | Critical spare parts in stock |
| MNT-006 | Maintenance Cost per Unit | $/unit | Maintenance spend per production unit |

**Financial (FIN-001 through FIN-005):**
| ID | Name | Unit | Description |
|----|------|------|-------------|
| FIN-001 | Cost Per Unit | $/unit | Fully loaded production cost per unit |
| FIN-002 | Operating Expense Ratio | % | OpEx as percentage of revenue |
| FIN-003 | Return on Assets | % | Net income / average total assets |
| FIN-004 | Working Capital Ratio | ratio | Current assets / current liabilities |
| FIN-005 | Budget Variance | % | Actual spend vs. budget variance |

**Sustainability (SUST-001 through SUST-005):**
| ID | Name | Unit | Description |
|----|------|------|-------------|
| SUST-001 | Energy Consumption per Unit | kWh/unit | Energy usage per production unit |
| SUST-002 | Carbon Emission Intensity | kgCO2e/unit | Carbon footprint per unit produced |
| SUST-003 | Water Usage Efficiency | L/unit | Water consumption per unit |
| SUST-004 | Waste Recycling Rate | % | Percentage of waste recycled/recovered |
| SUST-005 | Renewable Energy Share | % | Energy from renewable sources |

### Example: Operational KPIs Payload

```json
{
  "dashboard_id": "ops-overview-001",
  "generated_at": "2025-01-20T14:30:00Z",
  "kpis": [
    {
      "kpi_id": "OPS-001",
      "category": "OPS",
      "name": "Overall Equipment Effectiveness",
      "description": "OEE across all production lines",
      "value": 87.5,
      "unit": "%",
      "formatted_value": "87.5%",
      "target": 90.0,
      "threshold": {
        "warning": 85.0,
        "critical": 80.0
      },
      "trend": "up",
      "trend_percentage": 2.3,
      "comparison_period": "month",
      "timestamp": "2025-01-20T14:00:00Z",
      "data_source": "MES_integration",
      "confidence": 0.95,
      "dimensions": {
        "facility": "Plant A",
        "production_line": "Line 1-4",
        "shift": "all"
      }
    },
    {
      "kpi_id": "OPS-002",
      "category": "OPS",
      "name": "Production Throughput",
      "description": "Average hourly production rate",
      "value": 142.7,
      "unit": "units/hr",
      "formatted_value": "142.7 units/hr",
      "target": 150.0,
      "threshold": {
        "warning": 135.0,
        "critical": 120.0
      },
      "trend": "stable",
      "trend_percentage": 0.1,
      "comparison_period": "month",
      "timestamp": "2025-01-20T14:00:00Z",
      "data_source": "MES_integration",
      "confidence": 0.98,
      "dimensions": {
        "facility": "Plant A",
        "production_line": "Line 1-4",
        "shift": "all"
      }
    },
    {
      "kpi_id": "OPS-003",
      "category": "OPS",
      "name": "On-Time Delivery Rate",
      "description": "Orders delivered on or before promise date",
      "value": 94.2,
      "unit": "%",
      "formatted_value": "94.2%",
      "target": 95.0,
      "threshold": {
        "warning": 92.0,
        "critical": 88.0
      },
      "trend": "down",
      "trend_percentage": -1.1,
      "comparison_period": "month",
      "timestamp": "2025-01-20T14:00:00Z",
      "data_source": "ERP_integration",
      "confidence": 0.92,
      "dimensions": {
        "facility": "Plant A",
        "customer_tier": "all"
      }
    },
    {
      "kpi_id": "OPS-006",
      "category": "OPS",
      "name": "Capacity Utilization",
      "description": "Used capacity vs. available capacity",
      "value": 82.4,
      "unit": "%",
      "formatted_value": "82.4%",
      "target": 85.0,
      "threshold": {
        "warning": 75.0,
        "critical": 65.0
      },
      "trend": "up",
      "trend_percentage": 3.5,
      "comparison_period": "quarter",
      "timestamp": "2025-01-20T14:00:00Z",
      "data_source": "MES_integration",
      "confidence": 0.96,
      "dimensions": {
        "facility": "Plant A",
        "production_line": "Line 1-4"
      }
    }
  ]
}
```

### API Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/dashboard/kpis | Fetch KPIs with optional filtering |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | string | No | Filter by category code (OPS, QLT, etc.) |
| facility | string | No | Filter by facility identifier |
| period | string | No | Aggregation period: day, week, month, quarter, year |
| kpi_ids | string[] | No | Specific KPI IDs to retrieve |

### Example API Request

```http
GET /api/v1/dashboard/kpis?category=OPS&facility=Plant%20A&period=month HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

### Change History

| Version | Date | Author | Change Description |
|---------|------|--------|-------------------|
| v1.0 | 2025-01-20 | Analytics Team | Initial KPI data contract. 6 categories, 36 KPIs with threshold alerting and dimensional filtering. |

---

## Registry Maintenance

### Adding New ICR Entries

1. Assign the next sequential ID in the appropriate category
2. Fill out all required sections (Schema, Examples, Change History)
3. Submit for architecture review
4. Update the Quick Reference table

### Versioning Policy

- **Patch (x.y.Z):** Documentation corrections, non-breaking clarifications
- **Minor (x.Y.z):** Additive changes (new fields, new endpoints)
- **Major (X.y.z):** Breaking changes (removed fields, modified behavior)

### Contact

For questions or updates to this registry, contact the Platform Architecture Team.
