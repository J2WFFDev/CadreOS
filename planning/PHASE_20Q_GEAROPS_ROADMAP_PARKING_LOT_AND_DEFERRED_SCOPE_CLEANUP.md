# Arc 20Q — GearOps Roadmap Parking Lot and Deferred Scope Cleanup

## Status

Planning and documentation cleanup complete.  
This arc does not add runtime features, schema changes, API routes, or UI behavior.

## Arc Intent

Arc 20Q consolidates Arc 20A–20P scope decisions into one controlled roadmap reference so future work does not accidentally expand GearOps into enterprise warehouse management, procurement/accounting, native-only mobile, full communications automation, or cross-module rebuilds.

This document distinguishes:
- supported release-candidate capability now
- intentionally deferred scope
- candidate future enhancements (not commitments)
- explicit out-of-scope boundaries

---

## 1) Current GearOps Capability Summary (Release-Candidate Scope)

| Capability area | Current support level | Notes |
|---|---|---|
| Inventory foundation | Supported | Item lifecycle, movement history, locations, kits, ownership/readiness states from Arc 20A and prior GearOps MVP work. |
| Gear categories/templates | Supported | Category-template-driven configuration, typed defaults, starter templates, scoped admin config (Arc 20I). |
| Ownership/source | Supported | Ownership type and category-driven behavior are available in current workflows. |
| Custody | Supported | Assignment, checkout/check-in, custody history, and custody exception visibility are available. |
| Assignment | Supported with bounded approvals | Person/team/event assignment is supported; guardian approval is category-driven and workflow-bounded. |
| Location | Supported | Location assignment/movement and event staging/recovery location workflows are supported. |
| Rapid/mobile actions | Supported (web rapid mode) | Scan-first rapid continuation and contextual quick actions are implemented (Arc 20E). |
| Scan-first operations | Supported | Barcode/QR identifier resolution, scan contexts, scan event history, and scan-assisted routing are implemented (Arc 20B). |
| Readiness | Supported | Readiness states are visible and used in operational gating and reporting summaries. |
| Condition | Supported | Condition states and maintenance/inspection visibility are supported. |
| Maintenance | Supported (manual workflow) | Maintenance logs and maintenance-needed operational handling are supported; no full automation engine. |
| Inspection | Supported (workflow-level) | Inspection logging exists via maintenance/condition workflows; advanced automation is deferred. |
| Usage history | Supported | Movement, checkout, event assignment, and transaction history are available for operational review. |
| Consumables | Supported | Consumable transactions, low-availability thresholds, and reporting visibility are available. |
| Event gear planning | Supported | Event gear plans, requirements, assignments, readiness/staging/deployment/recovery orchestration (Arc 20G). |
| Staging/deployment/recovery | Supported | Event-aware staging/deployment/recovery is implemented using existing custody/readiness/location foundations. |
| Dashboards/reporting | Supported (operational) | Exception and summary reporting is available; enterprise BI and predictive analytics are deferred (Arc 20H). |
| Admin configuration | Supported (typed controls) | Category behavior settings, templates, report groups, and bounded custom fields are available (Arc 20I). |
| Operator UI | Supported | Operator-friendly and detailed admin/power-user surfaces are implemented (Arc 20J). |
| Mobile/offline foundation | Supported (bounded) | Pending-action visibility, retry/discard messaging, online-required blocking; no full sync engine (Arc 20N). |
| Cross-module integration readiness | Supported (reference-first) | Person/team/event/task/note/guardian references and graceful fallback are implemented (Arc 20M). |
| User/admin documentation | Supported | Arc planning and release/stabilization documentation exists across 16A–16I and 20A–20N with this Arc 20Q consolidation. |

---

## 2) Deferred Scope Parking Lot

Deferred items are intentionally parked. They are not commitments.

### A) Mobile and Offline
- Full offline sync engine
- Native mobile app
- Mobile app store deployment
- Background sync
- Complex conflict resolution
- Offline database replication
- Offline admin configuration
- Offline destructive operations

### B) Enterprise Asset / Warehouse Management
- Warehouse picking/packing
- Bin-level warehouse operations
- Barcode warehouse workflows beyond current scan-first operational scope
- Procurement
- Purchasing
- Depreciation
- Accounting
- Replacement forecasting
- Vendor/catalog management
- Enterprise inventory costing

