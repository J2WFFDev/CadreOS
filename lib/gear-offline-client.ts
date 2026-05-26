"use client";

import {
  applyGearRetryResult,
  createGearPendingAction,
  filterGearPendingActionsByOrganization,
  markGearPendingActionRetrying,
  type GearOfflineActionType,
  type GearPendingActionRecord,
  type GearPendingActionSubjectType,
  type GearRetryResult,
} from "@/lib/gear-offline";
import type { ScanContext } from "@/lib/inventory-scan/types";

const STORAGE_PREFIX = "cadreos.gear-offline.v1";
export const GEAR_OFFLINE_EVENT = "cadreos:gear-offline-actions-changed";

function getStorageKey(organizationId: string) {
  return `${STORAGE_PREFIX}:${organizationId}`;
}

function safeNow() {
  return new Date().toISOString();
}

export function readGearPendingActions(organizationId: string) {
  if (typeof window === "undefined") return [] satisfies GearPendingActionRecord[];

  try {
    const raw = window.localStorage.getItem(getStorageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GearPendingActionRecord[];
    return filterGearPendingActionsByOrganization(parsed, organizationId);
  } catch {
    return [];
  }
}

export function writeGearPendingActions(organizationId: string, actions: GearPendingActionRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(organizationId), JSON.stringify(actions));
  window.dispatchEvent(new CustomEvent(GEAR_OFFLINE_EVENT, { detail: { organizationId } }));
}

export function queueGearPendingAction(input: {
  organizationId: string;
  actionType: GearOfflineActionType;
  actionLabel?: string;
  requestAction: string;
  formData: FormData;
  subjectType: GearPendingActionSubjectType;
  subjectId?: string | null;
  subjectLabel?: string | null;
  scanContext?: ScanContext | null;
  returnHref?: string | null;
  permissionKey?: string | null;
}) {
  const createdAt = safeNow();
  const action = createGearPendingAction({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    organizationId: input.organizationId,
    actionType: input.actionType,
    actionLabel: input.actionLabel,
    requestAction: input.requestAction,
    formEntries: Array.from(input.formData.entries()).map(([key, value]) => [key, String(value)]),
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    subjectLabel: input.subjectLabel,
    scanContext: input.scanContext,
    returnHref: input.returnHref,
    permissionKey: input.permissionKey,
    createdAt,
  });

  const next = [action, ...readGearPendingActions(input.organizationId)];
  writeGearPendingActions(input.organizationId, next);
  return action;
}

export function updateGearPendingAction(organizationId: string, updated: GearPendingActionRecord) {
  const actions = readGearPendingActions(organizationId);
  writeGearPendingActions(
    organizationId,
    actions.map((action) => (action.id === updated.id ? updated : action)),
  );
}

export function discardGearPendingActionById(organizationId: string, actionId: string) {
  const actions = readGearPendingActions(organizationId);
  writeGearPendingActions(
    organizationId,
    actions.filter((action) => action.id !== actionId),
  );
}

function parseGearRetryResult(response: Response): GearRetryResult {
  const finalUrl = new URL(response.url, window.location.origin);
  const error = finalUrl.searchParams.get("error");

  if (error) {
    return { outcome: "FAILED", message: error };
  }

  const hasFieldErrors = Array.from(finalUrl.searchParams.keys()).some((key) => key.endsWith("Error"));
  if (hasFieldErrors) {
    return { outcome: "FAILED", message: "The server rejected the pending action. Open the form to review the highlighted fields." };
  }

  if (!response.ok) {
    return { outcome: "FAILED", message: `Request failed with status ${response.status}.` };
  }

  return { outcome: "COMPLETED", message: "Confirmed by server.", completedAt: safeNow() };
}

export async function retryGearPendingAction(organizationId: string, action: GearPendingActionRecord) {
  const retrying = markGearPendingActionRetrying(action, safeNow());
  updateGearPendingAction(organizationId, retrying);

  try {
    const formData = new FormData();
    retrying.request.formEntries.forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(retrying.request.action, {
      method: retrying.request.method,
      body: formData,
      credentials: "same-origin",
    });

    const result = parseGearRetryResult(response);
    const completed = applyGearRetryResult(retrying, result, safeNow());
    updateGearPendingAction(organizationId, completed);
    return completed;
  } catch (error) {
    const failed = applyGearRetryResult(
      retrying,
      { outcome: "FAILED", message: error instanceof Error ? error.message : "Network retry failed." },
      safeNow(),
    );
    updateGearPendingAction(organizationId, failed);
    return failed;
  }
}
