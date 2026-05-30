import Link from "next/link";
import {
  EntryObjectLinkTargetType,
  EntryPriority,
  Prisma,
  EntryStatus,
  EntryType,
  OperationalGraphNodeType,
  OperationalRelationshipType,
} from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { EventEntryMetadataFields } from "@/components/dashboard/event-entry-metadata-fields";
import { db } from "@/lib/db";
import { getEntryDetailConfig } from "@/lib/entries/detail-config";
import {
  DECISION_CLASSIFICATION_VALUES,
  DECISION_MATURITY_RESULT_VALUES,
  formatDecisionParticipantNames,
  parseDecisionEntryPayload,
} from "@/lib/entries/decision-payload";
import {
  DEFAULT_EVENT_TIMEZONE,
  normalizeEventTimezone,
  parseEventEntryPayload,
} from "@/lib/entries/event-payload";
import { fetchListsForActor, labelForEntryListScope } from "@/lib/entries/lists";
import {
  ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE,
  ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE,
  getEntryListSchemaIssue,
  getEntryTypePayloadSchemaIssue,
  logEntryListSchemaIssue,
  logEntryTypePayloadSchemaIssue,
} from "@/lib/entries/schema-guard";
import {
  labelForEntryObjectLinkTargetType,
  resolveEntryObjectLinkViews,
} from "@/lib/entries/object-links";
import { USER_SELECTABLE_ENTRY_TYPES } from "@/lib/entries/user-selectable-types";
import { formatEnumLabel, getTaskStatusBadgeClassName, isTaskOverdue } from "@/lib/follow-up-tasks";
import { labelForActivityAction } from "@/lib/operational-feed/render";
import {
  labelForOperationalNodeType,
  labelForOperationalRelationshipType,
  listRelatedOperationalRecords,
} from "@/lib/operational-graph";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

const EVENT_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE =
  "Event metadata is temporarily unavailable until setup is complete.";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function formatPersonName(person: { firstName: string; lastName: string } | null | undefined) {
  if (!person) return "—";
  const fullName = `${person.firstName} ${person.lastName}`.trim();
  return fullName || "—";
}

function summarizeEntryActivityMetadata(metadataJson: string | null) {
  if (!metadataJson) return [];
  try {
    const parsed = JSON.parse(metadataJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const metadata = parsed as Record<string, unknown>;
    const details: string[] = [];

    if (typeof metadata.fromStatus === "string" && typeof metadata.toStatus === "string") {
      details.push(`Status ${formatEnumLabel(metadata.fromStatus)} → ${formatEnumLabel(metadata.toStatus)}`);
    } else if (typeof metadata.changedStatus === "string") {
      details.push(`Status ${formatEnumLabel(metadata.changedStatus)}`);
    }
    if (typeof metadata.targetType === "string") {
      details.push(`Target type ${formatEnumLabel(metadata.targetType)}`);
    }
    if (typeof metadata.changedType === "string") {
      details.push(`Type changed to ${formatEnumLabel(metadata.changedType)}`);
    }
    if (typeof metadata.relationshipType === "string") {
      details.push(`Relationship ${formatEnumLabel(metadata.relationshipType)}`);
    }
    if (typeof metadata.captureType === "string") {
      details.push(`Capture ${formatEnumLabel(metadata.captureType)}`);
    }
    if (typeof metadata.entryType === "string") {
      details.push(`Entry type ${formatEnumLabel(metadata.entryType)}`);
    }
    if (metadata.followUpEntryId || metadata.followUpTaskId) {
      details.push("Follow-up link recorded");
    }
    if (typeof metadata.selectedTextLength === "number") {
      details.push(`Selection length ${metadata.selectedTextLength}`);
    }
    if (metadata.personId || metadata.assignedToPersonId) {
      details.push("Assignment updated");
    }
    if (typeof metadata.changedPriority === "string") {
      details.push(`Priority changed to ${formatEnumLabel(metadata.changedPriority)}`);
    }

    return details.slice(0, 3);
  } catch {
    return [];
  }
}

const entryBaseSelect = Prisma.validator<Prisma.EntryFindFirstArgs>()({
  select: {
    id: true,
    type: true,
    title: true,
    content: true,
    tags: true,
    status: true,
    priority: true,
    dueDate: true,
    dueTime: true,
    startDate: true,
    endDate: true,
    timezone: true,
    taskCompleted: true,
    createdAt: true,
    updatedAt: true,
    sourceTaskId: true,
    sourceNoteId: true,
    assignedToPersonId: true,
    createdBy: { select: { firstName: true, lastName: true } },
    updatedBy: { select: { firstName: true, lastName: true } },
    assignedTo: { select: { firstName: true, lastName: true } },
    objectLinks: {
      orderBy: { createdAt: "desc" },
      select: { id: true, targetType: true, targetId: true, createdAt: true },
      take: 40,
    },
    linkedFrom: {
      select: {
        id: true,
        fromEntryId: true,
        toEntryId: true,
        toEntry: { select: { id: true, title: true, type: true, deletedAt: true } },
      },
      take: 40,
    },
    linkedTo: {
      select: {
        id: true,
        fromEntryId: true,
        toEntryId: true,
        fromEntry: { select: { id: true, title: true, type: true, deletedAt: true } },
      },
      take: 40,
    },
    activity: {
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        metadataJson: true,
        createdAt: true,
        actor: { select: { firstName: true, lastName: true } },
      },
      take: 40,
    },
  },
});

