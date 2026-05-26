import { strict as assert } from "node:assert";
import test from "node:test";

import {
  applyGearRetryResult,
  buildGearConnectivityBannerModel,
  canRetryGearPendingAction,
  createGearPendingAction,
  discardGearPendingAction,
  filterGearPendingActionsByOrganization,
  filterGearPendingActionsBySubject,
  getGearPendingActionStatusLabel,
  initialStatusForGearOfflinePolicy,
  markGearPendingActionRetrying,
  resolveGearOfflineActionTypeForScanContext,
  resolveGearOfflinePolicy,
  shouldAutoRetryGearPendingAction,
  shouldShowGearActionInConfirmedHistory,
  shouldShowGearActionInLocalHistory,
  summarizeGearPendingActions,
} from "../../lib/gear-offline";

function buildAction(overrides: Partial<ReturnType<typeof createGearPendingAction>> = {}) {
  return {
    ...createGearPendingAction({
    id: "action-1",
    organizationId: "org-1",
    actionType: "gear.maintenance.create",
    requestAction: "/gear-ops/items/item-1/maintenance/create",
    formEntries: [["notes", "Replace strap"]],
    subjectType: "GEAR_ITEM",
    subjectId: "item-1",
    subjectLabel: "Duty Radio",
    createdAt: "2026-05-26T20:00:00.000Z",
    }),
    ...overrides,
  };
}

test("connectivity banner reports offline state with held actions", () => {
  const banner = buildGearConnectivityBannerModel({
    online: false,
    pendingCount: 1,
    failedCount: 0,
    reviewCount: 1,
  });

  assert.equal(banner.title, "Offline mode");
  assert.match(banner.detail, /held locally/i);
});

test("scan contexts map to bounded offline action types", () => {
  assert.equal(resolveGearOfflineActionTypeForScanContext("INVENTORY_LOOKUP"), "scan.lookup");
  assert.equal(resolveGearOfflineActionTypeForScanContext("CHECKOUT"), "scan.custody");
  assert.equal(resolveGearOfflineActionTypeForScanContext("INVENTORY_VERIFICATION"), "scan.verification");
});

test("online-required policies stay blocked offline", () => {
  const policy = resolveGearOfflinePolicy("event.gear.plan.save");

  assert.equal(policy.capability, "ONLINE_REQUIRED");
  assert.equal(policy.queueable, false);
  assert.equal(initialStatusForGearOfflinePolicy(policy), "ONLINE_REQUIRED");
});

test("offline-safe maintenance actions start as pending sync", () => {
  const action = buildAction();

  assert.equal(action.status, "PENDING_SYNC");
  assert.equal(action.retryMode, "AUTO");
  assert.equal(getGearPendingActionStatusLabel(action.status), "Pending sync");
});

test("offline-limited custody actions start as needs review", () => {
  const action = createGearPendingAction({
    id: "action-2",
    organizationId: "org-1",
    actionType: "gear.checkout.create",
    requestAction: "/gear-ops/items/item-1/checkout/create",
    formEntries: [["checkedOutById", "person-1"]],
    subjectType: "GEAR_ITEM",
    subjectId: "item-1",
    createdAt: "2026-05-26T20:00:00.000Z",
  });

  assert.equal(action.status, "NEEDS_REVIEW");
  assert.equal(action.retryMode, "MANUAL");
});

test("retry helpers move pending actions through retry and failure states", () => {
  const retrying = markGearPendingActionRetrying(buildAction(), "2026-05-26T20:05:00.000Z");
  assert.equal(retrying.retryCount, 1);
  assert.equal(retrying.status, "PENDING_SYNC");

  const failed = applyGearRetryResult(
    retrying,
    { outcome: "FAILED", message: "Conflict detected" },
    "2026-05-26T20:06:00.000Z",
  );
  assert.equal(failed.status, "SYNC_FAILED");
  assert.equal(failed.lastError, "Conflict detected");
  assert.equal(canRetryGearPendingAction(failed), true);
});

