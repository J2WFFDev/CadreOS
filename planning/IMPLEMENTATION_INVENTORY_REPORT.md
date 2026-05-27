# CadreOS Implementation Inventory Report

_Last reviewed: 2026-05-27_

## 1. Executive Summary

CadreOS is materially beyond a thin MVP: the core operating system foundation, FieldOps MVP, GearOps MVP plus follow-on arcs, roster lifecycle, reporting, notifications, and unified operational-entry infrastructure are all present in code. The highest-risk gaps are not basic CRUD or schema coverage; they are consistency gaps between the implemented admin/operator experience and the still-planned guided/mobile experience, incomplete guardian/athlete self-service flows, partial use of the unified `Entry` model for journaling/habits/decision workflows, and roadmap sprawl caused by overlapping historical phase docs.

The core system appears strongest for staff-led desktop workflows. The main risk areas are: (1) role-safe end-to-end validation across guardian/athlete/staff personas, (2) route-protection and landing-experience consistency across the full dashboard route set, (3) unfinished or deliberately deferred communication/channel features, (4) mobile/offline scope that is bounded today to GearOps pending-action support rather than true PWA/native sync, and (5) a roadmap history that mixes completed arcs, superseded phase numbering, and future design tracks.

## 2. Completed Capabilities

| Area | Feature / capability | Evidence in code or docs | Current status | Notes |
|---|---|---|---|---|
| Core foundation | Organization, program, team, season hierarchy | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`Organization`, `Program`, `Team`, `Season`); `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/programs/*`; `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/teams/*`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_1E_PROGRAM_MANAGEMENT.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_1F_SEASON_MANAGEMENT.md` | Implemented | Seasons are program-scoped and have edit/rollover routes. |
| Auth | Clerk auth integration and protected app surface | `/tmp/workspace/J2WFFDev/CadreOS/app/layout.tsx`; `/tmp/workspace/J2WFFDev/CadreOS/middleware.ts`; `/tmp/workspace/J2WFFDev/CadreOS/app/sign-in/[[...sign-in]]/page.tsx`; `/tmp/workspace/J2WFFDev/CadreOS/app/sign-up/[[...sign-up]]/page.tsx`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_4B_CLERK_PROVIDER_SETUP.md` | Implemented | Dashboard route families are protected; sign-in/sign-up routes exist. |
| Auth / permissions | Role assignment and scoped authorization model | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`RoleAssignment`, `RoleType`); `/tmp/workspace/J2WFFDev/CadreOS/lib/authorization/index.ts`; `/tmp/workspace/J2WFFDev/CadreOS/lib/permissions/index.ts`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PERMISSIONS_MATRIX.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PRODUCT_DECISIONS.md` | Implemented | Staff/guardian separation is explicitly documented and enforced conservatively. |
| People | Person records, lifecycle states, roster membership | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`Person`, `RosterMembership`, `MemberLifecycleStatus`); `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/people/*`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_17I_ROSTER_MEMBER_LIFECYCLE_CLOSEOUT.md` | Implemented | Lifecycle actions include activate, inactive, archive, move, and rollover flows. |
| Guardian/staff context | Guardian relationship records and staff-facing diagnostics | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`AthleteGuardianRelationship`); `/tmp/workspace/J2WFFDev/CadreOS/lib/guardian-relationship-access.ts`; `/tmp/workspace/J2WFFDev/CadreOS/lib/guardian-operational-context.ts`; `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/people/[personId]/guardians/*`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_8A_GUARDIAN_WORKFLOW_FOUNDATION.md` | Implemented | The implemented slice is staff-facing relationship management, not guardian self-service. |
| Notes | Observation note workflow | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`ObservationNote`); `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/notes/*`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_2D_NOTES_OBSERVATIONS.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_7F_NOTES_WORKFLOW_HARDENING.md` | Implemented | Still coexists with unified `Entry` model instead of being fully migrated. |
| Tasks | Follow-up task workflow | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`FollowUpTask`); `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/tasks/*`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_2E_FOLLOW_UP_TASKS.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_7G_FOLLOW_UP_TASK_OPERATIONAL_CLARITY.md` | Implemented | Includes list, detail, edit, and creation from related workflows. |
| Decisions / unified entries | Decision entry surface | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`Entry`, `EntryType.DECISION`); `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/decisions/page.tsx`; `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/entries/*` | Implemented | Decisions exist as `Entry` records and have a dedicated list page. |
| Feed / visibility | Role-aware operational feed and recent activity | `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/feed/page.tsx`; `/tmp/workspace/J2WFFDev/CadreOS/lib/operational-feed/*`; `/tmp/workspace/J2WFFDev/CadreOS/lib/operational-visibility.ts`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_19B_UNIFIED_FEED_TODAY_VIEW.md` | Implemented | Current feed aggregates entries and activity; it is not a messaging/channel system. |
| Events / attendance | Events, RSVP, attendance capture | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`Event`, `RSVP`, `AttendanceRecord`); `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/events/*`; `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/events/[eventId]/attendance/route.ts`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_2A_EVENT_MANAGEMENT.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_2B_RSVP_AVAILABILITY.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_2C_ATTENDANCE_MANAGEMENT.md` | Implemented | Staff-led event operations are well-covered. |
| FieldOps | Facility/resource catalog, booking, conflict precheck, approval flow | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`Facility`, `FacilityResource`, `ResourceBooking`, `BookingConflict`); `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/field-ops/*`; `/tmp/workspace/J2WFFDev/CadreOS/lib/field-ops-booking-precheck.ts`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_6K_FIELDOPS_MVP_CLOSEOUT.md` | Implemented | Explicitly treated as MVP-complete with later expansion parked. |
| GearOps | Inventory, custody, checkout/check-in, maintenance, reservations, audits, labels, kits, event gear planning | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`GearCategory`, `GearItem`, `GearAssignment`, `GearCheckout`, `GearReservation`, `GearMaintenanceLog`, `InventoryAudit`, `InventoryKit`, `EventGearPlan`); `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/gear-ops/*`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_16I_GEAROPS_MVP_CLOSEOUT.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20Q_GEAROPS_ROADMAP_PARKING_LOT_AND_DEFERRED_SCOPE_CLEANUP.md` | Implemented | GearOps is the most mature module beyond the core staff workflows. |
| Notifications / awareness | Notification center, preferences, awareness and readiness panels | `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma` (`Notification`, `NotificationReadState`, `NotificationPreference`, `AwarenessEvent`); `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/notifications/*`; `/tmp/workspace/J2WFFDev/CadreOS/lib/notifications/*`; `/tmp/workspace/J2WFFDev/CadreOS/lib/operational-awareness.ts`; `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/dashboard/page.tsx` | Implemented | In-app operational awareness exists even though messaging channels are deferred. |
| Reporting | Operational reports across core, FieldOps, GearOps, roster lifecycle | `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/reports/page.tsx`; `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/gear-ops/reports/page.tsx`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_18I_REPORTING_DASHBOARD_INTEGRATION_CLOSEOUT.md` | Implemented | Reporting is operational and export-friendly, not BI-grade analytics. |
| Deployment readiness | Vercel branch deployment policy and DB runbook readiness | `/tmp/workspace/J2WFFDev/CadreOS/vercel.json`; `/tmp/workspace/J2WFFDev/CadreOS/README.md`; `/tmp/workspace/J2WFFDev/CadreOS/app/api/health/db/route.ts` | Implemented | Main-branch deployment is enabled; non-main auto deploys are disabled. |
| Navigation / routing | Dashboard shell, sidebar navigation, module routes | `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/layout.tsx`; `/tmp/workspace/J2WFFDev/CadreOS/components/nav-sidebar.tsx`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_3A_NAVIGATION_UX_CLEANUP.md` | Implemented | Routing is broad, but current nav labels still reflect implementation history more than future UX docs. |

## 3. Partially Implemented Capabilities

| Area | Feature / capability | What exists | What is missing | Recommended next action |
|---|---|---|---|---|
| Unified entry model | Notes/tasks/decisions/journals/habits under one runtime | `Entry`, `EntryLink`, `EntryObjectLink`, `EntryAssignment`, `EntryActivity`, `EntryRuntimeRef` exist in `/tmp/workspace/J2WFFDev/CadreOS/prisma/schema.prisma`; `/tmp/workspace/J2WFFDev/CadreOS/app/(dashboard)/entries/*`, `/feed`, `/decisions` are live | `ObservationNote` and `FollowUpTask` remain primary runtime surfaces; no first-class journal or habit pages; migration is incomplete | Treat Arc 19 as the consolidation program and define the migration/dual-write cutoff explicitly before adding more entry types |
| Journaling / athlete development | Enum and roadmap groundwork | `EntryType.JOURNAL` and `EntryType.HABIT` exist in schema and render helpers; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_21A_ATHLETE_JOURNALING_CAPABILITY_ROADMAP.md` exists | No dedicated journaling UI, no prompt system, no coach/athlete workflow, no visibility policy implemented | Start with a bounded Arc 21A runtime slice after role-safe testing and privacy rules are finalized |
| Guardian experience | Relationship model and staff tools | Guardian relationships, staff-only diagnostics, and person-linking flows are present | No guardian dashboard, invitation, consent, or broad athlete-family self-service flow | Keep staff-gated model in place and add explicit guardian/athlete acceptance criteria before exposing self-service routes |
| Route protection coverage | Middleware-protected auth boundary exists | `/tmp/workspace/J2WFFDev/CadreOS/middleware.ts` protects selected route families and `/tmp/workspace/J2WFFDev/CadreOS/components/nav-sidebar.tsx` exposes a broader dashboard surface including `/feed`, `/notifications`, `/reports`, `/field-ops`, `/gear-ops`, `/decisions`, `/entries`, `/today`, and `/upcoming` | Protection assumptions should be revalidated across every non-public route family | Add a route-access matrix test pass and align middleware coverage with the intended protected surface |
| Role-filtered UX | Role-aware docs and some scoped data reads | Design docs define Today-first, role-filtered modes; operational feed and visibility helpers use actor context | Nav/sidebar and many pages remain staff/admin oriented; no true guided mode routing layer yet | Align actual nav and landing flows with the design-system role model before broadening personas |
| Mobile web readiness | Responsive basics and GearOps rapid actions | `NavSidebar` hides below `md`; `QuickCaptureLauncher` exists; GearOps offline provider and pending-action UI exist | No implemented bottom-tab shell, no PWA manifest, no service worker, no cross-module mobile information architecture | Deliver a web-only mobile shell first, using the existing design-system docs as the acceptance baseline |
| Offline readiness | GearOps pending-action model | `/tmp/workspace/J2WFFDev/CadreOS/lib/gear-offline.ts`; `/tmp/workspace/J2WFFDev/CadreOS/components/gear-ops/offline-provider.tsx`; local queue UX exists | Full sync engine, conflict-resolution runtime, PWA/session-resume, and non-GearOps offline behavior are deferred | Keep offline bounded; do not expand beyond Arc 20V design until pilot data justifies it |
| ResourceOps | Shared resource concepts live inside FieldOps | Field/resource models and booking flows cover part of the resource domain | No distinct ResourceOps module, roadmap, or runtime surface beyond FieldOps | Clarify whether ResourceOps should remain absorbed by FieldOps or become a separate module track |
| Communication model | Notifications and awareness primitives | Notifications, digests, awareness events, and operational awareness views are implemented | No channels, DM, group messaging, announcement runtime, or consent-safe communication handoff | Preserve current boundary; if needed, add a dedicated communications arc rather than growing feed pages into messaging |
| TeamOps naming alignment | Team/program/people/roster workflows are real | Programs, teams, people, roles, roster lifecycle, and guardian context are implemented | Product docs use TeamOps/CoachOps language, but UI/routes do not expose that taxonomy consistently | Decide whether TeamOps remains internal-only architecture language or becomes surfaced in navigation/docs |
| Decisions workflow depth | List/detail through `Entry` exists | `/decisions` and generic entry detail work | No dedicated decision capture templates, lifecycle reporting, or governance UX | Add lightweight decision taxonomy only after entry consolidation goals are clear |

## 4. Planned But Not Yet Built

| Area | Feature / capability | Current roadmap / arc reference | Priority recommendation | Dependency |
|---|---|---|---|---|
| Unified entry rollout | Full Arc 19 closeout: feed/today, quick capture, graph, orchestration, activity integration, closeout | `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_19A_UNIFIED_OPERATIONAL_ENTRY_ARCHITECTURE.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/README.md` | High | Clear migration plan from `ObservationNote`/`FollowUpTask` to unified entry runtime |
| Athlete journaling | First-class journal workflow with prompts and visibility rules | `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_21A_ATHLETE_JOURNALING_CAPABILITY_ROADMAP.md` | High | Role policy, guardian visibility decisions, and stable entry model |
| GearOps pilot follow-on | Pilot instrumentation and structured feedback | `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20R_GEAROPS_PILOT_TEST_PLAN_AND_FEEDBACK_INSTRUMENTATION.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20Q_GEAROPS_ROADMAP_PARKING_LOT_AND_DEFERRED_SCOPE_CLEANUP.md` | High | Stable RC workflows and real pilot operators |
| GearOps import/export | Guarded import/export and QR-label operations | `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20S_GEAROPS_IMPORT_EXPORT_AND_QR_LABEL_OPERATIONS.md` | Medium-High | Template validation, rollback safety, auditability |
| GearOps notification handoff | Design-only handoff from operations to future communications layer | `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20U_GEAROPS_NOTIFICATION_HANDOFF_DESIGN.md` | Medium | Consent policy and communication domain boundaries |
| GearOps offline phase 2 | Conflict policy and richer sync model | `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20V_GEAROPS_OFFLINE_SYNC_PHASE_2_DESIGN.md` | Medium | Pilot feedback and current pending-action foundation |
| Native mobile readiness | Readiness plan for native decision | `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20W_GEAROPS_NATIVE_MOBILE_READINESS_PLAN.md` | Medium | Mobile-web hardening and offline policy clarity |
| Advanced kit / recurring maintenance | Additional GearOps depth | `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20X_GEAROPS_ADVANCED_KIT_BUNDLE_OPERATIONS.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20Y_GEAROPS_INSPECTION_MAINTENANCE_SCHEDULING.md` | Medium | Mature usage history and operations telemetry |
| Communications runtime | Messages, announcements, channelized delivery | `/tmp/workspace/J2WFFDev/CadreOS/planning/ROADMAP_POST_GEAROPS_DECISION.md`; `/tmp/workspace/J2WFFDev/CadreOS/planning/PRODUCT_DECISIONS.md` | Medium-Low for current core | Consent/opt-out model, privacy boundaries, role-safe routing |
| Mobile UX shell | Actual mobile tab/bar and guided-mode navigation layer | `/tmp/workspace/J2WFFDev/CadreOS/docs/product/design-system/navigation-model.md`; `/tmp/workspace/J2WFFDev/CadreOS/docs/product/design-system/platform-targets.md` | High | Agreement that guided mode is the next UX layer, not a separate app rewrite |

## 5. Desired But Not Captured

| Feature / idea | Source or inferred context | Why it matters | Recommended arc placement |
|---|---|---|---|
| Cross-module role-home acceptance matrix | Inferred from `/tmp/workspace/J2WFFDev/CadreOS/docs/product/design-system/role-and-density-modes.md` and current staff-heavy routes | The design system promises Today-first, role-filtered entry points, but no implementation arc explicitly maps every persona to landing pages and workflows | New cross-cutting UX hardening arc before major guardian/athlete rollout |
| ResourceOps product boundary decision | `module-map.md` names ResourceOps, but runtime work is mostly embedded in FieldOps | Prevents duplicate planning and future module sprawl | Add to next roadmap realignment / architecture decision arc |
| Accessibility audit and component conformance backlog | Design docs mention touch targets/status language, but there is no explicit accessibility remediation arc | Avoids guided/mobile work shipping with inconsistent semantics, focus order, or color dependence | Add to a UI consistency / accessibility hardening arc |
| Cross-module mobile information architecture | Mobile and offline plans are GearOps-heavy; core People/Events/Tasks mobile flows are not captured as an implementation sequence | Mobile shell work risks becoming module-fragmented without a shared IA plan | Place before native/offline expansion; pair with guided-mode implementation arc |
| Role-safe seeded demo scenarios for every persona | Test scenarios exist, but not a durable role-by-role data fixture strategy spanning guardian/athlete/staff/admin | Faster validation and less accidental privilege leakage during regression testing | Add to validation/test infrastructure arc |

## 6. Decided Against / Deferred

| Item | Decision status | Reason | Revisit trigger |
|---|---|---|---|
| Messaging / DM / announcement runtime | Deferred | `/tmp/workspace/J2WFFDev/CadreOS/planning/PRODUCT_DECISIONS.md` says messaging is not current scope; roadmap notes privacy/consent risk | Consent model, routing policy, and communications ownership are explicit |
| Full unified entry migration during active team/member slices | Deferred | `/tmp/workspace/J2WFFDev/CadreOS/planning/ROADMAP.md` says `ObservationNote` and `FollowUpTask` remain implemented runtime flows while unified entry migration stays planning-only | Arc 19 migration criteria and rollback strategy are agreed |
| FieldOps recurring bookings, reminders, calendar sync, advanced recommendations | Deferred | `/tmp/workspace/J2WFFDev/CadreOS/planning/ROADMAP.md` and `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_6K_FIELDOPS_MVP_CLOSEOUT.md` park expansion after MVP closeout | FieldOps exits maintenance mode with a new product decision |
| Full offline sync engine | Deferred | `/tmp/workspace/J2WFFDev/CadreOS/planning/PHASE_20Q_GEAROPS_ROADMAP_PARKING_LOT_AND_DEFERRED_SCOPE_CLEANUP.md` cites unresolved conflict policy and ownership rules | Pilot data proves strong need and Arc 20V design is approved |
| Native mobile app | Deferred | Arc 20Q and 20W both treat native as later than mobile-web/PWA hardening | Mobile web/PWA improvements are insufficient for operators |
| Procurement/accounting / enterprise warehouse scope | Decided against for current GearOps scope | Arc 20Q explicitly says GearOps is not procurement, accounting, warehouse management, or a CMMS | Separate FinanceOps / enterprise asset decision is made |
| Full BI / predictive analytics platform | Deferred | Reporting arcs intentionally stop at operational reporting; Arc 20Q parks BI/predictive scope | Stable reporting consumers and a distinct analytics mandate exist |
| Guardian portal, invitations, consent workflows | Deferred | Relationship model is currently staff-scoped; deeper guardian flows carry privacy risk | Parent/guardian policy and approval audit model are defined |
| Channel-based feed/messaging runtime | Deferred | Product decisions preserve the routing concept but state channels/DM/group chat are future concepts | Communications track is formally scheduled |
| Reasonably implied but uncaptured simplification of legacy phase numbering | Deferred cleanup | Conflicts between historic phase numbering and later arc naming remain spread across roadmap docs | Dedicated planning hygiene pass |

## 7. UI / UX Inventory

| Experience area | Current implementation | Gap | Suggested improvement | Should be core now or later |
|---|---|---|---|---|
| Navigation model | Desktop dashboard shell with persistent sidebar in `/tmp/workspace/J2WFFDev/CadreOS/components/nav-sidebar.tsx`; design target documented in `/tmp/workspace/J2WFFDev/CadreOS/docs/product/design-system/navigation-model.md` | Current labels and ordering do not fully match the design-system top-level model; no mobile tab shell exists | Align sidebar labels and add a mobile navigation shell without renaming underlying modules internally | Core now |
| Role-filtered experience | Actor-scoped data exists in feed, visibility, auth, and guardian helpers | Page structure is still mostly staff/admin first | Define role-specific landing states and hide irrelevant actions instead of only filtering data | Core now |
| Mobile web readiness | Responsive basics, quick capture, GearOps rapid actions | No implemented guided-mode shell, sparse mobile-specific layouts outside GearOps | Build one shared mobile shell for Today, Events, Gear, People, More | Core now |
| Offline / sync | GearOps pending-action and reconnect support exist | No cross-module offline strategy, no manifest, no service worker | Keep bounded scope, but make online-required vs pending-safe messaging consistent across modules | Later, after mobile shell |
| Visual status indicators | Strong design-system guidance in `/tmp/workspace/J2WFFDev/CadreOS/docs/product/design-system/status-language.md` and reporting/readiness surfaces | In-code component consistency is not yet obviously standardized across modules | Normalize badge vocabulary and audit mismatches module by module | Core now |
| GearOps design pilot | Design docs are comprehensive and runtime GearOps is mature | Some pilot concepts remain ahead of implemented shared UI patterns outside GearOps | Use GearOps as the pattern source for broader mobile/operator workflows | Core now |
| Raw/admin vs simplified views | Admin/operator mode is real; guided mode is mostly a design target | No durable mode switch or route-level dual rendering strategy yet | Decide whether mode is automatic, user-selected, or route-scoped before expanding guided views | Core now |
| Accessibility / consistency | Docs call for text+color status, large touch targets, and shared component patterns | No explicit accessibility remediation backlog is captured | Add a focused accessibility and consistency hardening arc | Core now |

## 8. Role-Based Testing Recommendation

Test from lowest-privilege and narrowest-context roles upward so access leaks and over-broad UI exposure appear early.

### 1. Public / unauthenticated visitor
- **Expected permissions:** Marketing/home only; no dashboard data; auth prompts on protected routes.
- **Main workflows to test:** visit `/`, attempt direct route access to `/dashboard`, `/people`, `/events`, `/gear-ops`, `/field-ops`.
- **Pages/routes to test:** `/`, `/sign-in`, `/sign-up`, protected route redirects enforced by `/tmp/workspace/J2WFFDev/CadreOS/middleware.ts`.
- **Data setup required:** none.
- **Pass/fail criteria:** public pages render; protected routes require auth; no organization data leaks in headers, metadata, or API responses.
- **Known risks:** route families not listed in middleware may have weaker protection assumptions.

### 2. Guardian / parent
- **Expected permissions:** relationship-scoped visibility only; no staff-only notes; no broad team/program admin actions.
- **Main workflows to test:** link account to person, access athlete-related context, confirm absence of staff-only guardian diagnostics.
- **Pages/routes to test:** `/account`, `/account/link-person`, `/people/[personId]` for linked athlete access behavior, any future athlete-related pages surfaced by role.
- **Data setup required:** guardian `Person`, optional `UserAccount`, linked `AthleteGuardianRelationship`, one athlete with both safe and staff-only notes/tasks.
- **Pass/fail criteria:** guardian sees only allowed athlete-linked context; no role inheritance from staff roles; no staff-only note leakage.
- **Known risks:** mixed-role users and indirect links through feed/reporting queries.

### 3. Athlete
- **Expected permissions:** self-scoped visibility; no admin/staff controls; limited event/task/readiness context.
- **Main workflows to test:** self-access, event participation visibility, assigned gear visibility, absence of guardian/staff diagnostics.
- **Pages/routes to test:** `/today`, `/events`, `/feed`, `/gear-ops` read paths that may surface assigned items, `/account`.
- **Data setup required:** athlete `Person`, user account link, event attendance, optional gear assignment or checkout.
- **Pass/fail criteria:** athlete can see only self-related operational data and no admin controls.
- **Known risks:** entry/feed aggregation may include broader org data if filters are not tight enough.

### 4. Assistant coach
- **Expected permissions:** scoped team operations, note/task/event workflows, limited guardian diagnostics, no org-admin configuration.
- **Main workflows to test:** notes, tasks, attendance marking, team roster viewing, guardian context visibility, event-linked follow-up work.
- **Pages/routes to test:** `/dashboard`, `/teams/[teamId]`, `/people`, `/notes`, `/tasks`, `/events/[eventId]`, `/feed`.
- **Data setup required:** assistant-coach role assignment scoped to a team/program, linked athletes, notes, tasks, upcoming events.
- **Pass/fail criteria:** can execute operational staff workflows but cannot access unrelated programs/org admin settings.
- **Known risks:** over-broad organization context helpers and report routes.

### 5. Head coach
- **Expected permissions:** broader team/program oversight, readiness visibility, attendance, notes/tasks, some guardian diagnostics, likely more reporting than assistant coach.
- **Main workflows to test:** dashboard triage, event readiness, roster gaps, note/task review, gear/event handoff if applicable.
- **Pages/routes to test:** `/dashboard`, `/reports`, `/events`, `/teams`, `/people`, `/feed`, `/notifications`.
- **Data setup required:** one or more teams, mixed athlete statuses, roster gaps, attendance records, gear readiness blockers.
- **Pass/fail criteria:** sees actionable readiness/reporting context without gaining org-admin-only write surfaces.
- **Known risks:** role boundary between head coach and program/org admin is easy to blur in reporting pages.

### 6. Program manager
- **Expected permissions:** cross-team program context, role/roster oversight, reporting, possibly seasonal setup.
- **Main workflows to test:** season management, cross-team people/program views, reports, readiness and lifecycle review, notifications.
- **Pages/routes to test:** `/programs`, `/programs/[programId]`, season create/edit/rollover routes, `/reports`, `/people`, `/teams`.
- **Data setup required:** multiple teams in one program, at least one season, mixed lifecycle statuses, program-level role assignment.
- **Pass/fail criteria:** can manage program-scoped data without crossing into unrelated organizations or hidden system-admin controls.
- **Known risks:** program-vs-organization scope joins and season rollover side effects.

### 7. Organization admin / system admin
- **Expected permissions:** full organization setup, admin bootstrap, roles, cross-module operations, reporting, GearOps admin config.
- **Main workflows to test:** bootstrap, role assignment, people/program/team setup, FieldOps/GearOps admin paths, notifications, reports, inventory admin config.
- **Pages/routes to test:** `/account/bootstrap-admin`, `/people/[personId]/roles/*`, `/gear-ops/admin`, `/programs`, `/teams`, `/field-ops`, `/reports`, `/notifications`.
- **Data setup required:** fresh organization scenario and mature seeded organization scenario.
- **Pass/fail criteria:** can complete setup and admin operations without hidden blockers; audit trails and attribution persist.
- **Known risks:** bootstrap edge cases, linked-person fallback behavior, and admin-only routes outside the middleware-protected families.

## 9. Recommended Next Arcs

1. **Arc: Role-based validation and UX hardening**  
   Unify persona acceptance criteria, landing-page behavior, and navigation exposure before expanding guardian, athlete, or mobile experiences.

2. **Arc 19 completion / entry consolidation**  
   Finish the unified operational-entry program so notes, tasks, decisions, feed, and future journaling stop straddling two competing models.

3. **Arc: Mobile web shell and accessibility consistency**  
   Implement the documented guided-mode shell, shared status patterns, and accessibility guardrails across Today, Events, Gear, People, and Tasks.

4. **Arc 20R–20S focused GearOps follow-on**  
   Run pilot instrumentation first, then add guarded import/export/label operations based on observed operator pain points.

5. **Arc 21A bounded athlete journaling pilot**  
   After role-safe validation and entry-model stabilization, deliver the smallest useful journaling slice with explicit privacy and guardian visibility rules.

## Major Findings

- CadreOS is no longer just a foundation app; it already contains substantial operational depth across core staff workflows, FieldOps, GearOps, reporting, notifications, and workflow orchestration.
- The largest implementation mismatch is between the mature admin/operator desktop product and the still-mostly-documented guided/mobile persona experience.
- Route protection should be revalidated across all dashboard route families because the middleware matcher is narrower than the visible dashboard navigation surface.
- The unified `Entry` architecture is real in schema and partial runtime use, but the codebase still carries two live models for notes/tasks versus unified entries.
- Several desired future capabilities are documented, but roadmap history is fragmented across legacy phases, newer arcs, and module/design docs; a planning cleanup pass would reduce ambiguity.
