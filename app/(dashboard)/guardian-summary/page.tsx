/**
 * Arc 23E — Guardian-Safe Visibility and Feed Integration
 *
 * Guardian Summary Page — /guardian-summary
 *
 * Shows a guardian-scoped view of journal submissions and habit summaries
 * for each linked athlete. No journal body text is shown. No completion
 * notes are shown. Only metadata safe for guardian display is rendered.
 *
 * Access rules:
 * - Requires PARENT_GUARDIAN role assignment in the organization.
 * - Only athletes linked via AthleteGuardianRelationship are shown.
 * - Unlinked athletes are never visible through this view.
 */

import Link from "next/link";
import { EntryStatus, EntryType, EntryVisibility, HabitFrequency, HabitStatus } from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { computeCompletionCount, computeCurrentStreak } from "@/lib/habits/policy";
import { deriveGuardianAthleteJournalHabitSummary, type GuardianAthleteJournalHabitSummary } from "@/lib/journals/guardian-visibility";
import { getOrganizationScope } from "@/lib/organization-context";
import { RoleType } from "@prisma/client";

export const dynamic = "force-dynamic";

function formatName(person: { firstName: string; lastName: string } | null | undefined): string {
  if (!person) return "Unknown athlete";
  return `${person.firstName} ${person.lastName}`.trim() || "Unknown athlete";
}