### C) Maintenance and Lifecycle
- Predictive maintenance
- Full CMMS/work-order system
- Maintenance scheduling engine
- Warranty management
- Service vendor management
- Advanced inspection automation
- Lifecycle cost modeling

### D) Automation and Intelligence
- AI recommendations
- AI operational guidance
- Automated gear planning
- Automated assignment decisions
- Automated notifications
- Advanced rules engine
- Workflow automation engine

### E) Reporting and Analytics
- Full BI platform
- Advanced analytics
- Custom report builder
- Forecasting
- Trend prediction
- Financial reporting
- Power BI replacement scope

### F) Communications
- Email automation
- SMS automation
- Push notifications
- Communication campaigns
- Parent/guardian notification engine
- Event broadcast messaging

### G) Cross-Module Integrations
- Full people module rebuild
- Full athlete module rebuild
- Full guardian module rebuild
- Full event scheduling rebuild
- Full task system rebuild
- Full notes/activity system rebuild
- Full attendance integration
- Deep communications integration

### H) Advanced UX
- Full design system rewrite
- Complex drag-and-drop operations
- Advanced gesture system
- Heavy animation system
- Native-only mobile flows
- Warehouse-style scanner UI

---

## 3) Future Enhancement Candidates (Candidates, Not Commitments)

| Candidate | What it is | Why it may matter | Likely dependencies | Suggested arc placement | Risk/complexity | Recommended priority |
|---|---|---|---|---|---|---|
| GearOps pilot feedback instrumentation | Structured capture of pilot friction points and workflow telemetry | Prevents roadmap decisions from guesswork | RC stabilization baseline, pilot scenarios | 20R | Low-Medium | High |
| GearOps pilot test plan | Operator/admin/manual scenario plan with pass/fail criteria | Required for controlled pilot sign-off | Instrumentation and test ownership | 20R | Low | High |
| Native mobile readiness plan | Technical/product readiness checklist for native branch decision | Prevents premature native build | Offline phase-2 design, scope guardrails | 20W | Medium | Medium |
| Offline sync phase 2 design | Conflict policy, data ownership, retry strategy, rollback rules | Needed before any deeper offline write path | Current pending-action foundation, policy decisions | 20V | High | Medium-High |
| Notification handoff design | Integration contract from GearOps events into communications module | Enables future notifications without coupling | Communications domain boundaries, consent policy | 20U | Medium | Medium |
| Advanced event gear templates | Reusable event requirement starter packs by category/type | Speeds event prep consistency | Category-template maturity, event gear usage feedback | 20X | Medium | Medium |
| Advanced kit/bundle behavior | Kit composition/versioning and event usage improvements | Improves deploy/recover efficiency | Label/QR and event planning hardening | 20X | Medium-High | Medium |
| Equipment lifecycle analytics | Lifecycle trend and maintenance pattern reporting | Supports replacement and risk review decisions | Reporting baseline, reliable historical data | 20Y+ | Medium-High | Medium |
| Gear reservation/hold workflow | Formal reserve/hold flow before checkout/deployment | Reduces event/resource conflicts | Item lifecycle reservation controls, event workflows | 20T | Medium | High |
| Public QR recovery workflow | Limited public-facing lost-and-found scan landing pattern | Could improve recovery rates for lost gear | Security/privacy policy, communication handoff design | Post-20W candidate | High | Low-Medium |
| Deeper athlete profile integration | Richer athlete context in assignment and readiness panels | Improves assignment safety context | People/athlete query standardization | Post-20X candidate | Medium | Medium |
| Deeper event detail integration | Event detail pages showing practical gear readiness context | Improves operator continuity in event workflows | Event module integration boundaries | 20T–20X window | Medium | Medium |
| Recurring inspection schedule | Policy-driven recurring inspection prompts | Better readiness consistency | Maintenance scheduling design, role ownership | 20Y | High | Medium |
| Maintenance task automation | Optional task handoff from maintenance flags | Reduces missed follow-up work | Task integration handoff, automation boundaries | 20Y | Medium-High | Medium |
| Import/export tools | Controlled data ingress/egress tooling | Operational onboarding and audit utility | Data templates, validation policy, rollback safety | 20S | High | High |
| Audit export | Structured export of audit sessions/discrepancies | Supports compliance and review workflows | Audit model stability, reporting/export layer | 20S | Medium | Medium-High |
| Label/QR print workflow hardening | Batch labels, print packets, policy controls | Improves field operations speed | Existing label foundation + scan workflows | 20S | Medium | Medium-High |
| Bulk inventory import | Guarded template-driven item import with dry-run controls | Speeds initial inventory onboarding | Import/export platform, validation safeguards | Post-20S gated | High | Medium |
| Bulk gear update tools | Safe bulk updates for status/location/category fields | Reduces repetitive admin effort | Auditability, permission guardrails | Post-20S gated | Medium-High | Medium |

