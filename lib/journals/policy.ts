import { EntryStatus, EntryVisibility } from "@prisma/client";

export type JournalWorkflowStatus = "DRAFT" | "SUBMITTED" | "ARCHIVED";
export const MAX_JOURNAL_TITLE_LENGTH = 160;

export function mapEntryStatusToJournalWorkflowStatus(status: EntryStatus): JournalWorkflowStatus {
  if (status === EntryStatus.ARCHIVED) return "ARCHIVED";
  if (status === EntryStatus.DONE) return "SUBMITTED";
  return "DRAFT";
}

export function labelForJournalWorkflowStatus(status: JournalWorkflowStatus): string {
  if (status === "DRAFT") return "Draft";
  if (status === "SUBMITTED") return "Submitted";
  return "Archived";
}

export function labelForJournalVisibility(visibility: EntryVisibility): string {
  if (visibility === EntryVisibility.TEAM_STAFF) return "Coach scoped";
  if (visibility === EntryVisibility.ORGANIZATION_SCOPED) return "Guardian visible";
  return "Athlete private";
}

export function hintForJournalVisibility(visibility: EntryVisibility): string {
  if (visibility === EntryVisibility.TEAM_STAFF) {
    return "Submitted journals can be read by assigned coaches in scoped team/program context.";
  }

  if (visibility === EntryVisibility.ORGANIZATION_SCOPED) {
    return "Submitted journals can be read by linked guardians only when relationship scope is valid.";
  }

  return "Journal stays private to the author by default until policy allows submitted visibility.";
}

export function deriveSafeJournalActivityText(action: string): string {
  if (action === "journal.draft_created") return "Journal draft created";
  if (action === "journal.draft_updated") return "Journal draft updated";
  if (action === "journal.submitted") return "Journal submitted";
  if (action === "journal.archived") return "Journal archived";
  if (action === "journal.prompt_assigned") return "Journal prompt assigned";
  if (action === "journal.prompt_response_submitted") return "Journal prompt completed";
  if (action === "journal.prompt_assignment_cancelled") return "Prompt assignment cancelled";
  return "Journal entry";
}
