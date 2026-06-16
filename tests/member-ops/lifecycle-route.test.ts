import { strict as assert } from "node:assert";
import test from "node:test";
import { MemberLifecycleStatus } from "@prisma/client";

import { MEMBER_LIFECYCLE_STATUS_LABELS } from "../../lib/member-ops";
import {
  buildMemberLifecycleStatusCounts,
  formatLifecycleStatusSummary,
  MEMBER_LIFECYCLE_STATUS_ORDER,
  resolveMemberLifecycleFilter,
} from "../../lib/member-ops-lifecycle";

test("ARC-MEMBER-04: lifecycle status order follows existing MemberOps labels", () => {
  assert.deepEqual(MEMBER_LIFECYCLE_STATUS_ORDER, [
    MemberLifecycleStatus.PROSPECT,
    MemberLifecycleStatus.APPLICANT,
    MemberLifecycleStatus.ACTIVE,
    MemberLifecycleStatus.INACTIVE,
    MemberLifecycleStatus.FORMER,
    MemberLifecycleStatus.ARCHIVED,
    MemberLifecycleStatus.ALUMNI,
  ]);

  for (const status of MEMBER_LIFECYCLE_STATUS_ORDER) {
    assert.equal(typeof MEMBER_LIFECYCLE_STATUS_LABELS[status], "string");
    assert.ok(MEMBER_LIFECYCLE_STATUS_LABELS[status].length > 0);
  }
});

test("ARC-MEMBER-04: lifecycle filter falls back to all for unknown statuses", () => {
  assert.equal(resolveMemberLifecycleFilter("ACTIVE"), MemberLifecycleStatus.ACTIVE);
  assert.equal(resolveMemberLifecycleFilter("all"), "all");
  assert.equal(resolveMemberLifecycleFilter("not-a-status"), "all");
  assert.equal(resolveMemberLifecycleFilter(undefined), "all");
});

test("ARC-MEMBER-04: lifecycle counts include zero-count existing statuses", () => {
  const counts = buildMemberLifecycleStatusCounts([
    MemberLifecycleStatus.ACTIVE,
    MemberLifecycleStatus.ACTIVE,
    MemberLifecycleStatus.PROSPECT,
  ]);

  assert.equal(counts.ACTIVE, 2);
  assert.equal(counts.PROSPECT, 1);
  assert.equal(counts.APPLICANT, 0);
  assert.equal(counts.INACTIVE, 0);
  assert.equal(counts.FORMER, 0);
  assert.equal(counts.ARCHIVED, 0);
  assert.equal(counts.ALUMNI, 0);
});

test("ARC-MEMBER-04: lifecycle summary is read-only overview text", () => {
  const counts = buildMemberLifecycleStatusCounts([
    MemberLifecycleStatus.ACTIVE,
    MemberLifecycleStatus.APPLICANT,
  ]);

  assert.equal(
    formatLifecycleStatusSummary(counts),
    "Prospect 0 · Applicant 1 · Active Member 1 · Inactive Member 0 · Former Member 0 · Former Member (Archived) 0 · Alumni 0",
  );
});
