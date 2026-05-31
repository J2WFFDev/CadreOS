/**
 * Arc 24D.7 — Journal Entry First-Class Workflow
 *
 * Structured metadata for JOURNAL entry type, stored via EntryTypePayload
 * using the same pattern as Decision and Event payloads.
 *
 * Storage: Entry.typePayloads where entryType = JOURNAL, payloadJson = JSON.stringify(JournalEntryPayload)
 *
 * Visibility mapping (journalVisibility → Entry.visibility):
 *   PRIVATE       → STAFF_ONLY      (private to author; matches default staff-only)
 *   GUARDIAN      → ORGANIZATION_SCOPED (guardian-visible when journal is Final)
 *   TEAM_STAFF    → TEAM_STAFF      (scoped coach access)
 *   PROGRAM_STAFF → TEAM_STAFF      (deferred: no PROGRAM_STAFF variant in EntryVisibility; enforced as TEAM_STAFF)
 *
 * Note: PROGRAM_STAFF enforcement is deferred — it stores TEAM_STAFF in Entry.visibility
 * until a future RBAC arc introduces a program-staff scope variant.
 */

import { EntryType, EntryVisibility } from "@prisma/client";

// ── Journal payload status ───────────────────────────────────────────────────

export const JOURNAL_PAYLOAD_STATUS_VALUES = ["DRAFT", "FINAL", "ARCHIVED"] as const;
export type JournalPayloadStatus = (typeof JOURNAL_PAYLOAD_STATUS_VALUES)[number];

// ── Journal payload visibility ───────────────────────────────────────────────

export const JOURNAL_PAYLOAD_VISIBILITY_VALUES = [
  "PRIVATE",
  "GUARDIAN",
  "TEAM_STAFF",
  "PROGRAM_STAFF",
] as const;
export type JournalPayloadVisibility = (typeof JOURNAL_PAYLOAD_VISIBILITY_VALUES)[number];

// ── Payload shape ────────────────────────────────────────────────────────────

export type JournalEntryPayload = {
  /** Journal lifecycle status (mirrors Entry.status interpretation for journal context). */
  journalStatus: JournalPayloadStatus;
  /** Journal visibility rule stored in payload. Mapped to Entry.visibility on save. */
  journalVisibility: JournalPayloadVisibility;
  /** Author-provided journal date (YYYY-MM-DD). Defaults to entry creation date. */
  journalDate: string | null;
  /** Freeform display name for the journal author. Defaults to the creator's person name. */
  journalAuthor: string;
};

// ── Empty / default payload ──────────────────────────────────────────────────

export function createEmptyJournalEntryPayload(): JournalEntryPayload {
  return {
    journalStatus: "DRAFT",
    journalVisibility: "PRIVATE",
    journalDate: null,
    journalAuthor: "",
  };
}

// ── Parse ────────────────────────────────────────────────────────────────────

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseJournalEntryPayload(payloadJson: string | null | undefined): JournalEntryPayload {
  if (!payloadJson) return createEmptyJournalEntryPayload();

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return createEmptyJournalEntryPayload();

    return {
      journalStatus: normalizeJournalPayloadStatus(asOptionalString(parsed.journalStatus)),
      journalVisibility: normalizeJournalPayloadVisibility(asOptionalString(parsed.journalVisibility)),
      journalDate: normalizeJournalDateOnly(asOptionalString(parsed.journalDate)),
      journalAuthor: asOptionalString(parsed.journalAuthor),
    };
  } catch {
    return createEmptyJournalEntryPayload();
  }
}

// ── Serialize ────────────────────────────────────────────────────────────────

export function serializeJournalEntryPayload(payload: JournalEntryPayload): string {
  return JSON.stringify(payload);
}

// ── Normalize helpers ────────────────────────────────────────────────────────

export function normalizeJournalPayloadStatus(value: string | null | undefined): JournalPayloadStatus {
  if (typeof value !== "string") return "DRAFT";
  const normalized = value.trim().toUpperCase();
  return JOURNAL_PAYLOAD_STATUS_VALUES.includes(normalized as JournalPayloadStatus)
    ? (normalized as JournalPayloadStatus)
    : "DRAFT";
}

export function normalizeJournalPayloadVisibility(
  value: string | null | undefined,
): JournalPayloadVisibility {
  if (typeof value !== "string") return "PRIVATE";
  const normalized = value.trim().toUpperCase();
  return JOURNAL_PAYLOAD_VISIBILITY_VALUES.includes(normalized as JournalPayloadVisibility)
    ? (normalized as JournalPayloadVisibility)
    : "PRIVATE";
}

export function normalizeJournalDateOnly(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_ONLY_PATTERN.test(trimmed) ? trimmed : null;
}

// ── Visibility mapping ───────────────────────────────────────────────────────

/**
 * Maps JournalPayloadVisibility to the Entry.visibility enum value used for
 * existing RBAC enforcement. PROGRAM_STAFF is deferred — it uses TEAM_STAFF
 * as the closest available scope guard.
 */
export function mapJournalPayloadVisibilityToEntryVisibility(
  visibility: JournalPayloadVisibility,
): EntryVisibility {
  switch (visibility) {
    case "PRIVATE":
      return EntryVisibility.STAFF_ONLY;
    case "GUARDIAN":
      return EntryVisibility.ORGANIZATION_SCOPED;
    case "TEAM_STAFF":
      return EntryVisibility.TEAM_STAFF;
    case "PROGRAM_STAFF":
      // Deferred: no PROGRAM_STAFF variant in EntryVisibility. Uses TEAM_STAFF
      // as the closest enforcement scope until a future RBAC arc adds program-staff gating.
      return EntryVisibility.TEAM_STAFF;
    default:
      return EntryVisibility.STAFF_ONLY;
  }
}

// ── Type guard ───────────────────────────────────────────────────────────────

export function isJournalPayloadType(entryType: EntryType): boolean {
  return entryType === EntryType.JOURNAL;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function asOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
