import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryType } from "@prisma/client";

import { getEntryDetailConfig } from "../../lib/entries/detail-config";

test("decision detail config uses decision-specific labels and date field", () => {
  const config = getEntryDetailConfig(EntryType.DECISION);

  assert.equal(config.titleLabel, "Decision statement");
  assert.equal(config.contentLabel, "Context / Rationale");
  assert.equal(config.statusLabel, "Decision status");
  assert.equal(config.metadataDateLabel, "Effective date");
  assert.equal(config.dateFieldLabel, "Effective / Decision Date");
  assert.match(config.guidance ?? "", /decision statement/i);
});

test("task detail config preserves due-date editing", () => {
  const config = getEntryDetailConfig(EntryType.TASK);

  assert.equal(config.titleLabel, "Title");
  assert.equal(config.contentLabel, "Content");
  assert.equal(config.statusLabel, "Status");
  assert.equal(config.metadataDateLabel, "Due");
  assert.equal(config.dateFieldLabel, "Due date");
});