const entryDetailSelect = Prisma.validator<Prisma.EntryFindFirstArgs>()({
  select: {
    ...entryBaseSelect.select,
    typePayloads: {
      where: { entryType: { in: [EntryType.DECISION, EntryType.EVENT] } },
      select: { entryType: true, payloadJson: true, isActive: true },
      take: 2,
      orderBy: { updatedAt: "desc" },
    },
    listId: true,
  },
});

type EntryDetailRecord = Prisma.EntryGetPayload<typeof entryDetailSelect>;
type EntryBaseRecord = Prisma.EntryGetPayload<typeof entryBaseSelect>;
type EntryBaseWithListIdRecord = EntryBaseRecord & { listId: string | null };

function withUnavailableList(entry: EntryBaseRecord): EntryDetailRecord {
  return {
    ...entry,
    typePayloads: [],
    listId: null,
  };
}

function withUnavailableDecisionPayload(entry: EntryBaseWithListIdRecord): EntryDetailRecord {
  return {
    ...entry,
    typePayloads: [],
  };
}

function buildFallbackEntrySelect(hasListSchemaIssue: boolean, hasDecisionSchemaIssue: boolean) {
  const shouldIncludeListId = !hasListSchemaIssue;

  // When either schema dependency is unavailable, always use the base projection
  // (which intentionally excludes typePayloads) and only include listId when safe.
  if (hasListSchemaIssue || hasDecisionSchemaIssue) {
    return {
      ...entryBaseSelect.select,
      ...(shouldIncludeListId ? { listId: true } : {}),
    };
  }

  return {
    ...entryBaseSelect.select,
    listId: true,
  };
}

function normalizeFallbackEntryRecord(
  entry: EntryBaseRecord | EntryBaseWithListIdRecord | null,
  hasListSchemaIssue: boolean,
  hasDecisionSchemaIssue: boolean,
): EntryDetailRecord | null {
  if (!entry) {
    return null;
  }

  if (hasListSchemaIssue) {
    return withUnavailableList(entry as EntryBaseRecord);
  }

  if (hasDecisionSchemaIssue) {
    return withUnavailableDecisionPayload(entry as EntryBaseWithListIdRecord);
  }

  return entry as EntryDetailRecord;
}

async function fetchEntryDetailRecord(
  organizationId: string,
  entryId: string,
): Promise<{ entry: EntryDetailRecord | null; listAssignmentUnavailable: boolean; decisionPayloadUnavailable: boolean }> {
  try {
    const entry = await db.entry.findFirst({
      where: { id: entryId, organizationId, deletedAt: null },
      select: entryDetailSelect.select,
    });

    return {
      entry,
      listAssignmentUnavailable: false,
      decisionPayloadUnavailable: false,
    };
  } catch (error) {
    const listSchemaIssue = getEntryListSchemaIssue(error);
    const decisionSchemaIssue = getEntryTypePayloadSchemaIssue(error);

    if (!listSchemaIssue && !decisionSchemaIssue) {
      throw error;
    }

    if (listSchemaIssue) {
      logEntryListSchemaIssue("entries.detail.fetch-entry", error, { organizationId, entryId });
    }
    if (decisionSchemaIssue) {
      logEntryTypePayloadSchemaIssue("entries.detail.fetch-entry", error, { organizationId, entryId });
    }

    const hasListSchemaIssue = Boolean(listSchemaIssue);
    const hasDecisionSchemaIssue = Boolean(decisionSchemaIssue);

    const entry = await db.entry.findFirst({
      where: { id: entryId, organizationId, deletedAt: null },
      select: buildFallbackEntrySelect(hasListSchemaIssue, hasDecisionSchemaIssue),
    });

    return {
      entry: normalizeFallbackEntryRecord(entry, hasListSchemaIssue, hasDecisionSchemaIssue),
      listAssignmentUnavailable: hasListSchemaIssue,
      decisionPayloadUnavailable: hasDecisionSchemaIssue,
    };
  }
}

