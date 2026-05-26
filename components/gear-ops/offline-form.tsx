"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  getGearOfflineCapabilityLabel,
  resolveGearOfflinePolicy,
  type GearOfflineActionType,
  type GearPendingActionSubjectType,
} from "@/lib/gear-offline";
import type { ScanContext } from "@/lib/inventory-scan/types";
import { useGearOffline } from "@/components/gear-ops/offline-provider";

type GearOfflineFormProps = {
  action: string;
  className?: string;
  actionType: GearOfflineActionType;
  subjectType: GearPendingActionSubjectType;
  subjectId?: string | null;
  subjectLabel?: string | null;
  scanContext?: ScanContext | null;
  permissionKey?: string | null;
  returnHref?: string | null;
  queueLabel?: string;
  children: ReactNode;
};

export function GearOfflineForm({
  action,
  className,
  actionType,
  subjectType,
  subjectId,
  subjectLabel,
  scanContext,
  permissionKey,
  returnHref,
  queueLabel,
  children,
}: GearOfflineFormProps) {
  const router = useRouter();
  const { online, enqueueAction } = useGearOffline();
  const [message, setMessage] = useState<string | null>(null);
  const policy = useMemo(() => resolveGearOfflinePolicy(actionType), [actionType]);

  return (
    <form
      action={action}
      method="post"
      className={className}
      onSubmit={(event) => {
        if (online) {
          setMessage(null);
          return;
        }

        if (!policy.queueable) {
          event.preventDefault();
          setMessage(policy.onlineRequiredReason ?? "This action requires a connection before it can continue.");
          return;
        }

        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        enqueueAction({
          actionType,
          actionLabel: queueLabel,
          requestAction: action,
          formData,
          subjectType,
          subjectId,
          subjectLabel,
          scanContext,
          permissionKey,
          returnHref,
        });
        setMessage(`${policy.label} saved locally as ${policy.optimisticLabel.toLowerCase()}.`);
        if (returnHref) {
          router.push(returnHref);
          router.refresh();
        }
      }}
    >
      <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            {getGearOfflineCapabilityLabel(policy.capability)}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{policy.optimisticLabel}</span>
        </div>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{policy.offlineDescription}</p>
        {message ? <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">{message}</p> : null}
      </div>
      {children}
    </form>
  );
}
