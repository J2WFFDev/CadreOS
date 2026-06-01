import assert from "node:assert/strict";
import { test } from "node:test";

import { Prisma } from "@prisma/client";

import {
  MEMBEROPS_LIFECYCLE_HOUSEHOLD_MIGRATION_NAME,
  MEMBEROPS_QUALIFICATIONS_MIGRATION_NAME,
  formatMemberOpsOptionalFeatureUnavailableMessage,
  formatMemberOpsPeopleSetupIncompleteMessage,
  getMemberOpsPeopleSchemaIssue,
} from "../../lib/member-ops-schema-guard";

function createKnownRequestError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `Prisma error ${code}`,
    {
      code,
      clientVersion: "test",
      meta,
    },
  );
}

test("getMemberOpsPeopleSchemaIssue detects missing lifecycle columns", () => {
  const issue = getMemberOpsPeopleSchemaIssue(
    createKnownRequestError("P2022", { column: "Person.lifecycleStatusChangedAt" }),
  );

  assert.deepEqual(issue?.missing, ["Person.lifecycleStatusChangedAt"]);
  assert.equal(issue?.detail, "Missing database column: Person.lifecycleStatusChangedAt");
  assert.deepEqual(issue?.migrations, [MEMBEROPS_LIFECYCLE_HOUSEHOLD_MIGRATION_NAME]);
});

test("getMemberOpsPeopleSchemaIssue detects missing qualification tables", () => {
  const issue = getMemberOpsPeopleSchemaIssue(
    createKnownRequestError("P2021", { table: "public.PersonQualification" }),
  );

  assert.deepEqual(issue?.missing, ["PersonQualification"]);
  assert.equal(issue?.detail, "Missing database table: public.PersonQualification");
  assert.deepEqual(issue?.migrations, [MEMBEROPS_QUALIFICATIONS_MIGRATION_NAME]);
});

test("getMemberOpsPeopleSchemaIssue detects missing guardian enum from error text", () => {
  const issue = getMemberOpsPeopleSchemaIssue(new Error('type "GuardianRelationshipRole" does not exist'));

  assert.deepEqual(issue?.missing, ["GuardianRelationshipRole"]);
  assert.equal(issue?.detail, "Missing database enum: GuardianRelationshipRole");
  assert.deepEqual(issue?.migrations, [MEMBEROPS_LIFECYCLE_HOUSEHOLD_MIGRATION_NAME]);
});

test("formatMemberOpsPeopleSetupIncompleteMessage references manual setup and migration names", () => {
  const issue = getMemberOpsPeopleSchemaIssue(
    createKnownRequestError("P2021", { table: "public.PersonQualification" }),
  );

  assert.equal(
    formatMemberOpsPeopleSetupIncompleteMessage(issue!),
    `MemberOps People setup is incomplete in this environment. Missing database table: public.PersonQualification. Run Manual DB Setup to apply ${MEMBEROPS_QUALIFICATIONS_MIGRATION_NAME}.`,
  );
});

test("formatMemberOpsOptionalFeatureUnavailableMessage keeps optional sections non-fatal", () => {
  const issue = getMemberOpsPeopleSchemaIssue(
    createKnownRequestError("P2021", { table: "public.PersonCertification" }),
  );

  assert.equal(
    formatMemberOpsOptionalFeatureUnavailableMessage("Qualification and certification summaries", issue!),
    `Qualification and certification summaries are temporarily unavailable because setup is incomplete. Missing database table: public.PersonCertification. Run Manual DB Setup to apply ${MEMBEROPS_QUALIFICATIONS_MIGRATION_NAME}.`,
  );
});

test("getMemberOpsPeopleSchemaIssue ignores unrelated schema failures", () => {
  const issue = getMemberOpsPeopleSchemaIssue(createKnownRequestError("P2021", { table: "public.Team" }));

  assert.equal(issue, null);
});
