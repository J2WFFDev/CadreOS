# Arc 20R — GearOps Pilot Test Plan and Feedback Instrumentation

## Status

Pilot-readiness planning complete.  
This arc is documentation-and-lightweight-instrumentation guidance only.

## Arc Intent

Prepare GearOps release-candidate workflows (Arc 20A–20Q) for real-world pilot execution by defining:

- pilot objectives
- role-based scenario coverage
- measurable success criteria
- structured feedback collection
- issue triage ownership and outcomes
- lightweight instrumentation recommendations
- pilot readiness/data setup/reporting templates

This arc does **not** add major product features, heavy analytics, or new platform scope.

---

## 1) Pilot Objective

The GearOps pilot validates whether real operators can reliably execute release-candidate workflows under practical conditions.

Validation targets:

1. Operators can find gear quickly via search, category, location, custody holder, scan, and manual lookup.
2. Scan and manual fallback workflows are usable in field conditions.
3. Check-out, check-in, and custody transfer flows are understandable and auditable.
4. Assignment and custody history are clear for people/team/event contexts.
5. Readiness and maintenance status are visible enough to prevent unsafe use.
6. Event gear planning supports real event preparation, deployment, and recovery.
7. Cage/vault workflows are practical for issuing, receiving, and discrepancy handling.
8. Dashboard/report exceptions surface actionable operational issues.
9. Mobile/offline pending vs completed states are understandable.
10. Admin category/template configuration is understandable for staff admins.
11. Documentation supports real pilot users without requiring product-team hand-holding.

---

## 2) Pilot Roles and Expected Feedback

| Role | What they should test | What they should not test | Required feedback | Success looks like |
|---|---|---|---|---|
| Field operator | Lookup, scan/manual fallback, checkout/check-in, status review, pending state clarity | Admin category editing, schema-level config changes | Friction in speed, clarity, and field usability | Can complete core custody and lookup workflows with minimal coaching |
| Coach | Assignment to athlete/person/team, event gear linkage, readiness interpretation, missing gear handling | Low-level admin template tuning, report grouping internals | Workflow clarity and trust in readiness/custody context | Can confidently decide if gear is ready and assigned correctly |
| Equipment cage/vault operator | Staging, issue, receive, discrepancy handling, damaged gear flagging, storage return | Program-level admin configuration strategy | Practicality of cage/vault handling and exception recovery | Can reconcile event issue/return state without spreadsheet side-tracking |
| Event staff | Event plan create/open, requirement setup, assignment, staging/deploy/recover, post-event reconciliation | Category template authoring and cross-org settings | Event-day gap detection and handoff friction | Can identify unready/missing gear before and after deployment |
| Administrator | Category/template create/edit, identifier policy, location type, thresholds, event requirement templates, report grouping | Deep platform/DB operations and unrelated modules | Configuration clarity, defaults quality, safety guardrails | Can configure at least one usable category template from starter baseline |
| Power user / program manager | Dashboard/report review, drill-down validation, exception prioritization, pilot readiness checks | Schema changes, heavy analytics requests | Whether summary views support practical decisions | Can quickly triage top operational risks from dashboard/report surfaces |
| Guardian/parent reviewer (where available) | Boundary behavior when gear is assigned in guardian-sensitive contexts | Staff-only operational workflows and admin config | Clarity of guardian boundary messaging and fallback behavior | Boundary behavior is understandable and does not leak staff-only details |
| Athlete/person recipient (where available) | Clarity of assignment/custody acknowledgment steps | Staff/admin operations and sensitive maintenance internals | Confusion around assignment meaning and status language | Understands assigned vs checked-out vs pending status in plain terms |

---

## 3) Pilot Scenario Test Scripts

### Script format

Use each scenario with this execution structure:

- **Preconditions**
- **Steps**
- **Expected result**
- **Capture fields** (feedback form row ID, pass/fail, notes)

### A) Basic Inventory Lookup

Preconditions: pilot data loaded; at least one item per category/location/status.

Steps:
1. Find gear by search term.
2. Find gear by category.
3. Find gear by location.
4. Find gear by person/custody holder.
5. Scan identifier; then retry with manual identifier entry.
6. Review item status and history.

Expected result: operator can identify correct item and current operational status without ambiguity.

### B) Basic Custody Workflow

