import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryStatus, EntryType, EntryVisibility, RoleType, ScopeType } from "@prisma/client";

import {
  canArchiveJournal,
  canCreateJournal,
  canEditJournalDraft,
  canReadJournalEntry,
  canReadJournalVersionHistory,
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
  assert.equal(canReadJournalVersionHistory(context, submittedGuardianVisible), false);
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
  assert.equal(canReadJournalVersionHistory(context, submittedScoped), false);
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
  assert.equal(canReadJournalVersionHistory(context, entry), true);
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

test("author can read own journal version history", () => {
  const context = buildContext({ actorPersonId: "athlete-1" });
  const entry = buildEntry({ createdByPersonId: "athlete-1", status: EntryStatus.DONE, visibility: EntryVisibility.ORGANIZATION_SCOPED });
  assert.equal(canReadJournalVersionHistory(context, entry), true);
});
