import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewFocusPanel } from "@/components/dashboard/review-focus-panel";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

type SearchParams = Record<string, string | string[] | undefined>;

type AttendanceCoverage = "complete" | "partial" | "missing" | "captured" | "not_applicable";

export const dynamic = "force-dynamic";
const STALE_CONCERN_WINDOW_DAYS = 14;
const RECENT_ACTIVITY_WINDOW_HOURS = 72;
const UPCOMING_CONCERN_LOOKAHEAD_DAYS = 14;
const UPCOMING_RISK_LOOKAHEAD_DAYS = 7;
const ATTENDANCE_REVIEW_STALE_DAYS = 7;

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function getAttendanceCoverage(
  expectedAttendanceCount: number,
  capturedAttendanceCount: number,
  missingAttendanceCount: number,
): AttendanceCoverage {
  if (expectedAttendanceCount === 0) {
    return capturedAttendanceCount > 0 ? "captured" : "not_applicable";
  }

  if (capturedAttendanceCount === 0) {
    return "missing";
  }

  if (missingAttendanceCount > 0) {
    return "partial";
  }

  return "complete";
}

function getCoverageLabel(value: AttendanceCoverage) {
  if (value === "not_applicable") {
    return "Not expected";
  }

  return formatEnumLabel(value);
}

