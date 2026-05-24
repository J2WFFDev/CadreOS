# Phase 12E — Communication-Awareness Validation Checklist

Validation checklist for the Arc 12 (Phases 12A–12E) communication-awareness
stabilization and closeout. Use this checklist to confirm that current awareness
behavior matches documented scope, that no unauthorized runtime behavior exists,
and that authorization and organization scoping remain intact.

---

## 1. Awareness-View Visibility

- [ ] Dashboard page loads for a staff-authenticated, organization-scoped user without errors.
- [ ] `OperationalAwarenessPanel` renders correctly when awareness candidates are present.
- [ ] `OperationalAwarenessPanel` renders gracefully (empty state, no errors) when no candidates are present.
- [ ] Awareness panel is NOT visible to unauthenticated requests (middleware redirects to sign-in).
- [ ] Awareness panel is NOT visible to users who fail the staff-only authorization check.
- [ ] Awareness categories (overdue follow-up, unresolved concern, attendance review, readiness concern, assignment/update awareness) render with correct item counts and descriptions.
- [ ] Each awareness item links correctly to its source operational record (task/note/attendance/event).
- [ ] Awareness panel footer text correctly states that Inbox, Feed, delivery, messaging, and escalation behavior is deferred.
- [ ] Awareness panel does not render any action-taking controls (no create/edit/delete/dispatch buttons within the panel).

---

## 2. Classification Behavior

- [ ] `lib/communication-classification.ts` exports internal-only category taxonomy constants.
- [ ] Classification metadata on Entry wrapper summaries renders as informational labels only — no delivery or dispatch side effects occur.
- [ ] Classification metadata on operational history items renders as informational labels only — no delivery or dispatch side effects occur.
- [ ] Classification labels do not alter note/task/attendance/event operational record status, resolution, or assignment state.
- [ ] Classification constants include `internalOnly: true`, `deliveryDeferred: true`, `messagingDeferred: true`, and `guardianCommunicationDeferred: true` markers.
- [ ] Removing or changing a classification label on an item does not affect the underlying source record.

---

## 3. Notification-Candidate Behavior

- [ ] Notification-candidate evaluation helpers in `lib/communication-classification.ts` return evaluation metadata only — no enqueue, dispatch, or delivery calls are made.
- [ ] Candidate evaluation results (overdue follow-up, unresolved concern, attendance review, readiness concern, assignment/update awareness) appear only on staff-facing metadata surfaces.
- [ ] Candidate labels do not trigger any scheduled job, reminder, queue write, or external channel call.
- [ ] Candidate metadata on note/task detail views is display-only and does not alter workflow state.
- [ ] `buildOperationalAwarenessView` in `lib/operational-awareness.ts` groups candidates without making DB queries — it is a pure transformation.
- [ ] `OperationalAwarenessView` returned by `buildOperationalAwarenessView` has `hasDeliveryBehavior: false`, `isInbox: false`, `isFeed: false`.

---

## 4. Authorization Boundaries

- [ ] `app/(dashboard)/dashboard/page.tsx` applies `getOrganizationScope()` before any data fetch used by the awareness view.
- [ ] `app/(dashboard)/dashboard/page.tsx` applies `evaluateStaffOnlyContentAccess` (or equivalent staff-role gate) before rendering the awareness panel.
- [ ] `lib/operational-awareness.ts` does not perform any DB queries — it relies entirely on pre-authorized, pre-filtered history data from its caller.
- [ ] No awareness candidate items are sourced from outside the current user's organization scope.
- [ ] Guardian-linked data does not appear in the awareness panel (confirmed by verifying that `getOperationalHistory` staff-only filters remain active).
- [ ] Cross-organization data does not appear in the awareness panel (confirmed by verifying organization-scope filter on history queries).
- [ ] Awareness panel does not expose any staff-only note content (body text, confidential observations) — it displays item type, status, and link only.

---

## 5. Organization Scoping

