import { strict as assert } from "node:assert";
import test from "node:test";

import { buildGearOpsStandaloneContext } from "../../lib/gear-ops-integration/context";

test("buildGearOpsStandaloneContext returns safe fallback context for unavailable integrations", () => {
  const context = buildGearOpsStandaloneContext({
    organizationId: "org-001",
    gearItemId: "gear-001",
  });

  assert.equal(context.organizationId, "org-001");
  assert.equal(context.gearItemId, "gear-001");
  assert.equal(context.assignedPerson, null);
  assert.equal(context.assignedTeam, null);
  assert.equal(context.assignedEvent, null);
  assert.equal(context.athleteReference, null);
  assert.equal(context.guardianApprovalRequired, false);
  assert.deepEqual(context.guardianReferences, []);
  assert.deepEqual(context.linkedTasks, []);
  assert.deepEqual(context.linkedNotes, []);
  assert.equal(context.integrationAvailability.personModule, "unavailable");
  assert.equal(context.integrationAvailability.athleteModule, "unavailable");
  assert.equal(context.integrationAvailability.guardianModule, "unavailable");
  assert.equal(context.integrationAvailability.teamModule, "unavailable");
  assert.equal(context.integrationAvailability.eventModule, "unavailable");
  assert.equal(context.integrationAvailability.taskModule, "unavailable");
  assert.equal(context.integrationAvailability.noteModule, "unavailable");
  assert.equal(context.integrationAvailability.communicationModule, "deferred");
});
