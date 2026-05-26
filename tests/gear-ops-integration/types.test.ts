import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildGearOpsIntegrationAvailability,
  buildGearOpsStandaloneAvailability,
  formatGearModuleReferenceStatusMessage,
  formatGearPersonDisplayName,
} from "../../lib/gear-ops-integration/types";

// ── formatGearPersonDisplayName ───────────────────────────────────────────────

test("formatGearPersonDisplayName returns 'Last, First' format", () => {
  assert.equal(formatGearPersonDisplayName("Alice", "Smith"), "Smith, Alice");
});

test("formatGearPersonDisplayName handles missing first name", () => {
  assert.equal(formatGearPersonDisplayName("", "Smith"), "Smith");
});

test("formatGearPersonDisplayName handles missing last name", () => {
  assert.equal(formatGearPersonDisplayName("Alice", ""), "Alice");
});

test("formatGearPersonDisplayName returns placeholder when both names are empty", () => {
  assert.equal(formatGearPersonDisplayName("", ""), "(unnamed)");
});

test("formatGearPersonDisplayName trims whitespace from name parts", () => {
  assert.equal(formatGearPersonDisplayName("  Alice  ", "  Smith  "), "Smith, Alice");
});

// ── buildGearOpsIntegrationAvailability ──────────────────────────────────────

test("buildGearOpsIntegrationAvailability sets available for all active modules", () => {
  const availability = buildGearOpsIntegrationAvailability({
    personModuleActive: true,
    athleteModuleActive: true,
    guardianModuleActive: true,
    teamModuleActive: true,
    eventModuleActive: true,
    taskModuleActive: true,
    noteModuleActive: true,
  });

  assert.equal(availability.personModule, "available");
  assert.equal(availability.athleteModule, "available");
  assert.equal(availability.guardianModule, "available");
  assert.equal(availability.teamModule, "available");
  assert.equal(availability.eventModule, "available");
  assert.equal(availability.taskModule, "available");
  assert.equal(availability.noteModule, "available");
});

test("buildGearOpsIntegrationAvailability always sets communicationModule to deferred", () => {
  const availability = buildGearOpsIntegrationAvailability({
    personModuleActive: true,
    athleteModuleActive: false,
    guardianModuleActive: false,
    teamModuleActive: true,
    eventModuleActive: true,
    taskModuleActive: true,
    noteModuleActive: true,
  });

  assert.equal(availability.communicationModule, "deferred");
});

test("buildGearOpsIntegrationAvailability sets unavailable for inactive modules", () => {
  const availability = buildGearOpsIntegrationAvailability({
    personModuleActive: false,
    athleteModuleActive: false,
    guardianModuleActive: false,
    teamModuleActive: false,
    eventModuleActive: false,
    taskModuleActive: false,
    noteModuleActive: false,
  });

  assert.equal(availability.personModule, "unavailable");
  assert.equal(availability.athleteModule, "unavailable");
  assert.equal(availability.guardianModule, "unavailable");
  assert.equal(availability.teamModule, "unavailable");
  assert.equal(availability.eventModule, "unavailable");
  assert.equal(availability.taskModule, "unavailable");
  assert.equal(availability.noteModule, "unavailable");
});

// ── buildGearOpsStandaloneAvailability ───────────────────────────────────────

test("buildGearOpsStandaloneAvailability marks all modules as unavailable except communications", () => {
  const availability = buildGearOpsStandaloneAvailability();

  assert.equal(availability.personModule, "unavailable");
  assert.equal(availability.athleteModule, "unavailable");
  assert.equal(availability.guardianModule, "unavailable");
  assert.equal(availability.teamModule, "unavailable");
  assert.equal(availability.eventModule, "unavailable");
  assert.equal(availability.taskModule, "unavailable");
  assert.equal(availability.noteModule, "unavailable");
  assert.equal(availability.communicationModule, "deferred");
});

// ── formatGearModuleReferenceStatusMessage ───────────────────────────────────

test("formatGearModuleReferenceStatusMessage returns active message for 'available' status", () => {
  const message = formatGearModuleReferenceStatusMessage("People", "available");
  assert.ok(message.includes("active"), `Expected 'active' in message: '${message}'`);
});

test("formatGearModuleReferenceStatusMessage returns future arc message for 'deferred' status", () => {
  const message = formatGearModuleReferenceStatusMessage("Communications", "deferred");
  assert.ok(message.includes("future arc"), `Expected 'future arc' in message: '${message}'`);
});

test("formatGearModuleReferenceStatusMessage returns unavailability message for 'unavailable' status", () => {
  const message = formatGearModuleReferenceStatusMessage("Events", "unavailable");
  assert.ok(message.includes("not available"), `Expected 'not available' in message: '${message}'`);
});

