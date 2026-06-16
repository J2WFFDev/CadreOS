import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryStatus, EntryType, EntryVisibility, RoleType, ScopeType } from "@prisma/client";

import {
  canArchiveJournal,
  buildJournalEntryVisibilityWhere,
  buildJournalEntryEditWhere,
  canCreateJournal,
  canEditJournalDraft,
  canReadJournalEntry,
  canReopenJournal,
  canRestoreJournal,
  canSubmitJournal,
  hasJournalAdminAccess,
  type JournalAccessContext,
  type JournalAccessEntry,
} from "../../lib/journals/access";

function buildContext(input?: Partial<JournalAccessContext>): JournalAccessContext {
  return {
    actorPersonId: "actor-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set<string>(),
    ...input,
  };
}

function buildEntry(input?: Partial<JournalAccessEntry>): JournalAccessEntry {
  return {
    id: "journal-1",
    type: EntryType.JOURNAL,
    createdByPersonId: "actor-1",
    status: EntryStatus.OPEN,
    visibility: EntryVisibility.STAFF_ONLY,
    teamId: "team-1",
    teamProgramId: "program-1",
    ...input,
  };
}

test("author can read/edit/submit own draft journal", () => {
  const context = buildContext();
  const entry = buildEntry();

  assert.equal(canReadJournalEntry(context, entry), true);
  assert.equal(canEditJournalDraft(context, entry), true);
  assert.equal(canSubmitJournal(context, entry), true);
});

test("guardian can read linked submitted journal only when guardian visibility policy is enabled", () => {
  const context = buildContext({
    actorPersonId: "guardian-1",
    assignments: [{ roleType: RoleType.PARENT_GUARDIAN, scopeType: ScopeType.ORGANIZATION, teamId: null, programId: null }],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });

  const submittedGuardianVisible = buildEntry({
    createdByPersonId: "athlete-1",
    status: EntryStatus.DONE,
    visibility: EntryVisibility.ORGANIZATION_SCOPED,
  });

  const submittedPrivate = buildEntry({
    createdByPersonId: "athlete-1",
    status: EntryStatus.DONE,
    visibility: EntryVisibility.STAFF_ONLY,
  });

  assert.equal(canReadJournalEntry(context, submittedGuardianVisible), true);
  assert.equal(canReadJournalEntry(context, submittedPrivate), false);
});

