import assert from "node:assert/strict";
import test from "node:test";

import {
  applyGearCheckoutCreateCustodyRestrictions,
  applyGearCheckoutUpdateCustodyRestrictions,
  buildGearCheckoutCustodyChangeSummary,
  canEditGearCheckoutCustodyPeople,
} from "@/lib/gear-checkout-custody";

test("canEditGearCheckoutCustodyPeople only allows organization admins", () => {
  assert.equal(canEditGearCheckoutCustodyPeople({ isOrganizationAdmin: true }), true);
  assert.equal(canEditGearCheckoutCustodyPeople({ isOrganizationAdmin: false }), false);
});

test("create custody restrictions force issuer attribution for non-admin actors", () => {
  const restricted = applyGearCheckoutCreateCustodyRestrictions({
    canEditCustodyPeople: false,
    actorPersonId: "person-actor",
    issuedById: "person-other",
    receivedById: "person-receiver",
  });

  assert.deepEqual(restricted, {
    issuedById: "person-actor",
    receivedById: "",
  });
});

test("create custody restrictions clear issuer when non-admin actor is unlinked", () => {
  const restricted = applyGearCheckoutCreateCustodyRestrictions({
    canEditCustodyPeople: false,
    actorPersonId: null,
    issuedById: "person-other",
    receivedById: "person-receiver",
  });

  assert.deepEqual(restricted, {
    issuedById: "",
    receivedById: "",
  });
});

test("update custody restrictions preserve existing issuer/receiver for non-admin actors", () => {
  const restricted = applyGearCheckoutUpdateCustodyRestrictions({
    canEditCustodyPeople: false,
    issuedById: "person-other",
    receivedById: "person-other",
    existingIssuedById: "person-original-issuer",
    existingReceivedById: "person-original-receiver",
  });

  assert.deepEqual(restricted, {
    issuedById: "person-original-issuer",
    receivedById: "person-original-receiver",
  });
});

test("buildGearCheckoutCustodyChangeSummary emits transfer details when tracked fields change", () => {
  const summary = buildGearCheckoutCustodyChangeSummary({
    previous: {
      checkedOutById: "athlete-a",
      issuedById: "staff-a",
      receivedById: null,
    },
    next: {
      checkedOutById: "athlete-b",
      issuedById: "staff-a",
      receivedById: "staff-b",
    },
  });

  assert.match(summary ?? "", /checkedOutById athlete-a → athlete-b/);
  assert.match(summary ?? "", /receivedById none → staff-b/);
});

test("buildGearCheckoutCustodyChangeSummary returns null when tracked fields are unchanged", () => {
  const summary = buildGearCheckoutCustodyChangeSummary({
    previous: {
      checkedOutById: "athlete-a",
      issuedById: "staff-a",
      receivedById: "staff-b",
    },
    next: {
      checkedOutById: "athlete-a",
      issuedById: "staff-a",
      receivedById: "staff-b",
    },
  });

  assert.equal(summary, null);
});
