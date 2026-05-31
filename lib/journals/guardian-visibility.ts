/**
 * Arc 23E — Guardian-Safe Visibility and Feed Integration
 *
 * Guardian-safe visibility helpers for the Journals & Habits domain.
 *
 * These pure functions accept pre-loaded data and derive safe summary
 * projections for guardian-facing views. No DB dependencies.
 *
 * Privacy policy:
 * - Journal body text (Entry.content) must never appear in guardian summary output.
 * - Only metadata (title, status, date, count) is safe for guardian display.
 * - Guardian access is always relationship-scoped — only linked athlete data is returned.
 * - DRAFT journals are hidden from guardian summaries regardless of visibility policy.
 * - SUBMITTED journals are shown only if Entry.visibility = ORGANIZATION_SCOPED.
 * - Habit completion notes are hidden; only count and streak are shown to guardians.
 */

import { EntryStatus, EntryVisibility } from "@prisma/client";

// ── Input types ───────────────────────────────────────────────────────────────

/** Minimal journal metadata for guardian-safe summary derivation. */
export type GuardianJournalRecord = {
  id: string;
  title: string;
  status: EntryStatus;
  visibility: EntryVisibility;
  createdByPersonId: string;
  updatedAt: Date;
};

/** Minimal habit record for guardian-safe summary derivation. */
export type GuardianHabitRecord = {
  id: string;
  title: string;
  status: string;
  athletePersonId: string;
  completionCount: number;
  currentStreak: number;
};

// ── Output types ─────────────────────────────────────────────────────────────

/** Guardian-safe journal summary — no body text, only metadata. */
export type GuardianSafeJournalSummary = {
  id: string;
  /** Safe display title. For final/visible journals, the actual title is shown.
   *  Draft titles are never exposed to guardians. */
  displayTitle: string;
  /** Workflow status label safe for guardian display. */
  statusLabel: "Final" | "Archived";
  updatedAt: Date;
};

/** Guardian-safe athlete journal/habit overview. */
export type GuardianAthleteJournalHabitSummary = {
  athletePersonId: string;
  /** Count of submitted journals visible to this guardian. */
  submittedJournalCount: number;
  /** Count of archived journals visible to this guardian. */
  archivedJournalCount: number;
  /** List of guardian-safe journal summaries (most recent first, max 10). */
  recentJournals: GuardianSafeJournalSummary[];
  /** Count of active habits for the athlete. */
  activeHabitCount: number;
  /** List of guardian-safe habit summaries. */
  habits: GuardianHabitSummary[];
};

/** Guardian-safe habit summary — no completion notes, count and streak only. */
export type GuardianHabitSummary = {
  id: string;
  title: string;
  statusLabel: string;
  completionCount: number;
  currentStreak: number;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true if a guardian with the given linked athlete IDs may see this
 * submitted journal.
 *
 * Rules:
 * - Only SUBMITTED (DONE) journals are visible to guardians.
 * - The visibility policy must be ORGANIZATION_SCOPED.
 * - The journal's author must be one of the guardian's linked athletes.
 */
export function isJournalVisibleToGuardian(
  journal: Pick<GuardianJournalRecord, "status" | "visibility" | "createdByPersonId">,
  linkedAthleteIds: Set<string>,
): boolean {
  if (journal.status !== EntryStatus.DONE) return false;
  if (journal.visibility !== EntryVisibility.ORGANIZATION_SCOPED) return false;
  return linkedAthleteIds.has(journal.createdByPersonId);
}

/**
 * Converts a guardian-visible journal record into a safe summary for display.
 * The display title is included because the journal is explicitly policy-visible
 * (ORGANIZATION_SCOPED + submitted). Body text is never included.
 */
export function toGuardianSafeJournalSummary(journal: GuardianJournalRecord): GuardianSafeJournalSummary {
  return {
    id: journal.id,
    displayTitle: journal.title,
    statusLabel: journal.status === EntryStatus.ARCHIVED ? "Archived" : "Final",
    updatedAt: journal.updatedAt,
  };
}

/**
 * Derives a guardian-safe habit summary from a pre-loaded habit record.
 * Completion notes are never included — only the count and streak.
 */
export function toGuardianSafeHabitSummary(habit: GuardianHabitRecord): GuardianHabitSummary {
  const statusLabel =
    habit.status === "ACTIVE" ? "Active" : habit.status === "PAUSED" ? "Paused" : "Archived";

  return {
    id: habit.id,
    title: habit.title,
    statusLabel,
    completionCount: habit.completionCount,
    currentStreak: habit.currentStreak,
  };
}

/**
 * Derives the guardian-safe journal/habit overview for a single athlete.
 *
 * @param athletePersonId  The athlete being summarized.
 * @param journals         All journal records for this athlete (pre-fetched, NOT body content).
 * @param habits           All habit records for this athlete (pre-fetched).
 * @param linkedAthleteIds The guardian's set of linked athlete IDs (for safety re-check).
 * @returns                A safe summary object with no private content.
 */
export function deriveGuardianAthleteJournalHabitSummary(
  athletePersonId: string,
  journals: GuardianJournalRecord[],
  habits: GuardianHabitRecord[],
  linkedAthleteIds: Set<string>,
): GuardianAthleteJournalHabitSummary {
  // Safety re-check: guardian must be linked to this athlete
  if (!linkedAthleteIds.has(athletePersonId)) {
    return {
      athletePersonId,
      submittedJournalCount: 0,
      archivedJournalCount: 0,
      recentJournals: [],
      activeHabitCount: 0,
      habits: [],
    };
  }

  const visibleJournals = journals.filter((j) => isJournalVisibleToGuardian(j, linkedAthleteIds));

  const submittedJournalCount = visibleJournals.filter((j) => j.status === EntryStatus.DONE).length;
  const archivedJournalCount = visibleJournals.filter((j) => j.status === EntryStatus.ARCHIVED).length;

  const recentJournals = visibleJournals
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10)
    .map(toGuardianSafeJournalSummary);

  const activeHabitCount = habits.filter((h) => h.status === "ACTIVE").length;
  const habitSummaries = habits.map(toGuardianSafeHabitSummary);

  return {
    athletePersonId,
    submittedJournalCount,
    archivedJournalCount,
    recentJournals,
    activeHabitCount,
    habits: habitSummaries,
  };
}