test("Guardian relationship permits final Guardian-visible journal access without a direct role assignment", () => {
  const context = buildContext({
    actorPersonId: "guardian-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });

  assert.equal(
    canReadJournalEntry(
      context,
      buildEntry({
        createdByPersonId: "athlete-1",
        status: EntryStatus.DONE,
        visibility: EntryVisibility.ORGANIZATION_SCOPED,
      }),
    ),
    true,
  );
  assert.equal(
    canReadJournalEntry(
      context,
      buildEntry({
        createdByPersonId: "athlete-1",
        status: EntryStatus.OPEN,
        visibility: EntryVisibility.ORGANIZATION_SCOPED,
      }),
    ),
    false,
  );
});

test("coach access requires submitted + team visibility + scoped assignment", () => {
  const context = buildContext({
    actorPersonId: "coach-1",
    assignments: [{ roleType: RoleType.COACH, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null }],
  });

  const submittedScoped = buildEntry({
    createdByPersonId: "athlete-1",
    status: EntryStatus.DONE,
    visibility: EntryVisibility.TEAM_STAFF,
    teamId: "team-1",
  });

  const draftScoped = buildEntry({
    createdByPersonId: "athlete-1",
    status: EntryStatus.OPEN,
    visibility: EntryVisibility.TEAM_STAFF,
    teamId: "team-1",
  });

  const submittedWrongTeam = buildEntry({
    createdByPersonId: "athlete-1",
    status: EntryStatus.DONE,
    visibility: EntryVisibility.TEAM_STAFF,
    teamId: "team-2",
  });

  assert.equal(canReadJournalEntry(context, submittedScoped), true);
  assert.equal(canReadJournalEntry(context, draftScoped), false);
  assert.equal(canReadJournalEntry(context, submittedWrongTeam), false);
});

test("admin override allows read and archive", () => {
  const context = buildContext({
    actorPersonId: "admin-1",
    assignments: [
      {
        roleType: RoleType.ORGANIZATION_ADMIN,
        scopeType: ScopeType.ORGANIZATION,
        teamId: null,
        programId: null,
      },
    ],
  });

  const entry = buildEntry({
    createdByPersonId: "athlete-1",
    status: EntryStatus.OPEN,
  });

  assert.equal(hasJournalAdminAccess(context), true);
  assert.equal(canReadJournalEntry(context, entry), true);
  assert.equal(canArchiveJournal(context, entry), true);
  assert.equal(canRestoreJournal(context, entry), true);
});

test("author can restore archived journal", () => {
  const context = buildContext();
  const entry = buildEntry({ status: EntryStatus.ARCHIVED });

  assert.equal(canEditJournalDraft(context, entry), false);
  assert.equal(canSubmitJournal(context, entry), false);
  assert.equal(canRestoreJournal(context, entry), true);
});

test("reopen is limited to the final journal author or org admin", () => {
  const finalJournal = buildEntry({ status: EntryStatus.DONE });
  const adminContext = buildContext({
    actorPersonId: "admin-1",
    assignments: [
      {
        roleType: RoleType.ORGANIZATION_ADMIN,
        scopeType: ScopeType.ORGANIZATION,
        teamId: null,
        programId: null,
      },
    ],
  });
  const guardianContext = buildContext({
    actorPersonId: "guardian-1",
    linkedGuardianAthleteIds: new Set(["actor-1"]),
  });
  const coachContext = buildContext({
    actorPersonId: "coach-1",
    assignments: [{ roleType: RoleType.COACH, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null }],
  });

  assert.equal(canReopenJournal(buildContext(), finalJournal), true);
  assert.equal(canReopenJournal(adminContext, finalJournal), true);
  assert.equal(canReopenJournal(guardianContext, finalJournal), false);
  assert.equal(canReopenJournal(coachContext, finalJournal), false);
  assert.equal(canReopenJournal(buildContext(), buildEntry({ status: EntryStatus.OPEN })), false);
});

test("reopened Guardian-visible journal becomes hidden from the related athlete's Guardian", () => {
  const guardianContext = buildContext({
    actorPersonId: "guardian-1",
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });

  assert.equal(
    canReadJournalEntry(
      guardianContext,
      buildEntry({
        createdByPersonId: "athlete-1",
        status: EntryStatus.OPEN,
        visibility: EntryVisibility.ORGANIZATION_SCOPED,
      }),
    ),
    false,
  );
});

test("journal creation requires athlete or admin context", () => {
  const athleteContext = buildContext({
    assignments: [{ roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null }],
  });
  const assistantCoachContext = buildContext({
    assignments: [{ roleType: RoleType.ASSISTANT_COACH, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null }],
  });

  assert.equal(canCreateJournal(athleteContext), true);
  assert.equal(canCreateJournal(assistantCoachContext), false);
});

test("journal query visibility does not grant access from team placement alone", () => {
  const athleteContext = buildContext({
    actorPersonId: "athlete-2",
    assignments: [{ roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null }],
  });

  assert.deepEqual(buildJournalEntryVisibilityWhere(athleteContext), {
    type: EntryType.JOURNAL,
    OR: [{ createdByPersonId: "athlete-2" }],
  });
});

test("assignee and active EntryAssignment do not broaden the existing Journal privacy policy", () => {
  const context = buildContext({
    actorPersonId: "athlete-2",
    assignments: [{ roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null }],
  });
  const journal = buildEntry({
    createdByPersonId: "athlete-1",
    status: EntryStatus.OPEN,
  });

  assert.equal(canReadJournalEntry(context, journal), false);
  assert.equal(canEditJournalDraft(context, journal), false);
});

test("journal query visibility preserves submitted guardian and scoped coach restrictions", () => {
  const context = buildContext({
    actorPersonId: "guardian-coach-1",
    assignments: [
      { roleType: RoleType.PARENT_GUARDIAN, scopeType: ScopeType.ORGANIZATION, teamId: null, programId: null },
      { roleType: RoleType.COACH, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });

  assert.deepEqual(buildJournalEntryVisibilityWhere(context), {
    type: EntryType.JOURNAL,
    OR: [
      { createdByPersonId: "guardian-coach-1" },
      {
        status: EntryStatus.DONE,
        visibility: EntryVisibility.TEAM_STAFF,
        OR: [{ teamId: { in: ["team-1"] } }],
      },
      {
        status: EntryStatus.DONE,
        visibility: EntryVisibility.ORGANIZATION_SCOPED,
        createdByPersonId: { in: ["athlete-1"] },
      },
    ],
  });
});

test("journal query visibility allows relationship-linked Guardian context without broadening draft access", () => {
  const context = buildContext({
    actorPersonId: "guardian-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });

  assert.deepEqual(buildJournalEntryVisibilityWhere(context), {
    type: EntryType.JOURNAL,
    OR: [
      { createdByPersonId: "guardian-1" },
      {
        status: EntryStatus.DONE,
        visibility: EntryVisibility.ORGANIZATION_SCOPED,
        createdByPersonId: { in: ["athlete-1"] },
      },
    ],
  });
});

test("journal action query permits only the author while the journal is a draft", () => {
  const context = buildContext({ actorPersonId: "athlete-1" });

  assert.deepEqual(buildJournalEntryEditWhere(context), {
    type: EntryType.JOURNAL,
    status: EntryStatus.OPEN,
    createdByPersonId: "athlete-1",
  });
});