Steps:
1. Check out gear.
2. Check in gear.
3. Transfer custody.
4. Assign gear to athlete/person/team/event.
5. Verify custody history.

Expected result: custody chain stays clear; history reflects completed state only after server-confirmed completion.

### C) Vault / Equipment Cage Workflow

Steps:
1. Stage gear.
2. Issue gear.
3. Receive returned gear.
4. Verify missing/unreturned gear list.
5. Flag damaged gear.
6. Move gear back to storage location.

Expected result: cage/vault operator can reconcile issue/return state and identify unresolved exceptions.

### D) Readiness / Maintenance Workflow

Steps:
1. Mark gear ready.
2. Mark limited-use.
3. Mark out-of-service.
4. Add condition note.
5. Create maintenance intake.
6. Complete maintenance.
7. Record inspection result.
8. Verify readiness warning/blocking behavior in assignment/deployment paths.

Expected result: readiness states are visible and enforce practical operational gating.

### E) Event Gear Planning Workflow

Steps:
1. Create/open event gear plan.
2. Define required gear.
3. Assign specific inventory items.
4. Check readiness.
5. Stage gear.
6. Deploy gear.
7. Recover gear.
8. Flag missing/unreturned/damaged items.
9. Adjust consumables after event.
10. Review event gear history.

Expected result: event team can detect readiness gaps pre-deployment and unresolved returns post-event.

### F) Reporting / Dashboard Workflow

Steps:
1. Open GearOps dashboard/report view.
2. Inspect readiness summary.
3. Inspect custody summary.
4. Inspect location summary.
5. Inspect event gear summary.
6. Inspect maintenance summary.
7. Inspect consumable summary.
8. Open exception report.
9. Drill down into detail records.

Expected result: summary-to-detail flow supports triage without data interpretation confusion.

### G) Admin Configuration Workflow

Steps:
1. Create/edit category.
2. Apply starter template.
3. Adjust category fields.
4. Configure identifier behavior.
5. Configure consumable threshold.
6. Configure location type.
7. Configure event requirement template.
8. Verify reporting grouping.

Expected result: admin can configure practical defaults without unsafe hidden side effects.

### H) Mobile / Offline Behavior Workflow

Steps:
1. Use mobile layout.
2. Perform scan/manual lookup under weak connection (when testable).
3. Create offline-safe draft where supported.
4. Observe pending-action state language.
5. Retry failed/pending action.
6. Verify online-required action is blocked.
7. Confirm pending vs completed language clarity.

Expected result: users do not treat local pending actions as confirmed history.

### I) Cross-Module Reference Workflow

Steps:
1. Assign gear to shared person/athlete reference where available.
2. Link event gear plan to existing event where available.
3. Verify guardian boundary behavior where available.
4. Verify task/note/activity linkage where available.
5. Confirm graceful fallback when adjacent module references are incomplete.

Expected result: integration context improves workflow without coupling failures.

---

## 4) Pilot Success Criteria

Use practical thresholds, pass/fail, and confidence ratings (no unrealistic timing precision).

1. Operators can locate gear within a practical field threshold for most attempts.
2. Checkout/check-in is completed with minimal confusion and no custody ambiguity.
3. Event staff can identify missing or unready gear before deployment.
4. Cage/vault operators can identify unreturned gear after event recovery.
5. Admin can create/configure at least one category from a starter template.
6. Users can tell whether actions are pending vs completed.
7. Dashboard/report exceptions are understandable and actionable.
8. Documentation answers common workflow questions without live coaching.
9. No release-blocking permission or organization-scope defects are found.

Recommended scoring format:

- `PASS`
- `PASS_WITH_FRICTION`
- `FAIL`

---

## 5) Feedback Capture Model

Use one structured row per scenario execution or issue occurrence.

### Feedback template fields

- tester role
- scenario tested
- date/time
- device type
- browser
- network condition
- workflow completed (yes/no)
- confusion point
- error encountered
- expected behavior
- actual behavior
- severity
- frequency
- screenshot/link/reference
- suggested improvement
- documentation gap
- follow-up needed

### Severity categories

- Blocker
- High
- Medium
- Low
- Enhancement
- Documentation issue

### Feedback types

- bug
- usability issue
- missing workflow
- confusing label
- performance concern
- permission/access issue
- data issue
- documentation gap
- future enhancement

