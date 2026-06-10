import { strict as assert } from "node:assert";
import test from "node:test";

import {
  canManageOwnEntryLifecycle,
  resolveEntryLifecycleAccess,
} from "../../lib/entries/lifecycle-access";

test("Entry creator can manage their own archive and restore lifecycle", () => {
  assert.equal(
    canManageOwnEntryLifecycle({
      actorPersonId: "athlete-1",
      entry: { createdByPersonId: "athlete-1" },
    }),
    true,
  );
});

test("assignee-only or unrelated actors do not gain creator lifecycle access", () => {
  assert.equal(
    canManageOwnEntryLifecycle({
      actorPersonId: "assignee-1",
      entry: { createdByPersonId: "creator-1" },
    }),
    false,
  );
  assert.equal(
    canManageOwnEntryLifecycle({
      actorPersonId: null,
      entry: { createdByPersonId: "creator-1" },
    }),
    false,
  );
});

test("existing elevated permission remains an independent lifecycle path", () => {
  assert.equal(
    resolveEntryLifecycleAccess({
      actorPersonId: "admin-1",
      entry: { createdByPersonId: "creator-1" },
      hasElevatedPermission: true,
    }),
    true,
  );
  assert.equal(
    resolveEntryLifecycleAccess({
      actorPersonId: "unrelated-1",
      entry: { createdByPersonId: "creator-1" },
      hasElevatedPermission: false,
    }),
    false,
  );
});
