"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  inferQuickCaptureContextFromPath,
  normalizeQuickCapturePriority,
  resolveQuickCaptureDueDate,
  type QuickCaptureDueShortcut,
  type QuickCapturePriority,
} from "@/lib/quick-capture";

type QuickCaptureLauncherProps = {
  assignees: Array<{ id: string; name: string }>;
  defaultAssigneePersonId: string | null;
  disabled?: boolean;
};

const DUE_SHORTCUTS: Array<{ value: QuickCaptureDueShortcut; label: string }> = [
  { value: "TODAY", label: "Today" },
  { value: "TOMORROW", label: "Tomorrow" },
  { value: "NEXT_WEEK", label: "Next Week" },
];

const PRIORITIES: QuickCapturePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export function QuickCaptureLauncher({ assignees, defaultAssigneePersonId, disabled = false }: QuickCaptureLauncherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const queryPriority = searchParams.get("priority");
  const queryDueShortcut = (searchParams.get("dueShortcut") ?? "").toUpperCase();
  const queryTitle = searchParams.get("title") ?? "";
  const queryDetails = searchParams.get("details") ?? "";
  const queryError = searchParams.get("quickCaptureError");
  const [showDetails, setShowDetails] = useState(() => queryDetails.length > 0);
  const [dueShortcut, setDueShortcut] = useState<QuickCaptureDueShortcut | "">(
    resolveQuickCaptureDueDate(queryDueShortcut) ? (queryDueShortcut as QuickCaptureDueShortcut) : "",
  );
  const [priority, setPriority] = useState<QuickCapturePriority>(
    normalizeQuickCapturePriority(queryPriority, "MEDIUM"),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const context = useMemo(() => inferQuickCaptureContextFromPath(pathname), [pathname]);
  const quickCaptureQuery = searchParams.get("quickCapture");
  const isOpen = open || quickCaptureQuery === "1";

  const closeLauncher = useCallback(() => {
    setOpen(false);
    if (quickCaptureQuery === "1") {
      const url = new URL(window.location.href);
      url.searchParams.delete("quickCapture");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [quickCaptureQuery]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName.toLowerCase();
        const inEditable = Boolean(
          target?.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select",
        );

        if (!inEditable) {
          event.preventDefault();
          if (isOpen) {
            closeLauncher();
          } else {
            setOpen(true);
          }
        }
      }

      if (event.key === "Escape") {
        closeLauncher();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [closeLauncher, isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const returnTo = pathname || "/dashboard";
  const defaultAssignee = defaultAssigneePersonId ?? "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
      >
        Quick Capture
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="fixed bottom-4 right-4 z-20 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 md:hidden dark:bg-white dark:text-black"
      >
        Capture
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
          <div className="w-full max-w-2xl rounded-t-xl border bg-white p-4 shadow-2xl md:rounded-xl dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Quick Capture</h2>
              <button type="button" onClick={closeLauncher} className="rounded-md border px-2 py-1 text-xs">
                Close
              </button>
            </div>

            <form action="/entries/quick-add" method="post" className="space-y-3" onSubmit={() => setIsSubmitting(true)}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="dueShortcut" value={dueShortcut} />
              <input type="hidden" name="priority" value={priority} />

              {context ? (
                <>
                  <input type="hidden" name="contextTargetType" value={context.targetType} />
                  <input type="hidden" name="contextTargetId" value={context.targetId} />
                </>
              ) : null}

              {queryError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {queryError}
                </div>
              ) : null}

              <div className="space-y-1">
                <label htmlFor="title" className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  maxLength={160}
                  autoFocus
                  defaultValue={queryTitle}
                  placeholder="Capture it fast…"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowDetails((value) => !value)}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {showDetails ? "Hide details" : "Add details"}
                </button>
              </div>

              {showDetails ? (
                <div className="space-y-1">
                  <label htmlFor="details" className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Details (optional)
                  </label>
                  <textarea
                    id="details"
                    name="details"
                    rows={4}
                    maxLength={4000}
                    defaultValue={queryDetails}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Add optional detail, tags, or context."
                  />
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="assigneePersonId" className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Assign
                  </label>
                  <select id="assigneePersonId" name="assigneePersonId" defaultValue={defaultAssignee} className="w-full rounded-md border px-3 py-2 text-sm">
                    <option value="">Unassigned</option>
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Due shortcut</span>
                  <div className="flex flex-wrap gap-2">
                    {DUE_SHORTCUTS.map((shortcut) => (
                      <button
                        key={shortcut.value}
                        type="button"
                        onClick={() => setDueShortcut((value) => (value === shortcut.value ? "" : shortcut.value))}
                        className={`rounded-md border px-2 py-1 text-xs ${
                          dueShortcut === shortcut.value ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {shortcut.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Priority</span>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPriority(value)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        priority === value ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              {context ? (
                <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                  {context.label}
                </p>
              ) : (
                <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
                  Low-context captures are saved to Inbox for later routing.
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-zinc-500">Tip: Use ⌘/Ctrl + K to open quick capture.</p>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
                >
                  {isSubmitting ? "Capturing…" : "Capture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
