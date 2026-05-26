"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  getGearOfflineCapabilityLabel,
  resolveGearOfflineActionTypeForScanContext,
  resolveGearOfflinePolicy,
} from "@/lib/gear-offline";
import { buildRapidOperationHref, INVENTORY_ACTION_PRESETS } from "@/lib/rapid-inventory-ops";
import { labelForScanContext, SCAN_CONTEXTS, type ScanContext } from "@/lib/inventory-scan/types";
import { useGearOffline } from "@/components/gear-ops/offline-provider";

export function GearOfflineScanForm({
  organizationId,
  defaultScanValue,
  defaultScanContext,
}: {
  organizationId: string;
  defaultScanValue: string;
  defaultScanContext: ScanContext;
}) {
  const { online, enqueueAction } = useGearOffline();
  const [scanValue, setScanValue] = useState(defaultScanValue);
  const [scanContext, setScanContext] = useState<ScanContext>(defaultScanContext);
  const [message, setMessage] = useState<string | null>(null);

  const currentPreset = useMemo(
    () => INVENTORY_ACTION_PRESETS.find((preset) => preset.scanContext === scanContext) ?? INVENTORY_ACTION_PRESETS[0],
    [scanContext],
  );
  const policy = useMemo(() => resolveGearOfflinePolicy(resolveGearOfflineActionTypeForScanContext(scanContext)), [scanContext]);

  return (
    <div className="grid gap-3 md:grid-cols-[1.2fr,0.8fr]">
      <form
        action="/gear-ops/scan/resolve"
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
        onSubmit={(event) => {
          if (online) {
            setMessage(null);
            return;
          }

          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          enqueueAction({
            actionType: resolveGearOfflineActionTypeForScanContext(scanContext),
            actionLabel: currentPreset.title,
            requestAction: "/gear-ops/scan/resolve",
            formData,
            subjectType: "SCAN_WORKFLOW",
            subjectId: scanContext,
            subjectLabel: labelForScanContext(scanContext),
            scanContext,
            returnHref: `/gear-ops/scan?scanContext=${scanContext}&scanValue=${encodeURIComponent(scanValue)}`,
            permissionKey: `gear-ops.scan.${scanContext.toLowerCase()}`,
          });
          setMessage(`${currentPreset.title} saved locally as ${policy.optimisticLabel.toLowerCase()}. Retry from the pending panel when needed.`);
        }}
      >
        <div className="flex items-start gap-3 rounded-lg border-l-4 border-zinc-800 bg-zinc-50 p-3 dark:border-zinc-200 dark:bg-zinc-950/40">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Active mode</p>
            <h3 className="mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-50">{currentPreset.title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentPreset.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex rounded-full bg-zinc-900 px-2 py-1 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                {getGearOfflineCapabilityLabel(policy.capability)}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">{policy.offlineDescription}</span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="scanValue" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Scan barcode / QR code
          </label>
          <input
            id="scanValue"
            name="scanValue"
            value={scanValue}
            onChange={(event) => setScanValue(event.target.value)}
            autoFocus
            autoComplete="off"
            inputMode="text"
            className="w-full rounded-md border-2 border-zinc-300 px-4 py-3 text-lg font-mono focus:border-zinc-800 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:focus:border-zinc-200"
            placeholder="Scan or type code here"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="scanContext" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Scan context
          </label>
          <select
            id="scanContext"
            name="scanContext"
            value={scanContext}
            onChange={(event) => setScanContext(event.target.value as ScanContext)}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
          >
            {SCAN_CONTEXTS.map((context) => (
              <option key={context} value={context}>
                {labelForScanContext(context)}
              </option>
            ))}
          </select>
        </div>

        {!online ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Weak or no connection detected. Scan-first work can still be drafted locally where allowed, but custody and event changes stay visibly unconfirmed.
          </p>
        ) : null}
        {message ? <p className="text-xs text-zinc-600 dark:text-zinc-400">{message}</p> : null}

        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {currentPreset.primaryActionLabel}
        </button>
      </form>

      <div className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Rapid operation presets</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Pick a mode once, then keep scanning with the same follow-through.</p>
        </div>
        <div className="grid gap-2">
          {INVENTORY_ACTION_PRESETS.map((preset) => {
            const isActive = preset.scanContext === currentPreset.scanContext;
            return (
              <Link
                key={preset.key}
                href={buildRapidOperationHref(preset.scanContext, scanValue || undefined)}
                className={`rounded-lg border p-3 text-sm transition ${
                  isActive
                    ? "border-zinc-900 bg-zinc-100 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50"
                    : "border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                }`}
              >
                <p className="font-medium">{preset.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{preset.description}</p>
              </Link>
            );
          })}
        </div>

        <div className="border-t pt-3 dark:border-zinc-800">
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Organization queue</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pending scans stay scoped to this organization ({organizationId}) and remain visibly local until the server confirms them.
          </p>
        </div>
      </div>
    </div>
  );
}
