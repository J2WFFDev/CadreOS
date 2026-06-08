import Link from "next/link";
import {
  EntryPriority,
  Prisma,
  EntryStatus,
  EntryType,
  OperationalGraphNodeType,
} from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { RelationshipPanel } from "@/components/dashboard/relationship-panel";
import { EventEntryMetadataFields } from "@/components/dashboard/event-entry-metadata-fields";
import { db } from "@/lib/db";
import {
  canWriteRelationshipSource,
  FOUNDATION_RELATIONSHIP_TYPES,
  labelForRelationshipDirection,
  listFoundationRelationships,
  parseRelationshipTargetNodeType,
  searchRelationshipTargets,
} from "@/lib/entry-relationships";
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
import { readFirstSearchParam, shouldShowQuickCaptureSuccessBanner } from "@/lib/entries/entry-detail-query-state";
import {
  JOURNAL_PAYLOAD_VISIBILITY_VALUES,
  type JournalPayloadVisibility,
  parseJournalEntryPayload,
} from "@/lib/entries/journal-payload";
import { fetchListsForActor, labelForEntryListScope } from "@/lib/entries/lists";
import {
  ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE,
  ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE,
  getEntryListSchemaIssue,
  getEntryTypePayloadSchemaIssue,
  logEntryListSchemaIssue,
  logEntryTypePayloadSchemaIssue,
} from "@/lib/entries/schema-guard";
import { USER_SELECTABLE_ENTRY_TYPES } from "@/lib/entries/user-selectable-types";
import { formatEnumLabel } from "@/lib/follow-up-tasks";
import {
  buildEntryOpsTypeAwareVisibilityWhere,
  canEditEntryOpsEntry,
  ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE,
  logEntryOpsAccessDecision,
  resolveEntryOpsDetailAccessDecision,
  resolveEntryOpsAllWorkDefaultVisibility,
  resolveEntryOpsVisibilityContext,
} from "@/lib/entryops/visibility";
import {
  hintForJournalPayloadVisibility,
  labelForJournalPayloadVisibility,
} from "@/lib/journals/policy";
import { canEditJournalDraft } from "@/lib/journals/access";
import { labelForActivityAction } from "@/lib/operational-feed/render";
import {
  labelForOperationalNodeType,
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

function formatEntryListDisplay(
  listId: string | null,
  availableLists: Awaited<ReturnType<typeof fetchListsForActor>>,
): { label: string; href: string | null } {
  if (!listId) {
    return { label: "Unlisted legacy item", href: null };
  }

  const list = availableLists.find((candidate) => candidate.id === listId);
  if (!list) {
    return { label: "View list", href: `/lists/${listId}` };
  }

  return {
    label: list.isInbox ? `${list.name} (Inbox)` : list.name,
    href: `/lists/${list.id}`,
  };
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
    visibility: true,
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
    createdByPersonId: true,
    assignedToPersonId: true,
    teamId: true,
    assignments: {
      select: { personId: true, revokedAt: true },
      take: 40,
    },
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
      where: { entryType: { in: [EntryType.DECISION, EntryType.EVENT, EntryType.JOURNAL] } },
      select: { entryType: true, payloadJson: true, isActive: true },
      take: 3,
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
  visibilityWhere: Prisma.EntryWhereInput,
): Promise<{ entry: EntryDetailRecord | null; listAssignmentUnavailable: boolean; decisionPayloadUnavailable: boolean }> {
  const where: Prisma.EntryWhereInput = {
    organizationId,
    deletedAt: null,
    AND: [{ id: entryId }, visibilityWhere],
  };

  try {
    const entry = await db.entry.findFirst({
      where,
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
      where,
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
  const routeError = readFirstSearchParam(resolvedSearchParams.error);
  const savedParam = readFirstSearchParam(resolvedSearchParams.saved);
  const quickCapturedParam = readFirstSearchParam(resolvedSearchParams.quickCaptured);
  const warningParam = readFirstSearchParam(resolvedSearchParams.warning);
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Work Item</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load work item details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Work Item</h2>
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }
  const organizationId = scope.organizationId;

  const visibilityContext = await resolveEntryOpsVisibilityContext({
    organizationId,
    actorPersonId: scope.auth.personId,
  });
  const entryDetailVisibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);

  const entryAccess = await resolveEntryAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canReadEntry = entryDetailVisibility.canRead;
  const canEditEntryByRole = entryAccess.level === "WRITE" || entryAccess.level === "MANAGE";

  if (!canReadEntry) {
    logEntryOpsAccessDecision({
      workflow: "entries.detail",
      entryId,
      organizationId,
      actorPersonId: scope.auth.personId,
      decision: { allowed: false, reasonCode: "ENTRY_VISIBILITY_DENIED" },
    });
    return (
      <section className="space-y-4">
        <BackLink href="/entries" label="All work" />
        <h2 className="text-2xl font-semibold tracking-tight">Work Item</h2>
        <ErrorMessage message={ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE} />
      </section>
    );
  }

  const entryResult = await fetchEntryDetailRecord(
    organizationId,
    entryId,
    buildEntryOpsTypeAwareVisibilityWhere(visibilityContext, entryDetailVisibility),
  );
  const entry = entryResult.entry;
  let listAssignmentUnavailable = entryResult.listAssignmentUnavailable;
  const decisionPayloadUnavailable = entryResult.decisionPayloadUnavailable;

  if (!entry) {
    const existingEntry = await db.entry.findFirst({
      where: { id: entryId, organizationId, deletedAt: null },
      select: {
        createdByPersonId: true,
        assignedToPersonId: true,
        teamId: true,
        team: { select: { programId: true } },
        assignments: { select: { personId: true, revokedAt: true }, take: 40 },
      },
    });
    logEntryOpsAccessDecision({
      workflow: "entries.detail",
      entryId,
      organizationId,
      actorPersonId: scope.auth.personId,
      decision: resolveEntryOpsDetailAccessDecision(visibilityContext, entryDetailVisibility, existingEntry),
    });
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Work Item</h2>
        <ErrorMessage message={ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE} />
      </section>
    );
  }

  const canEditEntry =
    entry.type === EntryType.JOURNAL
      ? canEditJournalDraft(visibilityContext, {
          ...entry,
          visibility: entry.visibility,
          teamProgramId: null,
        })
      : canEditEntryOpsEntry({
          canWriteEntries: canEditEntryByRole,
          context: visibilityContext,
          entry,
        });
  logEntryOpsAccessDecision({
    workflow: "entries.detail",
    entryId,
    organizationId,
    actorPersonId: scope.auth.personId,
    decision: resolveEntryOpsDetailAccessDecision(visibilityContext, entryDetailVisibility, entry),
  });
  const canEditEntryAdministrativeFields = canEditEntryByRole;

  const relatedItems = await listRelatedOperationalRecords({
    organizationId,
    node: { nodeType: "ENTRY", nodeId: entry.id },
    limit: 30,
  });
  const relationshipTargetTypeParam = readFirstSearchParam(resolvedSearchParams.relationshipTargetType);
  const relationshipTargetType = parseRelationshipTargetNodeType(relationshipTargetTypeParam);
  const relationshipQuery = readFirstSearchParam(resolvedSearchParams.relationshipQuery)?.trim() ?? "";
  const relationshipSource = { nodeType: OperationalGraphNodeType.ENTRY, nodeId: entry.id } as const;
  const [relationshipItems, relationshipCandidates, canCreateRelationships] = await Promise.all([
    listFoundationRelationships({
      organizationId,
      actorPersonId: scope.auth.personId,
      source: relationshipSource,
      limit: 20,
    }),
    searchRelationshipTargets({
      organizationId,
      actorPersonId: scope.auth.personId,
      source: relationshipSource,
      targetNodeType: relationshipTargetType,
      query: relationshipQuery,
      limit: 8,
    }),
    canWriteRelationshipSource({
      organizationId,
      actorPersonId: scope.auth.personId,
      source: relationshipSource,
    }),
  ]);
  const relatedOperationalItems = relatedItems.filter(
    (item) => item.node.nodeType !== "ENTRY" && item.node.nodeType !== "HABIT",
  );
  const [programs, teams] = await Promise.all([
    canEditEntryAdministrativeFields
      ? db.program.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }],
        })
      : Promise.resolve([]),
    canEditEntryAdministrativeFields
      ? db.team.findMany({
          where: { organizationId },
          select: { id: true, name: true, programId: true },
          orderBy: [{ name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  // Arc 24D.4: Fetch available lists for the list picker.
  let availableLists: Awaited<ReturnType<typeof fetchListsForActor>> = [];
  if (!listAssignmentUnavailable) {
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

  const detailConfig = getEntryDetailConfig(entry.type);
  const decisionPayloadRecord = entry.typePayloads.find((payload) => payload.entryType === EntryType.DECISION) ?? null;
  const eventPayloadRecord = entry.typePayloads.find((payload) => payload.entryType === EntryType.EVENT) ?? null;
  const journalPayloadRecord = entry.typePayloads.find((payload) => payload.entryType === EntryType.JOURNAL) ?? null;
  const storedDecisionPayload = parseDecisionEntryPayload(decisionPayloadRecord?.payloadJson);
  const storedEventPayload = parseEventEntryPayload(eventPayloadRecord?.payloadJson);
  const storedJournalPayload = parseJournalEntryPayload(journalPayloadRecord?.payloadJson ?? null);
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
  const linkedItemCount = relationshipItems.length;
  const listDisplay = formatEntryListDisplay(entry.listId, availableLists);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/entries" label="All work" />
        <h2 className="text-2xl font-semibold tracking-tight">{entry.title}</h2>
      </div>

      {routeError ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {routeError}
        </div>
      ) : null}
      {savedParam && !routeError ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Work item saved successfully.
        </div>
      ) : null}
      {shouldShowQuickCaptureSuccessBanner(quickCapturedParam) && !routeError ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Captured as a task and routed to your inbox. Add details below when you are ready.
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
      {entry.type === EntryType.JOURNAL && entry.status === "DONE" ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This journal is <strong>Final</strong> and locked for editing. To resume editing,{" "}
          <Link href={`/journals/${entry.id}/reopen`} className="underline">
            reopen it via the journal view
          </Link>{" "}
          or use the Reopen button.
        </div>
      ) : null}
      {detailConfig.guidance ? (
        <div
          role="note"
          aria-label="Work item guidance"
          className="rounded-md border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
        >
          {detailConfig.guidance}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Main Item</h3>
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
          </section>

          {canEditEntry ? (
            <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <form action={`/entries/${entry.id}/update`} method="post" className="space-y-3">
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
                      {entry.listId ? null : <option value="">Assign Inbox on save</option>}
                      {availableLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {labelForEntryListScope(list.scope)}: {list.name}{list.isInbox ? " (Inbox)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {entry.type === EntryType.EVENT && canEditEntryAdministrativeFields ? (
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
                {entry.type === EntryType.JOURNAL ? (
                  <fieldset className="space-y-3 rounded-md border p-3" disabled={entry.status === "DONE"}>
                  <legend className="px-1 text-sm font-semibold">Journal metadata</legend>
                  {entry.status === "DONE" ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      This journal is Final. Fields are read-only. Reopen the journal to edit.
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    <label htmlFor="journalVisibility" className="text-sm font-medium">
                      Visibility
                    </label>
                    <select
                      id="journalVisibility"
                      name="journalVisibility"
                      defaultValue={storedJournalPayload.journalVisibility}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {JOURNAL_PAYLOAD_VISIBILITY_VALUES.map((vis: JournalPayloadVisibility) => (
                        <option key={vis} value={vis}>
                          {labelForJournalPayloadVisibility(vis)}
                        </option>
                      ))}
                    </select>
                    <ul className="space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {JOURNAL_PAYLOAD_VISIBILITY_VALUES.map((vis: JournalPayloadVisibility) => (
                        <li key={vis}>
                          <span className="font-medium">{labelForJournalPayloadVisibility(vis)}:</span>{" "}
                          {hintForJournalPayloadVisibility(vis)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="journalDate" className="text-sm font-medium">
                        Journal date
                      </label>
                      <input
                        id="journalDate"
                        name="journalDate"
                        type="date"
                        defaultValue={storedJournalPayload.journalDate ?? ""}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="journalAuthor" className="text-sm font-medium">
                        Author (optional)
                      </label>
                      <input
                        id="journalAuthor"
                        name="journalAuthor"
                        type="text"
                        maxLength={120}
                        defaultValue={storedJournalPayload.journalAuthor ?? ""}
                        placeholder="Leave blank to use your name"
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Journal body visibility: journal body is never surfaced in broad activity feeds.
                    Use the{" "}
                    <Link href={`/journals/${entry.id}`} className="underline">
                      journal workflow view
                    </Link>{" "}
                    for finalize/archive/reopen actions.
                  </p>
                  </fieldset>
                ) : null}
                <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
                  Save work item
                </button>
              </form>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {entry.type === EntryType.TASK && !entry.taskCompleted ? (
                  <form action={`/entries/${entry.id}/complete`} method="post">
                    <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                    <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Complete task
                    </button>
                  </form>
                ) : null}
                {canEditEntryByRole && entry.type === EntryType.NOTE ? (
                  <form action={`/entries/${entry.id}/convert-note-to-task`} method="post">
                    <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                    <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Convert note to task
                    </button>
                  </form>
                ) : null}
                {canEditEntryByRole && entry.type === EntryType.TASK && entry.status !== EntryStatus.ARCHIVED ? (
                  <form action={`/entries/${entry.id}/convert-task-to-habit`} method="post">
                    <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                    <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Convert task to habit
                    </button>
                  </form>
                ) : null}
                {canEditEntryByRole ? (
                  <form action={`/entries/${entry.id}/delete`} method="post">
                    <input type="hidden" name="returnTo" value="/entries" />
                    <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300">
                      Soft delete
                    </button>
                  </form>
                ) : null}
              </div>
            </section>
          ) : (
            <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              You can view this work item, but you do not have permission to edit it.
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
            <h3 className="font-semibold">Details</h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">List</dt>
                  <dd>
                    {listAssignmentUnavailable ? (
                      <span className="text-amber-700 dark:text-amber-300">{ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE}</span>
                    ) : listDisplay.href ? (
                      <Link href={listDisplay.href} className="underline">
                        {listDisplay.label}
                      </Link>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">{listDisplay.label}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Assignment</dt>
                  <dd>{formatPersonName(entry.assignedTo)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Scope</dt>
                  <dd>{entry.type === EntryType.EVENT ? "Program/Team event scope" : "Organization entry scope"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Visibility</dt>
                  <dd>Role and relationship policy controlled</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Related items</dt>
                  <dd>{linkedItemCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Related records</dt>
                  <dd>{relatedOperationalItems.length}</dd>
                </div>
            </dl>
          </div>
          <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
            <h3 className="font-semibold">Metadata</h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Created by</dt>
                  <dd>{formatPersonName(entry.createdBy)}</dd>
              </div>
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Last updated by</dt>
                  <dd>{formatPersonName(entry.updatedBy)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Created date</dt>
                  <dd>{formatDateTime(entry.createdAt)} UTC</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Updated date</dt>
                  <dd>{formatDateTime(entry.updatedAt)} UTC</dd>
                </div>
            </dl>
          </div>
        </aside>
      </div>

      <section className="space-y-4">
        <RelationshipPanel
          sourceNodeType={OperationalGraphNodeType.ENTRY}
          sourceNodeId={entry.id}
          returnTo={`/entries/${entry.id}`}
          searchPath={`/entries/${entry.id}`}
          canCreate={canCreateRelationships}
          searchTargetType={relationshipTargetType}
          searchQuery={relationshipQuery}
          relationshipItems={relationshipItems}
          candidates={relationshipCandidates}
          relationshipOptions={FOUNDATION_RELATIONSHIP_TYPES.map((value) => ({
            value,
            label: labelForRelationshipDirection(value, "OUTBOUND"),
          }))}
          searchTargetOptions={[OperationalGraphNodeType.ENTRY, OperationalGraphNodeType.HABIT]}
          limitation="List relationships are hidden for now because list visibility is still broader than the conservative permission checks used for relationship linking."
        />

        {relatedOperationalItems.length > 0 ? (
          <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Related records</h3>
            <ul className="mt-2 space-y-2 text-sm">
                {relatedOperationalItems.map((item) => (
                  <li key={item.id} className="rounded-md border px-3 py-2">
                    <div className="font-medium">{item.node.title}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      {labelForOperationalNodeType(item.node.nodeType)}
                      {item.node.subtitle ? ` · ${item.node.subtitle}` : ""}
                    </div>
                    {item.node.href ? (
                      <Link href={item.node.href} className="mt-1 inline-block underline">
                        Open record
                      </Link>
                    ) : null}
                  </li>
                ))}
            </ul>
          </section>
        ) : null}
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
