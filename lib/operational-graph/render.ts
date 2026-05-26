import type { OperationalGraphNodeType, OperationalRelationshipType } from "@prisma/client";

const NODE_TYPE_LABELS: Record<OperationalGraphNodeType, string> = {
  ENTRY: "Entry",
  PERSON: "Person",
  TEAM: "Team",
  PROGRAM: "Program",
  SEASON: "Season",
  EVENT: "Event",
  ATTENDANCE_RECORD: "Attendance",
  FACILITY: "Facility",
  FACILITY_RESOURCE: "Resource",
  RESOURCE_BOOKING: "Reservation",
  GEAR_ITEM: "Gear item",
  GEAR_ASSIGNMENT: "Gear assignment",
  GEAR_CHECKOUT: "Gear checkout",
  GEAR_MAINTENANCE_LOG: "Maintenance record",
  CONSUMABLE_TRANSACTION: "Inventory transaction",
  FOLLOW_UP_TASK: "Task",
  OBSERVATION_NOTE: "Note",
  ROSTER_MEMBERSHIP: "Roster membership",
  ATHLETE_GUARDIAN_RELATIONSHIP: "Guardian relationship",
  INVENTORY_LOCATION: "Inventory location",
  INVENTORY_MOVEMENT: "Inventory movement",
  INVENTORY_KIT: "Inventory kit",
};

const RELATIONSHIP_LABELS: Record<OperationalRelationshipType, string> = {
  RELATED_TO: "Related to",
  BLOCKED_BY: "Blocked by",
  FOLLOW_UP_TO: "Follow-up to",
  CREATED_FROM: "Created from",
  IMPACTS: "Impacts",
  ASSIGNED_FOR: "Assigned for",
  OBSERVED_DURING: "Observed during",
  READINESS_FOR: "Readiness for",
};

export function labelForOperationalNodeType(nodeType: OperationalGraphNodeType): string {
  return NODE_TYPE_LABELS[nodeType] ?? nodeType;
}

export function labelForOperationalRelationshipType(relationshipType: OperationalRelationshipType): string {
  return RELATIONSHIP_LABELS[relationshipType] ?? relationshipType;
}
