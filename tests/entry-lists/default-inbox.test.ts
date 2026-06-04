import { strict as assert } from "node:assert";
import test from "node:test";

import { buildDefaultInboxListResolutionInput } from "../../lib/entries/lists";

test("buildDefaultInboxListResolutionInput prefers team Inbox when team scope is present", () => {
  assert.deepEqual(
    buildDefaultInboxListResolutionInput({
      organizationId: "org-1",
      actorPersonId: "person-1",
      teamId: "team-1",
    }),
    {
      scope: "TEAM",
      organizationId: "org-1",
      teamId: "team-1",
    },
  );
});

test("buildDefaultInboxListResolutionInput uses personal Inbox for actor-scoped entries", () => {
  assert.deepEqual(
    buildDefaultInboxListResolutionInput({
      organizationId: "org-1",
      actorPersonId: "person-1",
    }),
    {
      scope: "PERSONAL",
      organizationId: "org-1",
      ownerPersonId: "person-1",
    },
  );
});

test("buildDefaultInboxListResolutionInput falls back to organization Inbox without actor or team", () => {
  assert.deepEqual(
    buildDefaultInboxListResolutionInput({
      organizationId: "org-1",
      actorPersonId: null,
      teamId: null,
    }),
    {
      scope: "ORGANIZATION",
      organizationId: "org-1",
    },
  );
});
