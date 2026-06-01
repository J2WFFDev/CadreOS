import { strict as assert } from "node:assert";
import test from "node:test";

import { wouldCreateCycleFromEdges } from "../../lib/gear-assembly";

test("wouldCreateCycleFromEdges: rejects direct self-parent relationship", () => {
  assert.equal(
    wouldCreateCycleFromEdges({
      parentGearItemId: "A",
      childGearItemId: "A",
      edges: [],
    }),
    true,
  );
});

test("wouldCreateCycleFromEdges: rejects relationship when child already reaches parent", () => {
  assert.equal(
    wouldCreateCycleFromEdges({
      parentGearItemId: "A",
      childGearItemId: "B",
      edges: [
        { parentGearItemId: "B", childGearItemId: "C" },
        { parentGearItemId: "C", childGearItemId: "A" },
      ],
    }),
    true,
  );
});

test("wouldCreateCycleFromEdges: allows acyclic parent-child relationship", () => {
  assert.equal(
    wouldCreateCycleFromEdges({
      parentGearItemId: "A",
      childGearItemId: "D",
      edges: [
        { parentGearItemId: "A", childGearItemId: "B" },
        { parentGearItemId: "B", childGearItemId: "C" },
      ],
    }),
    false,
  );
});
