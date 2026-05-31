import Link from "next/link";
import { OperationalGraphNodeType, OperationalRelationshipType } from "@prisma/client";

import type {
  FoundationRelationshipNodeType,
  FoundationRelationshipListItem,
  RelationshipSearchCandidate,
} from "@/lib/entry-relationships";

const TARGET_TYPE_LABELS: Record<OperationalGraphNodeType, string> = {
  ENTRY: "Entry item",
  HABIT: "Habit",
  PERSON: "Person",
  TEAM: "Team",
  PROGRAM: "Program",
  SEASON: "Season",
  EVENT: "Event",
  ATTENDANCE_RECORD: "Attendance",
  FACILITY: "Facility",
  FACILITY_RESOURCE: "Facility resource",
  RESOURCE_BOOKING: "Reservation",
  GEAR_ITEM: "Gear item",
  GEAR_ASSIGNMENT: "Gear assignment",
  GEAR_CHECKOUT: "Gear checkout",
  GEAR_MAINTENANCE_LOG: "Maintenance",
  CONSUMABLE_TRANSACTION: "Inventory transaction",
  FOLLOW_UP_TASK: "Task",
  OBSERVATION_NOTE: "Note",
  ROSTER_MEMBERSHIP: "Roster membership",
  ATHLETE_GUARDIAN_RELATIONSHIP: "Guardian relationship",
  INVENTORY_LOCATION: "Inventory location",
  INVENTORY_MOVEMENT: "Inventory movement",
  INVENTORY_KIT: "Inventory kit",
};

type RelationshipOption = {
  value: OperationalRelationshipType;
  label: string;
};

export function RelationshipPanel({
  sourceNodeType,
  sourceNodeId,
  returnTo,
  searchPath,
  canCreate,
  searchTargetType,
  searchQuery,
  relationshipItems,
  candidates,
  relationshipOptions,
  searchTargetOptions,
  limitation,
}: {
  sourceNodeType: FoundationRelationshipNodeType;
  sourceNodeId: string;
  returnTo: string;
  searchPath: string;
  canCreate: boolean;
  searchTargetType: FoundationRelationshipNodeType;
  searchQuery: string;
  relationshipItems: FoundationRelationshipListItem[];
  candidates: RelationshipSearchCandidate[];
  relationshipOptions: RelationshipOption[];
  searchTargetOptions: FoundationRelationshipNodeType[];
  limitation?: string | null;
}) {
  return (
    <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Related Items / Context</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Context only — related items do not change My Work visibility.
        </span>
      </div>

      {limitation ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{limitation}</p>
      ) : null}

      {canCreate ? (
        <div className="mt-4 space-y-3 rounded-md border p-3">
          <h4 className="text-sm font-medium">Add relationship</h4>
          <form action={searchPath} method="get" className="grid gap-2 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
            <div className="space-y-1">
              <label htmlFor="relationshipTargetType" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Target type
              </label>
              <select
                id="relationshipTargetType"
                name="relationshipTargetType"
                defaultValue={searchTargetType}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {searchTargetOptions.map((option) => (
                  <option key={option} value={option}>
                    {TARGET_TYPE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="relationshipQuery" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Search
              </label>
              <input
                id="relationshipQuery"
                name="relationshipQuery"
                defaultValue={searchQuery}
                placeholder="Title contains…"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Search
              </button>
            </div>
          </form>

          <form action="/relationships/link" method="post" className="space-y-3">
            <input type="hidden" name="fromNodeType" value={sourceNodeType} />
            <input type="hidden" name="fromNodeId" value={sourceNodeId} />
            <input type="hidden" name="toNodeType" value={searchTargetType} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Select target</p>
              {candidates.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No accessible items match this search yet.</p>
              ) : (
                <div className="space-y-2">
                  {candidates.map((candidate, index) => (
                    <label key={`${candidate.nodeType}:${candidate.nodeId}`} className="flex gap-3 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="toNodeId"
                        value={candidate.nodeId}
                        defaultChecked={index === 0}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">{candidate.title}</span>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {candidate.typeLabel}
                          {candidate.statusLabel ? ` · ${candidate.statusLabel}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <div className="space-y-1">
                <label htmlFor="relationshipType" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Relationship type
                </label>
                <select id="relationshipType" name="relationshipType" className="w-full rounded-md border px-3 py-2 text-sm">
                  {relationshipOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="relationshipNote" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Note (optional)
                </label>
                <input
                  id="relationshipNote"
                  name="relationshipNote"
                  maxLength={240}
                  placeholder="Why are these related?"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={candidates.length === 0}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
            >
              Save relationship
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Relationship changes are unavailable for your current access level.</p>
      )}

      {relationshipItems.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No related items yet.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {relationshipItems.map((item) => (
            <li key={item.id} className="rounded-md border px-3 py-2">
              <div className="font-medium">{item.relationshipLabel}</div>
              <div className="mt-1">
                {item.related.href ? (
                  <Link href={item.related.href} className="underline">
                    {item.related.title}
                  </Link>
                ) : (
                  <span>{item.related.title}</span>
                )}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                {item.related.typeLabel}
                {item.related.statusLabel ? ` · ${item.related.statusLabel}` : ""}
              </div>
              {item.note ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.note}</p> : null}
              {item.canRemove ? (
                <form action="/relationships/unlink" method="post" className="mt-2">
                  <input type="hidden" name="fromNodeType" value={item.unlink.fromNodeType} />
                  <input type="hidden" name="fromNodeId" value={item.unlink.fromNodeId} />
                  <input type="hidden" name="toNodeType" value={item.unlink.toNodeType} />
                  <input type="hidden" name="toNodeId" value={item.unlink.toNodeId} />
                  <input type="hidden" name="relationshipType" value={item.unlink.relationshipType} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Remove relationship
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
