import { strict as assert } from "node:assert";
import test from "node:test";

import { validateInventoryLocationFields } from "../../lib/inventory-ops/location-validation";

test("validateInventoryLocationFields requires location name", () => {
  const errors = validateInventoryLocationFields({
    name: "",
    locationCode: "",
    description: "",
  });

  assert.equal(errors.name, "Location name is required.");
});

test("validateInventoryLocationFields enforces max lengths", () => {
  const errors = validateInventoryLocationFields({
    name: "a".repeat(121),
    locationCode: "b".repeat(21),
    description: "c".repeat(501),
  });

  assert.equal(errors.name, "Location name must be 120 characters or less.");
  assert.equal(errors.locationCode, "Location code must be 20 characters or less.");
  assert.equal(errors.description, "Description must be 500 characters or less.");
});

test("validateInventoryLocationFields accepts valid values", () => {
  const errors = validateInventoryLocationFields({
    name: "Main Vault",
    locationCode: "VAULT-01",
    description: "Primary secured storage.",
  });

  assert.deepEqual(errors, {});
});

