import type {
  EntryObjectLinkTargetType,
  OperationalGraphNodeType,
  OperationalRelationshipType,
} from "@prisma/client";

export { OperationalGraphNodeType, OperationalRelationshipType };

export const OPERATIONAL_GRAPH_NODE_TYPES: OperationalGraphNodeType[] = [
  "ENTRY",
  "PERSON",
  "TEAM",
  "PROGRAM",
  "SEASON",
  "EVENT",
  "ATTENDANCE_RECORD",
  "FACILITY",
  "FACILITY_RESOURCE",
  "RESOURCE_BOOKING",
  "GEAR_ITEM",
  "GEAR_ASSIGNMENT",
  "GEAR_CHECKOUT",
  "GEAR_MAINTENANCE_LOG",
  "CONSUMABLE_TRANSACTION",
  "FOLLOW_UP_TASK",
  "OBSERVATION_NOTE",
  "ROSTER_MEMBERSHIP",
  "ATHLETE_GUARDIAN_RELATIONSHIP",
];

export const OPERATIONAL_RELATIONSHIP_TYPES: OperationalRelationshipType[] = [
  "RELATED_TO",
  "BLOCKED_BY",
  "FOLLOW_UP_TO",
  "CREATED_FROM",
  "IMPACTS",
  "ASSIGNED_FOR",
  "OBSERVED_DURING",
  "READINESS_FOR",
];

export type OperationalGraphNodeRef = {
  nodeType: OperationalGraphNodeType;
  nodeId: string;
};

export type LinkOperationalRecordsInput = {
  organizationId: string;
  from: OperationalGraphNodeRef;
  to: OperationalGraphNodeRef;
  relationshipType: OperationalRelationshipType;
  createdByPersonId: string;
  metadata?: Record<string, unknown> | null;
};

export type UnlinkOperationalRecordsInput = {
  organizationId: string;
  from: OperationalGraphNodeRef;
  to: OperationalGraphNodeRef;
  relationshipType: OperationalRelationshipType;
  actorPersonId: string;
};

export type ListRelatedOperationalRecordsInput = {
  organizationId: string;
  node: OperationalGraphNodeRef;
  relationshipTypes?: OperationalRelationshipType[];
  limit?: number;
};

export type OperationalNodeView = OperationalGraphNodeRef & {
  title: string;
  subtitle: string | null;
  href: string | null;
};

export type RelatedOperationalRecord = {
  id: string;
  relationshipType: OperationalRelationshipType;
  direction: "OUTBOUND" | "INBOUND";
  node: OperationalNodeView;
  createdAt: Date;
};

const ENTRY_OBJECT_TO_GRAPH_NODE: Record<EntryObjectLinkTargetType, OperationalGraphNodeType> = {
  PERSON: "PERSON",
  TEAM: "TEAM",
  PROGRAM: "PROGRAM",
  SEASON: "SEASON",
  EVENT: "EVENT",
  ATTENDANCE_RECORD: "ATTENDANCE_RECORD",
  FACILITY: "FACILITY",
  FACILITY_RESOURCE: "FACILITY_RESOURCE",
  RESOURCE_BOOKING: "RESOURCE_BOOKING",
  GEAR_ITEM: "GEAR_ITEM",
  GEAR_ASSIGNMENT: "GEAR_ASSIGNMENT",
  GEAR_CHECKOUT: "GEAR_CHECKOUT",
  GEAR_MAINTENANCE_LOG: "GEAR_MAINTENANCE_LOG",
  FOLLOW_UP_TASK: "FOLLOW_UP_TASK",
  OBSERVATION_NOTE: "OBSERVATION_NOTE",
};

export function mapEntryObjectLinkTargetToGraphNodeType(targetType: EntryObjectLinkTargetType): OperationalGraphNodeType {
  return ENTRY_OBJECT_TO_GRAPH_NODE[targetType];
}