---

## 4) Future Arc Candidate List (Post-20Q)

Candidate sequence (planning guidance only):

1. **Arc 20R — GearOps Pilot Test Plan and Feedback Instrumentation**
2. **Arc 20S — GearOps Import/Export and QR Label Operations**
3. **Arc 20T — GearOps Reservation and Hold Workflow**
4. **Arc 20U — GearOps Notification Handoff Design**
5. **Arc 20V — GearOps Offline Sync Phase 2 Design**
6. **Arc 20W — GearOps Native Mobile Readiness Plan**
7. **Arc 20X — GearOps Advanced Kit and Bundle Operations**
8. **Arc 20Y — GearOps Advanced Inspection and Recurring Maintenance Scheduling**
9. **Arc 20Z — GearOps Release Retrospective and Roadmap Reset**

### Dependency sequencing notes
- 20R should happen first to ground later scope in pilot feedback.
- 20S should precede large-scale rollout demands because onboarding/export pressure appears early.
- 20U should stay design-level until communications consent/routing boundaries are approved.
- 20V should define sync policy before 20W native readiness decisions.
- 20X and 20Y should follow core operational hardening, not replace it.
- 20Z should explicitly prune backlog items that remain low-value or out-of-scope.

---

## 5) Explicit Out-of-Scope List (Without Major Product Decision)

GearOps is explicitly:

- Not an enterprise warehouse management system
- Not a procurement/accounting system
- Not a full CMMS/work-order platform
- Not a native-only mobile product
- Not a full BI platform
- Not a communications engine
- Not a replacement for people/athlete/event/task modules
- Not a generic no-code form/rules platform
- Not an AI operations planner

Any move into these areas requires an explicit product decision arc before implementation.

---

## 6) Known Limitations Cleanup (Consolidated)

| Limitation area | Current limitation |
|---|---|
| Offline limitations | No full offline sync engine, no conflict-managed replication, no offline destructive finalization; online-required actions remain blocked when offline. |
| Mobile limitations | Rapid mobile is web-first scan continuation, not a separate native client; no app-store-native path in current scope. |
| Integration limitations | Cross-module behavior is reference-first and fallback-safe; deep bidirectional workflows and module-owned rewrites are deferred. |
| Reporting limitations | Operational summaries/exceptions are available; no full BI suite, predictive analytics, custom report builder, or financial analytics platform. |
| Admin configuration limitations | Typed category-template configuration is supported; no full rules engine, no broad custom schema/form runtime, no advanced policy scripting. |
| Category/template limitations | Categories are template-driven with bounded custom fields; no arbitrary nested schema, per-field workflow automation, or custom code runtime. |
| Guardian approval boundaries | Category-driven guardian approval boundaries exist; formal approval audit record systems and communication handoffs remain deferred. |
| Pending action boundaries | Pending actions are operator-visible but are not confirmed history until server acknowledgment. |
| Deferred notification boundaries | Communication automation (email/SMS/push/event broadcast) is deferred to dedicated communications arcs. |

---

## 7) Documentation Consistency Review (Terminology Normalization)

Preferred terms for GearOps docs and prompts:

| Preferred term | Use this for | Avoid as primary term |
|---|---|---|
| Gear item | Inventory-tracked operational unit in GearOps | Asset (unless discussing finance/accounting context) |
| Inventory item | Cross-context reference when scanning/auditing inventory operations | Generic asset language without GearOps context |
| Category template | Reusable admin configuration baseline | Dynamic custom schema |
| Custody | Checkout/check-in and assignment control context | Generic possession wording |
| Assignment | Person/team/event gear linkage | Borrowed-only wording for all custody flows |
| Owner/source | Ownership type and source classification | Procurement/accounting owner terms for MVP scope |
| Location | Physical/logical inventory placement | Warehouse bin orchestration language unless explicitly deferred |
| Readiness | Operational go/no-go state for usage | Availability-only shorthand when readiness is intended |
| Condition | Physical quality state | Maintenance state (not always equivalent) |
| Maintenance | Inspection/repair/servicing workflow | Full CMMS/work-order terminology |
| Inspection | Readiness/condition review activity | Predictive maintenance automation wording |
| Event gear plan | Event-specific planning layer | Full logistics planning engine |
| Staging / deployment / recovery | Event movement lifecycle terms | Warehouse fulfillment terminology |
| Pending action | Local/pending operator action not yet confirmed | Completed history |
| Online required | Action must reach server for finalization | Offline-safe |
| Offline safe | View or action allowed without immediate server finalization | Full offline synchronization |
| Admin | Configuration-capable staff role context | Superuser/platform admin wording outside current role model |
| Operator | Day-to-day execution workflow user | Admin-only terminology for all users |
| Power user | Advanced detail/operator hybrid workflow | Separate product persona requiring new role model |