### Copy/paste feedback row template

```text
Tester role:
Scenario tested:
Date/time:
Device type:
Browser:
Network condition:
Workflow completed (yes/no):
Confusion point:
Error encountered:
Expected behavior:
Actual behavior:
Severity:
Frequency:
Screenshot/link/reference:
Feedback type:
Suggested improvement:
Documentation gap:
Follow-up needed:
```

---

## 6) Issue Triage Structure

### Severity definitions

- **Blocker**: prevents critical workflow completion.
- **High**: causes wrong custody/readiness/event status or unsafe operational confusion.
- **Medium**: slows workflow or causes repeated confusion/workarounds.
- **Low**: minor usability or documentation issue.
- **Enhancement**: valid improvement, not pilot-blocking.
- **Deferred**: valid but intentionally outside current pilot/release scope.

### Triage outcomes

- fix before pilot continues
- fix before release
- document workaround
- move to future arc
- reject as out of scope
- needs product decision

### Triage operating model

1. Triage owner reviews new feedback daily during pilot.
2. Blockers are reviewed immediately and halt affected scenario execution.
3. High issues are assigned to release-candidate stabilization queue.
4. Medium/Low are grouped by recurring friction themes.
5. Enhancements/Deferred items are routed to roadmap parking lot with rationale.

---

## 7) Lightweight Instrumentation Recommendations

### Scope and privacy requirements

- Organization-scoped only.
- Capture operational event metadata, not sensitive journal/private content.
- Avoid unnecessary personal data.
- Keep optional if implementation becomes invasive.
- Reuse existing event/action naming patterns.

### Recommended event hooks (lightweight)

| Event | Suggested trigger point | Minimal payload |
|---|---|---|
| `gear.lookup.initiated` | Search/filter submit in lookup views | orgId, actorRole, lookupMode (`search/category/location/person`) |
| `gear.lookup.scan_attempted` | Scan resolve start | orgId, scanContext |
| `gear.lookup.manual_fallback_used` | Manual identifier submit after scan failure/no-scan | orgId, fallbackReason |
| `gear.checkout.started/completed/failed` | Checkout form open/submit outcome | orgId, itemId, context (`event/general`) |
| `gear.checkin.started/completed/failed` | Check-in form open/submit outcome | orgId, itemId |
| `gear.custody_transfer.started/completed/failed` | Assignment/custody transfer workflow submit outcome | orgId, itemId, recipientType |
| `gear.readiness_change.started/completed/failed` | Readiness/condition updates | orgId, itemId, targetState |
| `gear.maintenance_intake.started/completed/failed` | Maintenance intake create outcome | orgId, itemId |
| `gear.maintenance_completion.started/completed/failed` | Maintenance completion update outcome | orgId, itemId |
| `event_gear.readiness_checked` | Event gear readiness check action | orgId, eventId, concernCount |
| `event_gear.deployed` / `event_gear.recovered` | Deployment/recovery action completion | orgId, eventId, itemId |
| `gear.pending_action.created/retried/failed/completed` | Pending action lifecycle changes | orgId, actionType, status |
| `gear.dashboard.exception_opened` | Exception row open/drill-in | orgId, exceptionType |
| `gear.report.drilldown_opened` | Report detail drill-down | orgId, reportSlice |
| `gear.admin.category.created/edited` | Category create/edit completion | orgId, categoryId |
| `gear.docs.link_opened` (optional) | Help/doc link click from GearOps surfaces | orgId, docTarget |

### Implementation notes

1. Prefer lightweight server-side logging at existing route handlers for completion/failure events.
2. Use client-side lightweight signals only for initiated/opened actions where no server mutation exists.
3. Keep payloads small and operational; do not store freeform private note content.
4. If instrumentation requires broad architectural change, defer implementation and keep recommendations documented.

---

## 8) Pilot Readiness Checklist (Pre-Pilot)

- [ ] Seed/import realistic test gear.
- [ ] Configure categories/templates.
- [ ] Configure locations.
- [ ] Configure users/roles/permissions.
- [ ] Configure event gear templates.
- [ ] Prepare QR/identifier test data.
- [ ] Prepare mobile devices.
- [ ] Verify docs are linked from pilot execution notes.
- [ ] Verify known limitations are visible to testers.
- [ ] Verify rollback/cleanup plan.
- [ ] Verify feedback capture location/form.
- [ ] Verify issue triage owner.
- [ ] Verify pilot scope and excluded features with all participants.

