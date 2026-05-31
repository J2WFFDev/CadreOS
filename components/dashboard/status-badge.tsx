/**
 * Arc 23I — Entry System Consolidation & Operational Coherence
 *
 * Shared StatusBadge component.
 * Provides a unified status badge across all Entry-derived systems:
 * entries, journals, habits, and prompts.
 *
 * Usage:
 *   <StatusBadge variant="active" label="Active" />
 *   <StatusBadge variant="archived" label="Archived" />
 */

export type StatusBadgeVariant =
  | "active"       // Habit ACTIVE — green
  | "open"         // Entry OPEN — blue
  | "in_progress"  // Entry IN_PROGRESS — blue
  | "done"         // Entry DONE / Journal SUBMITTED — green
  | "completed"    // Habit COMPLETED — teal
  | "paused"       // Habit PAUSED — yellow
  | "draft"        // Journal DRAFT — zinc
  | "cancelled"    // Entry CANCELLED — zinc
  | "archived"     // Any ARCHIVED — zinc
  | "pending"      // Prompt assignment PENDING — amber
  | "neutral";     // Fallback — zinc

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  active:
    "inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300",
  open:
    "inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress:
    "inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  done:
    "inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300",
  completed:
    "inline-block rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  paused:
    "inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  draft:
    "inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  cancelled:
    "inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  archived:
    "inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  pending:
    "inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  neutral:
    "inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function StatusBadge({ variant, label }: { variant: StatusBadgeVariant; label: string }) {
  return <span className={VARIANT_CLASSES[variant]}>{label}</span>;
}