test("completed actions move out of local-only history and into confirmed local summary", () => {
  const completed = applyGearRetryResult(
    buildAction(),
    { outcome: "COMPLETED", message: "Confirmed", completedAt: "2026-05-26T20:07:00.000Z" },
    "2026-05-26T20:07:00.000Z",
  );

  assert.equal(completed.status, "COMPLETED");
  assert.equal(shouldShowGearActionInConfirmedHistory(completed), true);
  assert.equal(shouldShowGearActionInLocalHistory(completed), false);
});

test("discard removes pending actions cleanly", () => {
  const actions = [buildAction(), buildAction({ id: "action-2" })];
  const next = discardGearPendingAction(actions, "action-1");

  assert.equal(next.length, 1);
  assert.equal(next[0]?.id, "action-2");
});

test("organization and subject filters keep pending actions scoped correctly", () => {
  const orgOneItem = buildAction();
  const orgTwoItem = buildAction({
    id: "action-2",
    organizationId: "org-2",
    context: {
      subjectType: "GEAR_ITEM",
      subjectId: "item-2",
      subjectLabel: "Spare Helmet",
      scanContext: null,
      returnHref: null,
    },
  });
  const eventAction = buildAction({
    id: "action-3",
    context: {
      subjectType: "EVENT",
      subjectId: "event-1",
      subjectLabel: "Regional Match",
      scanContext: null,
      returnHref: null,
    },
  });
  const all = [orgOneItem, orgTwoItem, eventAction];

  assert.equal(filterGearPendingActionsByOrganization(all, "org-1").length, 2);
  assert.equal(filterGearPendingActionsBySubject(all, "GEAR_ITEM", "item-1").length, 1);
  assert.equal(filterGearPendingActionsBySubject(all, "EVENT", "event-1").length, 1);
});

test("auto retry only applies to supported retry-safe actions", () => {
  const safeAction = buildAction();
  const draftAction = createGearPendingAction({
    id: "action-2",
    organizationId: "org-1",
    actionType: "scan.lookup",
    requestAction: "/gear-ops/scan/resolve",
    formEntries: [["scanValue", "BC-001"]],
    subjectType: "SCAN_WORKFLOW",
    subjectId: "INVENTORY_LOOKUP",
    createdAt: "2026-05-26T20:00:00.000Z",
  });
  const reviewAction = createGearPendingAction({
    id: "action-3",
    organizationId: "org-1",
    actionType: "gear.assignment.create",
    requestAction: "/gear-ops/items/item-1/assign/create",
    formEntries: [["assignedToPersonId", "person-1"]],
    subjectType: "GEAR_ITEM",
    subjectId: "item-1",
    createdAt: "2026-05-26T20:00:00.000Z",
  });

  assert.equal(shouldAutoRetryGearPendingAction(safeAction), true);
  assert.equal(shouldAutoRetryGearPendingAction(draftAction), true);
  assert.equal(shouldAutoRetryGearPendingAction(reviewAction), false);
});

test("summary counts distinguish pending, failed, review, and completed states", () => {
  const actions = [
    buildAction(),
    applyGearRetryResult(buildAction({ id: "action-2" }), { outcome: "FAILED", message: "Retry later" }, "2026-05-26T20:08:00.000Z"),
    createGearPendingAction({
      id: "action-3",
      organizationId: "org-1",
      actionType: "gear.checkout.create",
      requestAction: "/gear-ops/items/item-1/checkout/create",
      formEntries: [["checkedOutById", "person-2"]],
      subjectType: "GEAR_ITEM",
      subjectId: "item-1",
      createdAt: "2026-05-26T20:00:00.000Z",
    }),
    applyGearRetryResult(buildAction({ id: "action-4" }), { outcome: "COMPLETED", message: "Done" }, "2026-05-26T20:09:00.000Z"),
  ];

  const summary = summarizeGearPendingActions(actions);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.reviewCount, 1);
  assert.equal(summary.completedCount, 1);
});
