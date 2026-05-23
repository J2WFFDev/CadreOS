import Link from "next/link";
import { RoleType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewFocusPanel } from "@/components/dashboard/review-focus-panel";
import { db } from "@/lib/db";
import {
  deriveGuardianOperationalContext,
  formatGuardianOperationalIndicator,
} from "@/lib/guardian-operational-context";
import { canReadStaffOnlyContent, resolveActorRoleContext } from "@/lib/authorization";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";
const STALE_NOTE_WINDOW_DAYS = 14;
const RECENTLY_ACTIVE_NOTE_WINDOW_HOURS = 72;
const UPCOMING_EVENT_LOOKAHEAD_DAYS = 14;

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SearchParams, key: string): string {
  const val = params[key];
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

function buildHref(pathname: string, filters: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function formatDateTime(value: Date) {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      {formatEnumLabel(visibility)}
    </span>
  );
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query notes right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canReadStaffOnlyContent(actorRoleContext)) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view notes. All notes require a staff role assignment.
          </p>
        </div>
      </section>
    );
  }

  const filterTeamId = readParam(resolvedParams, "teamId");
  const filterAthletePersonId = readParam(resolvedParams, "athletePersonId");
  const filterEventId = readParam(resolvedParams, "eventId");
  const filterAuthorPersonId = readParam(resolvedParams, "authorPersonId");
  const readinessIndicatorParam = readParam(resolvedParams, "readinessIndicator");
  const readinessIndicatorFilter =
    readinessIndicatorParam === "recently_active" ||
    readinessIndicatorParam === "stale" ||
    readinessIndicatorParam === "needs_review" ||
    readinessIndicatorParam === "unresolved_too_long" ||
    readinessIndicatorParam === "upcoming_operational_concern"
      ? readinessIndicatorParam
      : "";
  const guardianContextFilterParam = readParam(resolvedParams, "guardianContext");
  const guardianContextFilter =
    guardianContextFilterParam === "missing_guardian_linkage" ||
    guardianContextFilterParam === "guardian_linked" ||
    guardianContextFilterParam === "inactive_guardian_account"
      ? guardianContextFilterParam
      : "";
  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;
  const hasActiveFilters = !!(
    filterTeamId ||
    filterAthletePersonId ||
    filterEventId ||
    filterAuthorPersonId ||
    readinessIndicatorFilter ||
    (canViewGuardianRelationshipDetails && guardianContextFilter)
  );

  let notes:
    | Array<{
        id: string;
        body: string;
        visibility: string;
        createdAt: Date;
        updatedAt: Date;
        author: { id: string; firstName: string; lastName: string };
        athlete:
          | {
              id: string;
              firstName: string;
              lastName: string;
              athleteLinks?: Array<{
                id: string;
                guardian: {
                  _count: { userAccounts: number };
                  roles: Array<{ id: string }>;
                };
              }>;
            }
          | null;
        team: { id: string; name: string } | null;
        event: { id: string; title: string; startsAt: Date; status: string } | null;
        tasks: Array<{ status: string }>;
      }>
    | null = null;
  let filterTeams: Array<{ id: string; name: string }> = [];
  let filterPeople: Array<{ id: string; firstName: string; lastName: string }> = [];
  let filterEvents: Array<{ id: string; title: string }> = [];
  let queryErrorMessage = "Unable to load notes right now. Please try again later.";

  try {
    const [fetchedNotes, fetchedTeams, fetchedPeople, fetchedEvents] = await Promise.all([
      db.observationNote.findMany({
        where: {
          organizationId: scope.organizationId,
          ...(filterTeamId ? { teamId: filterTeamId } : {}),
          ...(filterAthletePersonId ? { athletePersonId: filterAthletePersonId } : {}),
          ...(filterEventId ? { eventId: filterEventId } : {}),
          ...(filterAuthorPersonId ? { authorPersonId: filterAuthorPersonId } : {}),
          ...(canViewGuardianRelationshipDetails && guardianContextFilter === "missing_guardian_linkage"
            ? {
                athletePersonId: { not: null },
                athlete: {
                  athleteLinks: {
                    none: {
                      organizationId: scope.organizationId,
                    },
                  },
                },
              }
            : {}),
          ...(canViewGuardianRelationshipDetails && guardianContextFilter === "guardian_linked"
            ? {
                athlete: {
                  athleteLinks: {
                    some: {
                      organizationId: scope.organizationId,
                    },
                  },
                },
              }
            : {}),
          ...(canViewGuardianRelationshipDetails && guardianContextFilter === "inactive_guardian_account"
            ? {
                athlete: {
                  athleteLinks: {
                    some: {
                      organizationId: scope.organizationId,
                      guardian: {
                        userAccounts: { some: {} },
                        roles: {
                          none: {
                            organizationId: scope.organizationId,
                            roleType: RoleType.PARENT_GUARDIAN,
                          },
                        },
                      },
                    },
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
          body: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, firstName: true, lastName: true } },
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              athleteLinks: {
                where: { organizationId: scope.organizationId },
                select: {
                  id: true,
                  guardian: {
                    select: {
                      _count: { select: { userAccounts: true } },
                      roles: {
                        where: {
                          organizationId: scope.organizationId,
                          roleType: RoleType.PARENT_GUARDIAN,
                        },
                        select: { id: true },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
          team: { select: { id: true, name: true } },
          event: { select: { id: true, title: true, startsAt: true, status: true } },
          tasks: { select: { status: true } },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      db.team.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.event.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, title: true },
        orderBy: [{ startsAt: "desc" }],
        take: 100,
      }),
    ]);
    notes = fetchedNotes;
    filterTeams = fetchedTeams;
    filterPeople = fetchedPeople;
    filterEvents = fetchedEvents;
  } catch (error) {
    notes = null;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading notes.";
    }
  }

  if (!notes) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const activeFilterLabels: string[] = [];
  if (filterTeamId) {
    const team = filterTeams.find((t) => t.id === filterTeamId);
    if (team) activeFilterLabels.push(`Team: ${team.name}`);
  }
  if (filterAthletePersonId) {
    const person = filterPeople.find((p) => p.id === filterAthletePersonId);
    if (person) activeFilterLabels.push(`Athlete/Person: ${person.firstName} ${person.lastName}`);
  }
  if (filterEventId) {
    const event = filterEvents.find((e) => e.id === filterEventId);
    if (event) activeFilterLabels.push(`Event: ${event.title}`);
  }
  if (filterAuthorPersonId) {
    const author = filterPeople.find((p) => p.id === filterAuthorPersonId);
    if (author) activeFilterLabels.push(`Author: ${author.firstName} ${author.lastName}`);
  }
  if (readinessIndicatorFilter) {
    const labelByFilter: Record<string, string> = {
      recently_active: "Readiness: recently active",
      stale: "Readiness: stale",
      needs_review: "Readiness: needs review",
      unresolved_too_long: "Readiness: unresolved too long",
      upcoming_operational_concern: "Readiness: upcoming operational concern",
    };
    activeFilterLabels.push(labelByFilter[readinessIndicatorFilter] ?? readinessIndicatorFilter);
  }
  if (canViewGuardianRelationshipDetails && guardianContextFilter) {
    const labelByFilter: Record<string, string> = {
      missing_guardian_linkage: "Guardian context: athlete missing guardian linkage",
      guardian_linked: "Guardian context: guardian-linked athlete",
      inactive_guardian_account: "Guardian context: inactive guardian account signal",
    };
    activeFilterLabels.push(labelByFilter[guardianContextFilter] ?? guardianContextFilter);
  }
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_NOTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentlyActiveCutoff = new Date(now.getTime() - RECENTLY_ACTIVE_NOTE_WINDOW_HOURS * 60 * 60 * 1000);
  const upcomingEventCutoff = new Date(now.getTime() + UPCOMING_EVENT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  const filteredNotes = notes.filter((note) => {
    const unresolvedTaskCount = note.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
    const hasUnresolvedFollowUp = unresolvedTaskCount > 0;
    const isStale = note.updatedAt.getTime() < staleCutoff.getTime();
    const isRecentlyActive = note.updatedAt.getTime() >= recentlyActiveCutoff.getTime();
    const hasUpcomingEventContext = Boolean(
      note.event &&
        note.event.startsAt.getTime() >= now.getTime() &&
        note.event.startsAt.getTime() <= upcomingEventCutoff.getTime(),
    );
    const hasUpcomingOperationalConcern = hasUpcomingEventContext && hasUnresolvedFollowUp;
    const needsReview = hasUnresolvedFollowUp || isStale;
    const unresolvedTooLong = hasUnresolvedFollowUp && isStale;

    if (readinessIndicatorFilter === "recently_active" && !isRecentlyActive) {
      return false;
    }
    if (readinessIndicatorFilter === "stale" && !isStale) {
      return false;
    }
    if (readinessIndicatorFilter === "needs_review" && !needsReview) {
      return false;
    }
    if (readinessIndicatorFilter === "unresolved_too_long" && !unresolvedTooLong) {
      return false;
    }
    if (readinessIndicatorFilter === "upcoming_operational_concern" && !hasUpcomingOperationalConcern) {
      return false;
    }
    return true;
  });
  const staleNoteCount = filteredNotes.filter((note) => note.updatedAt.getTime() < staleCutoff.getTime()).length;
  const recentlyActiveNoteCount = filteredNotes.filter(
    (note) => note.updatedAt.getTime() >= recentlyActiveCutoff.getTime(),
  ).length;
  const notesNeedingReviewCount = filteredNotes.filter((note) => {
    const unresolvedTaskCount = note.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
    const isStale = note.updatedAt.getTime() < staleCutoff.getTime();
    return unresolvedTaskCount > 0 || isStale;
  }).length;
  const upcomingConcernCount = filteredNotes.filter((note) => {
    const unresolvedTaskCount = note.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
    return Boolean(
      unresolvedTaskCount > 0 &&
        note.event &&
        note.event.startsAt.getTime() >= now.getTime() &&
        note.event.startsAt.getTime() <= upcomingEventCutoff.getTime(),
    );
  }).length;
  const unresolvedLinkedTaskCount = filteredNotes.reduce(
    (count, note) => count + note.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length,
    0,
  );
  const buildNotesHref = (overrides: Record<string, string>) =>
    buildHref("/notes", {
      teamId: filterTeamId,
      athletePersonId: filterAthletePersonId,
      eventId: filterEventId,
      authorPersonId: filterAuthorPersonId,
      readinessIndicator: readinessIndicatorFilter,
      guardianContext: canViewGuardianRelationshipDetails ? guardianContextFilter : "",
      ...overrides,
    });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Notes"
        description="Record coaching observations about athletes, teams, and events."
        actions={
          <Link href="/notes/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New note
          </Link>
        }
      />

      <ReviewFocusPanel
        title="Operational review focus"
        description="Use the current note scope to review what changed recently, what is stale, and which notes still carry unresolved follow-up into upcoming operations."
        activeFilters={activeFilterLabels}
        defaultScope="No filters are active. Review spans all observation notes in the current organization."
        stats={[
          {
            label: "Notes in current scope",
            value: filteredNotes.length,
            href: hasActiveFilters ? buildNotesHref({}) : "/notes",
          },
          {
            label: "Need review",
            value: notesNeedingReviewCount,
            href: buildNotesHref({ readinessIndicator: "needs_review" }),
            tone: notesNeedingReviewCount > 0 ? "warning" : "success",
          },
          {
            label: "Stale",
            value: staleNoteCount,
            href: buildNotesHref({ readinessIndicator: "stale" }),
            tone: staleNoteCount > 0 ? "warning" : "neutral",
          },
          {
            label: "Upcoming concerns",
            value: upcomingConcernCount,
            href: buildNotesHref({ readinessIndicator: "upcoming_operational_concern" }),
            tone: upcomingConcernCount > 0 ? "danger" : "success",
          },
          {
            label: "Recently active",
            value: recentlyActiveNoteCount,
            href: buildNotesHref({ readinessIndicator: "recently_active" }),
            tone: recentlyActiveNoteCount > 0 ? "info" : "neutral",
          },
          {
            label: "Unresolved linked tasks",
            value: unresolvedLinkedTaskCount,
            href: buildNotesHref({ readinessIndicator: "needs_review" }),
            tone: unresolvedLinkedTaskCount > 0 ? "warning" : "success",
          },
        ]}
        links={[
          { label: "Needs review in current scope", href: buildNotesHref({ readinessIndicator: "needs_review" }) },
          { label: "Stale notes", href: buildNotesHref({ readinessIndicator: "stale" }) },
          {
            label: "Upcoming operational concern",
            href: buildNotesHref({ readinessIndicator: "upcoming_operational_concern" }),
          },
          { label: "Recent note changes", href: buildNotesHref({ readinessIndicator: "recently_active" }) },
        ]}
        guidance="Readiness cues are lightweight prompts derived from existing note timestamps, linked task states, and linked event timing. Feed, Journal, and Entry runtime behavior remain deferred."
      />

      {/* Filter bar */}
      <form method="GET" className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="filter-teamId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Team
            </label>
            <select
              id="filter-teamId"
              name="teamId"
              defaultValue={filterTeamId}
              className="w-36 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All teams</option>
              {filterTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-athletePersonId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Athlete / Person
            </label>
            <select
              id="filter-athletePersonId"
              name="athletePersonId"
              defaultValue={filterAthletePersonId}
              className="w-44 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All people</option>
              {filterPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-eventId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Event
            </label>
            <select
              id="filter-eventId"
              name="eventId"
              defaultValue={filterEventId}
              className="w-44 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All events</option>
              {filterEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-authorPersonId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Author
            </label>
            <select
              id="filter-authorPersonId"
              name="authorPersonId"
              defaultValue={filterAuthorPersonId}
              className="w-44 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All authors</option>
              {filterPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-readinessIndicator" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Readiness indicator
            </label>
            <select
              id="filter-readinessIndicator"
              name="readinessIndicator"
              defaultValue={readinessIndicatorFilter}
              className="w-52 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All readiness indicators</option>
              <option value="recently_active">Recently active</option>
              <option value="stale">Stale</option>
              <option value="needs_review">Needs review</option>
              <option value="unresolved_too_long">Unresolved too long</option>
              <option value="upcoming_operational_concern">Upcoming operational concern</option>
            </select>
          </div>

          {canViewGuardianRelationshipDetails ? (
            <div className="space-y-1">
              <label htmlFor="filter-guardianContext" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Guardian context
              </label>
              <select
                id="filter-guardianContext"
                name="guardianContext"
                defaultValue={guardianContextFilter}
                className="w-52 rounded-md border px-2 py-1.5 text-sm"
              >
                <option value="">All guardian contexts</option>
                <option value="guardian_linked">Guardian-linked athlete</option>
                <option value="missing_guardian_linkage">Athlete missing guardian linkage</option>
                <option value="inactive_guardian_account">Inactive guardian account signal</option>
              </select>
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Apply
            </button>
            {hasActiveFilters ? (
              <Link href="/notes" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Clear
              </Link>
            ) : null}
          </div>
        </div>

        {activeFilterLabels.length > 0 ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Filtered by: {activeFilterLabels.join(" · ")}
          </p>
        ) : null}
      </form>

      {filteredNotes.length === 0 ? (
        <EmptyState
          message={
            hasActiveFilters
              ? "No notes match the selected filters."
              : "No observation notes have been recorded yet."
          }
          actionHref={hasActiveFilters ? "/notes" : "/notes/new"}
          actionLabel={hasActiveFilters ? "Clear filters" : "Record the first note"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 font-medium">Athlete / Person</th>
                <th className="px-4 py-3 font-medium">Guardian context</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Operational indicator</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.map((note) => {
                const unresolvedTaskCount = note.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
                const hasUnresolvedFollowUp = unresolvedTaskCount > 0;
                const isStale = note.updatedAt.getTime() < staleCutoff.getTime();
                const isRecentlyActive = note.updatedAt.getTime() >= recentlyActiveCutoff.getTime();
                const hasUpcomingEventContext = Boolean(
                  note.event &&
                    note.event.startsAt.getTime() >= now.getTime() &&
                    note.event.startsAt.getTime() <= upcomingEventCutoff.getTime(),
                );
                const hasUpcomingOperationalConcern = hasUpcomingEventContext && hasUnresolvedFollowUp;
                const unresolvedTooLong = hasUnresolvedFollowUp && isStale;
                const needsReview = hasUnresolvedFollowUp || isStale;
                const isContextFree = !note.athlete && !note.team && !note.event;

                return (
                  <tr key={note.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/notes/${note.id}`} className="underline">
                        {note.body.length > 80 ? `${note.body.slice(0, 80)}…` : note.body}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/people/${note.author.id}`} className="underline">
                        {note.author.firstName} {note.author.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(note.createdAt)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(note.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <VisibilityBadge visibility={note.visibility} />
                    </td>
                    <td className="px-4 py-3">
                      {note.athlete ? (
                        <Link href={`/people/${note.athlete.id}`} className="underline">
                          {note.athlete.firstName} {note.athlete.lastName}
                        </Link>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!note.athlete ? (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      ) : canViewGuardianRelationshipDetails ? (
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {formatGuardianOperationalIndicator(
                            deriveGuardianOperationalContext(note.athlete.athleteLinks ?? []),
                          )}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">Staff-only</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {note.team ? (
                        <Link href={`/teams/${note.team.id}`} className="underline">
                          {note.team.name}
                        </Link>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {note.event ? (
                        <Link href={`/events/${note.event.id}`} className="underline">
                          {note.event.title}
                        </Link>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {isContextFree ? (
                          <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                            No context
                          </span>
                        ) : null}
                        {isRecentlyActive ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            Recently active
                          </span>
                        ) : null}
                        {isStale ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Stale
                          </span>
                        ) : null}
                        {needsReview ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Needs review
                          </span>
                        ) : null}
                        {unresolvedTooLong ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                            Unresolved too long
                          </span>
                        ) : null}
                        {hasUpcomingOperationalConcern ? (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                            Upcoming operational concern
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Unresolved linked tasks: {unresolvedTaskCount}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
        <strong className="font-medium">Future scope (deferred):</strong> A unified Entry/Inbox model is planned to consolidate notes, tasks, and other capture types into a single workflow. Inbox routing, feed behavior, journal entries, and messaging are intentionally not implemented yet. Current notes use the <code>ObservationNote</code> model.
      </div>
    </section>
  );
}