- [ ] Awareness view data is scoped to a single organization per page render; no cross-organization leakage path exists.
- [ ] `getOrganizationScope()` call in the dashboard page resolves correctly from session context.
- [ ] Team-scoped and program-scoped items in the awareness view belong only to teams/programs within the current organization.
- [ ] Adding or removing team membership does not cause items from other organizations to appear in the awareness panel.

---

## 6. No-Delivery and No-Messaging Confirmations

- [ ] No HTTP calls to external messaging APIs (Twilio, SendGrid, FCM, APNS, Slack, etc.) exist in any file introduced or modified in Arc 12.
- [ ] No queue write operations (Redis, SQS, Kafka, BullMQ, etc.) exist in any file introduced or modified in Arc 12.
- [ ] No scheduled jobs or cron registrations exist in any file introduced or modified in Arc 12.
- [ ] No new Prisma schema models for delivery state, message threads, Feed subscriptions, or Inbox queues were introduced in Arc 12.
- [ ] `prisma/schema.prisma` was not modified in Arc 12 (verified by `git log --oneline -- prisma/schema.prisma` showing no Arc 12 commits).

---

## 7. No Feed / Inbox Runtime Confirmations

- [ ] No Feed timeline rendering or subscription logic exists in any file introduced or modified in Arc 12.
- [ ] No Inbox triage UI, capture queue, or action-ownership-transfer logic exists in any file introduced or modified in Arc 12.
- [ ] `OperationalAwarenessPanel` does not implement triage, filing, snooze, mark-as-read, or archive semantics.
- [ ] Awareness grouping output does not include any Feed-style pagination, subscription cursors, or real-time update hooks.

---

## 8. No Guardian Runtime Communication Confirmations

- [ ] No guardian-facing route, component, or API handler was introduced or modified in Arc 12 to expose communication or awareness data.
- [ ] Guardian relationship linkage in `AthleteGuardianRelationship` was not modified to add communication entitlement in Arc 12.
- [ ] `lib/guardian-relationship-access.ts` behavior remains unchanged from Arc 11 baseline.
- [ ] Staff-only note/task content is not accessible through any path introduced in Arc 12 by a guardian-role user.

---

## 9. Existing Operational Workflow Continuity

- [ ] `npm run typecheck` passes without new errors.
- [ ] `npm run build` completes successfully.
- [ ] ObservationNote create and update workflows function correctly.
- [ ] FollowUpTask create, update, and resolve workflows function correctly.
- [ ] Event create, update, and attendance capture workflows function correctly.
- [ ] Operational history panels on dashboard, team, person, and event pages load correctly.
- [ ] Entry wrapper relationship detail page loads correctly.
- [ ] FieldOps booking and approval workflows are unaffected.

---

## 10. Documentation Completeness

- [ ] `planning/PHASE_12E_COMMUNICATION_AWARENESS_STABILIZATION_CLOSEOUT.md` exists and covers:
  - Current communication-awareness scope (what it does).
  - What remains deferred.
  - What this is intentionally not (Inbox/Feed/messaging/delivery/guardian-facing).
  - Do Not Build Yet section.
  - Recommended Arc 13 Scope section.
  - Production Risk Areas section.
- [ ] `planning/PHASE_12E_VALIDATION_CHECKLIST.md` (this file) exists.
- [ ] `planning/README.md` includes Phase 12D summary and Phase 12E entry under the Arc 12 / Track 3 section.
- [ ] Arc 12 Track 3 milestones in README are complete and up to date.

---

## Validation Sign-Off

When all checklist items above are confirmed:

- Arc 12 (Communication & Coordination) is **closed**.
- All deferred communication runtime behavior remains blocked pending Track 3 gate review.
- Arc 13 (Operational Intelligence) may begin within the safe scope defined in
  `planning/PHASE_12E_COMMUNICATION_AWARENESS_STABILIZATION_CLOSEOUT.md`.
