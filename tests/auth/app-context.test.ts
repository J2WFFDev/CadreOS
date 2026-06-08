import { strict as assert } from "node:assert";
import test from "node:test";

import { buildEffectiveAppRoles } from "../../lib/auth/app-context";

test("linked member without direct or guardian roles receives safe base app access", () => {
  assert.deepEqual(
    buildEffectiveAppRoles({
      directRoles: [],
      hasGuardianDependentScope: false,
    }),
    ["LIMITED_VIEWER"],
  );
});

test("guardian relationship derives Guardian app access without a fake direct assignment", () => {
  assert.deepEqual(
    buildEffectiveAppRoles({
      directRoles: [],
      hasGuardianDependentScope: true,
    }),
    ["GUARDIAN"],
  );
});

test("direct roles stay independent when guardian access is derived", () => {
  assert.deepEqual(
    buildEffectiveAppRoles({
      directRoles: ["COACH"],
      hasGuardianDependentScope: true,
    }),
    ["COACH", "GUARDIAN"],
  );
});