test("formatGearModuleReferenceStatusMessage includes the module name in the output", () => {
  const message = formatGearModuleReferenceStatusMessage("Guardian", "deferred");
  assert.ok(message.includes("Guardian"), `Expected module name in message: '${message}'`);
});

// ── GearOpsIntegrationContext shape ───────────────────────────────────────────

test("GearPersonReference carries required display name and organizationId fields", () => {
  const ref = {
    personId: "person-123",
    displayName: "Doe, Jane",
    organizationId: "org-abc",
  };

  assert.equal(typeof ref.personId, "string");
  assert.equal(typeof ref.displayName, "string");
  assert.equal(typeof ref.organizationId, "string");
});

test("GearAthleteReference extends GearPersonReference with athlete-specific fields", () => {
  const ref = {
    personId: "athlete-456",
    displayName: "Smith, Bob",
    organizationId: "org-abc",
    isAthlete: true as const,
    hasGuardianOnFile: true,
    guardianPersonIds: ["guardian-789"],
  };

  assert.equal(ref.isAthlete, true);
  assert.equal(ref.hasGuardianOnFile, true);
  assert.ok(Array.isArray(ref.guardianPersonIds));
  assert.equal(ref.guardianPersonIds.length, 1);
});

test("GearAthleteReference without guardian has empty guardianPersonIds", () => {
  const ref = {
    personId: "athlete-111",
    displayName: "Brown, Alex",
    organizationId: "org-abc",
    isAthlete: true as const,
    hasGuardianOnFile: false,
    guardianPersonIds: [],
  };

  assert.equal(ref.hasGuardianOnFile, false);
  assert.equal(ref.guardianPersonIds.length, 0);
});

test("GearEventReference carries startsAt, teamId, and programId fields", () => {
  const ref = {
    eventId: "event-001",
    eventTitle: "Saturday Practice",
    organizationId: "org-abc",
    startsAt: new Date("2026-06-01T09:00:00Z"),
    teamId: "team-001",
    programId: "prog-001",
  };

  assert.ok(ref.startsAt instanceof Date);
  assert.equal(ref.teamId, "team-001");
  assert.equal(ref.programId, "prog-001");
});

test("GearEventReference allows null startsAt, teamId, programId", () => {
  const ref = {
    eventId: "event-002",
    eventTitle: "Open Training",
    organizationId: "org-abc",
    startsAt: null,
    teamId: null,
    programId: null,
  };

  assert.equal(ref.startsAt, null);
  assert.equal(ref.teamId, null);
  assert.equal(ref.programId, null);
});

test("GearGuardianApprovalBoundary not_required has canProceedWithoutApproval true", () => {
  const boundary = {
    required: false,
    reason: "not_required" as const,
    guardianReferences: [],
    canProceedWithoutApproval: true,
    blockerMessage: null,
  };

  assert.equal(boundary.required, false);
  assert.equal(boundary.canProceedWithoutApproval, true);
  assert.equal(boundary.blockerMessage, null);
});

test("GearGuardianApprovalBoundary no_guardian_on_file blocks assignment", () => {
  const boundary = {
    required: true,
    reason: "no_guardian_on_file" as const,
    guardianReferences: [],
    canProceedWithoutApproval: false,
    blockerMessage: "No guardian on file.",
  };

  assert.equal(boundary.required, true);
  assert.equal(boundary.canProceedWithoutApproval, false);
  assert.ok(typeof boundary.blockerMessage === "string");
});

test("GearCrossModuleLink covers all expected fromType values", () => {
  const validFromTypes = [
    "GEAR_ITEM",
    "GEAR_ASSIGNMENT",
    "GEAR_CHECKOUT",
    "GEAR_MAINTENANCE",
    "EVENT_GEAR_PLAN",
  ] as const;

  for (const fromType of validFromTypes) {
    const link = {
      fromType,
      fromId: "from-001",
      toType: "PERSON" as const,
      toId: "to-001",
      organizationId: "org-abc",
      linkLabel: null,
    };
    assert.equal(link.fromType, fromType);
  }
});

test("GearCrossModuleLink covers all expected toType values", () => {
  const validToTypes = ["PERSON", "TEAM", "EVENT", "TASK", "NOTE", "ENTRY"] as const;

  for (const toType of validToTypes) {
    const link = {
      fromType: "GEAR_ITEM" as const,
      fromId: "from-001",
      toType,
      toId: "to-001",
      organizationId: "org-abc",
      linkLabel: null,
    };
    assert.equal(link.toType, toType);
  }
});
