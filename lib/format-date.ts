/**
 * Arc 23I — Entry System Consolidation & Operational Coherence
 *
 * Shared date formatting utilities.
 * These are pure functions — no DB or React dependencies — and are fully testable.
 *
 * Consolidates the repeated `date.toISOString().slice(0, 16).replace("T", " ")`
 * pattern used across dashboard pages into a single, tested source of truth.
 */

/**
 * Formats a Date as a compact UTC datetime string: "YYYY-MM-DD HH:MM UTC".
 * Suitable for operational list views and detail pages.
 */
export function formatOperationalDateTime(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * Formats a Date as a compact UTC datetime string without the "UTC" suffix:
 * "YYYY-MM-DD HH:MM".
 * Suitable for table cells and feed rows where space is limited.
 */
export function formatShortDateTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Formats a Date as an ISO date-only string: "YYYY-MM-DD".
 * Suitable for date fields and completion history rows.
 */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