type SearchParams = Record<string, string | string[] | undefined>;
// Includes legacy/internal labels so existing non-user-selectable entries can be shown safely if already persisted.
const ENTRY_TYPE_OPTION_LABELS: Record<EntryType, string> = {
  [EntryType.TASK]: "Task",
  [EntryType.NOTE]: "Note",
  [EntryType.EVENT]: "Event",
  [EntryType.DECISION]: "Decision",
  [EntryType.HABIT]: "Habit",
  [EntryType.JOURNAL]: "Journal Entry",
  [EntryType.OBSERVATION]: "Observation",
  [EntryType.FOLLOW_UP]: "Follow-up",
  [EntryType.ACTIVITY]: "Activity",
  [EntryType.READINESS_ITEM]: "Readiness Item",
};

export default async function EntryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { entryId } = await params;
  const resolvedSearchParams = await searchParams;
  const routeError = Array.isArray(resolvedSearchParams.error) ? resolvedSearchParams.error[0] : resolvedSearchParams.error;
  const savedParam = Array.isArray(resolvedSearchParams.saved) ? resolvedSearchParams.saved[0] : resolvedSearchParams.saved;
  const warningParam = Array.isArray(resolvedSearchParams.warning) ? resolvedSearchParams.warning[0] : resolvedSearchParams.warning;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load entry details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry</h2>
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }
  const organizationId = scope.organizationId;

  const entryAccess = await resolveEntryAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canReadEntry = entryAccess.level !== "NONE";
  const canEditEntry = entryAccess.level === "WRITE" || entryAccess.level === "MANAGE";

  if (!canReadEntry) {
    return (
      <section className="space-y-4">
        <BackLink href="/entries" label="All entries" />
        <h2 className="text-2xl font-semibold tracking-tight">Entry</h2>
        <ErrorMessage message="You do not have permission to view entry details in this organization." />
      </section>
    );
  }

  const entryResult = await fetchEntryDetailRecord(organizationId, entryId);
  const entry = entryResult.entry;
  let listAssignmentUnavailable = entryResult.listAssignmentUnavailable;
  const decisionPayloadUnavailable = entryResult.decisionPayloadUnavailable;

  if (!entry) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry</h2>
        <ErrorMessage message="Entry not found in the active organization." />
      </section>
    );
  }

  const [relatedItems, objectLinkViews] = await Promise.all([
    listRelatedOperationalRecords({
      organizationId,
      node: { nodeType: "ENTRY", nodeId: entry.id },
      limit: 30,
    }),
    resolveEntryObjectLinkViews({
      organizationId,
      links: entry.objectLinks,
      canViewTargetDetails: canReadEntry,
    }),
  ]);
  const [followUpEntries, people, programs, teams] = await Promise.all([
    db.entry.findMany({
      where: {
        organizationId,
        parentEntryId: entry.id,
        deletedAt: null,
        sourceTaskId: { not: null },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        dueTime: true,
        sourceTaskId: true,
        sourceTask: {
          select: {
            id: true,
            status: true,
            dueAt: true,
            assignee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    canEditEntry
      ? db.person.findMany({
          where: { organizationId },
          select: { id: true, firstName: true, lastName: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
      : Promise.resolve([]),
    canEditEntry
      ? db.program.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }],
        })
      : Promise.resolve([]),
    canEditEntry
      ? db.team.findMany({
          where: { organizationId },
          select: { id: true, name: true, programId: true },
          orderBy: [{ name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  // Arc 24D.4: Fetch available lists for the list picker.
  let availableLists: Awaited<ReturnType<typeof fetchListsForActor>> = [];
  if (canEditEntry && !listAssignmentUnavailable) {
    try {
      availableLists = await fetchListsForActor({ organizationId, actorPersonId: scope.auth.personId });
    } catch (error) {
      const schemaIssue = getEntryListSchemaIssue(error);

      if (!schemaIssue) {
        throw error;
      }

      logEntryListSchemaIssue("entries.detail.fetch-available-lists", error, {
        organizationId,
        entryId,
        actorPersonId: scope.auth.personId,
      });
      listAssignmentUnavailable = true;
    }
  }

  const linkedEntryRows = [
    ...entry.linkedFrom.map((item) => ({
      linkId: item.id,
      fromEntryId: item.fromEntryId,
      toEntryId: item.toEntryId,
      linked: item.toEntry,
    })),
    ...entry.linkedTo.map((item) => ({
      linkId: item.id,
      fromEntryId: item.fromEntryId,
      toEntryId: item.toEntryId,
      linked: item.fromEntry,
    })),
  ];
  const openFollowUps = followUpEntries.filter((item) => item.sourceTask?.status !== "DONE" && item.sourceTask?.status !== "CANCELLED");
  const completedFollowUps = followUpEntries.filter((item) => item.sourceTask?.status === "DONE" || item.sourceTask?.status === "CANCELLED");

  const detailConfig = getEntryDetailConfig(entry.type);
  const decisionPayloadRecord = entry.typePayloads.find((payload) => payload.entryType === EntryType.DECISION) ?? null;
  const eventPayloadRecord = entry.typePayloads.find((payload) => payload.entryType === EntryType.EVENT) ?? null;
  const storedDecisionPayload = parseDecisionEntryPayload(decisionPayloadRecord?.payloadJson);
  const storedEventPayload = parseEventEntryPayload(eventPayloadRecord?.payloadJson);
  const hasStoredDecisionPayload = Boolean(decisionPayloadRecord);
  const defaultDecisionStatement = hasStoredDecisionPayload ? storedDecisionPayload.decisionStatement : entry.title;
  const defaultDecisionDetails = hasStoredDecisionPayload
    ? storedDecisionPayload.decisionDetails
    : (entry.content ?? "");
  const resolvedEventTimezone =
    normalizeEventTimezone(storedEventPayload.timezone) ??
    normalizeEventTimezone(entry.timezone) ??
    DEFAULT_EVENT_TIMEZONE;
  const eventPayloadForForm = { ...storedEventPayload, timezone: resolvedEventTimezone };

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/entries" label="All entries" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{entry.title}</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/entries/inbox" className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Entry inbox
            </Link>
            <Link href="/entries/schedule" className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Event schedule
            </Link>
            <Link href="/feed" className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Operational feed
            </Link>
          </div>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Type: {entry.type} · Status: {entry.status} · Priority: {entry.priority}
        </p>
      </div>

      {routeError ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {routeError}
        </div>
      ) : null}
      {savedParam && !routeError ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Entry saved successfully.
        </div>
      ) : null}
      {warningParam ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {warningParam}
        </div>
      ) : null}
      {listAssignmentUnavailable ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE}
        </div>
      ) : null}
      {decisionPayloadUnavailable && (entry.type === EntryType.DECISION || entry.type === EntryType.EVENT) ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {entry.type === EntryType.EVENT ? EVENT_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE : ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE}
        </div>
      ) : null}
      {entry.type === EntryType.HABIT ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Habit advanced recurrence and reporting workflows are partially supported and will expand in a future arc.
        </div>
      ) : null}
      {entry.type === EntryType.JOURNAL ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Journal prompt and assignment workflows are not yet enabled; this entry type currently provides basic detail/edit support only.
        </div>
      ) : null}
      {detailConfig.guidance ? (
        <div
          role="note"
          aria-label="Entry guidance"
          className="rounded-md border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
        >
          {detailConfig.guidance}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">{detailConfig.summaryHeading}</h3>
            <p className="mt-2 text-sm whitespace-pre-wrap">{entry.content?.trim() ? entry.content : detailConfig.emptySummary}</p>
            {entry.tags.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <li key={tag} className="rounded-full border px-2 py-0.5 text-xs">
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>

          <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
            <h3 className="font-semibold">Metadata</h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Creator</dt>
                <dd>{formatPersonName(entry.createdBy)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Assignee</dt>
                <dd>{formatPersonName(entry.assignedTo)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Last updated by</dt>
                <dd>{formatPersonName(entry.updatedBy)}</dd>
              </div>
              {detailConfig.metadataDateLabel ? (
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">{detailConfig.metadataDateLabel}</dt>
                  <dd>
                    {entry.dueDate ? entry.dueDate.toISOString().slice(0, 10) : "—"}
                    {entry.dueDate && entry.dueTime ? ` ${entry.dueTime}` : ""}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Created</dt>
                <dd>{formatDateTime(entry.createdAt)} UTC</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Updated</dt>
                <dd>{formatDateTime(entry.updatedAt)} UTC</dd>
              </div>
              {/* Arc 24D.4: Show assigned list */}
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">List</dt>
                <dd>
                  {listAssignmentUnavailable ? (
                    <span className="text-amber-700 dark:text-amber-300">{ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE}</span>
                  ) : entry.listId ? (
                    <Link href={`/lists/${entry.listId}`} className="underline">
                      {availableLists.find((list) => list.id === entry.listId)?.name ?? "View list"}
                    </Link>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500">None</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {canEditEntry ? (
            <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
              <h3 className="font-semibold">Advanced follow-up tasks</h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Secondary workflow only. Keep primary updates on the entry unless a separate operational task is required.
              </p>
              <details className="mt-3 rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">Create follow-up task</summary>
                <form action={`/entries/${entry.id}/create-follow-up`} method="post" className="mt-3 space-y-3">
                  <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                  <div className="space-y-1">
                    <label htmlFor="followUpTitle" className="text-sm font-medium">
                      Follow-up title
                    </label>
                    <input
                      id="followUpTitle"
                      name="title"
                      defaultValue={`Follow up: ${entry.title}`.slice(0, 160)}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="followUpDescription" className="text-sm font-medium">
                      Follow-up description
                    </label>
                    <textarea
                      id="followUpDescription"
                      name="description"
                      defaultValue={entry.content ?? ""}
                      rows={5}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label htmlFor="followUpAssigneePersonId" className="text-sm font-medium">
                        Assignee
                      </label>
                      <select
                        id="followUpAssigneePersonId"
                        name="assigneePersonId"
                        defaultValue={entry.assignedToPersonId ?? ""}
                        disabled={people.length === 0}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      >
                        {people.length === 0 ? <option value="">No people available</option> : null}
                        {people.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.firstName} {person.lastName}
                          </option>
                        ))}
                      </select>
                      {people.length === 0 ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Add a person before creating follow-up assignments.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="followUpDueAt" className="text-sm font-medium">
                        Due date
                      </label>
                      <input id="followUpDueAt" name="dueAt" type="datetime-local" className="w-full rounded-md border px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="followUpPriority" className="text-sm font-medium">
                        Priority
                      </label>
                      <select id="followUpPriority" name="priority" defaultValue={entry.priority} className="w-full rounded-md border px-3 py-2 text-sm">
                        {Object.values(EntryPriority).map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Create follow-up task
                  </button>
                </form>
              </details>
            </section>
          ) : null}

          <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Follow-up tasks (advanced workflow)</h3>
            {followUpEntries.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No follow-ups created from this entry yet.</p>
            ) : (
              <div className="space-y-3">
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {openFollowUps.length} active · {completedFollowUps.length} completed
                </p>
                <ul className="space-y-2 text-sm">
                  {followUpEntries.map((followUp) => {
                    const followUpTask = followUp.sourceTask;
                    const followUpStatus = followUpTask?.status ?? followUp.status;
                    const followUpOverdue = followUpTask ? isTaskOverdue(followUpTask) : false;

                    return (
                      <li key={followUp.id} className="rounded-md border px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">
                            <Link href={`/entries/${followUp.id}`} className="underline">
                              {followUp.title}
                            </Link>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClassName(followUpStatus)}`}>
                            {formatEnumLabel(followUpStatus)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                          Priority: {formatEnumLabel(followUp.priority)}
                          {followUpTask?.assignee
                            ? ` · Assignee: ${followUpTask.assignee.firstName} ${followUpTask.assignee.lastName}`
                            : ""}
                          {followUpTask?.dueAt
                            ? ` · Due: ${followUpTask.dueAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
                            : followUp.dueDate
                              ? ` · Due: ${followUp.dueDate.toISOString().slice(0, 10)}${followUp.dueTime ? ` ${followUp.dueTime}` : ""}`
                              : ""}
                          {followUpOverdue ? " · Overdue" : ""}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs">
                          {followUp.sourceTaskId ? (
                            <Link href={`/tasks/${followUp.sourceTaskId}`} className="underline">
                              Open task
                            </Link>
                          ) : null}
                          <Link href={`/entries/${followUp.id}`} className="underline">
                            Open follow-up entry
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {canEditEntry ? (
            <form action={`/entries/${entry.id}/update`} method="post" className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
              <div className="space-y-1">
                <label htmlFor="title" className="text-sm font-medium">
                  {detailConfig.titleLabel}
                </label>
                <input id="title" name="title" defaultValue={entry.title} className="w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label htmlFor="content" className="text-sm font-medium">
                  {detailConfig.contentLabel}
                </label>
                <textarea id="content" name="content" defaultValue={entry.content ?? ""} rows={10} className="w-full rounded-md border px-3 py-2 text-sm" />
                {detailConfig.contentHint ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{detailConfig.contentHint}</p> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor="type" className="text-sm font-medium">
                    Type
                  </label>
                  <select id="type" name="type" defaultValue={entry.type} className="w-full rounded-md border px-3 py-2 text-sm">
                    {USER_SELECTABLE_ENTRY_TYPES.includes(entry.type) ? null : (
                      <option value={entry.type}>{ENTRY_TYPE_OPTION_LABELS[entry.type]} (legacy/internal)</option>
                    )}
                    {USER_SELECTABLE_ENTRY_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {ENTRY_TYPE_OPTION_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="status" className="text-sm font-medium">
                    {detailConfig.statusLabel}
                  </label>
                  <select id="status" name="status" defaultValue={entry.status} className="w-full rounded-md border px-3 py-2 text-sm">
                    {Object.values(EntryStatus).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="priority" className="text-sm font-medium">
                    {detailConfig.priorityLabel}
                  </label>
                  <select id="priority" name="priority" defaultValue={entry.priority} className="w-full rounded-md border px-3 py-2 text-sm">
                    {Object.values(EntryPriority).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {detailConfig.dateFieldLabel ? (
                <div className="space-y-1">
                  <label htmlFor="dueAt" className="text-sm font-medium">
                    {detailConfig.dateFieldLabel}
                  </label>
                  <input
                    id="dueAt"
                    name="dueAt"
                    type="datetime-local"
                    defaultValue={
                      entry.dueDate
                        ? `${entry.dueDate.toISOString().slice(0, 10)}T${entry.dueTime ?? "00:00"}`
                        : ""
                    }
                    className="w-full rounded-md border px-3 py-2 text-sm sm:w-64"
                  />
                </div>
              ) : null}
              {/* Arc 24D.4: List assignment */}
              {listAssignmentUnavailable ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">List</label>
                  <p className="text-sm text-amber-700 dark:text-amber-300">{ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE}</p>
                </div>
              ) : availableLists.length > 0 ? (
                <div className="space-y-1">
                  <label htmlFor="listId" className="text-sm font-medium">
                    List
                  </label>
                  <select id="listId" name="listId" defaultValue={entry.listId ?? ""} className="w-full rounded-md border px-3 py-2 text-sm sm:w-80">
                    <option value="">— No list —</option>
                    {availableLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {labelForEntryListScope(list.scope)}: {list.name}{list.isInbox ? " (Inbox)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {entry.type === EntryType.EVENT ? (
                <EventEntryMetadataFields
                  payload={eventPayloadForForm}
                  programs={programs}
                  teams={teams}
                  timezoneDefault={resolvedEventTimezone}
                />
              ) : null}
              {entry.type === EntryType.DECISION ? (
                <fieldset className="space-y-3 rounded-md border p-3">
                  <legend className="px-1 text-sm font-semibold">Decision metadata</legend>
                  <div className="space-y-1">
                    <label htmlFor="decisionStatement" className="text-sm font-medium">
                      Decision statement
                    </label>
                    <input
                      id="decisionStatement"
                      name="decisionStatement"
                      defaultValue={defaultDecisionStatement}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="decisionDetails" className="text-sm font-medium">
                      Decision details / context
                    </label>
                    <textarea
                      id="decisionDetails"
                      name="decisionDetails"
                      rows={6}
                      defaultValue={defaultDecisionDetails}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="decisionMaker" className="text-sm font-medium">
                      Decision maker
                    </label>
                    <input
                      id="decisionMaker"
                      name="decisionMaker"
                      defaultValue={storedDecisionPayload.decisionMaker}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="supporters" className="text-sm font-medium">
                        Supporters / signed-on participants
                      </label>
                      <textarea
                        id="supporters"
                        name="supporters"
                        rows={4}
                        defaultValue={formatDecisionParticipantNames(storedDecisionPayload.supporters)}
                        placeholder="One person per line"
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="opposition" className="text-sm font-medium">
                        Opposition / against participants
                      </label>
                      <textarea
                        id="opposition"
                        name="opposition"
                        rows={4}
                        defaultValue={formatDecisionParticipantNames(storedDecisionPayload.opposition)}
                        placeholder="One person per line"
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="decisionClassification" className="text-sm font-medium">
                        Classification
                      </label>
                      <select
                        id="decisionClassification"
                        name="decisionClassification"
                        defaultValue={storedDecisionPayload.classification ?? ""}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      >
                        <option value="">— Not set —</option>
                        {DECISION_CLASSIFICATION_VALUES.map((value) => (
                          <option key={value} value={value}>
                            {value === "SOFT" ? "Soft" : "Hard"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="decisionDate" className="text-sm font-medium">
                        Decision date
                      </label>
                      <input
                        id="decisionDate"
                        name="decisionDate"
                        type="date"
                        defaultValue={storedDecisionPayload.decisionDate ?? ""}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="maturityDate" className="text-sm font-medium">
                        Maturity date
                      </label>
                      <input
                        id="maturityDate"
                        name="maturityDate"
                        type="date"
                        defaultValue={storedDecisionPayload.maturityDate ?? ""}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="maturityResult" className="text-sm font-medium">
                        Maturity result
                      </label>
                      <select
                        id="maturityResult"
                        name="maturityResult"
                        defaultValue={storedDecisionPayload.maturityResult ?? ""}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      >
                        <option value="">— Not set —</option>
                        {DECISION_MATURITY_RESULT_VALUES.map((value) => (
                          <option key={value} value={value}>
                            {value === "SUCCESSFUL"
                              ? "Successful"
                              : value === "PARTIALLY_SUCCESSFUL"
                                ? "Partially Successful"
                                : "Failed"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="maturityReviewNotes" className="text-sm font-medium">
                      Maturity review notes / explanation
                    </label>
                    <textarea
                      id="maturityReviewNotes"
                      name="maturityReviewNotes"
                      rows={4}
                      defaultValue={storedDecisionPayload.maturityReviewNotes}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                </fieldset>
              ) : null}
              <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
                Save entry
              </button>
            </form>
          ) : (
            <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Entry editing is unavailable for your role.
            </div>
          )}

          {canEditEntry ? (
            <div className="flex flex-wrap gap-2">
              {entry.type === EntryType.TASK && !entry.taskCompleted ? (
                <form action={`/entries/${entry.id}/complete`} method="post">
                  <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                  <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Complete task
                  </button>
                </form>
              ) : null}
              {entry.type === EntryType.NOTE ? (
                <form action={`/entries/${entry.id}/convert-note-to-task`} method="post">
                  <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                  <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Convert note to task
                  </button>
                </form>
              ) : null}
              <form action={`/entries/${entry.id}/delete`} method="post">
                <input type="hidden" name="returnTo" value="/entries" />
                <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300">
                  Soft delete
                </button>
              </form>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
            <h3 className="font-semibold">Source links</h3>
            <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
              {entry.sourceTaskId ? (
                <li>
                  <Link href={`/tasks/${entry.sourceTaskId}`} className="underline">
                    Open linked task
                  </Link>
                </li>
              ) : null}
              {entry.sourceNoteId ? (
                <li>
                  <Link href={`/notes/${entry.sourceNoteId}`} className="underline">
                    Open linked note
                  </Link>
                </li>
              ) : null}
              {!entry.sourceTaskId && !entry.sourceNoteId ? <li>No linked source object.</li> : null}
            </ul>
          </div>

          {canEditEntry ? (
            <>
              <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
                <h3 className="font-semibold">Link entries</h3>
                <form action="/entries/link" method="post" className="mt-2 space-y-2">
                  <input type="hidden" name="fromEntryId" value={entry.id} />
                  <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                  <input
                    name="toEntryId"
                    placeholder="Target entry ID"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    aria-label="Target entry ID"
                  />
                  <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Link entry
                  </button>
                </form>
              </div>

              <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
                <h3 className="font-semibold">Link operational object</h3>
                <form action="/entries/object-links/link" method="post" className="mt-2 space-y-2">
                  <input type="hidden" name="entryId" value={entry.id} />
                  <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                  <div className="space-y-1">
                    <label htmlFor="targetType" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Target type
                    </label>
                    <select id="targetType" name="targetType" defaultValue={EntryObjectLinkTargetType.PERSON} className="w-full rounded-md border px-3 py-2 text-sm">
                      {Object.values(EntryObjectLinkTargetType).map((value) => (
                        <option key={value} value={value}>
                          {labelForEntryObjectLinkTargetType(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="targetId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Target ID
                    </label>
                    <input id="targetId" name="targetId" placeholder="Target record ID" className="w-full rounded-md border px-3 py-2 text-sm" />
                  </div>
                  <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Add linked object
                  </button>
                </form>
              </div>

              <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
                <h3 className="font-semibold">Operational graph link</h3>
                <form action="/entries/relationships/link" method="post" className="mt-2 space-y-2">
                  <input type="hidden" name="fromNodeType" value="ENTRY" />
                  <input type="hidden" name="fromNodeId" value={entry.id} />
                  <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                  <div className="space-y-1">
                    <label htmlFor="toNodeType" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Target type
                    </label>
                    <select id="toNodeType" name="toNodeType" defaultValue={OperationalGraphNodeType.ENTRY} className="w-full rounded-md border px-3 py-2 text-sm">
                      {Object.values(OperationalGraphNodeType).map((value) => (
                        <option key={value} value={value}>
                          {labelForOperationalNodeType(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="toNodeId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Target ID
                    </label>
                    <input id="toNodeId" name="toNodeId" placeholder="Target record ID" className="w-full rounded-md border px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="relationshipType" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Relationship type
                    </label>
                    <select id="relationshipType" name="relationshipType" defaultValue={OperationalRelationshipType.RELATED_TO} className="w-full rounded-md border px-3 py-2 text-sm">
                      {Object.values(OperationalRelationshipType).map((value) => (
                        <option key={value} value={value}>
                          {labelForOperationalRelationshipType(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Link operational record
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Linking actions are unavailable for your role.
            </div>
          )}
        </aside>
      </div>

      <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Linked objects</h3>
        {objectLinkViews.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No linked objects yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {objectLinkViews.map((objectLink) => (
              <li key={objectLink.id} className="rounded-md border px-3 py-2">
                <div className="font-medium">
                  {objectLink.href ? (
                    <Link href={objectLink.href} className="underline">
                      {objectLink.title}
                    </Link>
                  ) : (
                    objectLink.title
                  )}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {labelForEntryObjectLinkTargetType(objectLink.targetType)}
                  {objectLink.subtitle ? ` · ${objectLink.subtitle}` : ""}
                </div>
                {canEditEntry ? (
                  <form action="/entries/object-links/unlink" method="post" className="mt-2">
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input type="hidden" name="targetType" value={objectLink.targetType} />
                    <input type="hidden" name="targetId" value={objectLink.targetId} />
                    <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                    <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Remove link
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Linked entries</h3>
        {linkedEntryRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No linked entries yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {linkedEntryRows.map((row) => (
              <li key={row.linkId} className="rounded-md border px-3 py-2">
                {row.linked.deletedAt ? (
                  <span>Linked entry unavailable</span>
                ) : (
                  <Link href={`/entries/${row.linked.id}`} className="underline">
                    {row.linked.type}: {row.linked.title}
                  </Link>
                )}
                {canEditEntry ? (
                  <form action="/entries/unlink" method="post" className="mt-2">
                    <input type="hidden" name="fromEntryId" value={row.fromEntryId} />
                    <input type="hidden" name="toEntryId" value={row.toEntryId} />
                    <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                    <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Unlink
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Related operational items</h3>
        {relatedItems.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No related operational items yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {relatedItems.map((item) => (
              <li key={item.id} className="rounded-md border px-3 py-2">
                <div className="font-medium">
                  {item.direction === "OUTBOUND" ? "→" : "←"} {labelForOperationalRelationshipType(item.relationshipType)}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {labelForOperationalNodeType(item.node.nodeType)} · {item.node.subtitle ?? "Operational record"}
                </div>
                <div className="mt-1">
                  {item.node.href ? (
                    <Link href={item.node.href} className="underline">
                      {item.node.title}
                    </Link>
                  ) : (
                    <span>{item.node.title}</span>
                  )}
                </div>
                {canEditEntry ? (
                  <form action="/entries/relationships/unlink" method="post" className="mt-2">
                    <input type="hidden" name="fromNodeType" value={item.direction === "OUTBOUND" ? "ENTRY" : item.node.nodeType} />
                    <input type="hidden" name="fromNodeId" value={item.direction === "OUTBOUND" ? entry.id : item.node.nodeId} />
                    <input type="hidden" name="toNodeType" value={item.direction === "OUTBOUND" ? item.node.nodeType : "ENTRY"} />
                    <input type="hidden" name="toNodeId" value={item.direction === "OUTBOUND" ? item.node.nodeId : entry.id} />
                    <input type="hidden" name="relationshipType" value={item.relationshipType} />
                    <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                    <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Unlink
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Activity / history</h3>
        {entry.activity.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No activity recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {entry.activity.map((activity) => {
              const details = summarizeEntryActivityMetadata(activity.metadataJson);
              return (
                <li key={activity.id} className="rounded-md border px-3 py-2">
                  <div className="font-medium">{labelForActivityAction(activity.action)}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {activity.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                    {activity.actor ? ` · ${activity.actor.firstName} ${activity.actor.lastName}` : ""}
                  </div>
                  {details.length > 0 ? (
                    <ul className="mt-2 list-disc pl-4 text-xs text-zinc-600 dark:text-zinc-400">
                      {details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
