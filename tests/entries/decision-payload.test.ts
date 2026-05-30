import { strict as assert } from "node:assert";
import test from "node:test";

import {
  createEmptyDecisionEntryPayload,
  formatDecisionParticipantNames,
  parseDecisionEntryPayload,
  parseDecisionParticipantNames,
  serializeDecisionEntryPayload,
} from "../../lib/entries/decision-payload";

test("parseDecisionParticipantNames trims, dedupes, and preserves order", () => {
  const parsed = parseDecisionParticipantNames("  Alex  \nJAMIE\nalex\n\n Sam ");
  assert.deepEqual(parsed, ["Alex", "JAMIE", "Sam"]);
});

test("parseDecisionEntryPayload returns defaults for malformed JSON", () => {
  const payload = parseDecisionEntryPayload("{bad");
  assert.deepEqual(payload, createEmptyDecisionEntryPayload());
});

test("parseDecisionEntryPayload normalizes values and invalid options", () => {
  const payload = parseDecisionEntryPayload(
    JSON.stringify({
      decisionStatement: "  Stand up reserve team ",
      decisionDetails: "  Need surge support ",
      decisionMaker: "  Ops Lead ",
      supporters: ["  Alex  ", "", "alex", "Jamie"],
      opposition: ["  Pat ", "pat"],
      classification: "hard",
      decisionDate: "2026-06-01",
      maturityDate: "invalid-date",
      maturityResult: "partially_successful",
      maturityReviewNotes: "  Outcome mixed ",
    }),
  );

  assert.equal(payload.decisionStatement, "Stand up reserve team");
  assert.equal(payload.decisionDetails, "Need surge support");
  assert.equal(payload.decisionMaker, "Ops Lead");
  assert.deepEqual(payload.supporters, ["Alex", "Jamie"]);
  assert.deepEqual(payload.opposition, ["Pat"]);
  assert.equal(payload.classification, "HARD");
  assert.equal(payload.decisionDate, "2026-06-01");
  assert.equal(payload.maturityDate, null);
  assert.equal(payload.maturityResult, "PARTIALLY_SUCCESSFUL");
  assert.equal(payload.maturityReviewNotes, "Outcome mixed");
});

test("serializeDecisionEntryPayload emits stable shape", () => {
  const payload = createEmptyDecisionEntryPayload();
  payload.supporters = ["A", "B"];
  payload.opposition = ["C"];
  payload.classification = "SOFT";

  const serialized = serializeDecisionEntryPayload(payload);
  const parsed = parseDecisionEntryPayload(serialized);

  assert.deepEqual(parsed, payload);
  assert.equal(formatDecisionParticipantNames(parsed.supporters), "A\nB");
});
