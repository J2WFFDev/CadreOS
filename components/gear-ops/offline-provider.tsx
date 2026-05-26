"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  buildGearConnectivityBannerModel,
  canRetryGearPendingAction,
  filterGearPendingActionsBySubject,
  shouldAutoRetryGearPendingAction,
  summarizeGearPendingActions,
  type GearOfflineActionType,
  type GearPendingActionRecord,
  type GearPendingActionSubjectType,
} from "@/lib/gear-offline";
import {
  discardGearPendingActionById,
  queueGearPendingAction,
  readGearPendingActions,
  retryGearPendingAction,
  GEAR_OFFLINE_EVENT,
} from "@/lib/gear-offline-client";
import type { ScanContext } from "@/lib/inventory-scan/types";

type QueueActionInput = {
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
};

type GearOfflineContextValue = {
  organizationId: string | null;
  online: boolean;
  actions: GearPendingActionRecord[];
  enqueueAction: (input: QueueActionInput) => GearPendingActionRecord | null;
  retryAction: (actionId: string) => Promise<void>;
  discardAction: (actionId: string) => void;
  getActionsForSubject: (subjectType: GearPendingActionSubjectType, subjectId: string) => GearPendingActionRecord[];
};

const GearOfflineContext = createContext<GearOfflineContextValue | null>(null);

function toneClass(tone: "success" | "warning" | "info") {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200";
    case "warning":
    default:
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
  }
}

function statusClass(status: GearPendingActionRecord["status"]) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
    case "SYNC_FAILED":
    case "ONLINE_REQUIRED":
      return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200";
    case "NEEDS_REVIEW":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
    default:
      return "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200";
  }
}

export function GearOfflineProvider({ organizationId, children }: { organizationId: string | null; children: ReactNode }) {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [actions, setActions] = useState<GearPendingActionRecord[]>(() => (organizationId ? readGearPendingActions(organizationId) : []));
  const [panelOpen, setPanelOpen] = useState(false);
  const retryingRef = useRef(false);

  const refresh = useCallback(() => {
    if (!organizationId) {
      setActions([]);
      return;
    }
    setActions(readGearPendingActions(organizationId));
  }, [organizationId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => refresh());

    const handleOnline = () => {
      setOnline(true);
      refresh();
    };
    const handleOffline = () => setOnline(false);
    const handleStorage = () => refresh();
    const handleQueueChange = (event: Event) => {
      const detail = (event as CustomEvent<{ organizationId?: string }>).detail;
      if (!organizationId || !detail?.organizationId || detail.organizationId === organizationId) {
        refresh();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(GEAR_OFFLINE_EVENT, handleQueueChange as EventListener);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(GEAR_OFFLINE_EVENT, handleQueueChange as EventListener);
    };
  }, [organizationId, refresh]);

  useEffect(() => {
    if (!organizationId || !online || retryingRef.current) {
      return;
    }

    const autoActions = actions.filter(shouldAutoRetryGearPendingAction);
    if (autoActions.length === 0) {
      return;
    }

    retryingRef.current = true;
    void (async () => {
      try {
        for (const action of autoActions) {
          await retryGearPendingAction(organizationId, action);
        }
      } finally {
        retryingRef.current = false;
        refresh();
      }
    })();
  }, [actions, online, organizationId, refresh]);

  const enqueueAction = useCallback(
    (input: QueueActionInput) => {
      if (!organizationId) return null;
      const action = queueGearPendingAction({ organizationId, ...input });
      refresh();
      setPanelOpen(true);
      return action;
    },
    [organizationId, refresh],
  );

  const retryAction = useCallback(
    async (actionId: string) => {
      if (!organizationId) return;
      const target = readGearPendingActions(organizationId).find((action) => action.id === actionId);
      if (!target || !canRetryGearPendingAction(target)) return;
      await retryGearPendingAction(organizationId, target);
      refresh();
    },
    [organizationId, refresh],
  );

  const discardAction = useCallback(
    (actionId: string) => {
      if (!organizationId) return;
      discardGearPendingActionById(organizationId, actionId);
      refresh();
    },
    [organizationId, refresh],
  );

  const value = useMemo<GearOfflineContextValue>(
    () => ({
      organizationId,
      online,
      actions,
      enqueueAction,
      retryAction,
      discardAction,
      getActionsForSubject: (subjectType, subjectId) => filterGearPendingActionsBySubject(actions, subjectType, subjectId),
    }),
    [actions, discardAction, enqueueAction, online, organizationId, retryAction],
  );

  const summary = summarizeGearPendingActions(actions);
  const banner = buildGearConnectivityBannerModel({
    online,
    pendingCount: summary.pendingCount,
    failedCount: summary.failedCount,
    reviewCount: summary.reviewCount,
  });

  return (
    <GearOfflineContext.Provider value={value}>
      <div className="space-y-4">
        <div className={`rounded-lg border px-4 py-3 text-sm ${toneClass(banner.tone)}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{banner.title}</p>
              <p className="text-xs sm:text-sm">{banner.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen((current) => !current)}
              className="rounded-md border border-current px-3 py-1.5 text-xs font-medium"
            >
              Pending actions {summary.pendingCount + summary.reviewCount + summary.failedCount > 0 ? `(${summary.pendingCount + summary.reviewCount + summary.failedCount})` : ""}
            </button>
          </div>
        </div>

        {children}

        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-4 left-4 z-20 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          Sync {summary.pendingCount + summary.reviewCount + summary.failedCount > 0 ? `(${summary.pendingCount + summary.reviewCount + summary.failedCount})` : ""}
        </button>

        {panelOpen ? (
          <div className="fixed inset-0 z-30 flex justify-end bg-black/40">
            <div className="flex h-full w-full max-w-md flex-col border-l bg-white p-4 shadow-2xl dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Pending field actions</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Confirmed history stays server-backed. Local pending work stays labeled here until sync completes.</p>
                </div>
                <button type="button" onClick={() => setPanelOpen(false)} className="rounded-md border px-2 py-1 text-xs">
                  Close
                </button>
              </div>

              <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                {actions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-zinc-500 dark:text-zinc-400">No local pending actions are stored for this organization.</div>
                ) : (
                  actions.map((action) => (
                    <article key={action.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{action.label}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {action.context.subjectLabel ?? action.context.subjectId ?? "GearOps"}
                          </p>
                        </div>
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${statusClass(action.status)}`}>
                          {action.status.replaceAll("_", " ").toLowerCase()}
                        </span>
                      </div>
                      {action.lastError ? <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{action.lastError}</p> : null}
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Created {new Date(action.createdAt).toLocaleString()} · retries {action.retryCount}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canRetryGearPendingAction(action) ? (
                          <button
                            type="button"
                            onClick={() => void retryAction(action.id)}
                            disabled={!online && action.retryMode !== "AUTO"}
                            className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
                          >
                            Retry
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => discardAction(action.id)}
                          className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          Discard
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </GearOfflineContext.Provider>
  );
}

export function useGearOffline() {
  const context = useContext(GearOfflineContext);
  if (!context) {
    throw new Error("useGearOffline must be used inside GearOfflineProvider");
  }
  return context;
}
