import { strict as assert } from "node:assert";
import test from "node:test";

import { RoleType, ScopeType } from "@prisma/client";

import {
  buildDefaultInboxListResolutionInput,
  buildEntryListVisibilityForActor,
} from "../../lib/entries/lists";

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

test("entry list visibility allows athlete or limited actor to manage own personal lists only", () => {
  assert.deepEqual(
    buildEntryListVisibilityForActor({
      organizationId: "org-1",
      actorPersonId: "athlete-1",
      assignments: [{ roleType: RoleType.ATHLETE, scopeType: ScopeType.ORGANIZATION }],
    }),
    {
      canRead: true,
      canCreatePersonalList: true,
      canManageSharedLists: false,
      where: {
        organizationId: "org-1",
        isArchived: false,
        scope: "PERSONAL",
        ownerPersonId: "athlete-1",
      },
    },
  );

  assert.deepEqual(
    buildEntryListVisibilityForActor({
      organizationId: "org-1",
      actorPersonId: "limited-1",
      assignments: [],
    }).where,
    {
      organizationId: "org-1",
      isArchived: false,
      scope: "PERSONAL",
      ownerPersonId: "limited-1",
    },
  );
});

test("entry list visibility keeps unrelated or unlinked actors out", () => {
  const visibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: null,
    assignments: [],
  });

  assert.equal(visibility.canRead, false);
  assert.equal(visibility.canCreatePersonalList, false);
  assert.equal(visibility.canManageSharedLists, false);
  assert.deepEqual(visibility.where, { id: "__entry_list_no_actor__" });
});

test("entry list visibility allows org admin broad list access", () => {
  assert.deepEqual(
    buildEntryListVisibilityForActor({
      organizationId: "org-1",
      actorPersonId: "admin-1",
      assignments: [{ roleType: RoleType.ORGANIZATION_ADMIN, scopeType: ScopeType.ORGANIZATION }],
    }),
    {
      canRead: true,
      canCreatePersonalList: true,
      canManageSharedLists: true,
      where: { organizationId: "org-1", isArchived: false },
    },
  );
});
