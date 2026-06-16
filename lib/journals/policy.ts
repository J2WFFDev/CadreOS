import { EntryStatus, EntryVisibility } from "@prisma/client";

import type { JournalPayloadStatus, JournalPayloadVisibility } from "@/lib/entries/journal-payload";

/**
 * Arc 24D.7: Journal lifecycle status labels.
 * "FINAL" replaces the prior "SUBMITTED" vocabulary to align with the
 * product-level lifecycle: Draft → Final → Archived.
 */
export type JournalWorkflowStatus = "DRAFT" | "FINAL" | "ARCHIVED";
export const MAX_JOURNAL_TITLE_LENGTH = 160;

export function mapEntryStatusToJournalWorkflowStatus(status: EntryStatus): JournalWorkflowStatus {
  if (status === EntryStatus.ARCHIVED) return "ARCHIVED";
  if (status === EntryStatus.DONE) return "FINAL";
  return "DRAFT";
}

export function resolveJournalWorkflowStatus(
  journalStatus: JournalPayloadStatus | null | undefined,
  entryStatus: EntryStatus,
): JournalWorkflowStatus {
  const fallbackStatus = mapEntryStatusToJournalWorkflowStatus(entryStatus);
  const normalizedJournalStatus = journalStatus ?? "DRAFT";
  if (normalizedJournalStatus === "DRAFT" && fallbackStatus !== "DRAFT") {
    return fallbackStatus;
  }

  if (normalizedJournalStatus === "FINAL") return "FINAL";
  if (normalizedJournalStatus === "ARCHIVED") return "ARCHIVED";
  return "DRAFT";
}

export function labelForJournalWorkflowStatus(status: JournalWorkflowStatus): string {
  if (status === "DRAFT") return "Draft";
  if (status === "FINAL") return "Final";
  return "Archived";
}

// ── Legacy Entry.visibility helpers (used by existing journal routes) ────────

export function labelForJournalVisibility(visibility: EntryVisibility): string {
  if (visibility === EntryVisibility.TEAM_STAFF) return "Team Staff";
  if (visibility === EntryVisibility.ORGANIZATION_SCOPED) return "Guardian";
  return "Private";
}

export function hintForJournalVisibility(visibility: EntryVisibility): string {
  if (visibility === EntryVisibility.TEAM_STAFF) {
    return "Final journals can be read by assigned coaches in scoped team/program context.";
  }

  if (visibility === EntryVisibility.ORGANIZATION_SCOPED) {
    return "Final journals can be read by Guardians for the related athlete only when relationship scope is valid.";
  }

  return "Journal stays private to the author by default.";
}

// ── Arc 24D.7: Payload-level visibility helpers ──────────────────────────────

/**
 * Human-readable label for the four journal payload visibility options.
 * These correspond to JournalPayloadVisibility values stored in JournalEntryPayload.
 */
export function labelForJournalPayloadVisibility(visibility: JournalPayloadVisibility): string {
  switch (visibility) {
    case "PRIVATE":
      return "Private";
    case "GUARDIAN":
      return "Guardian";
    case "TEAM_STAFF":
      return "Team Staff";
    case "PROGRAM_STAFF":
      return "Program Staff";
    default:
      return "Private";
  }
}

/**
 * Description hint for each journal payload visibility option.
 */
export function hintForJournalPayloadVisibility(visibility: JournalPayloadVisibility): string {
  switch (visibility) {
    case "PRIVATE":
      return "Only visible to the journal author.";
    case "GUARDIAN":
      return "Visible to Guardians for the related athlete once the Journal is Final.";
    case "TEAM_STAFF":
      return "Visible to team staff (coaches) in the assigned team scope.";
    case "PROGRAM_STAFF":
      return "Visible to program staff. Note: full program-staff scope enforcement is deferred to a future arc.";
    default:
      return "Only visible to the journal author.";
  }
}

// ── Activity text ────────────────────────────────────────────────────────────

export function deriveSafeJournalActivityText(action: string): string {
  if (action === "journal.draft_created") return "Journal draft created";
  if (action === "journal.draft_updated") return "Journal draft updated";
  if (action === "journal.finalized") return "Journal finalized";
  if (action === "journal.submitted") return "Journal finalized";
  if (action === "journal.reopened") return "Journal reopened";
  if (action === "journal.archived") return "Journal archived";
  if (action === "journal.restored") return "Journal restored";
  if (action === "journal.prompt_assigned") return "Journal prompt assigned";
  if (action === "journal.prompt_response_submitted") return "Journal prompt completed";
  if (action === "journal.prompt_assignment_cancelled") return "Prompt assignment cancelled";
  return "Journal entry";
}
