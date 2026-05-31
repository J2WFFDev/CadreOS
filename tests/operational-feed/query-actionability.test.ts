import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildActionableWhere,
  hasDecisionScheduleSignalForMyWork,
  hasEventScheduleSignalForMyWork,
} from "../../lib/operational-feed/queries";

test("buildActionableWhere scopes journals to IN_PROGRESS in My Work filters", () => {
  const where = buildActionableWhere(null, true) as { OR: Array<Record<string, unknown>> };
  const journalBranch = where.OR.find((branch) => branch.type === "JOURNAL");

  assert.ok(journalBranch);
  assert.equal(journalBranch?.status, "IN_PROGRESS");
});

test("buildActionableWhere includes scheduled-signal payload checks for events and decisions", () => {
  const window = {
    from: new Date("2026-06-01T00:00:00.000Z"),
    to: new Date("2026-06-08T00:00:00.000Z"),
  };
  const where = buildActionableWhere(window, true) as { OR: Array<Record<string, unknown>> };
  const eventBranch = where.OR.find((branch) => branch.type === "EVENT") as { OR: unknown[] } | undefined;
  const decisionBranch = where.OR.find((branch) => branch.type === "DECISION") as { OR: unknown[] } | undefined;

  assert.ok(eventBranch);
  assert.ok(decisionBranch);
  assert.ok(eventBranch.OR.length >= 4, "Event branch should include due/start/end plus payload signal checks");
  assert.ok(decisionBranch.OR.length >= 4, "Decision branch should include due/start/end plus payload signal checks");
});

test("hasEventScheduleSignalForMyWork detects scheduled events from start/end fields and payload", () => {
  const window = {
    from: new Date("2026-06-10T00:00:00.000Z"),
    to: new Date("2026-06-11T00:00:00.000Z"),
  };

  assert.equal(
    hasEventScheduleSignalForMyWork(
      {
        dueDate: null,
        startDate: new Date("2026-06-10T14:00:00.000Z"),
        endDate: null,
        eventPayloadJson: null,
      },
      window,
    ),
    true,
  );

  assert.equal(
    hasEventScheduleSignalForMyWork(
      {
        dueDate: null,
        startDate: null,
        endDate: null,
        eventPayloadJson: JSON.stringify({ startDateTimeLocal: "2026-06-10T09:00" }),
      },
      window,
    ),
    true,
  );
});

test("hasEventScheduleSignalForMyWork hides unscheduled events", () => {
  assert.equal(
    hasEventScheduleSignalForMyWork(
      {
        dueDate: null,
        startDate: null,
        endDate: null,
        eventPayloadJson: null,
      },
      null,
    ),
    false,
  );
});

test("hasDecisionScheduleSignalForMyWork detects maturity/review signals from payload dates", () => {
  const upcomingWindow = {
    from: new Date("2026-06-01T00:00:00.000Z"),
    to: new Date("2026-06-08T00:00:00.000Z"),
  };

  assert.equal(
    hasDecisionScheduleSignalForMyWork(
      {
        dueDate: null,
        decisionPayloadJson: JSON.stringify({ maturityDate: "2026-06-03" }),
      },
      upcomingWindow,
    ),
    true,
  );

  assert.equal(
    hasDecisionScheduleSignalForMyWork(
      {
        dueDate: null,
        decisionPayloadJson: JSON.stringify({ maturityDate: "2026-07-15" }),
      },
      upcomingWindow,
    ),
    false,
  );
});