---

## 8) Product Decision Notes (Deferral Rationale)

1. **Full offline sync is deferred**  
   Current GearOps supports a bounded pending-action model. Full sync requires deterministic conflict policy, data ownership rules, and recovery guarantees that are not yet validated for pilot operations.

2. **Native mobile is deferred**  
   Rapid mobile value is available in web scan-first workflows. Native investment should follow offline policy maturity and validated operator demand.

3. **Procurement/accounting is deferred**  
   GearOps currently solves operational custody/readiness/event usage, not finance workflows. Procurement, depreciation, and costing require separate policy, compliance, and accounting integration ownership.

4. **Full CMMS is deferred**  
   Maintenance logging and readiness workflows exist, but a full work-order/scheduling system introduces significant process overhead and lifecycle complexity beyond current GearOps goals.

5. **AI recommendations are deferred**  
   Reliable recommendation quality depends on stable operational telemetry and clear policy boundaries that are still being hardened through pilot-focused arcs.

6. **Custom schema/rules engine is deferred**  
   Typed category-template configuration keeps behavior explainable, testable, and operationally safe. A generic runtime rules platform would materially increase risk and support burden.

7. **Communications automation is deferred**  
   Messaging delivery, consent handling, and audience policy belong to a dedicated communications track, not direct GearOps expansion.

8. **Category-template-driven approach is intentional**  
   Category-template configuration supports consistency, guardrails, and operator clarity. GearOps should not become custom-code driven without a separate platform-level decision.

---

## Validation Check (Arc 20Q Cleanup)

- Deferred scope reflects prior Arc 20 deferrals and Arc 16/20 boundary decisions.
- Current capability summary is bounded to implemented operational scope.
- Future enhancements are labeled as candidates and not commitments.
- Out-of-scope boundaries are explicit to prevent accidental enterprise-module creep.
- Known limitations are consolidated into one reference section.
- Terminology is normalized for future planning and Copilot prompt quality.

---

## Recommended Arc 20R Next Steps

1. Define pilot scenarios and success criteria for each current GearOps workflow area.
2. Add instrumentation events for high-friction operator actions (scan, custody, event staging/recovery, maintenance follow-up).
3. Establish a pilot feedback review cadence and decision rubric for moving items from parking lot to active candidate scope.
4. Keep all deferred/out-of-scope boundaries active until explicit product decisions change them.

---

## Source References

- `planning/PHASE_16I_GEAROPS_MVP_CLOSEOUT.md`
- `planning/PHASE_20A_INVENTORY_OPERATIONS_ARCHITECTURE.md`
- `planning/PHASE_20B_BARCODE_QR_SUPPORT.md`
- `planning/PHASE_20C_INVENTORY_AUDIT_WORKFLOW.md`
- `planning/PHASE_20D_INVENTORY_LABELS_PRINT_SUPPORT.md`
- `planning/PHASE_20E_RAPID_MOBILE_INVENTORY_OPERATIONS.md`
- `planning/PHASE_20G_EVENT_GEAR_PLANNING_AND_DEPLOYMENT.md`
- `planning/PHASE_20H_GEAROPS_OPERATIONAL_DASHBOARDS_AND_REPORTING.md`
- `planning/PHASE_20I_GEAROPS_ADMIN_CONFIGURATION.md`
- `planning/PHASE_20J_GEAROPS_UI_REFINEMENT.md`
- `planning/PHASE_20M_GEAROPS_CROSS_MODULE_INTEGRATION_READINESS.md`
- `planning/PHASE_20N_GEAROPS_RELEASE_CANDIDATE_STABILIZATION.md`
- `planning/ROADMAP_DEFERRED_GEAROPS_CAPABILITIES.md`