function AthleteSummaryCard({
  athleteName,
  athletePersonId,
  summary,
}: {
  athleteName: string;
  athletePersonId: string;
  summary: GuardianAthleteJournalHabitSummary;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-zinc-900">
      <h2 className="mb-3 text-base font-semibold text-zinc-800 dark:text-zinc-100">{athleteName}</h2>

      {/* Journal summary */}
      <div className="mb-4">
        <h3 className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Journals</h3>
        {summary.submittedJournalCount === 0 && summary.archivedJournalCount === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No submitted journals visible to you.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
              {summary.submittedJournalCount} submitted
              {summary.archivedJournalCount > 0 && `, ${summary.archivedJournalCount} archived`}
            </p>
            {summary.recentJournals.length > 0 && (
              <ul className="space-y-1">
                {summary.recentJournals.map((journal) => (
                  <li key={journal.id} className="flex items-center gap-2 text-sm">
                    <span className="inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      {journal.statusLabel}
                    </span>
                    <Link
                      href={`/journals/${journal.id}`}
                      className="truncate text-zinc-700 underline dark:text-zinc-300"
                    >
                      {journal.displayTitle}
                    </Link>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {journal.updatedAt.toISOString().slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Habit summary */}
      <div>
        <h3 className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Habits</h3>
        {summary.habits.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No habits on file.</p>
        ) : (
          <ul className="space-y-1">
            {summary.habits.map((habit) => (
              <li key={habit.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={
                    habit.statusLabel === "Active"
                      ? "inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "inline-block rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }
                >
                  {habit.statusLabel}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">{habit.title}</span>
                <span className="text-xs text-zinc-500">
                  {habit.completionCount} check-in{habit.completionCount !== 1 ? "s" : ""}
                  {habit.currentStreak > 0 && ` · ${habit.currentStreak}-day streak`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex gap-3 text-xs">
        <Link
          href={`/journals?createdBy=${athletePersonId}`}
          className="text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          View journals →
        </Link>
        <Link
          href={`/habits?athlete=${athletePersonId}`}
          className="text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          View habits →
        </Link>
      </div>
    </div>
  );
}

export default async function GuardianSummaryPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Athlete Summary"
          description="Guardian-safe view of journal and habit activity for linked athletes."
        />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load guardian summary right now."} />
      </section>
    );
  }

  const { organizationId } = scope;
  const actorPersonId = scope.auth.personId;

  // Verify guardian role in this organization
  if (!actorPersonId) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Athlete Summary"
          description="Guardian-safe view of journal and habit activity for linked athletes."
        />
        <ErrorMessage message="You must be signed in to view this page." />
      </section>
    );
  }

  const guardianRoleAssignment = await db.roleAssignment.findFirst({
    where: {
      organizationId,
      personId: actorPersonId,
      roleType: RoleType.PARENT_GUARDIAN,
    },
    select: { id: true },
  });

  if (!guardianRoleAssignment) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Athlete Summary"
          description="Guardian-safe view of journal and habit activity for linked athletes."
        />
        <ErrorMessage message="This view is only available to guardians with linked athletes." />
      </section>
    );
  }

  // Load linked athlete relationships
  const relationships = await db.athleteGuardianRelationship.findMany({
    where: {
      organizationId,
      guardianPersonId: actorPersonId,
    },
    select: {
      athletePersonId: true,
      athlete: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ athlete: { lastName: "asc" } }, { athlete: { firstName: "asc" } }],
  });

  if (relationships.length === 0) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Athlete Summary"
          description="Guardian-safe view of journal and habit activity for linked athletes."
        />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No athletes are currently linked to your guardian account. Contact your organization admin.
        </p>
      </section>
    );
  }

  const linkedAthleteIds = new Set(relationships.map((r) => r.athletePersonId));
  const athleteIds = [...linkedAthleteIds];

  // Load journal metadata — no content field; only metadata safe for summary display
  const journals = await db.entry.findMany({
    where: {
      organizationId,
      type: EntryType.JOURNAL,
      deletedAt: null,
      createdByPersonId: { in: athleteIds },
      // Only load ORGANIZATION_SCOPED submitted journals — the only ones guardians may see
      visibility: EntryVisibility.ORGANIZATION_SCOPED,
      status: { in: [EntryStatus.DONE, EntryStatus.ARCHIVED] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      visibility: true,
      createdByPersonId: true,
      updatedAt: true,
    },
  });

  // Load habits (summary) — completions loaded separately; notes are excluded
  const habits = await db.habit.findMany({
    where: {
      organizationId,
      athletePersonId: { in: athleteIds },
    },
    select: {
      id: true,
      title: true,
      status: true,
      athletePersonId: true,
      schedules: {
        select: { frequency: true },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
      completions: {
        select: { completedOn: true },
        // Note: notes field is intentionally excluded — guardians see counts only
      },
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
  });

  // Build per-athlete summaries
  const athleteSummaries = relationships.map((rel) => {
    const athleteJournals = journals.filter((j) => j.createdByPersonId === rel.athletePersonId);
    const athleteHabits = habits
      .filter((h) => h.athletePersonId === rel.athletePersonId)
      .map((h) => {
        const frequency = h.schedules[0]?.frequency ?? HabitFrequency.DAILY;
        const completedDates = h.completions.map((c) => c.completedOn);
        return {
          id: h.id,
          title: h.title,
          status: h.status as string,
          athletePersonId: h.athletePersonId,
          completionCount: computeCompletionCount(completedDates),
          currentStreak: h.status === HabitStatus.ACTIVE ? computeCurrentStreak(completedDates, frequency) : 0,
        };
      });

    const summary = deriveGuardianAthleteJournalHabitSummary(
      rel.athletePersonId,
      athleteJournals,
      athleteHabits,
      linkedAthleteIds,
    );

    return { rel, summary };
  });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Athlete Summary"
        description="Guardian-safe view of journal and habit activity for your linked athletes. Journal content is not shown."
      />

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
        <strong>Privacy notice:</strong> This view shows safe summary information only. Journal body
        text and habit check-in notes are not shown here.
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {athleteSummaries.map(({ rel, summary }) => (
          <AthleteSummaryCard
            key={rel.athletePersonId}
            athleteName={formatName(rel.athlete)}
            athletePersonId={rel.athletePersonId}
            summary={summary}
          />
        ))}
      </div>
    </section>
  );
}