function getCoverageBadgeClassName(value: AttendanceCoverage) {
  if (value === "complete" || value === "captured") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  }

  if (value === "partial") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  }

  if (value === "missing") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }

  return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query events right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const statusFilter = readSearchParam(resolvedSearchParams, "status");
  const teamIdFilter = readSearchParam(resolvedSearchParams, "teamId");
  const ownerPersonIdFilter = readSearchParam(resolvedSearchParams, "ownerPersonId");
  const attendanceFilterParam = readSearchParam(resolvedSearchParams, "attendance");
  const attendanceFilter =
    attendanceFilterParam === "complete" ||
    attendanceFilterParam === "partial" ||
    attendanceFilterParam === "missing" ||
    attendanceFilterParam === "captured" ||
    attendanceFilterParam === "not_applicable"
      ? (attendanceFilterParam as AttendanceCoverage)
      : "";
  const linkFilterParam = readSearchParam(resolvedSearchParams, "links");
  const linkFilter =
    linkFilterParam === "notes" ||
    linkFilterParam === "tasks" ||
    linkFilterParam === "notes_or_tasks" ||
    linkFilterParam === "follow_up_required"
      ? linkFilterParam
      : "";
  const accountabilityFilterParam = readSearchParam(resolvedSearchParams, "accountability");
  const accountabilityFilter =
    accountabilityFilterParam === "unresolved_follow_up" || accountabilityFilterParam === "missing_responsible_team"
      ? accountabilityFilterParam
      : "";
  const operationalIndicatorParam = readSearchParam(resolvedSearchParams, "operationalIndicator");
  const operationalIndicatorFilter =
    operationalIndicatorParam === "recently_active" ||
    operationalIndicatorParam === "stale" ||
    operationalIndicatorParam === "needs_review" ||
    operationalIndicatorParam === "unresolved_too_long" ||
    operationalIndicatorParam === "upcoming_operational_concern" ||
    operationalIndicatorParam === "upcoming_operational_risk" ||
    operationalIndicatorParam === "attendance_not_reviewed_recently"
      ? operationalIndicatorParam
      : "";

  let events:
    | Array<{
        id: string;
        title: string;
        eventType: string;
        status: string;
        startsAt: Date;
        updatedAt: Date;
        endsAt: Date | null;
        location: string | null;
        createdBy: { id: string; firstName: string; lastName: string };
        program: { id: string; name: string };
        team: { id: string; name: string; roster: Array<{ personId: string }> } | null;
        _count: { attendance: number; notes: number; tasks: number };
        tasks: Array<{ status: string }>;
      }>
    | null = null;
  let teams: Array<{ id: string; name: string }> = [];
  let people: Array<{ id: string; firstName: string; lastName: string }> = [];

  try {
    const now = new Date();
    const [fetchedEvents, fetchedTeams, fetchedPeople] = await Promise.all([
      db.event.findMany({
        where: {
          organizationId: scope.organizationId,
          ...(statusFilter ? { status: statusFilter as never } : {}),
          ...(teamIdFilter ? { teamId: teamIdFilter } : {}),
          ...(ownerPersonIdFilter ? { createdByPersonId: ownerPersonIdFilter } : {}),
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          program: { select: { id: true, name: true } },
          team: {
            select: {
              id: true,
              name: true,
              roster: {
                where: { organizationId: scope.organizationId },
                select: { personId: true },
              },
            },
          },
          _count: {
            select: {
              attendance: true,
              notes: true,
              tasks: true,
            },
          },
          tasks: {
            select: { status: true },
          },
        },
        orderBy: [
          {
            startsAt: "desc",
          },
        ],
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
    ]);

    const upcomingEvents = fetchedEvents
      .filter((event) => event.startsAt >= now)
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
    const pastEvents = fetchedEvents
      .filter((event) => event.startsAt < now)
      .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());

    events = [...upcomingEvents, ...pastEvents];
    teams = fetchedTeams;
    people = fetchedPeople;
  } catch {
    events = null;
  }

  if (!events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <ErrorMessage message="Unable to load events right now. Please try again later." />
      </section>
    );
  }

  const displayedEvents = events.filter((event) => {
    const now = new Date();
    const staleConcernCutoff = new Date(now.getTime() - STALE_CONCERN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentActivityCutoff = new Date(now.getTime() - RECENT_ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000);
    const upcomingConcernCutoff = new Date(now.getTime() + UPCOMING_CONCERN_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const upcomingRiskCutoff = new Date(now.getTime() + UPCOMING_RISK_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const attendanceReviewStaleCutoff = new Date(now.getTime() - ATTENDANCE_REVIEW_STALE_DAYS * 24 * 60 * 60 * 1000);
    const expectedAttendanceCount = new Set(event.team?.roster.map((membership) => membership.personId) ?? []).size;
    const capturedAttendanceCount = event._count.attendance;
    const missingAttendanceCount = Math.max(expectedAttendanceCount - capturedAttendanceCount, 0);
    const attendanceCoverage = getAttendanceCoverage(
      expectedAttendanceCount,
      capturedAttendanceCount,
      missingAttendanceCount,
    );
    const openTaskCount = event.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
    const followUpRequired = missingAttendanceCount > 0 || openTaskCount > 0;
    const hasAttendanceNeedingReview = expectedAttendanceCount > 0 && missingAttendanceCount > 0;
    const attendanceNotReviewedRecently =
      hasAttendanceNeedingReview && event.startsAt.getTime() < attendanceReviewStaleCutoff.getTime();
    const recentlyActive = event.updatedAt.getTime() >= recentActivityCutoff.getTime();
    const stale = followUpRequired && event.updatedAt.getTime() < staleConcernCutoff.getTime();
    const needsReview = followUpRequired || attendanceNotReviewedRecently;
    const unresolvedTooLong = followUpRequired && stale;
    const upcomingOperationalConcern =
      followUpRequired &&
      event.startsAt.getTime() >= now.getTime() &&
      event.startsAt.getTime() <= upcomingConcernCutoff.getTime();
    // upcoming_operational_risk = upcoming within 7 days AND has unresolved follow-up (higher urgency than concern)
    const upcomingOperationalRisk =
      followUpRequired &&
      event.startsAt.getTime() >= now.getTime() &&
      event.startsAt.getTime() <= upcomingRiskCutoff.getTime();

    if (attendanceFilter && attendanceCoverage !== attendanceFilter) {
      return false;
    }

    if (linkFilter === "notes" && event._count.notes === 0) {
      return false;
    }

    if (linkFilter === "tasks" && event._count.tasks === 0) {
      return false;
    }

    if (linkFilter === "notes_or_tasks" && event._count.notes === 0 && event._count.tasks === 0) {
      return false;
    }

    if (linkFilter === "follow_up_required" && missingAttendanceCount === 0 && openTaskCount === 0) {
      return false;
    }

    if (accountabilityFilter === "unresolved_follow_up" && !followUpRequired) {
      return false;
    }

    if (accountabilityFilter === "missing_responsible_team" && (event.team || !followUpRequired)) {
      return false;
    }
    if (operationalIndicatorFilter === "recently_active" && !recentlyActive) {
      return false;
    }
    if (operationalIndicatorFilter === "stale" && !stale) {
      return false;
    }
    if (operationalIndicatorFilter === "needs_review" && !needsReview) {
      return false;
    }
    if (operationalIndicatorFilter === "unresolved_too_long" && !unresolvedTooLong) {
      return false;
    }
    if (operationalIndicatorFilter === "upcoming_operational_concern" && !upcomingOperationalConcern) {
      return false;
    }
    if (operationalIndicatorFilter === "upcoming_operational_risk" && !upcomingOperationalRisk) {
      return false;
    }
    if (operationalIndicatorFilter === "attendance_not_reviewed_recently" && !attendanceNotReviewedRecently) {
      return false;
    }

    return true;
  });

  const hasActiveFilters = Boolean(
    statusFilter ||
      teamIdFilter ||
      ownerPersonIdFilter ||
      attendanceFilter ||
      linkFilter ||
      accountabilityFilter ||
      operationalIndicatorFilter,
  );
  const activeFilterLabels: string[] = [];

  if (statusFilter) {
    activeFilterLabels.push(`Status: ${formatEnumLabel(statusFilter)}`);
  }
  if (teamIdFilter) {
    const team = teams.find((value) => value.id === teamIdFilter);
    if (team) {
      activeFilterLabels.push(`Team: ${team.name}`);
    }
  }
  if (ownerPersonIdFilter) {
    const person = people.find((value) => value.id === ownerPersonIdFilter);
    if (person) {
      activeFilterLabels.push(`Responsible person: ${person.firstName} ${person.lastName}`);
    }
  }
  if (attendanceFilter) {
    activeFilterLabels.push(`Attendance: ${getCoverageLabel(attendanceFilter)}`);
  }
  if (linkFilter) {
    const labelByFilter: Record<string, string> = {
      notes: "Linked context: notes",
      tasks: "Linked context: tasks",
      notes_or_tasks: "Linked context: notes or tasks",
      follow_up_required: "Linked context: follow-up required",
    };
    activeFilterLabels.push(labelByFilter[linkFilter] ?? linkFilter);
  }
  if (accountabilityFilter) {
    const labelByFilter: Record<string, string> = {
      unresolved_follow_up: "Accountability: unresolved follow-up",
      missing_responsible_team: "Accountability: missing responsible team",
    };
    activeFilterLabels.push(labelByFilter[accountabilityFilter] ?? accountabilityFilter);
  }
  if (operationalIndicatorFilter) {
    const labelByFilter: Record<string, string> = {
      recently_active: "Operational indicator: recently active",
      stale: "Operational indicator: stale",
      needs_review: "Operational indicator: needs review",
      unresolved_too_long: "Operational indicator: unresolved too long",
      upcoming_operational_concern: "Operational indicator: upcoming concern",
      upcoming_operational_risk: "Operational indicator: upcoming risk",
      attendance_not_reviewed_recently: "Operational indicator: attendance not reviewed recently",
    };
    activeFilterLabels.push(labelByFilter[operationalIndicatorFilter] ?? operationalIndicatorFilter);
  }

  const eventReviewEntries = displayedEvents.map((event) => {
    const now = new Date();
    const staleConcernCutoff = new Date(now.getTime() - STALE_CONCERN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentActivityCutoff = new Date(now.getTime() - RECENT_ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000);
    const upcomingConcernCutoff = new Date(now.getTime() + UPCOMING_CONCERN_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const upcomingRiskCutoff = new Date(now.getTime() + UPCOMING_RISK_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const attendanceReviewStaleCutoff = new Date(now.getTime() - ATTENDANCE_REVIEW_STALE_DAYS * 24 * 60 * 60 * 1000);
    const expectedAttendanceCount = new Set(event.team?.roster.map((membership) => membership.personId) ?? []).size;
    const capturedAttendanceCount = event._count.attendance;
    const missingAttendanceCount = Math.max(expectedAttendanceCount - capturedAttendanceCount, 0);
    const openTaskCount = event.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
    const followUpRequired = missingAttendanceCount > 0 || openTaskCount > 0;
    const attendanceNotReviewedRecently =
      expectedAttendanceCount > 0 &&
      missingAttendanceCount > 0 &&
      event.startsAt.getTime() < attendanceReviewStaleCutoff.getTime();

    return {
      followUpRequired,
      attendanceNotReviewedRecently,
      recentlyActive: event.updatedAt.getTime() >= recentActivityCutoff.getTime(),
      stale: followUpRequired && event.updatedAt.getTime() < staleConcernCutoff.getTime(),
      upcomingOperationalConcern:
        followUpRequired &&
        event.startsAt.getTime() >= now.getTime() &&
        event.startsAt.getTime() <= upcomingConcernCutoff.getTime(),
      upcomingOperationalRisk:
        followUpRequired &&
        event.startsAt.getTime() >= now.getTime() &&
        event.startsAt.getTime() <= upcomingRiskCutoff.getTime(),
    };
  });
  const followUpRequiredCount = eventReviewEntries.filter((entry) => entry.followUpRequired).length;
  const staleEventCount = eventReviewEntries.filter((entry) => entry.stale).length;
  const recentEventCount = eventReviewEntries.filter((entry) => entry.recentlyActive).length;
  const upcomingConcernCount = eventReviewEntries.filter((entry) => entry.upcomingOperationalConcern).length;
  const upcomingRiskCount = eventReviewEntries.filter((entry) => entry.upcomingOperationalRisk).length;
  const attendanceReviewCount = eventReviewEntries.filter((entry) => entry.attendanceNotReviewedRecently).length;
  const buildEventsHref = (overrides: Record<string, string>) =>
    buildHref("/events", {
      status: statusFilter,
      teamId: teamIdFilter,
      ownerPersonId: ownerPersonIdFilter,
      attendance: attendanceFilter,
      links: linkFilter,
      accountability: accountabilityFilter,
      operationalIndicator: operationalIndicatorFilter,
      ...overrides,
    });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Events"
        description="Schedule events, capture attendance, and review linked notes and follow-up tasks."
        actions={
          <Link href="/events/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New event
          </Link>
        }
      />

      <ReviewFocusPanel
        title="Operational review focus"
        description="Review events by unresolved follow-up, attendance coverage, recent change, and upcoming readiness risk while preserving the current event scope."
        activeFilters={activeFilterLabels}
        defaultScope="No filters are active. Review spans all events in the current organization."
        stats={[
          {
            label: "Events in current scope",
            value: displayedEvents.length,
            href: hasActiveFilters ? buildEventsHref({}) : "/events",
          },
          {
            label: "Unresolved follow-up",
            value: followUpRequiredCount,
            href: buildEventsHref({ links: "follow_up_required", accountability: "unresolved_follow_up" }),
            tone: followUpRequiredCount > 0 ? "warning" : "success",
          },
          {
            label: "Attendance review",
            value: attendanceReviewCount,
            href: buildEventsHref({ operationalIndicator: "attendance_not_reviewed_recently" }),
            tone: attendanceReviewCount > 0 ? "danger" : "success",
          },
          {
            label: "Upcoming risk",
            value: upcomingRiskCount,
            href: buildEventsHref({ operationalIndicator: "upcoming_operational_risk" }),
            tone: upcomingRiskCount > 0 ? "danger" : "success",
          },
          {
            label: "Upcoming concern",
            value: upcomingConcernCount,
            href: buildEventsHref({ operationalIndicator: "upcoming_operational_concern" }),
            tone: upcomingConcernCount > 0 ? "warning" : "neutral",
          },
          {
            label: "Recently active",
            value: recentEventCount,
            href: buildEventsHref({ operationalIndicator: "recently_active" }),
            tone: recentEventCount > 0 ? "info" : "neutral",
          },
          {
            label: "Stale",
            value: staleEventCount,
            href: buildEventsHref({ operationalIndicator: "stale" }),
            tone: staleEventCount > 0 ? "warning" : "neutral",
          },
        ]}
        links={[
          {
            label: "Unresolved follow-up in current scope",
            href: buildEventsHref({ links: "follow_up_required", accountability: "unresolved_follow_up" }),
          },
          { label: "Attendance review lane", href: buildEventsHref({ operationalIndicator: "attendance_not_reviewed_recently" }) },
          { label: "Upcoming risk lane", href: buildEventsHref({ operationalIndicator: "upcoming_operational_risk" }) },
          { label: "Recent event changes", href: buildEventsHref({ operationalIndicator: "recently_active" }) },
        ]}
        guidance="Event readiness cues are derived from existing event timing, attendance capture, and linked task data only. No orchestration, reminders, or notifications are added."
      />

      <form method="GET" className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
        <div className="grid gap-3 md:grid-cols-7">
          <div className="space-y-1">
            <label htmlFor="status" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Status
            </label>
            <select id="status" name="status" defaultValue={statusFilter} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="teamId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Team
            </label>
            <select id="teamId" name="teamId" defaultValue={teamIdFilter} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="ownerPersonId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Responsible person
            </label>
            <select
              id="ownerPersonId"
              name="ownerPersonId"
              defaultValue={ownerPersonIdFilter}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All responsible people</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="attendance" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Attendance capture
            </label>
            <select id="attendance" name="attendance" defaultValue={attendanceFilter} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">All attendance states</option>
              <option value="complete">Complete</option>
              <option value="partial">Partial</option>
              <option value="missing">Missing</option>
              <option value="captured">Captured (no team roster expectation)</option>
              <option value="not_applicable">Not expected (no team roster)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="links" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Linked context
            </label>
            <select id="links" name="links" defaultValue={linkFilter} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">All link states</option>
              <option value="notes">Has linked notes</option>
              <option value="tasks">Has linked tasks</option>
              <option value="notes_or_tasks">Has linked notes or tasks</option>
              <option value="follow_up_required">Follow-up required</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="accountability" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Accountability
            </label>
            <select
              id="accountability"
              name="accountability"
              defaultValue={accountabilityFilter}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All accountability states</option>
              <option value="unresolved_follow_up">Unresolved event follow-up</option>
              <option value="missing_responsible_team">Missing responsible team context</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="operationalIndicator" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Operational indicator
            </label>
            <select
              id="operationalIndicator"
              name="operationalIndicator"
              defaultValue={operationalIndicatorFilter}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All operational indicators</option>
              <option value="recently_active">Recently active</option>
              <option value="stale">Stale</option>
              <option value="needs_review">Needs review</option>
              <option value="unresolved_too_long">Unresolved too long</option>
              <option value="upcoming_operational_risk">Upcoming operational risk (within 7 days)</option>
              <option value="upcoming_operational_concern">Upcoming operational concern (within 14 days)</option>
              <option value="attendance_not_reviewed_recently">Attendance not reviewed recently</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Apply
          </button>
          {hasActiveFilters ? (
            <Link href="/events" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {displayedEvents.length === 0 ? (
        <EmptyState
          message={
            hasActiveFilters
              ? "No events match the selected filters."
              : "No events have been scheduled yet."
          }
          actionHref={hasActiveFilters ? "/events" : "/events/new"}
          actionLabel={hasActiveFilters ? "Clear filters" : "Schedule the first event"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Responsible person</th>
                <th className="px-4 py-3 font-medium">Attendance</th>
                <th className="px-4 py-3 font-medium">Notes / Tasks</th>
                <th className="px-4 py-3 font-medium">Operational indicator</th>
              </tr>
            </thead>
            <tbody>
              {displayedEvents.map((event) => {
                const now = new Date();
                const staleConcernCutoff = new Date(now.getTime() - STALE_CONCERN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
                const recentActivityCutoff = new Date(now.getTime() - RECENT_ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000);
                const upcomingConcernCutoff = new Date(now.getTime() + UPCOMING_CONCERN_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
                const upcomingRiskCutoff = new Date(now.getTime() + UPCOMING_RISK_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
                const attendanceReviewStaleCutoff = new Date(now.getTime() - ATTENDANCE_REVIEW_STALE_DAYS * 24 * 60 * 60 * 1000);
                const expectedAttendanceCount = new Set(event.team?.roster.map((membership) => membership.personId) ?? []).size;
                const capturedAttendanceCount = event._count.attendance;
                const missingAttendanceCount = Math.max(expectedAttendanceCount - capturedAttendanceCount, 0);
                const attendanceCoverage = getAttendanceCoverage(
                  expectedAttendanceCount,
                  capturedAttendanceCount,
                  missingAttendanceCount,
                );
                const openTaskCount = event.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
                const followUpRequired = missingAttendanceCount > 0 || openTaskCount > 0;
                const hasAttendanceNeedingReview = expectedAttendanceCount > 0 && missingAttendanceCount > 0;
                const attendanceNotReviewedRecently =
                  hasAttendanceNeedingReview && event.startsAt.getTime() < attendanceReviewStaleCutoff.getTime();
                const recentlyActive = event.updatedAt.getTime() >= recentActivityCutoff.getTime();
                const stale = followUpRequired && event.updatedAt.getTime() < staleConcernCutoff.getTime();
                const needsReview = followUpRequired || attendanceNotReviewedRecently;
                const unresolvedTooLong = followUpRequired && stale;
                const upcomingOperationalRisk =
                  followUpRequired &&
                  event.startsAt.getTime() >= now.getTime() &&
                  event.startsAt.getTime() <= upcomingRiskCutoff.getTime();
                const upcomingOperationalConcern =
                  followUpRequired &&
                  event.startsAt.getTime() >= now.getTime() &&
                  event.startsAt.getTime() <= upcomingConcernCutoff.getTime();

                return (
                  <tr key={event.id} className="border-b align-top last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/events/${event.id}`} className="underline">
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatEnumLabel(event.eventType)}</td>
                    <td className="px-4 py-3">{formatEnumLabel(event.status)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(event.startsAt)}</td>
                    <td className="px-4 py-3">{event.program.name}</td>
                    <td className="px-4 py-3">{event.team?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/people/${event.createdBy.id}`} className="underline">
                        {event.createdBy.firstName} {event.createdBy.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCoverageBadgeClassName(attendanceCoverage)}`}
                      >
                        {getCoverageLabel(attendanceCoverage)}
                      </span>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        Captured: {capturedAttendanceCount}
                        {expectedAttendanceCount > 0
                          ? ` · Missing: ${missingAttendanceCount} · Expected: ${expectedAttendanceCount}`
                          : " · No team roster expectation"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      Notes: {event._count.notes} · Tasks: {event._count.tasks}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {upcomingOperationalRisk ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                            Upcoming operational risk
                          </span>
                        ) : null}
                        {followUpRequired ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Unresolved follow-up
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Operationally clear
                          </span>
                        )}
                        {followUpRequired && !event.team ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                            Missing responsible team
                          </span>
                        ) : null}
                        {recentlyActive ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            Recently active
                          </span>
                        ) : null}
                        {stale ? (
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
                        {upcomingOperationalConcern && !upcomingOperationalRisk ? (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                            Upcoming operational concern
                          </span>
                        ) : null}
                        {attendanceNotReviewedRecently ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                            Attendance not reviewed recently
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