---

## 9) Pilot Data Setup Guidance

Recommended baseline pilot dataset:

- 10–25 durable gear items
- 5–10 consumable items
- 2–3 kits/bundles
- 2–3 locations
- 1–2 event gear plans
- several person/athlete references where available
- 1–2 admin-created categories from starter templates
- mixed readiness states
- at least one out-of-service item
- at least one maintenance-needed item
- at least one low-consumable item
- at least one checked-out/unreturned scenario

Adjustment guidance:

- Use upper range values for larger pilot groups or multi-role concurrent testing.
- Use lower range values for single-site, short-duration pilot sessions.

---

## 10) Pilot Report Template

Use this format at pilot close:

```text
Pilot date range:
Participants:
Scenarios tested:
Completed workflows:
Failed workflows:
Top blockers:
Top usability issues:
Documentation gaps:
Configuration issues:
Mobile/offline observations:
Dashboard/report observations:
Recommendations:
Release decision (Go / Conditional Go / No-Go):
Follow-up arcs:
```

---

## 11) Roadmap Feedback Loop

Route pilot outcomes by feedback type:

- bugs → stabilization/fix arc
- usability issues → UX refinement arc
- documentation gaps → documentation arc
- enhancements → roadmap parking lot
- mobile/offline gaps → future offline arc
- import/export/QR needs → Arc 20S+ import/export arc
- notification needs → notification handoff arc
- reporting gaps → reporting enhancement arc

Decision cadence:

1. Weekly pilot review board summarizes top patterns.
2. Blockers/high issues update release decision status immediately.
3. Enhancements remain non-blocking unless reclassified by product decision.

---

## 12) Acceptance and Validation Criteria

Arc 20R is complete when:

- Pilot test plan exists and is role/scenario complete.
- Success criteria are documented and practical.
- Feedback capture template is usable in real sessions.
- Triage definitions and outcomes are clear.
- Pilot readiness checklist and data setup guidance are complete.
- Pilot report template is available.
- Instrumentation recommendations are organization-scoped and privacy-conscious.
- Deferred/non-pilot features remain clearly out of scope.

Validation checks:

- Scenario set covers lookup, custody, cage/vault, readiness/maintenance, event planning, reporting, admin config, mobile/offline, and cross-module reference workflows.
- Success criteria avoid unrealistic precision.
- Severity and feedback types are unambiguous.
- No sensitive/private content is requested in feedback instrumentation fields.

---

## 13) Out of Scope (Enforced)

This arc does **not** add:

- major new GearOps features
- heavy analytics platform
- full event tracking platform
- AI feedback analysis
- native mobile app
- full offline sync
- notification engine
- unrelated module work

---

## 14) Arc 20S Recommended Next Steps

1. Execute pilot sessions using this Arc 20R script package and feedback template.
2. Prioritize blocker/high findings into release stabilization backlog.
3. Convert import/export/QR workflow feedback into Arc 20S implementation requirements.
4. Finalize release decision gate using pilot report template outcomes.
5. Keep deferred scope boundaries from Arc 20Q active unless explicitly re-approved.

---

## Workflow Alignment References

- `planning/PHASE_20N_GEAROPS_RELEASE_CANDIDATE_STABILIZATION.md`
- `planning/PHASE_20Q_GEAROPS_ROADMAP_PARKING_LOT_AND_DEFERRED_SCOPE_CLEANUP.md`
- `planning/PHASE_20G_EVENT_GEAR_PLANNING_AND_DEPLOYMENT.md`
- `planning/PHASE_20H_GEAROPS_OPERATIONAL_DASHBOARDS_AND_REPORTING.md`
- `planning/PHASE_20I_GEAROPS_ADMIN_CONFIGURATION.md`
- `planning/PHASE_20M_GEAROPS_CROSS_MODULE_INTEGRATION_READINESS.md`
- `lib/gear-offline.ts`
- `lib/event-gear.ts`
- `lib/gear-ops-dashboard.ts`
- `app/(dashboard)/gear-ops/`
- `app/(dashboard)/events/[eventId]/gear/`
